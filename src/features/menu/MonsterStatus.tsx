import React, { useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { MONSTER_DB, getMonsterStats } from '../../lib/evolutionUtils';
import MonsterDisplay from '../battle/MonsterDisplay';

interface MonsterStatusProps {
    onBack: () => void;
}

const MonsterStatus: React.FC<MonsterStatusProps> = ({ onBack }) => {
    const { partners, stats, evolvePartner } = useUserStore();
    const [selectedSkin, setSelectedSkin] = useState<string>(partners.currentMonsterId);

    const currentMonster = MONSTER_DB[partners.currentMonsterId];
    const previewMonster = MONSTER_DB[selectedSkin];
    // Use the same growth formula as battle so the menu matches in-combat stats
    const previewStats = getMonsterStats(selectedSkin, stats.playerLevel);

    const isUnlocked = (skinId: string) => partners.unlockedSkins.includes(skinId);

    const handleEquip = () => {
        if (isUnlocked(selectedSkin)) {
            evolvePartner(selectedSkin); // Reusing evolvePartner to set current monster ID
        }
    };

    // Get all monsters in the same evolution line (simplified: just showing all for now or filtering by element?)
    // For now, let's show all monsters that match the current monster's element to simulate "evolution line" or just all.
    // Better: Traverse the tree. But for simplicity, let's just show all defined in MONSTER_DB.
    const allSkins = Object.values(MONSTER_DB).filter(m => m.element === currentMonster.element);

    return (
        <div className="w-full min-h-dvh bg-gray-800 text-white flex flex-col">
            {/* Header */}
            <div className="p-6 flex justify-between items-center bg-gray-900 shadow-md">
                <button onClick={onBack} className="text-gray-400 hover:text-white">← Back</button>
                <h2 className="text-2xl font-bold">PARTNER STATUS</h2>
                <div className="w-8" />
            </div>

            <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">
                {/* Left: Preview */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-800 to-gray-900 relative">
                    <div className="absolute top-4 left-4 bg-black/50 px-4 py-2 rounded-full">
                        <span className="text-cyan-400 font-bold">Lv.{stats.playerLevel}</span>
                    </div>

                    <MonsterDisplay
                        name={previewMonster.name}
                        element={previewMonster.element}
                        level={stats.playerLevel}
                        hp={previewStats.hp}
                        maxHp={previewStats.hp}
                        imagePath={`/monsters/${previewMonster.id}.png`}
                    />

                    <div className="mt-8 text-center">
                        <h3 className="text-3xl font-bold mb-2">{previewMonster.name}</h3>
                        <div className="flex justify-center gap-4 mb-4 text-sm font-mono text-cyan-300">
                            <span>HP: {previewStats.hp}</span>
                            <span>ATK: {previewStats.attack}</span>
                        </div>
                        <p className="text-gray-400 max-w-md">{previewMonster.description}</p>
                    </div>

                    {!isUnlocked(selectedSkin) && (
                        <div className="mt-4 bg-red-500/20 text-red-300 px-4 py-2 rounded border border-red-500/50">
                            🔒 {previewMonster.unlockText}
                        </div>
                    )}

                    {isUnlocked(selectedSkin) && selectedSkin !== partners.currentMonsterId && (
                        <button
                            onClick={handleEquip}
                            className="mt-6 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all"
                        >
                            EQUIP SKIN
                        </button>
                    )}
                    {selectedSkin === partners.currentMonsterId && (
                        <div className="mt-6 text-green-400 font-bold flex items-center gap-2">
                            ✓ EQUIPPED
                        </div>
                    )}
                </div>

                {/* Right: Skin List */}
                <div className="w-full md:w-96 bg-gray-900 border-l border-gray-700 overflow-y-auto p-6">
                    <h3 className="text-xl font-bold mb-4 text-gray-300">CHANGE CHARACTER</h3>
                    <div className="flex flex-col gap-4">
                        {allSkins.map((skin) => (
                            <button
                                key={skin.id}
                                onClick={() => setSelectedSkin(skin.id)}
                                className={`
                                    flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                                    ${selectedSkin === skin.id ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-700 hover:border-gray-500'}
                                    ${!isUnlocked(skin.id) ? 'opacity-50 grayscale' : ''}
                                `}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-800 text-2xl`}>
                                    {isUnlocked(skin.id) ? (skin.element === 'FIRE' ? '🔥' : skin.element === 'AQUA' ? '💧' : '🌿') : '?'}
                                </div>
                                <div>
                                    <div className="font-bold">{isUnlocked(skin.id) ? skin.name : '???'}</div>
                                    <div className="text-xs text-gray-500">
                                        {isUnlocked(skin.id) ? `HP: ${skin.baseHp} | ATK: ${skin.baseAttack}` : 'Locked'}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonsterStatus;
