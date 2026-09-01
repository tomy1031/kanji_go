import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameVersion } from '../../types';
import { useUserStore } from '../../store/userStore';
import { useSound } from '../../hooks/useSound';

interface CartridgeSelectProps {
    onSelect: (version: GameVersion) => void;
}

import { getAssetPath } from '../../utils/assetUtils';

const cartridges = [
    {
        id: GameVersion.RED,
        title: 'KanjiGo! RED(N5)',
        color: 'from-red-500 to-red-700',
        icon: '🔥',
        bg: 'bg-red-600',
        description: 'しょきゅう（N5）・ほのおの ぼうけん',
        image: '/backgrounds/bg_n5.png'
    },
    {
        id: GameVersion.BLUE,
        title: 'KanjiGo! BLUE(N4)',
        color: 'from-blue-500 to-blue-700',
        icon: '💧',
        bg: 'bg-blue-600',
        description: 'ちゅうきゅう（N4）・うみの ぼうけん',
        image: '/backgrounds/bg_n4.png'
    },
    {
        id: GameVersion.GREEN,
        title: 'KanjiGo! GREEN(N3)',
        color: 'from-green-500 to-green-700',
        icon: '🌿',
        bg: 'bg-green-600',
        description: 'じょうきゅう（N3）・もりの ぼうけん',
        image: '/backgrounds/bg_n3.png'
    }
];

