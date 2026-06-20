import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MONSTER_DB } from '../lib/evolutionUtils';
import { ENEMY_DB } from '../lib/enemyUtils';
import { getAssetPath } from '../utils/assetUtils';

interface AssetPreloaderProps {
    onComplete: () => void;
    children: React.ReactNode;
}

// Check if asset is already cached
const isAssetCached = async (url: string): Promise<boolean> => {
    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                const cache = await caches.open(name);
                const response = await cache.match(url);
                if (response) return true;
            }
        } catch {
            // Cache API not available or error
        }
    }
    return false;
};

const AssetPreloader: React.FC<AssetPreloaderProps> = ({ onComplete, children }) => {
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [currentAsset, setCurrentAsset] = useState('');
    const [cachedCount, setCachedCount] = useState(0);
    const isLoadingRef = useRef(true);

    // Skip function - continues loading in background
    const handleSkip = () => {
        setIsLoaded(true);
        onComplete();
    };

    useEffect(() => {
        const loadAssets = async () => {
            // Collect all assets to preload
            const imageAssets = [
                // Monster images from MONSTER_DB (using pre-calculated imagePath if available)
                ...Object.values(MONSTER_DB).map(m => m.imagePath || getAssetPath(`/monsters/${m.id}.png`)),

                // Enemy images from ENEMY_DB (imagePath is already processed by getAssetPath in DB definition)
                ...ENEMY_DB.map(e => e.imagePath || '').filter(p => p !== ''),
                // Background images
                getAssetPath('/backgrounds/bg_n3.png'),
                getAssetPath('/backgrounds/bg_n4.png'),
                getAssetPath('/backgrounds/bg_n5.png'),
                getAssetPath('/backgrounds/title_blue.png'),
                getAssetPath('/backgrounds/title_green.png'),
                getAssetPath('/backgrounds/title_red.png'),
                getAssetPath('/backgrounds/main_menu.png'),
                getAssetPath('/backgrounds/practice_dojo.png'),
                // Textures
                getAssetPath('/textures/wood-pattern.png'),
                getAssetPath('/textures/circuit-board.png'),
            ];

            const audioAssets = [
                // Music files
                getAssetPath('/music/red-opening.mp3'),
                getAssetPath('/music/green-opening.mp3'),
                getAssetPath('/music/blue-opening.mp3'),
                getAssetPath('/music/red-battle.mp3'),
                getAssetPath('/music/green-battle.mp3'),
                getAssetPath('/music/blue-battle.mp3'),
                getAssetPath('/music/red-field.mp3'),
                getAssetPath('/music/green-field.mp3'),
                getAssetPath('/music/blue-field.mp3'),
                getAssetPath('/music/boss.mp3'),
                getAssetPath('/music/practice.mp3'),
                // SFX
                getAssetPath('/sfx/boss_siren.mp3'),
            ];

            const allAssets = [...imageAssets, ...audioAssets];
            let loaded = 0;
            let cached = 0;

            // First, check cache status
            for (const asset of allAssets) {
                if (await isAssetCached(asset)) {
                    cached++;
                }
            }
            setCachedCount(cached);

            // If most assets are cached, quick complete
            if (cached > allAssets.length * 0.8) {
                setLoadingProgress(100);
                setIsLoaded(true);
                onComplete();
                return;
            }

            // Preload images
            for (const asset of imageAssets) {
                if (!isLoadingRef.current) break;
                try {
                    setCurrentAsset(asset.split('/').pop() || '');
                    const img = new Image();
                    img.src = asset;
                    await new Promise<void>((resolve) => {
                        img.onload = () => resolve();
                        img.onerror = () => resolve(); // Continue even on error
                    });
                } catch {
                    // Continue on error
                }
                loaded++;
                setLoadingProgress(Math.floor((loaded / allAssets.length) * 100));
            }

            // Preload audio (just fetch headers, don't fully download)
            for (const asset of audioAssets) {
                if (!isLoadingRef.current) break;
                try {
                    setCurrentAsset(asset.split('/').pop() || '');
                    await fetch(asset, { method: 'HEAD' }).catch(() => { });
                } catch {
                    // Continue on error
                }
                loaded++;
                setLoadingProgress(Math.floor((loaded / allAssets.length) * 100));
            }

            if (isLoadingRef.current) {
                setIsLoaded(true);
                onComplete();
            }
        };

        loadAssets();

        return () => {
            isLoadingRef.current = false;
        };
    }, [onComplete]);

    if (isLoaded) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center z-50">
            {/* Logo */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-8"
            >
                <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 drop-shadow-lg">
                    KanjiGo!
                </h1>
                <p className="text-gray-400 mt-2">Loading game assets...</p>
                {cachedCount > 0 && (
                    <p className="text-xs text-green-400 mt-1">
                        {cachedCount} files cached ✓
                    </p>
                )}
            </motion.div>

            {/* Progress Bar */}
            <div className="w-64 md:w-80 bg-gray-800 rounded-full h-4 overflow-hidden border border-gray-700">
                <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${loadingProgress}%` }}
                    transition={{ duration: 0.2 }}
                />
            </div>

            {/* Progress Text */}
            <div className="mt-4 text-center">
                <span className="text-2xl font-bold text-white">{loadingProgress}%</span>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-48">{currentAsset}</p>
            </div>

            {/* Loading Spinner */}
            <motion.div
                className="mt-8"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
                <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full" />
            </motion.div>

            {/* Skip Button */}
            <button
                onClick={handleSkip}
                className="mt-8 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
                スキップして開始 →
            </button>
        </div>
    );
};

export default AssetPreloader;
