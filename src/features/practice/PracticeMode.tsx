import React, { useState, useRef, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { getAllKanji } from '../../lib/kanjiUtils';
import { getStages } from '../../lib/stageUtils';
import { MONSTER_DB } from '../../lib/evolutionUtils';
import { PRACTICE_MASTERY_COUNT } from '../../lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { getAssetPath } from '../../utils/assetUtils';
import KanjiWriterCanvas, { type KanjiWriterHandle } from '../../components/KanjiWriterCanvas';
import { useSound } from '../../hooks/useSound';

interface PracticeModeProps {
    onBack: () => void;
}

const PracticeMode: React.FC<PracticeModeProps> = ({ onBack }) => {
    const { progress, maxUnlockedStage, profile, incrementPracticeCount, addExp, checkPracticeStageCompletion } = useUserStore();
    const { playBgm } = useSound();
    const [activeTab, setActiveTab] = useState<'NEW+LEARNING' | 'ALL' | 'LEARNING' | 'MASTERED'>('NEW+LEARNING');
    const [selectedStage, setSelectedStage] = useState<string | 'ALL'>('ALL'); // Changed to string for world-order keys
    const [searchTerm, setSearchTerm] = useState('');
    const [practiceTarget, setPracticeTarget] = useState<string | null>(null); // ID of kanji being practiced
    const [showSample, setShowSample] = useState(false);
    const canvasRef = useRef<KanjiWriterHandle>(null);
    const [unlockedMonster, setUnlockedMonster] = useState<string | null>(null);

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
            incrementPracticeCount(practiceTarget);

            // Add EXP (10 * World Number)
            const targetKanji = allKanji.find(k => k.id === practiceTarget);
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
                <div className="p-4 flex justify-between items-center bg-gray-800 shadow-md z-10 relative">
                    <button onClick={() => setPracticeTarget(null)} className="text-gray-400 hover:text-white flex items-center gap-2">
                        <span>←</span> Back to List
                    </button>
                    <h2 className="text-xl font-bold tracking-widest">WRITING PRACTICE</h2>
                    <div className="text-sm text-gray-400">
                        {currentIndex + 1} / {filteredKanji.length}
                    </div>
                </div>

                {/* Navigation Arrows - Side positioned */}
                {hasPrevious && (
                    <button
                        onClick={handlePreviousKanji}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 border-2 border-cyan-300/30"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                {hasNext && (
                    <button
                        onClick={handleNextKanji}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 border-2 border-cyan-300/30"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* Content */}
                <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-4">
                    <div className="mb-4 text-center">
                        <div className="text-6xl font-black mb-2 text-white drop-shadow-lg">{targetKanji.char}</div>
                        <div className="text-xl text-cyan-300 font-bold">{targetKanji.meanings[0]}</div>
                        <div className="text-sm text-gray-400 font-mono mt-1">
                            {targetKanji.readings.on.join(' / ')}
                        </div>
                        {exampleDisplay && (
                            <div className="mt-3 text-lg text-white bg-black/50 px-4 py-2 rounded-lg border border-cyan-500/30">
                                <span className="font-mono">{exampleDisplay}</span>
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <KanjiWriterCanvas
                            ref={canvasRef}
                            char={targetKanji.char}
                            size={300}
                            onComplete={handlePracticeComplete}
                            quizMode={true}
                            showSample={showSample}
                        />

                        {/* Controls below canvas */}
                        <div className="mt-4 flex gap-4 justify-center">
                            <button
                                onClick={() => setShowSample(!showSample)}
                                className={`px-4 py-2 rounded-full font-bold transition-colors ${showSample ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                            >
                                Sample: {showSample ? 'ON' : 'OFF'}
                            </button>
                            <button
                                onClick={handleGuideClick}
                                className="px-4 py-2 rounded-full font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                            >
                                Guide
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 bg-black/50 px-6 py-3 rounded-xl border border-gray-700 text-center">
                        <div className="text-gray-400 text-sm mb-1">PRACTICE COUNT</div>
                        <div className={`text-3xl font-black ${isMastered ? 'text-yellow-400' : 'text-white'}`}>
                            {practiceCount} <span className="text-lg text-gray-500">/ {PRACTICE_MASTERY_COUNT}</span>
                        </div>
                        {isMastered && (
                            <div className="text-yellow-400 text-xs font-bold mt-1">MASTERED!</div>
                        )}
                    </div>
                </div>

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

    // List View
    return (
        <div className="w-full h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden">
            {/* Background */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-50"
                style={{ backgroundImage: `url(${getAssetPath('/backgrounds/practice_dojo.png')})` }}
            />
            <div className="absolute inset-0 bg-black/40" /> {/* Overlay for readability */}

            {/* Header */}
            <div className="p-6 flex justify-between items-center bg-gray-800 shadow-md z-10 relative">
                <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-2">
                    <span>←</span> Back
                </button>
                <h2 className="text-xl font-bold tracking-widest">PRACTICE MODE</h2>
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
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 relative z-0">
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
