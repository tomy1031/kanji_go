import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { getAllKanji } from '../../lib/kanjiUtils';
import { getStages, type StageData } from '../../lib/stageUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface PracticeModeProps {
    onBack: () => void;
}

const PracticeMode: React.FC<PracticeModeProps> = ({ onBack }) => {
    const { progress, maxUnlockedStage } = useUserStore();
    const [activeTab, setActiveTab] = useState<'ALL' | 'LEARNING' | 'MASTERED'>('ALL');
    const [selectedStage, setSelectedStage] = useState<number | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [stages, setStages] = useState<StageData[]>([]);

    useEffect(() => {
        setStages(getStages(maxUnlockedStage));
    }, [maxUnlockedStage]);

    const allKanji = getAllKanji();

    const filteredKanji = allKanji.filter(k => {
        const item = progress[k.id];
        const masteryCount = item ? item.masteryCount : 0;

        // Stage Filter
        if (selectedStage !== 'ALL' && k.stage !== selectedStage) return false;

        // Tab Filter
        // ALL: Show everything
        // LEARNING: 1 <= mastery < 10
        // MASTERED: mastery >= 10
        // UNLEARNED (Implicit in ALL, or maybe add a specific tab? User asked for clear distinction)

        if (activeTab === 'LEARNING') {
            if (masteryCount === 0 || masteryCount >= 10) return false;
        } else if (activeTab === 'MASTERED') {
            if (masteryCount < 10) return false;
        }

        // Search Filter
        const matchesSearch = k.char.includes(searchTerm) ||
            k.meanings.some(m => m.toLowerCase().includes(searchTerm.toLowerCase())) ||
            k.readings.on.some(r => r.toLowerCase().includes(searchTerm.toLowerCase())) ||
            k.readings.kun.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesSearch;
    });

    return (
        <div className="w-full h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/backgrounds/practice_dojo.png')] bg-cover bg-center opacity-50" />
            <div className="absolute inset-0 bg-black/40" /> {/* Overlay for readability */}
            {/* Header */}
            <div className="p-6 flex justify-between items-center bg-gray-800 shadow-md z-10">
                <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-2">
                    <span>←</span> Back
                </button>
                <h2 className="text-2xl font-bold tracking-widest">PRACTICE MODE</h2>
                <div className="w-16" /> {/* Spacer */}
            </div>

            {/* Controls */}
            <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex flex-col gap-4">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    {/* Tabs */}
                    <div className="flex gap-2 bg-gray-900 p-1 rounded-lg">
                        {(['ALL', 'LEARNING', 'MASTERED'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-md transition-colors ${activeTab === tab ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Stage Selector */}
                    <select
                        value={selectedStage}
                        onChange={(e) => setSelectedStage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500"
                    >
                        <option value="ALL">All Stages</option>
                        {stages.map(stage => (
                            <option key={stage.id} value={stage.id}>
                                Stage {stage.id} ({stage.status})
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
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {filteredKanji.map((kanji) => {
                            const item = progress[kanji.id];
                            const mastery = item ? item.masteryCount : 0;
                            const isMastered = mastery >= 10;
                            const isLearning = mastery > 0 && mastery < 10;
                            const isUnlearned = mastery === 0;

                            return (
                                <motion.div
                                    key={kanji.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className={`
                                        rounded-xl p-4 border transition-all flex gap-4 relative overflow-hidden
                                        ${isMastered ? 'bg-gray-800 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]' :
                                            isLearning ? 'bg-gray-800 border-cyan-500/50' :
                                                'bg-gray-800/50 border-gray-700 opacity-80'}
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
                                                style={{ width: `${Math.min(100, (mastery / 10) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="text-right text-xs text-gray-400 mt-1">
                                            {mastery} / 10
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {filteredKanji.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <div className="text-4xl mb-4">📭</div>
                        <p>No Kanji found matching your criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PracticeMode;
