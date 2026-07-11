import { useEffect, useState } from 'react';

// Writing-canvas size that fits both narrow AND short screens.
// Width: leave room for the frame/padding. Height: cap by a fraction of the
// viewport so the canvas never pushes HUD/controls off-screen on small phones.
const compute = (maxSize: number, heightRatio: number): number => {
    const byWidth = window.innerWidth - 64;
    const byHeight = Math.floor(window.innerHeight * heightRatio);
    return Math.max(180, Math.min(maxSize, byWidth, byHeight));
};

export const useCanvasSize = (maxSize = 300, heightRatio = 0.4): number => {
    const [size, setSize] = useState(() => compute(maxSize, heightRatio));

    useEffect(() => {
        const onResize = () => setSize(compute(maxSize, heightRatio));
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
        };
    }, [maxSize, heightRatio]);

    return size;
};
