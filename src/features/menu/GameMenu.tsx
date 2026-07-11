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
        { label: 'クエスト', sub: 'QUEST', desc: 'マップを進んでボスに挑もう', icon: '⚔️', action: onQuest, gradient: 'from-red-600 to-orange-600', border: 'border-red-400/40' },
        { label: '練習', sub: 'PRACTICE', desc: '漢字を書いてモンスターをゲット', icon: '✍️', action: onPractice, gradient: 'from-blue-600 to-cyan-600', border: 'border-cyan-400/40' },
        { label: 'オンライン対戦', sub: 'ONLINE BATTLE', desc: 'フレンドとリアルタイム勝負', icon: '🌐', action: onOnline, gradient: 'from-purple-600 to-fuchsia-600', border: 'border-purple-400/40' },
        { label: 'パートナー', sub: 'PARTNER', desc: 'ステータスとモンスター図鑑', icon: '🐉', action: onStatus, gradient: 'from-emerald-600 to-green-600', border: 'border-emerald-400/40' },
    ];

    return (
        <div className="w-full h-dvh bg-gray-900 flex items-center justify-center relative overflow-y-auto">
            <div
                className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
                style={{ backgroundImage: `url(${getBgImage()})` }}
            />
            {/* Vignette for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />

            <div className="z-10 w-full max-w-md flex flex-col gap-3 md:gap-4 p-4 md:p-8">
                <h2 className="text-2xl md:text-4xl font-black text-white text-center mb-3 md:mb-6 tracking-[0.3em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                    メニュー
                </h2>

                {menuItems.map((item, index) => (
                    <motion.button
                        key={item.label}
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.08 }}
                        whileHover={{ scale: 1.03, x: 6 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={item.action}
                        className={`w-full p-4 md:p-5 rounded-2xl shadow-lg text-left relative overflow-hidden group bg-gradient-to-r ${item.gradient} border ${item.border}`}
                    >
                        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
                        {/* Subtle top shine */}
                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/10 pointer-events-none" />
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-xl bg-black/30 border border-white/20 flex items-center justify-center text-2xl md:text-3xl shadow-inner">
                                {item.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-lg md:text-2xl font-black text-white drop-shadow">{item.label}</span>
                                    <span className="text-[9px] md:text-[10px] font-bold text-white/50 tracking-widest">{item.sub}</span>
                                </div>
                                <div className="text-xs md:text-sm text-white/85">{item.desc}</div>
                            </div>
                            <div className="ml-auto text-white/60 text-xl">›</div>
                        </div>
                    </motion.button>
                ))}

                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={onBack}
                    className="mt-6 text-gray-400 hover:text-white transition-colors text-center text-sm"
                >
                    ← タイトルへもどる
                </motion.button>
            </div>
        </div>
    );
};

export default GameMenu;
