import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { GameVersion } from '../../types';
import { getAssetPath } from '../../utils/assetUtils';
import { useSound } from '../../hooks/useSound';

interface GameMenuProps {
    onQuest: () => void;
    onPractice: () => void;
    onStatus: () => void;
    onOnline: () => void;
    onBack: () => void;
}

const GameMenu: React.FC<GameMenuProps> = ({ onQuest, onPractice, onStatus, onOnline, onBack }) => {
    const { profile } = useUserStore();
    const { playBgm } = useSound();

    // Play title BGM when entering main menu
    useEffect(() => {
        playBgm('title');
    }, [playBgm]);
    const getBgImage = () => {
        switch (profile.currentVersion) {
            case GameVersion.RED: return getAssetPath('/backgrounds/title_red.png');
            case GameVersion.GREEN: return getAssetPath('/backgrounds/title_green.png');
            case GameVersion.BLUE: return getAssetPath('/backgrounds/title_blue.png');
            default: return getAssetPath('/backgrounds/main_menu.png');
        }
    };

    const menuItems = [
        { label: 'QUEST MODE', desc: 'Explore the map and battle bosses', action: onQuest, color: 'bg-red-500' },
        { label: 'PRACTICE', desc: 'Review kanji without pressure', action: onPractice, color: 'bg-blue-500' },
        { label: 'ONLINE BATTLE', desc: 'Real-time P2P battles', action: onOnline, color: 'bg-purple-500' },
        { label: 'PARTNER STATUS', desc: 'Check stats and evolution', action: onStatus, color: 'bg-green-500' },
    ];

    return (
        <div className="w-full h-dvh bg-gray-900 flex items-center justify-center relative overflow-y-auto">
            <div
                className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
                style={{ backgroundImage: `url(${getBgImage()})` }}
            />

            <div className="z-10 w-full max-w-md flex flex-col gap-4 md:gap-6 p-4 md:p-8">
                <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4 md:mb-8 tracking-widest">MAIN MENU</h2>

                {menuItems.map((item, index) => (
                    <motion.button
                        key={item.label}
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.05, x: 10 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={item.action}
                        className={`w-full p-4 md:p-6 rounded-xl shadow-lg text-left relative overflow-hidden group ${item.color}`}
                    >
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                        <div className="relative z-10">
                            <div className="text-xl md:text-2xl font-bold text-white">{item.label}</div>
                            <div className="text-xs md:text-sm text-white/80">{item.desc}</div>
                        </div>
                    </motion.button>
                ))}

                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={onBack}
                    className="mt-8 text-gray-400 hover:text-white transition-colors text-center"
                >
                    Back to Title
                </motion.button>
            </div>
        </div>
    );
};

export default GameMenu;
