import { getAssetPath } from '../utils/assetUtils';

// Shared, session-wide loader + cache for hanzi-writer stroke data.
//
// Previously KanjiWriterCanvas cached only a single character per instance and
// reset it on every character change, so each new kanji (and the sample layer)
// re-fetched + re-parsed its JSON. This module keeps one persistent in-memory
// cache for the whole app and exposes preloadCharData() so a stage's / practice
// set's kanji can be fetched in parallel up front — making the canvas appear
// instantly instead of waiting on a per-character round-trip.

// Matches hanzi-writer's CharacterJson shape so it can be passed to
// HanziWriter's charDataLoader without casts.
export interface CharData {
    strokes: string[];
    medians: number[][][];
    [key: string]: unknown;
}

const cache = new Map<string, CharData>();
const inflight = new Map<string, Promise<CharData | null>>();

// Local bundle first (instant, same-origin), then JA/CN CDN fallbacks.
const sourcesFor = (char: string): string[] => {
    const e = encodeURIComponent(char);
    return [
        getAssetPath(`/kanji-data/${e}.json`),
        `https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0.1.0/${e}.json`,
        `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${e}.json`,
        `https://raw.githubusercontent.com/mnako/hanzi-writer-data-ja/master/data/${e}.json`,
    ];
};

/** Synchronous cache lookup (returns undefined if not loaded yet). */
export const getCachedCharData = (char: string): CharData | undefined => cache.get(char);

/** Load (and cache) stroke data for one character. De-dupes concurrent calls. */
export const loadCharData = (char: string): Promise<CharData | null> => {
    const cached = cache.get(char);
    if (cached) return Promise.resolve(cached);

    const pending = inflight.get(char);
    if (pending) return pending;

    const p = (async (): Promise<CharData | null> => {
        for (const url of sourcesFor(char)) {
            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                const data = await res.json();
                if (data && data.strokes) {
                    cache.set(char, data);
                    return data;
                }
            } catch {
                // try next source
            }
        }
        console.warn(`No stroke data available for: ${char}`);
        return null;
    })();

    inflight.set(char, p);
    p.finally(() => inflight.delete(char));
    return p;
};

/**
 * Preload stroke data for a set of characters (e.g. all kanji in a stage or
 * practice set) in parallel so the writing canvas renders with no wait.
 */
export const preloadCharData = (chars: string[]): Promise<void> =>
    Promise.all([...new Set(chars)].map((c) => loadCharData(c).catch(() => null))).then(() => undefined);
