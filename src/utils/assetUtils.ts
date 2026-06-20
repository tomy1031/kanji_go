/**
 * Resolves the correct path for assets, accounting for the base URL
 * when deployed to subdirectories (like GitHub Pages).
 */
export const getAssetPath = (path: string): string => {
    // If path is already absolute (starts with http/https), return as is
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    // Remove leading slash if present to avoid double slashes with BASE_URL
    let cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // Get Base URL
    let baseUrl = import.meta.env.BASE_URL;

    // Fallback for GitHub Pages if BASE_URL is '/' in production
    if (import.meta.env.PROD && baseUrl === '/') {
        baseUrl = '/kanji_go/';
    }

    // Ensure baseUrl ends with /
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    // Ensure baseUrl starts with /
    if (!baseUrl.startsWith('/')) baseUrl = '/' + baseUrl;

    // Prevent double base injection
    // If baseUrl is '/kanji_go/' and path already starts with 'kanji_go/', strip it from path
    const baseName = baseUrl.replace(/^\/|\/$/g, ''); // e.g. 'kanji_go'
    if (baseName && cleanPath.startsWith(`${baseName}/`)) {
        cleanPath = cleanPath.slice(baseName.length + 1);
    }

    return `${baseUrl}${cleanPath}`;
};
