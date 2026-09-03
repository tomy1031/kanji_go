import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { allAssets, countCached, warmAssets } from '../lib/offlineAssets';

interface AssetPreloaderProps {
    onComplete: () => void;
    children: React.ReactNode;
}

/**
 * Boot splash.
 *
 * It no longer blocks on downloading ~85MB of art before the child can play:
 * the app starts as soon as the cache has been checked (one fast parallel
 * pass), and anything still missing is warmed quietly in the background.
 * Full offline preparation is an explicit action in the main menu instead.
 */
const AssetPreloader: React.FC<AssetPreloaderProps> = ({ onComplete, children }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const stoppedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const boot = async () => {
            const urls = allAssets();
            const cached = await countCached(urls);
            if (cancelled) return;

            // Start the game immediately either way.
            setIsLoaded(true);
            onComplete();

            // Quietly top up whatever is missing, without blocking play.
            if (cached < urls.length) {
                void warmAssets(urls, undefined, () => stoppedRef.current);
            }
        };

        // Never let a slow/broken Cache API keep the child on the splash.
        const failsafe = setTimeout(() => {
            if (!cancelled) {
                setIsLoaded(true);
                onComplete();
            }
        }, 2500);

        boot().finally(() => clearTimeout(failsafe));

        return () => {
            cancelled = true;
            stoppedRef.current = true;
            clearTimeout(failsafe);
        };
    }, [onComplete]);

    if (isLoaded) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center z-50">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
            >
                <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 drop-shadow-lg">
                    KanjiGo!
                </h1>
                <p className="text-gray-400 mt-3 text-sm">よみこみ中…</p>
            </motion.div>

            <motion.div
                className="mt-8"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            >
                <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full" />
            </motion.div>
        </div>
    );
};

export default AssetPreloader;
