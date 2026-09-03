import { useEffect, useState } from 'react';

// Writing-canvas size that fits both narrow AND short screens.
// Width: leave room for the frame/padding. Height: cap by a fraction of the
// viewport so the canvas never pushes HUD/controls off-screen on small phones.
const compute = (maxSize: number, heightRatio: number, widthMargin: number): number => {
    const byWidth = window.innerWidth - widthMargin;
    const byHeight = Math.floor(window.innerHeight * heightRatio);
    return Math.max(160, Math.min(maxSize, byWidth, byHeight));
};

/**
 * @param widthMargin horizontal space reserved for padding and anything sitting
 *                    beside the canvas (e.g. the battle hint button column).
 */
export const useCanvasSize = (maxSize = 300, heightRatio = 0.4, widthMargin = 64): number => {
    const [size, setSize] = useState(() => compute(maxSize, heightRatio, widthMargin));

    useEffect(() => {
        const onResize = () => setSize(compute(maxSize, heightRatio, widthMargin));
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
        };
    }, [maxSize, heightRatio, widthMargin]);

    return size;
};
