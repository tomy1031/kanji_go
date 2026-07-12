import React, { useState, useRef, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { getAllKanji } from '../../lib/kanjiUtils';
import { getStages } from '../../lib/stageUtils';
import { MONSTER_DB } from '../../lib/evolutionUtils';
import { getMetaMonsterForStage } from '../../lib/enemyUtils';
import { PRACTICE_MASTERY_COUNT } from '../../lib/constants';
import { preloadCharData } from '../../lib/kanjiStrokeLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { getAssetPath } from '../../utils/assetUtils';
import KanjiWriterCanvas, { type KanjiWriterHandle } from '../../components/KanjiWriterCanvas';
import ScoreAttack from './ScoreAttack';
import { useSound } from '../../hooks/useSound';
import { useCanvasSize } from '../../hooks/useCanvasSize';

interface PracticeModeProps {
    onBack: () => void;
}

const PracticeMode: React.FC<PracticeModeProps> = ({ onBack }) => {
    const { progress, maxUnlockedStage, profile, partners, scoreAttackBest, incrementPracticeCount, addExp, checkPracticeStageCompletion, recordDailyActivity } = useUserStore();
    const { playBgm, playStroke } = useSound();
    const [activeTab, setActiveTab] = useState<'NEW+LEARNING' | 'ALL' | 'LEARNING' | 'MASTERED'>('NEW+LEARNING');
    const [selectedStage, setSelectedStage] = useState<string | 'ALL'>('ALL'); // Changed to string for world-order keys
    const [searchTerm, setSearchTerm] = useState('');
    const [practiceTarget, setPracticeTarget] = useState<string | null>(null); // ID of kanji being practiced
    const [showSample, setShowSample] = useState(false);
    const canvasRef = useRef<KanjiWriterHandle>(null);
    const [unlockedMonster, setUnlockedMonster] = useState<string | null>(null);
    const [masteredChar, setMasteredChar] = useState<string | null>(null); // celebration on reaching the mastery count
    const [countPulse, setCountPulse] = useState(0); // re-triggers the +1 pulse animation
    const [showScoreAttack, setShowScoreAttack] = useState(false);
    const [streakToast, setStreakToast] = useState<number | null>(null);
    const strokeComboRef = useRef(0); // per-character stroke counter for the rising-pitch blip
    const canvasSize = useCanvasSize(300, 0.38);

    // Play practice BGM on mount
    useEffect(() => {
        playBgm('practice');
    }, [playBgm]);

    const allKanji = getAllKanji().filter(k => k.level === profile.currentVersion);
    const availableStages = getStages(maxUnlockedStage, profile.currentVersion);

    const filteredKanji = allKanji.filter(k => {
        const item = progress[k.id];
        // Mastery in Practice Mode is defined by practiceCount >= 20
        const practiceCount = item ? (item.practiceCount || 0) : 0;
        const isMastered = practiceCount >= PRACTICE_MASTERY_COUNT;
        const isLearning = practiceCount > 0 && practiceCount < PRACTICE_MASTERY_COUNT;

        // Stage Filter - now using composite world-order key
        // For BOSS stages (order 4), show all kanji from that world (order 1-3)
        if (selectedStage !== 'ALL') {
            const [selWorld, selOrder] = selectedStage.split('-').map(Number);
            if (selOrder === 4) {
                // BOSS stage: show all kanji from this chapter (world)
                if (k.world !== selWorld) return false;
            } else {
                // Normal stage: exact match
                const stageKey = `${k.world}-${k.order}`;
                if (stageKey !== selectedStage) return false;
            }
        }

        // Tab Filter
        if (activeTab === 'NEW+LEARNING') {
            if (isMastered) return false; // Hide mastered
        } else if (activeTab === 'LEARNING') {
            if (!isLearning) return false;
        } else if (activeTab === 'MASTERED') {
            if (!isMastered) return false;
        }
        // 'ALL' shows everything

        // Search Filter
        const matchesSearch = k.char.includes(searchTerm) ||
            k.meanings.some(m => m.toLowerCase().includes(searchTerm.toLowerCase())) ||
            k.readings.on.some(r => r.toLowerCase().includes(searchTerm.toLowerCase())) ||
            k.readings.kun.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesSearch;
    });

    const handlePracticeComplete = () => {
        if (practiceTarget) {
            // Detect crossing the mastery threshold BEFORE incrementing
            const prevCount = progress[practiceTarget]?.practiceCount || 0;
            incrementPracticeCount(practiceTarget);
            setCountPulse(p => p + 1);
            strokeComboRef.current = 0;

            // Daily streak (counts once per day)
            const { milestone } = recordDailyActivity();
            if (milestone) {
                setStreakToast(milestone);
                setTimeout(() => setStreakToast(null), 3500);
            }

            const completedKanji = allKanji.find(k => k.id === practiceTarget);
            if (prevCount + 1 === PRACTICE_MASTERY_COUNT && completedKanji) {
                setMasteredChar(completedKanji.char);
                setTimeout(() => setMasteredChar(null), 2800);
            }

            // Add EXP (10 * World Number)
            const targetKanji = completedKanji;
            if (targetKanji && targetKanji.world) {
                addExp(10 * targetKanji.world);

                // Check Meta Monster Unlock (Stage Completion)
                if (targetKanji.order) {
                    const unlockedMetaId = checkPracticeStageCompletion(
                        targetKanji.world,
                        targetKanji.order,
                        profile.currentVersion
                    );

                    // Show unlock notification
                    if (unlockedMetaId) {
                        setUnlockedMonster(unlockedMetaId);
                        setTimeout(() => setUnlockedMonster(null), 3000);
                    }
                }
            }
        }
    };

    const handleGuideClick = () => {
        canvasRef.current?.animateStroke();
    };

    // Preload stroke data around the current practice target so navigating
    // prev/next renders instantly (the shared cache keeps them for the session).
    useEffect(() => {
        if (!practiceTarget) return;
        const idx = filteredKanji.findIndex(k => k.id === practiceTarget);
        if (idx < 0) return;
        const window = filteredKanji.slice(Math.max(0, idx - 1), idx + 6).map(k => k.char);
        preloadCharData(window);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [practiceTarget]);

    const handleNextKanji = () => {
        const currentIndex = filteredKanji.findIndex(k => k.id === practiceTarget);
        if (currentIndex < filteredKanji.length - 1) {
            setPracticeTarget(filteredKanji[currentIndex + 1].id);
        }
    };

    const handlePreviousKanji = () => {
        const currentIndex = filteredKanji.findIndex(k => k.id === practiceTarget);
        if (currentIndex > 0) {
            setPracticeTarget(filteredKanji[currentIndex - 1].id);
        }
    };

    // Score Attack mode (60s personal-best rush)
    if (showScoreAttack) {
        return <ScoreAttack onBack={() => setShowScoreAttack(false)} />;
    }

    // Practice Screen View
    if (practiceTarget) {
        const targetKanji = allKanji.find(k => k.id === practiceTarget);
        if (!targetKanji) return null;

        const item = progress[targetKanji.id];
        const practiceCount = item ? (item.practiceCount || 0) : 0;
        const isMastered = practiceCount >= PRACTICE_MASTERY_COUNT;

        const currentIndex = filteredKanji.findIndex(k => k.id === practiceTarget);
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex < filteredKanji.length - 1;

        // Format example sentence with underline for the kanji
        const exampleDisplay = targetKanji.exampleSentence || '';

        return (
            <div className="w-full h-dvh bg-gray-900 text-white flex flex-col relative overflow-hidden">
                {/* Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-30"
                    style={{ backgroundImage: `url(${getAssetPath('/backgrounds/practice_dojo.png')})` }}
                />

                {/* Header */}
                <div className="px-3 py-2 md:p-4 flex justify-between items-center bg-gray-800 shadow-md z-10 relative">
                    <button onClick={() => setPracticeTarget(null)} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm md:text-base">
                        <span>←</span> もどる
                    </button>
                    <h2 className="text-base md:text-xl font-bold tracking-widest">書き取り練習</h2>
                    <div className="text-xs md:text-sm text-gray-400 font-mono">
                        {currentIndex + 1} / {filteredKanji.length}
                    </div>
                </div>

                {/* Navigation Arrows - side positioned (wide screens only; on
                    phones they would overlap the canvas, so a bottom bar is used) */}
                {hasPrevious && (
                    <button
                        onClick={handlePreviousKanji}
                        aria-label="前の漢字"
                        className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 border-2 border-cyan-300/30"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                {hasNext && (
                    <button
                        onClick={handleNextKanji}
                        aria-label="次の漢字"
                        className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 border-2 border-cyan-300/30"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* Content */}
                <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-2 md:p-4 min-h-0">
                    <div className="mb-2 md:mb-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                            <div className="text-4xl md:text-6xl font-black text-white drop-shadow-lg">{targetKanji.char}</div>
                            <div className="text-left">
                                <div className="text-base md:text-xl text-cyan-300 font-bold leading-tight">{targetKanji.meanings[0]}</div>
                                <div className="text-xs md:text-sm text-gray-400 font-mono">
                                    {targetKanji.readings.on.join(' / ')}
                                </div>
                            </div>
                        </div>
                        {exampleDisplay && (
                            <div className="mt-2 text-sm md:text-lg text-white bg-black/50 px-3 py-1.5 rounded-lg border border-cyan-500/30 max-w-[92vw] mx-auto">
                                <span className="font-mono">{exampleDisplay}</span>
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <KanjiWriterCanvas
                            ref={canvasRef}
                            char={targetKanji.char}
                            size={canvasSize}
                            onCorrectStroke={() => {
                                strokeComboRef.current += 1;
                                playStroke(strokeComboRef.current);
                            }}
                            onMistake={() => {
                                strokeComboRef.current = 0;
                            }}
                            onComplete={handlePracticeComplete}
                            quizMode={true}
                            showSample={showSample}
                        />

                        {/* Controls below canvas */}
                        <div className="mt-2 md:mt-4 flex gap-3 justify-center">
                            <button
                                onClick={() => setShowSample(!showSample)}
                                className={`px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-full font-bold transition-colors ${showSample ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                            >
                                手本: {showSample ? 'ON' : 'OFF'}
                            </button>
                            <button
                                onClick={handleGuideClick}
                                className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-full font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                            >
                                書き順
                            </button>
                        </div>
                    </div>

                    {/* Completion count — dot meter + number, pulses on each write */}
                    <div className="mt-3 md:mt-6 bg-black/60 px-4 py-2.5 md:px-6 md:py-3 rounded-xl border border-gray-700 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-1.5 mb-1.5">
                            {Array.from({ length: PRACTICE_MASTERY_COUNT }, (_, i) => (
                                <div
                                    key={i}
                                    className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full transition-colors duration-300 ${i < practiceCount ? (isMastered ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)]' : 'bg-cyan-400') : 'bg-gray-700'}`}
                                />
                            ))}
                        </div>
                        <motion.div
                            key={countPulse}
                            initial={{ scale: 1.35 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            className={`text-2xl md:text-3xl font-black ${isMastered ? 'text-yellow-400' : 'text-white'}`}
                        >
                            {Math.min(practiceCount, PRACTICE_MASTERY_COUNT)} <span className="text-base md:text-lg text-gray-500">/ {PRACTICE_MASTERY_COUNT} 回</span>
                        </motion.div>
                        <div className={`text-xs font-bold mt-0.5 ${isMastered ? 'text-yellow-400' : 'text-gray-500'}`}>
                            {isMastered ? '⭐ マスター済み！' : `あと ${PRACTICE_MASTERY_COUNT - practiceCount} 回でマスター`}
                        </div>
                    </div>
                </div>

                {/* Bottom navigation (phones) */}
                <div className="md:hidden relative z-10 px-4 pb-3 pt-1 flex gap-3">
                    <button
                        onClick={handlePreviousKanji}
                        disabled={!hasPrevious}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm border ${hasPrevious ? 'bg-gray-800 border-cyan-500/40 text-cyan-300 active:bg-gray-700' : 'bg-gray-800/40 border-gray-700 text-gray-600'}`}
                    >
                        ← 前の漢字
                    </button>
                    <button
                        onClick={handleNextKanji}
                        disabled={!hasNext}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm border ${hasNext ? 'bg-cyan-700 border-cyan-400/50 text-white active:bg-cyan-600' : 'bg-gray-800/40 border-gray-700 text-gray-600'}`}
                    >
                        次の漢字 →
                    </button>
                </div>

                {/* Streak milestone toast */}
                <AnimatePresence>
                    {streakToast && (
                        <motion.div
                            initial={{ y: -60, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -60, opacity: 0 }}
                            className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black px-5 py-2 rounded-full border border-yellow-300 shadow-xl text-xs md:text-sm whitespace-nowrap"
                        >
                            🔥 {streakToast}日 れんぞく達成！ ボーナスEXP ＆ ストリーク保護 +1
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mastery celebration overlay */}
                <AnimatePresence>
                    {masteredChar && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none"
                        >
                            <motion.div
                                initial={{ scale: 0.5, y: 30 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 1.2, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 250, damping: 18 }}
                                className="text-center px-8 py-6 rounded-3xl bg-gradient-to-b from-yellow-500/20 to-orange-500/10 border-2 border-yellow-400 shadow-[0_0_60px_rgba(250,204,21,0.4)]"
                            >
                                <div className="text-5xl mb-2">🎉</div>
                                <div className="text-7xl md:text-8xl font-black text-yellow-300 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] mb-2">{masteredChar}</div>
                                <div className="text-2xl md:text-3xl font-black text-white tracking-widest">コンプリート！</div>
                                <div className="text-sm text-yellow-200 mt-1 font-bold">{PRACTICE_MASTERY_COUNT}回 書き切りました — マスター達成！</div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Monster Unlock Notification */}
                <AnimatePresence>
                    {unlockedMonster && MONSTER_DB[unlockedMonster] && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="absolute bottom-4 left-4 right-4 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl p-4 flex items-center gap-4 shadow-lg border-2 border-yellow-400 z-30"
                        >
                            <img
                                src={getAssetPath(`/monsters/${unlockedMonster}.png`)}
                                alt="New Monster"
                                className="w-16 h-16 object-contain"
                            />
                            <div className="flex-1">
                                <div className="text-yellow-200 text-xs font-bold">🎉 NEW MONSTER UNLOCKED!</div>
                                <div className="text-white text-lg font-bold">{MONSTER_DB[unlockedMonster].name}</div>
                                <div className="text-yellow-200 text-xs">チャプターをマスターしました！</div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // ---- List View ----
    // Reward monster for the currently selected stage (visualizes what you get
    // for mastering all of its kanji).
    let rewardInfo: {
        monsterId: string;
        unlocked: boolean;
        masteredCount: number;
        totalCount: number;
    } | null = null;
    if (selectedStage !== 'ALL') {
        const [selWorld, selOrder] = selectedStage.split('-').map(Number);
        const metaId = getMetaMonsterForStage(selWorld, selOrder, profile.currentVersion);
        if (metaId && MONSTER_DB[metaId]) {
            const targetOrders = selOrder === 4 ? [1, 2, 3] : [selOrder];
            const stageKanjiAll = allKanji.filter(k => k.world === selWorld && k.order && targetOrders.includes(k.order));
            const masteredCount = stageKanjiAll.filter(k => (progress[k.id]?.practiceCount || 0) >= PRACTICE_MASTERY_COUNT).length;
            rewardInfo = {
                monsterId: metaId,
                unlocked: partners.unlockedSkins.includes(metaId),
                masteredCount,
                totalCount: stageKanjiAll.length,
            };
        }
    }

    return (
        <div className="w-full h-dvh bg-gray-900 text-white flex flex-col relative overflow-hidden">
            {/* Background */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-50"
                style={{ backgroundImage: `url(${getAssetPath('/backgrounds/practice_dojo.png')})` }}
            />
            <div className="absolute inset-0 bg-black/40" /> {/* Overlay for readability */}

            {/* Header */}
            <div className="px-4 py-3 md:p-6 flex justify-between items-center bg-gray-800 shadow-md z-10 relative">
                <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-2">
                    <span>←</span> もどる
                </button>
                <h2 className="text-lg md:text-xl font-bold tracking-widest">練習モード</h2>
                <div className="w-16" /> {/* Spacer */}
            </div>

            {/* Controls */}
            <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex flex-col gap-4 relative z-10">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    {/* Tabs */}
                    <div className="flex gap-2 bg-gray-900 p-1 rounded-lg overflow-x-auto">
                        {([
                            { id: 'NEW+LEARNING', label: '未習得' },
                            { id: 'ALL', label: '全て' },
                            { id: 'LEARNING', label: '学習中' },
                            { id: 'MASTERED', label: 'マスター' }
                        ] as const).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-md transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Stage Selector */}
                    <select
                        value={selectedStage}
                        onChange={(e) => setSelectedStage(e.target.value === 'ALL' ? 'ALL' : e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500"
                    >
                        <option value="ALL">All Stages</option>
                        {availableStages.map((stage) => (
                            <option key={`${stage.world}-${stage.order}`} value={`${stage.world}-${stage.order}`}>
                                {stage.name}
                            </option>
                        ))}
                    </select>

                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search Kanji..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 w-full md:w-64 focus:outline-none focus:border-cyan-500"
                    />

                    {/* Score Attack entry */}
                    <button
                        onClick={() => setShowScoreAttack(true)}
                        className="px-4 py-2 rounded-lg font-black text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 border border-fuchsia-400/40 hover:brightness-110 active:scale-95 transition-all whitespace-nowrap"
                    >
                        ⏱️ スコアアタック
                        {((scoreAttackBest || {})[profile.currentVersion] || 0) > 0 && (
                            <span className="ml-1 text-xs text-fuchsia-200">🏆{(scoreAttackBest || {})[profile.currentVersion]}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Stage reward banner — shows WHICH monster you get for mastering
                the selected stage's kanji (silhouette until unlocked) */}
            {rewardInfo && (
                <div className="relative z-10 px-4 pt-3">
                    <div className={`max-w-2xl mx-auto flex items-center gap-3 rounded-xl px-4 py-2.5 border ${rewardInfo.unlocked ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-black/50 border-purple-500/40'}`}>
                        <div className="relative w-14 h-14 shrink-0 rounded-full bg-gray-900/80 border border-white/10 flex items-center justify-center overflow-hidden">
                            <img
                                src={getAssetPath(`/monsters/${rewardInfo.monsterId}.png`)}
                                alt="reward monster"
                                className={`w-11 h-11 object-contain ${rewardInfo.unlocked ? '' : 'brightness-0 opacity-70'}`}
                            />
                            {!rewardInfo.unlocked && <span className="absolute text-white/90 font-black text-lg">?</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            {rewardInfo.unlocked ? (
                                <>
                                    <div className="text-yellow-300 text-xs font-bold">✓ ゲット済み</div>
                                    <div className="text-white font-bold truncate">{MONSTER_DB[rewardInfo.monsterId].name}</div>
                                </>
                            ) : (
                                <>
                                    <div className="text-purple-300 text-xs font-bold">ごほうびモンスター</div>
                                    <div className="text-white text-sm font-bold">全部マスターすると仲間になる！</div>
                                </>
                            )}
                            {/* Mastery progress toward the reward */}
                            <div className="mt-1 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${rewardInfo.unlocked ? 'bg-yellow-400' : 'bg-purple-400'} transition-all duration-500`}
                                        style={{ width: `${rewardInfo.totalCount ? (rewardInfo.masteredCount / rewardInfo.totalCount) * 100 : 0}%` }}
                                    />
                                </div>
                                <span className="text-[11px] text-gray-400 font-mono whitespace-nowrap">{rewardInfo.masteredCount}/{rewardInfo.totalCount} マスター</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 relative z-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {filteredKanji.map((kanji) => {
                            const item = progress[kanji.id];
                            const practiceCount = item ? (item.practiceCount || 0) : 0;
                            const isMastered = practiceCount >= PRACTICE_MASTERY_COUNT;
                            const isLearning = practiceCount > 0 && practiceCount < PRACTICE_MASTERY_COUNT;
                            const isUnlearned = practiceCount === 0;

                            return (
                                <motion.button
                                    key={kanji.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    onClick={() => setPracticeTarget(kanji.id)}
                                    className={`
                                        rounded-xl p-4 border transition-all flex gap-4 relative overflow-hidden text-left w-full
                                        ${isMastered ? 'bg-gray-800 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)] hover:bg-gray-700' :
                                            isLearning ? 'bg-gray-800 border-cyan-500/50 hover:bg-gray-700' :
                                                'bg-gray-800/50 border-gray-700 opacity-80 hover:opacity-100 hover:bg-gray-700'}
                                    `}
                                >
                                    {/* Status Badge */}
                                    <div className="absolute top-2 right-2">
                                        {isMastered && <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">MASTER</span>}
                                        {isLearning && <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded">LEARNING</span>}
                                        {isUnlearned && <span className="text-xs font-bold text-gray-400 bg-gray-700 px-2 py-1 rounded">NEW</span>}
                                    </div>

                                    {/* Kanji Char */}
                                    <div className={`
                                        w-20 h-20 rounded-lg flex items-center justify-center text-5xl font-serif
                                        ${isMastered ? 'text-yellow-400 bg-yellow-900/20' :
                                            isLearning ? 'text-cyan-400 bg-cyan-900/20' :
                                                'text-gray-500 bg-gray-900'}
                                    `}>
                                        {kanji.char}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 pt-2">
                                        <div className="flex justify-between items-start pr-16">
                                            <h3 className="font-bold text-lg leading-tight">{kanji.meanings[0]}</h3>
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono mt-1 mb-2">
                                            {kanji.readings.on[0]} / {kanji.readings.kun[0]}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${isMastered ? 'bg-yellow-500' : 'bg-cyan-500'}`}
                                                style={{ width: `${Math.min(100, (practiceCount / PRACTICE_MASTERY_COUNT) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="text-right text-xs text-gray-400 mt-1">
                                            {practiceCount} / {PRACTICE_MASTERY_COUNT}
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {filteredKanji.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 mt-20">
                        <div className="text-4xl mb-4">📭</div>
                        <p>No Kanji found matching your criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PracticeMode;
