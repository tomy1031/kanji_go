import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { MONSTER_DB } from '../../lib/evolutionUtils';
import { getStages, type StageData, getStageKanji } from '../../lib/stageUtils';
import { useSound } from '../../hooks/useSound';
import { getEnemyForStage, getMetaMonsterForStage } from '../../lib/enemyUtils';
import { getAssetPath } from '../../utils/assetUtils';
import PartnerSelectModal from '../../components/PartnerSelectModal';

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

    useEffect(() => {
        playBgm('map');
    }, [playBgm]);

    const handleStageClick = (stage: StageData) => {
        if (stage.status === 'locked') return;
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
        <div className="w-full h-dvh bg-[#2c1810] relative overflow-hidden flex flex-col">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-20 bg-[url('/kanji_go/textures/wood-pattern.png')]" />

            {/* Header */}
            <div className="relative z-20 bg-[#4a2c1d] p-4 shadow-lg border-b-4 border-[#8b5a2b] flex items-center justify-between">
                {selectedChapter ? (
                    <button onClick={handleBackToChapters} className="text-[#e6d5b8] font-bold text-sm md:text-base flex items-center gap-1">
                        <span>◀</span> Back
                    </button>
                ) : (
                    <button onClick={onBack} className="text-[#e6d5b8] font-bold text-sm md:text-base flex items-center gap-1">
                        <span>◀</span> Back
                    </button>
                )}
                <h1 className="text-[#e6d5b8] font-bold text-lg md:text-2xl tracking-widest drop-shadow-md">
                    {selectedChapter ? `CHAPTER ${selectedChapter}` : 'QUEST MODE'}
                </h1>
                <div className="w-16" />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
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
                                        onClick={() => !isLocked && handleChapterSelect(chapter)}
                                        disabled={isLocked}
                                        className={`
                                            w-full p-6 rounded-xl border-4 shadow-lg relative overflow-hidden transition-transform active:scale-95
                                            ${isLocked
                                                ? 'bg-gray-700 border-gray-600 grayscale opacity-70'
                                                : 'bg-gradient-to-br from-[#8b5a2b] to-[#5c3a1e] border-[#e6d5b8] hover:brightness-110'}
                                        `}
                                    >
                                        <div className="flex justify-between items-center relative z-10">
                                            <div className="text-left">
                                                <div className="text-[#e6d5b8]/70 text-sm font-bold mb-1">STAGE</div>
                                                <div className="text-3xl md:text-4xl font-black text-[#e6d5b8] drop-shadow-md">
                                                    {chapter}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[#e6d5b8] font-bold text-sm mb-1">
                                                    CLEARED: {clearedCount}/{chapterStages.length}
                                                </div>
                                                <div className="flex items-center gap-1 text-yellow-400 font-mono text-xs">
                                                    ⭐{totalStars}/⭐{chapterStages.length * 3}
                                                </div>
                                            </div>
                                        </div>
                                        {isLocked && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                                                <span className="text-gray-400 font-bold text-xl">LOCKED</span>
                                            </div>
                                        )}
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
                                            disabled={isLocked}
                                            className={`
                                                w-full min-h-40 md:min-h-48 rounded-xl border-4 shadow-xl relative overflow-hidden flex flex-col p-6 transition-transform active:scale-95
                                                ${isLocked
                                                    ? 'bg-gray-800 border-gray-700 opacity-60'
                                                    : 'bg-gradient-to-br from-[#5c3a1e] via-[#8b5a2b] to-[#5c3a1e] border-[#d4af37] hover:brightness-110'}
                                            `}
                                        >
                                            {/* BOSS Badge with Stars */}
                                            <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                                                <div className="bg-[#d4af37] text-[#2c1810] px-3 py-1 rounded-full font-black text-xs md:text-sm shadow-lg flex items-center gap-2">
                                                    ⚔️ BOSS BATTLE
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
                                                    <div className="bg-green-500 text-white px-3 py-1 rounded-full font-bold text-xs shadow-lg">
                                                        ✓ CLEARED
                                                    </div>
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
                                                <div className="text-[#d4af37] text-xs font-bold mb-2 text-center">REVIEW KANJI</div>
                                                <div className="grid grid-cols-5 md:grid-cols-8 gap-2 justify-items-center max-w-xs mx-auto">
                                                    {kanjis.map(k => (
                                                        <div key={k.id} className={`w-8 h-8 md:w-10 md:h-10 rounded flex items-center justify-center text-sm md:text-base font-bold ${isLocked ? 'bg-gray-700 text-gray-500' : 'bg-[#d4af37] text-[#2c1810] shadow-md'}`}>
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
                                        disabled={isLocked}
                                        className={`
                                            w-full h-24 md:h-28 rounded-lg border-2 shadow-md relative overflow-hidden flex items-center px-4 transition-transform active:scale-95
                                            ${isLocked
                                                ? 'bg-gray-800 border-gray-700 opacity-60'
                                                : 'bg-[#e6d5b8] border-[#8b5a2b] hover:bg-[#f0e6d2]'}
                                        `}
                                    >
                                        {/* Left: Stage Info */}
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <div className={`font-bold text-lg md:text-xl ${isLocked ? 'text-gray-500' : 'text-[#5c3a1e]'}`}>
                                                    {stage.isBoss ? 'BOSS' : `STAGE ${stage.chapter}-${stage.displayNumber}`}
                                                </div>
                                                {/* Star Rating Display */}
                                                {!isLocked && (
                                                    <div className="flex gap-0.5">
                                                        {[1, 2, 3].map(star => {
                                                            const rating = stageRatings[`${profile.currentVersion}-${stage.world}-${stage.order}`] || 0;
                                                            return (
                                                                <span key={star} className={`text-sm ${star <= rating ? 'text-yellow-400' : 'text-gray-400'}`}>
                                                                    ⭐
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                {kanjis.map(k => (
                                                    <div key={k.id} className={`w-6 h-6 md:w-8 md:h-8 rounded flex items-center justify-center text-xs md:text-sm font-bold ${isLocked ? 'bg-gray-700 text-gray-500' : 'bg-[#8b5a2b] text-[#e6d5b8]'}`}>
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
                                                <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg transform rotate-12 border border-white shadow-sm">
                                                    CLEAR
                                                </div>
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
            <div
                className="bg-[#2c1810] p-2 border-t border-[#8b5a2b] flex items-center justify-center gap-4 cursor-pointer hover:bg-[#3a2015] transition-colors"
                onClick={() => {
                    playSfx('select');
                    setShowPartnerModal(true);
                }}
            >
                <div className="w-10 h-10 rounded-full bg-gray-800 border border-cyan-500 overflow-hidden">
                    <img src={getAssetPath(`/monsters/${currentPartner.id}.png`)} alt={currentPartner.name} className="w-full h-full object-cover" />
                </div>
                <div className="text-[#e6d5b8] text-xs">
                    <div className="font-bold">{currentPartner.name}</div>
                    <div>Lv.{stats.playerLevel}</div>
                </div>
                <div className="text-[#e6d5b8]/50 text-xs">▶ Change</div>
            </div>

            {/* Partner Select Modal */}
            <PartnerSelectModal
                isOpen={showPartnerModal}
                onClose={() => setShowPartnerModal(false)}
            />
        </div>
    );
};

export default WorldMap;
