import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameVersion } from '../../types';
import { useSound } from '../../hooks/useSound';
import { getAssetPath } from '../../utils/assetUtils';
import Stage from '../../components/ui/Stage';

interface TitleScreenProps {
    version: GameVersion;
    onStart: () => void;
    onBack: () => void;
}

const THEME: Record<GameVersion, { art: string; label: string; tint: string; word: string }> = {
    [GameVersion.RED]: { art: '/backgrounds/title_red.png', label: 'N5', tint: 'var(--color-ver-red)', word: 'ほのお' },
    [GameVersion.BLUE]: { art: '/backgrounds/title_blue.png', label: 'N4', tint: 'var(--color-ver-blue)', word: 'うみ' },
    [GameVersion.GREEN]: { art: '/backgrounds/title_green.png', label: 'N3', tint: 'var(--color-ver-green)', word: 'もり' },
};

const TitleScreen: React.FC<TitleScreenProps> = ({ version, onStart, onBack }) => {
    const { playBgm, playSfx } = useSound();
    useEffect(() => { playBgm('title'); }, [playBgm]);
    const t = THEME[version] ?? THEME[GameVersion.RED];

    return (
        <Stage art={getAssetPath(t.art)} artSize="auto 150%" artPosition="center 100%" veil="heavy">
            {/* Back */}
            <div className="absolute top-3 left-3 z-20">
                <button onClick={onBack} className="g-btn g-btn-ghost !min-h-[42px] !px-4 text-sm">‹ ソフトをかえる</button>
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-end px-6 text-center pb-8 gap-7">
                {/* Top: version tag + logo lockup (mascot stays visible below) */}
                <div className="flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                        className="g-chip !h-8 !px-4 mb-4 tracking-[0.2em]"
                        style={{ borderColor: t.tint, color: t.tint, background: 'rgba(0,0,0,0.35)' }}
                    >
                        {t.label} ・ {t.word}の ぼうけん
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.92, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="g-title text-[56px] leading-[0.95] md:text-[96px] text-white"
                        style={{ textShadow: '0 4px 0 rgba(0,0,0,0.25), 0 18px 40px rgba(0,0,0,0.6)' }}
                    >
                        <span className="block" style={{ color: t.tint }}>かんじ</span>
                        <span className="block tracking-tight">GO!</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                        className="mt-3 text-sm md:text-base text-white/85 font-bold"
                        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
                    >
                        書いて たたかう、漢字バトル
                    </motion.p>
                </div>

                {/* Bottom: the one action */}
                <div className="flex flex-col items-center gap-5 w-full">
                    <motion.button
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.45 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { playSfx('select'); onStart(); }}
                        className="g-btn g-btn-primary !min-h-[60px] !px-12 text-xl md:text-2xl g-shimmer"
                    >
                        タップして スタート！
                    </motion.button>
                    <div className="text-[11px] text-white/45">© 2025 AUPP / Nextmake Japanese IT Pathway</div>
                </div>
            </div>
        </Stage>
    );
};

export default TitleScreen;
