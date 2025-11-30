import React from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { GameVersion } from '../../types';

interface GameMenuProps {
    onQuest: () => void;
    onPractice: () => void;
    onStatus: () => void;
    onBack: () => void;
}

const GameMenu: React.FC<GameMenuProps> = ({ onQuest, onPractice, onStatus, onBack }) => {
    const { profile } = useUserStore();

    const getBgImage = () => {
        switch (profile.currentVersion) {
            case GameVersion.RED: return "bg-[url('/backgrounds/title_red.png')]";
            case GameVersion.GREEN: return "bg-[url('/backgrounds/title_green.png')]";
            case GameVersion.BLUE: return "bg-[url('/backgrounds/title_blue.png')]";
            default: return "bg-[url('/backgrounds/main_menu.png')]";
        }
    };

    const menuItems = [
        { label: 'QUEST MODE', desc: 'Explore the map and battle bosses', action: onQuest, color: 'bg-red-500' },
        { label: 'PRACTICE', desc: 'Review kanji without pressure', action: onPractice, color: 'bg-blue-500' },
        { label: 'PARTNER STATUS', desc: 'Check stats and evolution', action: onStatus, color: 'bg-green-500' },
    ];

    return (
        <div className="w-full h-screen bg-gray-900 flex items-center justify-center relative overflow-hidden">
            <div className={`absolute inset-0 ${getBgImage()} bg-cover bg-center opacity-30 blur-sm`} />

            <div className="z-10 w-full max-w-md flex flex-col gap-6 p-8">
                <h2 className="text-4xl font-bold text-white text-center mb-8 tracking-widest">MAIN MENU</h2>

                {menuItems.map((item, index) => (
                    <motion.button
                        key={item.label}
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.05, x: 10 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={item.action}
                        className={`w-full p-6 rounded-xl shadow-lg text-left relative overflow-hidden group ${item.color}`}
                    >
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                        <div className="relative z-10">
                            <div className="text-2xl font-bold text-white">{item.label}</div>
                            <div className="text-sm text-white/80">{item.desc}</div>
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
