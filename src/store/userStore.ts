import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type UserState, GameVersion } from '../types';
import { getLevelFromExp } from '../lib/levelUtils';

interface UserStore extends UserState {
    setProfile: (profile: Partial<UserState['profile']>) => void;
    addExp: (amount: number) => void;
    masterKanji: (kanjiId: string) => void;
    updateProgress: (kanjiId: string, result: { interval: number; nextReview: number; streak: number }) => void;
    unlockSkin: (skinId: string) => void;
    evolvePartner: (newMonsterId: string) => void;
    setPartner: (monsterId: string) => void;
    setCurrentStage: (stageId: number) => void;
    unlockNextStage: () => void;
}

const initialState: UserState = {
    profile: {
        name: 'Player',
        currentVersion: GameVersion.RED,
        avatarId: 'default',
    },
    stats: {
        playerLevel: 1,
        currentExp: 0,
        totalKanjiMastered: 0,
    },
    partners: {
        currentMonsterId: 'starter_fire',
        unlockedSkins: ['starter_fire'],
    },
    currentStageId: 1,
    maxUnlockedStage: 1,
    progress: {},
};

export const useUserStore = create<UserStore>()(
    persist(
        (set) => ({
            ...initialState,
            setProfile: (profile) =>
                set((state) => ({
                    profile: { ...state.profile, ...profile },
                })),
            addExp: (amount) =>
                set((state) => {
                    const newExp = state.stats.currentExp + amount;
                    const newLevel = getLevelFromExp(newExp);

                    return {
                        stats: {
                            ...state.stats,
                            currentExp: newExp,
                            playerLevel: newLevel,
                        },
                    };
                }),
            updateProgress: (kanjiId, result) =>
                set((state) => {
                    const currentProgress = state.progress[kanjiId] || {
                        status: 'new',
                        nextReview: 0,
                        interval: 0,
                        streak: 0,
                        masteryCount: 0,
                    };

                    const newMasteryCount = currentProgress.masteryCount + 1;
                    const status = newMasteryCount >= 5 ? 'mastered' : 'learning';

                    return {
                        progress: {
                            ...state.progress,
                            [kanjiId]: {
                                ...currentProgress,
                                status,
                                ...result,
                                masteryCount: newMasteryCount,
                            },
                        },
                        stats: {
                            ...state.stats,
                            totalKanjiMastered: status === 'mastered' && currentProgress.status !== 'mastered'
                                ? state.stats.totalKanjiMastered + 1
                                : state.stats.totalKanjiMastered
                        }
                    };
                }),
            masterKanji: (kanjiId) =>
                set((state) => ({
                    stats: {
                        ...state.stats,
                        totalKanjiMastered: state.stats.totalKanjiMastered + 1,
                    },
                    progress: {
                        ...state.progress,
                        [kanjiId]: {
                            status: 'mastered',
                            nextReview: Date.now() + 86400000, // +1 day
                            interval: 1,
                            streak: 1,
                            masteryCount: 1,
                        },
                    },
                })),
            unlockSkin: (skinId) =>
                set((state) => ({
                    partners: {
                        ...state.partners,
                        unlockedSkins: state.partners.unlockedSkins.includes(skinId)
                            ? state.partners.unlockedSkins
                            : [...state.partners.unlockedSkins, skinId],
                    },
                })),
            evolvePartner: (newMonsterId) =>
                set((state) => ({
                    partners: {
                        ...state.partners,
                        currentMonsterId: newMonsterId,
                        unlockedSkins: state.partners.unlockedSkins.includes(newMonsterId)
                            ? state.partners.unlockedSkins
                            : [...state.partners.unlockedSkins, newMonsterId],
                    },
                })),
            setPartner: (monsterId) =>
                set((state) => ({
                    partners: {
                        ...state.partners,
                        currentMonsterId: monsterId,
                        unlockedSkins: state.partners.unlockedSkins.includes(monsterId)
                            ? state.partners.unlockedSkins
                            : [...state.partners.unlockedSkins, monsterId]
                    }
                })),
            setCurrentStage: (stageId) => set({ currentStageId: stageId }),
            unlockNextStage: () => set((state) => {
                const current = state.currentStageId || 1;
                const max = state.maxUnlockedStage || 1;
                if (current >= max) {
                    return { maxUnlockedStage: max + 1 };
                }
                return {};
            }),
        }),
        {
            name: 'kanjigo-storage',
        }
    )
);
