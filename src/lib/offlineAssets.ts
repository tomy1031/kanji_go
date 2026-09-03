import { MONSTER_DB } from './evolutionUtils';
import { getAssetPath } from '../utils/assetUtils';

// Everything the game needs to be playable with no network.
// Kept in one place so both the boot splash and the explicit
// "download for offline" action agree on what "ready" means.

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

/**
 * How many of `urls` are already in the Cache Storage.
 *
 * The old implementation awaited `caches.keys()` + a `cache.match()` for every
 * asset one at a time (~1000 serial round trips) on EVERY launch, which is what
 * made the game look like it was re-downloading each time. This opens each
 * cache once and matches in parallel.
 */
export const countCached = async (urls: string[]): Promise<number> => {
    if (!('caches' in window)) return 0;
    try {
        const names = await caches.keys();
        const caches_ = await Promise.all(names.map((n) => caches.open(n)));
        const results = await Promise.all(
            urls.map(async (url) => {
                for (const c of caches_) {
                    if (await c.match(url)) return true;
                }
                return false;
            })
        );
        return results.filter(Boolean).length;
    } catch {
        return 0;
    }
};

/**
 * Fetch assets so the service worker's runtime caching stores them.
 *
 * Audio MUST be fetched with GET: the previous code used HEAD, which Workbox's
 * routes ignore, so no music was ever cached and it re-streamed every session.
 */
export const warmAssets = async (
    urls: string[],
    onProgress?: (done: number, total: number) => void,
    shouldStop?: () => boolean
): Promise<void> => {
    const total = urls.length;
    let done = 0;
    const CONCURRENCY = 6;
    let cursor = 0;

    const worker = async () => {
        while (cursor < urls.length) {
            if (shouldStop?.()) return;
            const url = urls[cursor++];
            try {
                await fetch(url, { cache: 'force-cache' });
            } catch {
                // keep going — a missing asset must not block the rest
            }
            done++;
            onProgress?.(done, total);
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
};
