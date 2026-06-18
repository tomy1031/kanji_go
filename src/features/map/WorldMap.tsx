import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { MONSTER_DB } from '../../lib/evolutionUtils';
import { getStages, type StageData } from '../../lib/stageUtils';
import { useSound } from '../../hooks/useSound';
import { getEnemyForStage } from '../../lib/enemyUtils';
import { getKanjiForStage } from '../../lib/kanjiUtils';
import { preloadCharData } from '../../lib/kanjiDataLoader';

interface WorldMapProps {
    onLevelSelect: (levelId: string) => void;
}

const WorldMap: React.FC<WorldMapProps> = ({ onLevelSelect }) => {
    const { stats, partners, setCurrentStage, maxUnlockedStage } = useUserStore();
    const currentPartner = MONSTER_DB[partners.currentMonsterId];
    const [stages, setStages] = useState<StageData[]>([]);
    const { playBgm, playSfx } = useSound();

    useEffect(() => {
        playBgm('map');
    }, [playBgm]);

    useEffect(() => {
        setStages(getStages(maxUnlockedStage));
    }, [maxUnlockedStage]);

    const handleStageClick = (stage: StageData) => {
        if (stage.status === 'locked') return;
        playSfx('select');
        // Warm the stroke-data cache before entering the battle so the writing
        // canvas is ready the moment the stage starts.
        preloadCharData(getKanjiForStage(stage.id).map((k) => k.char));
        setCurrentStage(stage.id);
        onLevelSelect(stage.id.toString());
    };

    // Calculate positions for a simple path (zigzag or curve)
    const getPosition = (index: number) => {
        const x = 20 + (index % 3) * 30;
        const y = 80 - Math.floor(index / 3) * 20;
        return { x, y };
    };

    return (
        <div className="w-full h-dvh bg-[#1a1a2e] relative overflow-hidden">
            {/* Background Map Image */}
            <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

            {/* HUD */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-4 bg-gray-900/80 p-4 rounded-xl border border-gray-700 backdrop-blur-md">
                {/* Partner Image */}
                <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-cyan-500 overflow-hidden relative flex items-center justify-center">
                    <img src={`/monsters/${currentPartner.id}.png`} alt={currentPartner.name} className="w-full h-full object-cover" />
                </div>

                <div>
                    <div className="font-bold text-white">{currentPartner.name}</div>
                    <div className="text-xs text-cyan-400">Lv. {stats.playerLevel}</div>
                    {/* HP Bar */}
                    <div className="w-32 h-2 bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-green-500 w-full" />
                    </div>
                </div>
            </div>

            {/* Map Nodes */}
            {stages.map((stage, index) => {
                const pos = getPosition(index);
                const enemy = getEnemyForStage(stage.id);

                return (
                    <motion.button
                        key={stage.id}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        whileHover={{ scale: 1.2 }}
                        onClick={() => handleStageClick(stage)}
                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                        className={`
                            absolute w-20 h-20 rounded-full border-4 shadow-lg z-10 flex items-center justify-center overflow-hidden
                            ${stage.status === 'cleared' ? 'bg-green-600 border-green-400' :
                                stage.status === 'unlocked' ? 'bg-yellow-500 border-yellow-300 animate-pulse' :
                                    'bg-gray-700 border-gray-600 cursor-not-allowed grayscale'}
                        `}
                    >
                        {enemy ? (
                            <img src={enemy.imagePath} alt={enemy.name} className="w-full h-full object-cover opacity-80 hover:opacity-100" />
                        ) : (
                            <div className="flex flex-col items-center">
                                <span className="font-bold text-white text-lg">{stage.id}</span>
                            </div>
                        )}

                        {stage.isBoss && <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1 font-bold">BOSS</span>}

                        <div className="absolute -bottom-8 whitespace-nowrap text-white font-bold text-shadow-sm bg-black/50 px-2 rounded z-20">
                            {stage.name}
                        </div>
                    </motion.button>
                );
            })}

            {/* Path Lines (Simplified) */}
            <svg className="absolute inset-0 pointer-events-none opacity-50">
                {stages.map((_, index) => {
                    if (index === 0) return null;
                    const prev = getPosition(index - 1);
                    const curr = getPosition(index);
                    return (
                        <line
                            key={index}
                            x1={`${prev.x}%`} y1={`${prev.y}%`}
                            x2={`${curr.x}%`} y2={`${curr.y}%`}
                            stroke="white" strokeWidth="4" strokeDasharray="10 10"
                        />
                    );
                })}
            </svg>
        </div>
    );
};

export default WorldMap;
