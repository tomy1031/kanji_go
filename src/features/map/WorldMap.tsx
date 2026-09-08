import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { MONSTER_DB } from '../../lib/evolutionUtils';
import { getStages, type StageData, getStageKanji } from '../../lib/stageUtils';
import { useSound } from '../../hooks/useSound';
import { getEnemyForStage, getMetaMonsterForStage } from '../../lib/enemyUtils';
import { getAssetPath } from '../../utils/assetUtils';
import PartnerSelectModal from '../../components/PartnerSelectModal';
import Stage from '../../components/ui/Stage';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { SHINY_FILTER } from '../../lib/constants';

interface WorldMapProps {
    onLevelSelect: (levelId: string) => void;
    onBack: () => void;
}

const WorldMap: React.FC<WorldMapProps> = ({ onLevelSelect, onBack }) => {
    const { stats, partners, maxUnlockedStage, profile, stageRatings, selectedChapter: storeChapter, setSelectedChapter: setStoreChapter } = useUserStore();
    const currentPartner = MONSTER_DB[partners.currentMonsterId] || {
        id: 'starter_fire',
        name: 'Unknown',
        element: 'FIRE',
        baseHp: 100,
        baseAttack: 10,
        description: 'Unknown Monster',
        unlockText: 'Unknown'
    };
    // Derived directly (no state+effect mirrors, which caused cascading renders)
    const stages = useMemo(
        () => getStages(maxUnlockedStage, profile.currentVersion),
        [maxUnlockedStage, profile.currentVersion]
    );
    const selectedChapter = storeChapter || null;
    const { playBgm, playSfx } = useSound();
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    // Feedback when tapping a locked chapter/stage (silence reads as "broken")
    const [lockedToast, setLockedToast] = useState(false);
    const showLockedToast = () => {
        playSfx('mistake');
        setLockedToast(true);
        setTimeout(() => setLockedToast(false), 1800);
    };

    useEffect(() => {
        playBgm('map');
    }, [playBgm]);

    const handleStageClick = (stage: StageData) => {
        if (stage.status === 'locked') {
            showLockedToast();
            return;
        }
        playSfx('select');
        // Store world and order as a composite key
        const stageKey = `${stage.world}-${stage.order}`;
        onLevelSelect(stageKey);
    };

    const handleChapterSelect = (chapter: number) => {
        setStoreChapter(chapter);
    };

    const handleBackToChapters = () => {
        setStoreChapter(null);
    };

    // Group stages by chapter
    const chapters = Array.from(new Set(stages.map(s => s.chapter))).sort((a, b) => a - b);

    return (
        <Stage art={getAssetPath(`/backgrounds/bg_${profile.currentVersion.toLowerCase()}.png`)} blur>
            <ScreenHeader
                eyebrow={selectedChapter ? 'CHAPTER' : 'QUEST'}
                title={selectedChapter ? `だい${selectedChapter}しょう` : 'ぼうけんマップ'}
                onBack={selectedChapter ? handleBackToChapters : onBack}
            />

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 md:px-8 relative z-10">
                <AnimatePresence mode="wait">
                    {!selectedChapter ? (
                        // Chapter Select View
                        <motion.div
                            key="chapter-list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col gap-4 max-w-md mx-auto"
                        >
                            {chapters.map(chapter => {
                                const chapterStages = stages.filter(s => s.chapter === chapter);
                                const isLocked = chapterStages[0].status === 'locked';
                                const clearedCount = chapterStages.filter(s => s.status === 'cleared').length;
                                const totalStars = chapterStages.reduce((acc, s) => acc + (stageRatings[`${profile.currentVersion}-${s.world}-${s.order}`] || 0), 0);

                                return (
                                    <button
                                        key={chapter}
                                        onClick={() => (isLocked ? showLockedToast() : handleChapterSelect(chapter))}
                                        className={`g-panel w-full text-left px-4 py-4 flex items-center gap-4 transition-transform active:scale-[0.98] ${isLocked ? 'opacity-60 grayscale' : ''}`}
                                    >
                                        <div className="g-tile !w-16 !h-16 flex-col !gap-0" style={{ borderColor: isLocked ? undefined : 'rgba(255,207,74,0.5)' }}>
                                            <span className="g-eyebrow !text-[9px] !tracking-[0.1em]">CH.</span>
                                            <span className="g-title text-2xl leading-none" style={{ color: isLocked ? undefined : 'var(--color-gold)' }}>{chapter}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="g-title text-lg">だい{chapter}しょう</div>
                                            <div className="mt-1.5 g-meter !h-2">
                                                <div style={{ width: `${(clearedCount / chapterStages.length) * 100}%`, background: 'linear-gradient(90deg, #ffb31a, #ffe08a)' }} />
                                            </div>
                                            <div className="mt-1 flex items-center gap-3 text-[11px] text-[color:var(--color-ink-2)]">
                                                <span>クリア {clearedCount}/{chapterStages.length}</span>
                                                <span className="text-[color:var(--color-gold)]">★ {totalStars}/{chapterStages.length * 3}</span>
                                            </div>
                                        </div>
                                        <div className="text-white/50 text-xl">{isLocked ? '🔒' : '›'}</div>
                                    </button>
                                );
                            })}
                        </motion.div>
                    ) : (
                        // Stage Select View
                        <motion.div
                            key="stage-list"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex flex-col gap-3 max-w-md mx-auto"
                        >
                            {stages.filter(s => s.chapter === selectedChapter).map(stage => {
                                const kanjis = getStageKanji(stage.world, stage.order, profile.currentVersion);
                                const enemy = getEnemyForStage(stage.world, stage.order, profile.currentVersion);
                                const isLocked = stage.status === 'locked';
                                // Reward (meta) monster earned by mastering this stage's kanji in practice
                                const metaId = getMetaMonsterForStage(stage.world, stage.order, profile.currentVersion);
                                const metaMonster = metaId ? MONSTER_DB[metaId] : undefined;
                                const metaUnlocked = metaId ? partners.unlockedSkins.includes(metaId) : false;
                                const rewardChip = metaMonster ? (
                                    <div className={`flex flex-col items-center gap-0.5 shrink-0 ${isLocked ? 'opacity-40' : ''}`} title={metaUnlocked ? metaMonster.name : 'ごほうびモンスター（未ゲット）'}>
                                        <div className="relative w-9 h-9 md:w-11 md:h-11 rounded-full bg-black/30 border border-purple-400/60 flex items-center justify-center overflow-hidden">
                                            <img
                                                src={getAssetPath(`/monsters/${metaId}.png`)}
                                                alt="reward"
                                                className={`w-7 h-7 md:w-9 md:h-9 object-contain ${metaUnlocked ? '' : 'brightness-0 opacity-70'}`}
                                            />
                                            {!metaUnlocked && <span className="absolute text-white/90 font-black text-xs">?</span>}
                                        </div>
                                        <span className={`text-[8px] md:text-[9px] font-black px-1.5 rounded-full ${metaUnlocked ? 'bg-yellow-400 text-yellow-900' : 'bg-purple-600 text-white'}`}>
                                            {metaUnlocked ? '✓済' : 'GET'}
                                        </span>
                                    </div>
                                ) : null;

                                // Special design for BOSS stages
                                if (stage.isBoss) {
                                    return (
                                        <button
                                            key={`${stage.world}-${stage.order}`}
                                            onClick={() => handleStageClick(stage)}
                                            className={`w-full min-h-40 md:min-h-48 rounded-[var(--radius-card)] relative overflow-hidden flex flex-col p-5 transition-transform active:scale-[0.98] border ${isLocked ? 'g-panel opacity-60 grayscale' : 'border-[rgba(255,90,110,0.55)] shadow-[0_0_0_1px_rgba(255,90,110,0.35),0_16px_40px_rgba(217,38,63,0.35)]'}`}
                                            style={isLocked ? undefined : { background: 'linear-gradient(135deg, rgba(217,38,63,0.35) 0%, rgba(58,10,20,0.85) 60%, rgba(11,16,32,0.9) 100%)' }}
                                        >
                                            {/* BOSS Badge with Stars */}
                                            <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                                                <div className="g-chip g-chip-enemy !h-8 !px-3 text-xs md:text-sm">
                                                    ⚔️ ボスバトル
                                                    {/* Star Rating inline with BOSS text */}
                                                    {!isLocked && (
                                                        <span className="flex gap-0.5 ml-1">
                                                            {[1, 2, 3].map(star => {
                                                                const rating = stageRatings[`${profile.currentVersion}-${stage.world}-${stage.order}`] || 0;
                                                                return (
                                                                    <span key={star} className={`text-sm ${star <= rating ? 'text-yellow-600' : 'text-[#8b6914]'}`}>
                                                                        ★
                                                                    </span>
                                                                );
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Cleared Badge - positioned on the right */}
                                                {stage.status === 'cleared' && (
                                                    <div className="g-chip g-chip-success !h-8">✓ クリア！</div>
                                                )}
                                            </div>

                                            {/* Enemy Image (Larger) - with top margin for mobile */}
                                            <div className="flex-1 flex items-center justify-center mt-6 md:mt-8 relative w-full">
                                                {enemy && (
                                                    <img
                                                        src={getAssetPath(enemy.imagePath || '')}
                                                        alt={enemy.name}
                                                        className={`w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-2xl ${isLocked ? 'grayscale opacity-50' : 'animate-pulse'}`}
                                                    />
                                                )}
                                                {/* Reward monster chip (boss card: pinned right) */}
                                                {rewardChip && (
                                                    <div className="absolute right-0 top-1/2 -translate-y-1/2">{rewardChip}</div>
                                                )}
                                            </div>

                                            {/* Kanji Grid (2 rows for better layout) - center aligned */}
                                            <div className="mt-4 w-full flex flex-col items-center">
                                                <div className="g-eyebrow mb-2 text-center">ここで つかう かんじ</div>
                                                <div className="grid grid-cols-5 md:grid-cols-8 gap-2 justify-items-center max-w-xs mx-auto">
                                                    {kanjis.map(k => (
                                                        <div key={k.id} className={`w-8 h-8 md:w-10 md:h-10 rounded flex items-center justify-center text-sm md:text-base font-bold ${isLocked ? 'bg-white/10 text-white/40' : 'bg-white/90 text-[#1a1030] shadow-md'}`}>
                                                            {k.char}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                }

                                // Normal stage design
                                return (
                                    <button
                                        key={`${stage.world}-${stage.order}`}
                                        onClick={() => handleStageClick(stage)}
                                        className={`g-panel w-full h-24 md:h-28 relative overflow-hidden flex items-center px-4 transition-transform active:scale-[0.98] ${isLocked ? 'opacity-60 grayscale' : ''}`}
                                    >
                                        {/* Left: Stage Info */}
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <div className={`g-title text-lg md:text-xl ${isLocked ? 'text-white/40' : 'text-white'}`}>
                                                    {stage.isBoss ? 'ボス' : `ステージ ${stage.chapter}-${stage.displayNumber}`}
                                                </div>
                                                {/* Star Rating Display */}
                                                {!isLocked && (
                                                    <div className="flex gap-0.5">
                                                        {[1, 2, 3].map(star => {
                                                            const rating = stageRatings[`${profile.currentVersion}-${stage.world}-${stage.order}`] || 0;
                                                            return (
                                                                <span key={star} className={`text-sm ${star <= rating ? 'text-[color:var(--color-gold)]' : 'text-white/20'}`}>
                                                                    ★
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                {kanjis.map(k => (
                                                    <div key={k.id} className={`w-6 h-6 md:w-8 md:h-8 rounded flex items-center justify-center text-xs md:text-sm font-bold ${isLocked ? 'bg-white/10 text-white/40' : 'bg-white/90 text-[#1a1030]'}`}>
                                                        {k.char}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Reward monster chip */}
                                        {rewardChip}

                                        {/* Right: Enemy Icon */}
                                        <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 ml-2 relative">
                                            {enemy ? (
                                                <img src={getAssetPath(enemy.imagePath || '')} alt={enemy.name} className={`w-full h-full object-contain ${isLocked ? 'grayscale opacity-50' : ''}`} />
                                            ) : (
                                                <div className="w-full h-full bg-gray-400/20 rounded-full" />
                                            )}
                                            {stage.status === 'cleared' && (
                                                <div className="absolute -top-1 -right-1 g-chip g-chip-success !h-6 !px-2 !text-[10px]">✓</div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer / Current Partner - Clickable */}
            <button
                className="relative z-20 mx-4 mb-4 g-panel-solid px-3 py-2.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
                onClick={() => {
                    playSfx('select');
                    setShowPartnerModal(true);
                }}
            >
                <div className="w-12 h-12 rounded-xl bg-black/40 border border-[rgba(56,214,255,0.5)] overflow-hidden shrink-0">
                    <img src={getAssetPath(`/monsters/${currentPartner.id}.png`)} alt={currentPartner.name} className="w-full h-full object-contain" style={{ filter: (partners.shinySkins || []).includes(currentPartner.id) ? SHINY_FILTER : undefined }} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="g-eyebrow">PARTNER</div>
                    <div className="g-title text-base truncate">{currentPartner.name} <span className="g-chip g-chip-player !h-5 !px-2 !text-[10px] align-middle ml-1">Lv.{stats.playerLevel}</span></div>
                </div>
                <span className="g-chip">かえる ›</span>
            </button>

            {/* Locked-content toast */}
            <AnimatePresence>
                {lockedToast && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 text-white text-sm font-bold px-5 py-2.5 rounded-full border border-yellow-500/60 shadow-xl whitespace-nowrap"
                    >
                        🔒 まえのステージを クリアしよう！
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Partner Select Modal */}
            <PartnerSelectModal
                isOpen={showPartnerModal}
                onClose={() => setShowPartnerModal(false)}
            />
        </Stage>
    );
};

export default WorldMap;
