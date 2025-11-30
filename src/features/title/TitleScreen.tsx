import React from 'react';
import { motion } from 'framer-motion';
import { GameVersion } from '../../types';

interface TitleScreenProps {
    version: GameVersion;
    onStart: () => void;
    onBack: () => void;
}

const TitleScreen: React.FC<TitleScreenProps> = ({ version, onStart, onBack }) => {
    const getTheme = () => {
        switch (version) {
            case GameVersion.RED:
                return {
                    bg: "bg-[url('/backgrounds/title_red.png')]",
                    titleColor: "text-red-500",
                    buttonColor: "bg-red-600 hover:bg-red-500",
                    accent: "border-red-500"
                };
            case GameVersion.GREEN:
                return {
                    bg: "bg-[url('/backgrounds/title_green.png')]",
                    titleColor: "text-green-500",
                    buttonColor: "bg-green-600 hover:bg-green-500",
                    accent: "border-green-500"
                };
            case GameVersion.BLUE:
                return {
                    bg: "bg-[url('/backgrounds/title_blue.png')]",
                    titleColor: "text-blue-500",
                    buttonColor: "bg-blue-600 hover:bg-blue-500",
                    accent: "border-blue-500"
                };
            default:
                return {
                    bg: "bg-gray-900",
                    titleColor: "text-white",
                    buttonColor: "bg-gray-600",
                    accent: "border-gray-500"
                };
        }
    };

    const theme = getTheme();

    return (
        <div className={`w-full h-screen ${theme.bg} bg-cover bg-center flex flex-col items-center justify-center relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/40" /> {/* Overlay */}

            <div className="z-10 text-center">
                <motion.h1
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`text-6xl md:text-8xl font-black mb-4 ${theme.titleColor} drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] tracking-tighter`}
                >
                    KANJI GO!
                </motion.h1>

                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className={`text-2xl font-bold text-white mb-12 tracking-widest uppercase border-b-4 ${theme.accent} inline-block pb-2`}
                >
                    {version} VERSION
                </motion.div>

                <motion.button
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onStart}
                    className={`${theme.buttonColor} text-white text-xl font-bold py-4 px-12 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] border-2 border-white/20`}
                >
                    PRESS START
                </motion.button>
            </div>

            <div className="absolute bottom-8 text-white/50 text-sm z-10">
                © 2025 AUPP/Nextmake Japanese IT Pathway
            </div>

            {/* Back Button */}
            <button
                onClick={onBack}
                className="absolute top-4 left-4 z-20 text-white/80 hover:text-white flex items-center gap-2 bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm transition-colors"
            >
                <span>←</span> Change Version
            </button>
        </div>
    );
};

export default TitleScreen;
