import { MONSTER_DB } from './evolutionUtils';
import { getAssetPath } from '../utils/assetUtils';

// Everything the game needs to be playable with no network.
//
// Warming writes straight into the same Cache Storage buckets the service
// worker's runtime routes read from (`image-cache` / `audio-cache`), instead of
// relying on the SW intercepting our fetches. That removes the timing
// dependency on the SW being installed and in control, and — crucially — lets
// us VERIFY each asset landed, so the progress bar can no longer reach 100%
// while nothing was actually stored.

const IMAGE_CACHE = 'image-cache';
const AUDIO_CACHE = 'audio-cache';

const BACKGROUNDS = [
    'bg_n3', 'bg_n4', 'bg_n5',
    'title_blue', 'title_green', 'title_red',
    'main_menu', 'practice_dojo',
];

const TEXTURES = ['wood-pattern', 'circuit-board'];

const MUSIC = [
    'red-opening', 'green-opening', 'blue-opening',
    'red-battle', 'green-battle', 'blue-battle',
    'red-field', 'green-field', 'blue-field',
    'boss', 'practice',
];

const isAudio = (url: string) => /\.(mp3|ogg|wav)(\?|$)/.test(url);
const cacheNameFor = (url: string) => (isAudio(url) ? AUDIO_CACHE : IMAGE_CACHE);

/** Monster art — de-duplicated (ENEMY_DB is a subset of MONSTER_DB). */
export const imageAssets = (): string[] => [
    ...new Set([
        ...Object.values(MONSTER_DB).map((m) => m.imagePath || getAssetPath(`/monsters/${m.id}.png`)),
        ...BACKGROUNDS.map((b) => getAssetPath(`/backgrounds/${b}.png`)),
        ...TEXTURES.map((t) => getAssetPath(`/textures/${t}.png`)),
    ]),
];

export const audioAssets = (): string[] => [
    ...MUSIC.map((m) => getAssetPath(`/music/${m}.mp3`)),
    getAssetPath('/sfx/boss_siren.mp3'),
];

export const allAssets = (): string[] => [...imageAssets(), ...audioAssets()];

export interface WarmResult {
    stored: number;
    failed: string[];
}

const cacheSupported = () => typeof caches !== 'undefined';

/** Which of `urls` are already stored (checked against their own bucket). */
export const listMissing = async (urls: string[]): Promise<string[]> => {
    if (!cacheSupported()) return urls;
    try {
        const [img, audio] = await Promise.all([
            caches.open(IMAGE_CACHE),
            caches.open(AUDIO_CACHE),
        ]);
        const results = await Promise.all(
            urls.map(async (url) => {
                const c = cacheNameFor(url) === AUDIO_CACHE ? audio : img;
                return (await c.match(url)) ? null : url;
            })
        );
        return results.filter((u): u is string => u !== null);
    } catch {
        return urls;
    }
};

export const countCached = async (urls: string[]): Promise<number> =>
    urls.length - (await listMissing(urls)).length;

/**
 * Download assets into the SW's caches, verifying each one.
 *
 * Previously this counted a URL as "done" even when the fetch threw, so a
 * failed run still displayed 100%. Now only verified writes count, failures are
 * returned so they can be retried, and anything already cached is skipped
 * (making a repeat run fast and resumable).
 */
export const warmAssets = async (
    urls: string[],
    onProgress?: (done: number, total: number) => void,
    shouldStop?: () => boolean
): Promise<WarmResult> => {
    if (!cacheSupported()) return { stored: 0, failed: [...urls] };

    const missing = await listMissing(urls);
    const alreadyThere = urls.length - missing.length;
    const total = urls.length;
    let done = alreadyThere;
    onProgress?.(done, total);

    if (missing.length === 0) return { stored: 0, failed: [] };

    const [imgCache, audioCache] = await Promise.all([
        caches.open(IMAGE_CACHE),
        caches.open(AUDIO_CACHE),
    ]);

    const failed: string[] = [];
    let stored = 0;
    let cursor = 0;
    // Modest concurrency: phones choke (and time out) on many parallel
    // multi-megabyte downloads, which is what made runs "fail" mid-way.
    const CONCURRENCY = 3;
    const ATTEMPTS = 3;

    const fetchOne = async (url: string): Promise<boolean> => {
        const cache = cacheNameFor(url) === AUDIO_CACHE ? audioCache : imgCache;
        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
            if (shouldStop?.()) return false;
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) {
                    // A 404 will never succeed — don't burn retries on it.
                    if (res.status === 404) return false;
                    throw new Error(String(res.status));
                }
                await cache.put(url, res.clone());
                // Verify it really landed before counting it.
                if (await cache.match(url)) return true;
            } catch {
                // fall through to retry
            }
            if (attempt < ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            }
        }
        return false;
    };

    const worker = async () => {
        while (cursor < missing.length) {
            if (shouldStop?.()) return;
            const url = missing[cursor++];
            const ok = await fetchOne(url);
            if (ok) stored++;
            else failed.push(url);
            done++;
            onProgress?.(done, total);
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return { stored, failed };
};
