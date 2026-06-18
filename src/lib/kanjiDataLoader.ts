// Local loader + preloader for hanzi-writer stroke data.
//
// By default hanzi-writer fetches each character's stroke JSON from a CDN the
// moment it is rendered, which makes the writing canvas appear slowly / flicker
// when a new kanji shows up. The JSON for every kanji used in the game is
// bundled under public/kanji-data/, and this module loads it from the same
// origin and caches it in memory so it can be prepared *before* a stage starts.

// hanzi-writer character data shape.
export interface CharData {
    strokes: string[];
    medians: number[][][];
}

const cache = new Map<string, CharData>();
const inflight = new Map<string, Promise<CharData>>();

const dataUrl = (char: string) =>
    `${import.meta.env.BASE_URL}kanji-data/${encodeURIComponent(char)}.json`;

/** Returns already-loaded stroke data synchronously, or undefined if not cached. */
export const getCachedCharData = (char: string): CharData | undefined => cache.get(char);

/** Loads (and caches) stroke data for a single character from the local origin. */
export const loadCharData = (char: string): Promise<CharData> => {
    const cached = cache.get(char);
    if (cached) return Promise.resolve(cached);

    const pending = inflight.get(char);
    if (pending) return pending;

    const p = fetch(dataUrl(char))
        .then((res) => {
            if (!res.ok) throw new Error(`Failed to load stroke data for "${char}" (${res.status})`);
            return res.json() as Promise<CharData>;
        })
        .then((data) => {
            cache.set(char, data);
            inflight.delete(char);
            return data;
        })
        .catch((err) => {
            inflight.delete(char);
            throw err;
        });

    inflight.set(char, p);
    return p;
};

/**
 * Preloads stroke data for a set of characters (e.g. all kanji in a stage) so
 * the writing canvas can render instantly with no network round-trip. Failures
 * are swallowed: the canvas's charDataLoader will retry/fetch on demand.
 */
export const preloadCharData = (chars: string[]): Promise<void> =>
    Promise.all(chars.map((c) => loadCharData(c).catch(() => undefined))).then(() => undefined);
