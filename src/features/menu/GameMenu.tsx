import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { MONSTER_DB } from '../../lib/evolutionUtils';
import { GameVersion } from '../../types';
import { getAssetPath } from '../../utils/assetUtils';
import { useSound } from '../../hooks/useSound';
import { SHINY_FILTER } from '../../lib/constants';
import OfflineSetup from '../../components/OfflineSetup';
import Stage from '../../components/ui/Stage';

interface GameMenuProps {
    onQuest: () => void;
    onPractice: () => void;
    onStatus: () => void;
    onOnline: () => void;
    onBack: () => void;
}

const VERSION_META: Record<GameVersion, { label: string; art: string; tint: string }> = {
    [GameVersion.RED]: { label: 'N5', art: '/backgrounds/title_red.png', tint: 'var(--color-ver-red)' },
    [GameVersion.BLUE]: { label: 'N4', art: '/backgrounds/title_blue.png', tint: 'var(--color-ver-blue)' },
    [GameVersion.GREEN]: { label: 'N3', art: '/backgrounds/title_green.png', tint: 'var(--color-ver-green)' },
};

const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.06 * i, duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } }),
};

const GameMenu: React.FC<GameMenuProps> = ({ onQuest, onPractice, onStatus, onOnline, onBack }) => {
    const { profile, partners, stats, dailyStreak, clutchWins, maxUnlockedStage } = useUserStore();
    const { playBgm, playSfx } = useSound();

    useEffect(() => {
        playBgm('title');
    }, [playBgm]);

    const meta = VERSION_META[profile.currentVersion] ?? VERSION_META[GameVersion.RED];
    const partner = MONSTER_DB[partners.currentMonsterId];
    const isShiny = (partners.shinySkins || []).includes(partners.currentMonsterId);
    const totalMonsters = Object.keys(MONSTER_DB).length;
    const owned = partners.unlockedSkins.length;
    const collectionPct = totalMonsters ? Math.floor((owned / totalMonsters) * 100) : 0;
    const streak = dailyStreak?.count || 0;

    const go = (fn: () => void) => () => {
        playSfx('select');
        fn();
    };

    const items = [
        { key: 'practice', title: 'れんしゅう', sub: '漢字を書いて なかまをゲット', icon: '✍️', tone: 'player', action: onPractice },
        { key: 'online', title: 'オンラインたいせん', sub: 'ボタンひとつで だれかと しょうぶ', icon: '🌐', tone: 'magic', action: onOnline },
        { key: 'partner', title: 'パートナー', sub: 'ステータスと モンスターずかん', icon: '🐉', tone: 'success', action: onStatus },
    ] as const;

    const toneRing: Record<string, string> = {
        player: 'rgba(56,214,255,0.55)',
        magic: 'rgba(185,140,255,0.55)',
        success: 'rgba(94,226,154,0.55)',
    };

    return (
        <Stage art={getAssetPath(meta.art)} blur>
            <div className="relative z-10 flex-1 overflow-y-auto no-scrollbar">
                <div className="max-w-md mx-auto px-4 pt-5 pb-8 flex flex-col gap-3">
                    {/* Identity row */}
                    <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="g-panel px-3 py-3 flex items-center gap-3">
                        <button onClick={go(onStatus)} className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white/20 bg-black/40 shrink-0 active:scale-95 transition-transform">
                            <img
                                src={getAssetPath(`/monsters/${partners.currentMonsterId}.png`)}
                                alt={partner?.name || 'partner'}
                                className="w-full h-full object-contain"
                                style={{ filter: isShiny ? SHINY_FILTER : undefined }}
                            />
                            {isShiny && <span className="absolute -top-0.5 -right-0.5 text-[10px]">✨</span>}
                        </button>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="g-title text-base truncate">{profile.name}</span>
                                <span className="g-chip g-chip-gold !h-6 !px-2 !text-[11px]">Lv.{stats.playerLevel}</span>
                            </div>
                            <div className="text-xs text-[color:var(--color-ink-2)] truncate mt-0.5">
                                {partner?.name || 'パートナー'} と ぼうけんちゅう
                            </div>
                        </div>
                        <span className="g-chip !h-7" style={{ borderColor: meta.tint, color: meta.tint }}>{meta.label}</span>
                    </motion.div>

                    {/* Stats strip */}
                    <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show" className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                        <span className={`g-chip ${streak > 0 ? 'g-chip-gold' : ''}`}>🔥 れんぞく {streak}日{(dailyStreak?.freezes || 0) > 0 && <span className="opacity-80">🧊{dailyStreak!.freezes}</span>}</span>
                        <span className="g-chip g-chip-magic">📖 ずかん {collectionPct}%</span>
                        {(clutchWins || 0) > 0 && <span className="g-chip g-chip-enemy">⚡ クラッチ {clutchWins}</span>}
                    </motion.div>

                    {/* Hero: Quest */}
                    <motion.button
                        custom={2} variants={fadeUp} initial="hidden" animate="show"
                        whileTap={{ scale: 0.98 }}
                        onClick={go(onQuest)}
                        className="relative text-left rounded-[var(--radius-card)] overflow-hidden border border-[rgba(255,224,138,0.55)] shadow-[var(--shadow-glow-gold)] min-h-[128px] g-shimmer"
                        style={{ background: 'linear-gradient(135deg, rgba(255,207,74,0.22) 0%, rgba(255,140,26,0.18) 60%, rgba(11,16,32,0.4) 100%)' }}
                    >
                        <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 120% at 100% 0%, rgba(255,255,255,0.14), transparent 55%)' }} />
                        <div className="relative p-4 flex items-center gap-4">
                            <div className="g-tile !w-16 !h-16 !text-3xl" style={{ background: 'rgba(58,38,0,0.45)', borderColor: 'rgba(255,224,138,0.5)' }}>⚔️</div>
                            <div className="min-w-0 flex-1">
                                <div className="g-eyebrow !text-[color:var(--color-gold)]">QUEST</div>
                                <div className="g-title text-2xl md:text-3xl text-white drop-shadow">ぼうけんに でる</div>
                                <div className="text-xs text-white/80 mt-1">ステージ {maxUnlockedStage} まで あそべるよ</div>
                            </div>
                            <div className="text-white/70 text-2xl">›</div>
                        </div>
                    </motion.button>

                    {/* Secondary actions */}
                    {items.map((item, i) => (
                        <motion.button
                            key={item.key}
                            custom={3 + i} variants={fadeUp} initial="hidden" animate="show"
                            whileTap={{ scale: 0.98 }}
                            onClick={go(item.action)}
                            className="g-panel text-left px-3 py-3 flex items-center gap-3 active:bg-[color:var(--color-surface-2)] transition-colors"
                        >
                            <div className="g-tile" style={{ boxShadow: `inset 0 0 0 1px ${toneRing[item.tone]}, inset 0 1px 0 rgba(255,255,255,0.1)` }}>{item.icon}</div>
                            <div className="min-w-0 flex-1">
                                <div className="g-title text-lg">{item.title}</div>
                                <div className="text-xs text-[color:var(--color-ink-2)] truncate">{item.sub}</div>
                            </div>
                            <div className="text-white/50 text-xl">›</div>
                        </motion.button>
                    ))}

                    <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show" className="mt-1">
                        <OfflineSetup />
                    </motion.div>

                    <motion.button custom={7} variants={fadeUp} initial="hidden" animate="show" onClick={go(onBack)} className="g-btn g-btn-ghost self-center mt-1 !min-h-[40px] text-sm">
                        ‹ タイトルへ
                    </motion.button>
                </div>
            </div>
        </Stage>
    );
};

export default GameMenu;
