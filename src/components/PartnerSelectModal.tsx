import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MONSTER_DB, getMonsterStats, type MonsterData } from '../lib/evolutionUtils';
import { useUserStore } from '../store/userStore';
import { getAssetPath } from '../utils/assetUtils';
import { ElementType } from '../types';

interface PartnerSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Element icon mapping (new 5-element system)
const ELEMENT_ICONS: Record<string, string> = {
    FIRE: '🔥',
    WATER: '💧',
    NATURE: '🌿',
    LIGHT: '✨',
    DARK: '🌑',
    BOSS: '👿'
};

type SortOption = 'default' | 'hp' | 'atk' | 'element';

const PartnerSelectModal: React.FC<PartnerSelectModalProps> = ({ isOpen, onClose }) => {
    const { partners, stats, setPartner, profile } = useUserStore();
    const [selectedSkin, setSelectedSkin] = useState<string>(partners.currentMonsterId);
    const [elementFilter, setElementFilter] = useState<ElementType | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>('default');

    const currentMonster = MONSTER_DB[partners.currentMonsterId];
    const previewMonster = MONSTER_DB[selectedSkin] || currentMonster || {
        id: 'starter_fire',
        name: 'Unknown',
        element: 'FIRE',
        weakness: 'WATER',
        baseHp: 100,
        baseAttack: 10,
        description: 'Unknown Monster',
        unlockText: 'Unknown'
    };

    const isUnlocked = (skinId: string) => partners.unlockedSkins.includes(skinId);

    // All available elements from monsters
    const allElements: ElementType[] = ['FIRE', 'WATER', 'NATURE', 'LIGHT', 'DARK'];

    // Available skins: unlocked skins that exist in MONSTER_DB
    const availableSkins: MonsterData[] = useMemo(() => {
        let skins = Object.values(MONSTER_DB).filter((skin) => {
            // Filter by Game Version
            if (skin.version && skin.version !== profile.currentVersion) return false;

            if (skin.unlockCondition === 'EVOLUTION') {
                return isUnlocked(skin.id);
            }
            if (skin.unlockCondition === 'STARTER') return true;
            if (isUnlocked(skin.id)) return true;
            return false;
        });

        // Apply element filter
        if (elementFilter) {
            skins = skins.filter(skin => skin.element === elementFilter);
        }

        // Apply sorting
        if (sortBy === 'hp') {
            skins.sort((a, b) => b.baseHp - a.baseHp);
        } else if (sortBy === 'atk') {
            skins.sort((a, b) => b.baseAttack - a.baseAttack);
        } else if (sortBy === 'element') {
            skins.sort((a, b) => a.element.localeCompare(b.element));
        }

        return skins;
    }, [elementFilter, sortBy, partners.unlockedSkins, profile.currentVersion]);

    const handleEquip = () => {
        if (isUnlocked(selectedSkin)) {
            setPartner(selectedSkin);
            onClose();
        }
    };

    const monsterStats = getMonsterStats(selectedSkin, stats.playerLevel);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">パートナーをえらぶ</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white text-2xl"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Preview Section */}
                    <div className="p-4 bg-gradient-to-b from-gray-800 to-gray-900 text-center">
                        <div className="flex items-center justify-center gap-4">
                            <div className="relative">
                                <img
                                    src={getAssetPath(`/monsters/${selectedSkin}.png`)}
                                    alt={previewMonster.name}
                                    className="w-24 h-24 object-contain"
                                />
                                {/* Element Badge on Preview */}
                                <div className="absolute -top-1 -left-1 text-xl" title="Attack Element">
                                    {ELEMENT_ICONS[previewMonster.element] || '❓'}
                                </div>
                                {/* Weakness Badge on Preview */}
                                {previewMonster.weakness && (
                                    <div className="absolute -bottom-1 -right-1 text-sm bg-black/50 rounded-full w-6 h-6 flex items-center justify-center border border-blue-400" title="Weakness">
                                        {ELEMENT_ICONS[previewMonster.weakness] || '❓'}
                                    </div>
                                )}
                            </div>
                            <div className="text-left">
                                <span className="text-xs text-cyan-400 font-bold">Lv.{stats.playerLevel}</span>
                                <h3 className="text-2xl font-bold text-white">{previewMonster.name}</h3>
                                <div className="text-sm text-cyan-300 font-mono">
                                    HP: {monsterStats.hp} ATK: {monsterStats.attack}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{previewMonster.description}</p>
                            </div>
                        </div>

                        {isUnlocked(selectedSkin) && selectedSkin !== partners.currentMonsterId && (
                            <button
                                onClick={handleEquip}
                                className="mt-4 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-full font-bold shadow-lg transition-all"
                            >
                                つかう
                            </button>
                        )}
                        {selectedSkin === partners.currentMonsterId && (
                            <div className="mt-4 text-green-400 font-bold">✓ つかってるよ</div>
                        )}
                    </div>

                    {/* Filter & Sort Controls */}
                    <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700">
                        {/* Element Filter */}
                        <div className="flex gap-1 items-center mb-2 overflow-x-auto pb-1">
                            <span className="text-gray-500 text-xs shrink-0">しぼりこみ:</span>
                            <button
                                onClick={() => setElementFilter(null)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-colors ${!elementFilter ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                ALL
                            </button>
                            {allElements.map(el => (
                                <button
                                    key={el}
                                    onClick={() => setElementFilter(el)}
                                    className={`px-2 py-1 rounded text-xs shrink-0 transition-colors ${elementFilter === el ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                                        }`}
                                    title={el}
                                >
                                    {ELEMENT_ICONS[el]}
                                </button>
                            ))}
                        </div>
                        {/* Sort Options */}
                        <div className="flex gap-1 items-center">
                            <span className="text-gray-500 text-xs shrink-0">ならびかえ:</span>
                            {(['default', 'hp', 'atk', 'element'] as SortOption[]).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setSortBy(opt)}
                                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${sortBy === opt ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {opt === 'default' ? 'ふつう' : opt === 'hp' ? 'HP' : opt === 'atk' ? 'こうげき' : 'ぞくせい'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Monster Grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-4 gap-3">
                            {availableSkins.map((skin) => {
                                const unlocked = isUnlocked(skin.id) || skin.unlockCondition === 'STARTER';
                                const isSelected = selectedSkin === skin.id;
                                const isEquipped = partners.currentMonsterId === skin.id;
                                const skinStats = getMonsterStats(skin.id, stats.playerLevel);

                                return (
                                    <button
                                        key={skin.id}
                                        onClick={() => unlocked && setSelectedSkin(skin.id)}
                                        className={`
                                            relative aspect-square rounded-xl border-2 transition-all p-1
                                            ${isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-gray-600'}
                                            ${unlocked ? 'bg-gray-800 hover:brightness-110' : 'bg-gray-900 opacity-50'}
                                            ${isEquipped ? 'border-green-500' : ''}
                                        `}
                                        disabled={!unlocked}
                                    >
                                        <img
                                            src={getAssetPath(`/monsters/${skin.id}.png`)}
                                            alt={skin.name}
                                            className={`w-full h-full object-contain ${!unlocked ? 'grayscale' : ''}`}
                                        />
                                        {/* Element Badge */}
                                        <div className="absolute top-0 left-0 text-[10px] bg-black/70 rounded-br px-1">
                                            {ELEMENT_ICONS[skin.element] || '❓'}
                                        </div>
                                        {/* Stats (always show if unlocked) */}
                                        {unlocked && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[7px] md:text-[8px] text-center py-0.5 text-cyan-300 font-mono leading-none">
                                                HP:{skinStats.hp}<br />ATK:{skinStats.attack}
                                            </div>
                                        )}
                                        {!unlocked && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-2xl">🔒</span>
                                            </div>
                                        )}
                                        {isEquipped && (
                                            <div className="absolute top-0 right-0 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                                ✓
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {availableSkins.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                                みつからなかった…
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PartnerSelectModal;