const CartridgeSelect: React.FC<CartridgeSelectProps> = ({ onSelect }) => {
    const [selectedId, setSelectedId] = useState<GameVersion | null>(null);
    const [focusedId, setFocusedId] = useState<GameVersion>(GameVersion.RED);
    const setProfile = useUserStore(state => state.setProfile);
    const { stopBgm, playSfx } = useSound();
    const [hasInteracted, setHasInteracted] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    // Stop any playing music on mount (cartridge select has no music)
    useEffect(() => {
        stopBgm();
    }, [stopBgm]);

    // Listen for PWA install prompt
    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    // No BGM on cartridge select screen - keep it silent
    // Music will play after version selection on title screen

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        setDeferredPrompt(null);
    };

    const handleInteraction = () => {
        if (!hasInteracted) {
            setHasInteracted(true);
            // No music on cartridge select - just mark as interacted
        }
    };

    const handleSelect = (version: GameVersion) => {
        if (!hasInteracted) {
            handleInteraction();
            return;
        }
        setSelectedId(version);
        playSfx('select');
        setTimeout(() => {
            setProfile({ currentVersion: version });
            onSelect(version);
        }, 1000);
    };

    return (
        <div
            className="w-full h-dvh bg-[#0f172a] text-white font-sans overflow-hidden flex flex-col relative fixed inset-0"
            onClick={handleInteraction}
        >
            {/* Tap to Start Overlay */}
            {!hasInteracted && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer">
                    <div className="text-center animate-pulse">
                        <div className="text-4xl md:text-6xl mb-4">👆</div>
                        <div className="text-xl md:text-2xl font-bold text-white tracking-widest">タップして はじめよう！</div>
                    </div>
                </div>
            )}

            {/* Background Tech Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('/kanji_go/textures/circuit-board.png')] pointer-events-none" />

            {/* Top Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center p-4 md:p-8 md:px-12 z-10 border-b border-white/10 bg-[#1e293b]/50 backdrop-blur-md gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-cyan-500 overflow-hidden border-2 border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                        {/* User Avatar Placeholder */}
                        <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm md:text-lg text-cyan-100">かんじGO！</span>
                        <span className="text-[10px] md:text-xs text-cyan-400">どのソフトで あそぶ？</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={() => {
                            if (deferredPrompt) {
                                handleInstallClick();
                            } else {
                                // Show manual install instructions
                                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                                const isChrome = /Chrome/.test(navigator.userAgent);
                                const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;

                                let message = 'アプリをインストールするには：\n\n';
                                if (isMobile) {
                                    if (isSafari) {
                                        message += 'Safari: 共有ボタン → ホーム画面に追加';
                                    } else {
                                        message += 'Chrome: メニュー(⋮) → アプリをインストール\nまたは\nホーム画面に追加';
                                    }
                                } else {
                                    message += 'ブラウザのアドレスバー右側の\nインストールアイコン(⊕)をクリック\nまたは\nメニュー → アプリをインストール';
                                }
                                alert(message);
                            }
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs md:text-sm font-bold py-1 px-3 md:py-2 md:px-4 rounded-full transition-colors flex items-center gap-1 md:gap-2"
                    >
                        <span>📱</span>
                        <span className="hidden md:inline">アプリにする</span>
                        <span className="md:hidden">アプリにする</span>
                    </button>
                </div>
            </div>

            {/* Main Content (Game Row) */}
            <div className="flex-1 flex items-center justify-start md:justify-center gap-4 md:gap-8 px-4 md:px-12 overflow-x-auto overflow-y-hidden no-scrollbar z-10 py-4 snap-x snap-mandatory min-h-0">
                {cartridges.map((cartridge) => {
                    const isFocused = focusedId === cartridge.id;
                    const isSelected = selectedId === cartridge.id;

                    return (
                        <div key={cartridge.id} className="relative flex flex-col items-center gap-4 snap-center shrink-0 h-full justify-center">
                            <motion.div
                                layoutId={cartridge.id}
                                onClick={() => {
                                    setFocusedId(cartridge.id);
                                    handleSelect(cartridge.id);
                                }}
                                animate={{
                                    scale: isFocused ? 1.05 : 0.95,
                                    opacity: selectedId && !isSelected ? 0 : 1,
                                    y: isFocused ? -10 : 0
                                }}
                                className={`
                            w-64 h-80 md:w-72 md:h-96 rounded-xl cursor-pointer relative z-10
                            bg-gradient-to-b from-gray-800 to-gray-900
                            border-2 ${isFocused ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'border-gray-700'}
                            flex flex-col items-center overflow-hidden
                            transition-colors duration-300
                        `}
                            >
                                {/* Background Image */}
                                {cartridge.image && (
                                    <div
                                        className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity"
                                        style={{ backgroundImage: `url(${getAssetPath(cartridge.image)})` }}
                                    />
                                )}
                                <div className="absolute inset-0 bg-black/40" /> {/* Overlay for readability */}
                                {/* Header Color Strip */}
                                <div className={`w-full h-2 bg-gradient-to-r ${cartridge.color}`} />

                                {/* Content */}
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-20">
                                    <div className="text-5xl md:text-6xl mb-4 filter drop-shadow-lg transform group-hover:scale-110 transition-transform">
                                        {cartridge.icon}
                                    </div>
                                    <h3 className="text-lg md:text-xl font-bold text-white mb-2">{cartridge.title}</h3>
                                    <p className="text-xs text-gray-300 font-mono bg-black/50 px-2 py-1 rounded">{cartridge.description}</p>
                                </div>

                                {/* Footer Status */}
                                <div className="w-full bg-black/30 p-2 flex justify-between items-center px-4 relative z-20">
                                    <span className="text-[10px] text-gray-400 font-mono">MOD.0{cartridge.id === GameVersion.RED ? '1' : cartridge.id === GameVersion.GREEN ? '2' : '3'}</span>
                                    <div className={`w-2 h-2 rounded-full ${cartridge.bg}`} />
                                </div>
                            </motion.div>

                            {/* Selection Indicator */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: isFocused ? 1 : 0 }}
                                className="text-cyan-400 font-mono text-xs md:text-sm tracking-widest absolute -bottom-8"
                            >
                                ▲ タップで スタート！
                            </motion.div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Bar */}
            <div className="p-3 md:p-5 flex justify-center items-center gap-2 border-t border-white/10 bg-[#1e293b]/50 backdrop-blur-md z-10">
                <span className="md:hidden text-[11px] text-cyan-300/80 font-bold animate-pulse">← よこに うごかすと ほかのソフトも あるよ →</span>
                <span className="hidden md:inline text-xs text-gray-500">すきなソフトを えらんでね</span>
            </div>

            {/* Loading Overlay */}
            <AnimatePresence>
                {selectedId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-[#0a192f] z-50 flex items-center justify-center px-4"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
                            <div className="text-cyan-400 text-lg md:text-xl font-bold tracking-widest animate-pulse">
                                じゅんびちゅう…
                            </div>
                            <div className="text-gray-500 text-xs md:text-sm mt-2">
                                {selectedId} の せかいへ しゅっぱつ！
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CartridgeSelect;
