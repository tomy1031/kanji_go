import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type UserState, GameVersion } from '../types';
import { getLevelFromExp } from '../lib/levelUtils';
import { getAllKanji } from '../lib/kanjiUtils';
import { MONSTER_DB } from '../lib/evolutionUtils';
import { getMetaMonsterForStage } from '../lib/enemyUtils';
import { PRACTICE_MASTERY_COUNT, STREAK_MILESTONES, STREAK_MILESTONE_EXP } from '../lib/constants';

interface UserStore extends UserState {
    setProfile: (profile: Partial<UserState['profile']>) => void;
    addExp: (amount: number) => void;
    masterKanji: (kanjiId: string) => void;
    updateProgress: (kanjiId: string, result: { interval: number; nextReview: number; streak: number }) => void;
    unlockSkin: (skinId: string) => void;
    evolvePartner: (newMonsterId: string) => void;
    setPartner: (monsterId: string) => void;
    setCurrentStage: (stageId: number) => void;
    stageRatings: Record<string, number>; // Key: `${level}-${world}-${order}`, Value: 0-3
    updateStageRating: (level: GameVersion, world: number, order: number, rating: number) => void;
    incrementPracticeCount: (kanjiId: string) => void;
    unlockNextStage: () => void;
    setSelectedChapter: (chapter: number | null) => void;
    checkStageCompletion: (stageId: number, version: GameVersion) => string[]; // Returns newly unlocked monster IDs
    checkPracticeStageCompletion: (world: number, order: number, version: GameVersion) => string | null; // Returns unlocked meta monster ID
    updateDebugSettings: (settings: Partial<UserState['debugSettings']>) => void;
    setStageKanjiPracticeCount: (world: number, order: number, count: number) => void; // Debug helper
    // Friend list management
    ensurePlayerId: () => string; // Returns playerId, generates if not exists
    addFriend: (friendId: string, friendName: string) => void;
    removeFriend: (friendId: string) => void;
    updateFriendName: (friendId: string, newName: string) => void;
    // Battle Stats
    battleRecords: Record<string, { wins: number; losses: number }>;
    recordWin: (opponentId: string) => void;
    recordLoss: (opponentId: string) => void;
    syncBattleStats: (opponentId: string, remoteStats: { wins: number; losses: number }) => void;
    // Dopamine systems
    addShinySkin: (skinId: string) => void;
    recordClutchWin: () => void;
    /** Updates the daily streak; returns the new count and a milestone number if one was just reached. */
    recordDailyActivity: () => { count: number; milestone: number | null };
    /** Records a score-attack result; returns true if it is a new personal best. */
    submitScoreAttack: (version: GameVersion, score: number) => boolean;
}

// Generate a readable player ID
const generatePlayerId = (): string => {
    const adjectives = ['kanji', 'sumo', 'ninja', 'samurai', 'yokai', 'sakura', 'fuji', 'zen'];
    const nouns = ['master', 'warrior', 'sage', 'spirit', 'dragon', 'tiger', 'fox', 'crane'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 10000);
    return `${adj}-${noun}-${num}`;
};

const initialState: UserState = {
    profile: {
        name: 'Player',
        currentVersion: GameVersion.RED,
        avatarId: 'default',
        playerId: undefined, // Will be generated on first access
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
    currentStageId: undefined,
    maxUnlockedStage: 1,
    selectedChapter: null,
    stageRatings: {},
    progress: {},
    debugSettings: {
        practiceExpMode: 'CHAR',
    },
    friends: [],
    battleRecords: {},
};

export const useUserStore = create<UserStore>()(
    persist(
        (set, get) => ({
            ...initialState,
            setProfile: (profile) =>
                set((state) => ({
                    profile: { ...state.profile, ...profile },
                })),
            // ... (existing actions)
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
                        practiceCount: 0,
                    };

                    const newMasteryCount = currentProgress.masteryCount + 1;
                    // Quest progress no longer automatically sets 'mastered' status for the badge
                    // But we still track it for SRS. Status 'mastered' is now reserved for Practice Mode >= 20
                    // OR we can keep 'mastered' for SRS logic but use a different flag for the badge?
                    // User said: "20回以上書いたらMasterにしてください" (Make it Mastered if written 20+ times)
                    // So let's rely on practiceCount for the status transition to 'mastered'.
                    // However, we still need 'learning' status for Quest progress.

                    let status = currentProgress.status;
                    if (status === 'new') status = 'learning';

                    // If already mastered (by practice), keep it.

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
                        // Total mastered stat might need to be decoupled too? 
                        // For now, let's leave totalKanjiMastered driven by practiceCount in the other action.
                    };
                }),
            incrementPracticeCount: (kanjiId) =>
                set((state) => {
                    const currentProgress = state.progress[kanjiId] || {
                        status: 'new',
                        nextReview: 0,
                        interval: 0,
                        streak: 0,
                        masteryCount: 0,
                        practiceCount: 0,
                    };

                    const newPracticeCount = (currentProgress.practiceCount || 0) + 1;
                    let status = currentProgress.status;

                    if (newPracticeCount >= PRACTICE_MASTERY_COUNT && status !== 'mastered') {
                        status = 'mastered';
                    } else if (status === 'new') {
                        status = 'learning';
                    }

                    const isNewMastery = status === 'mastered' && currentProgress.status !== 'mastered';

                    return {
                        progress: {
                            ...state.progress,
                            [kanjiId]: {
                                ...currentProgress,
                                practiceCount: newPracticeCount,
                                status,
                            },
                        },
                        stats: {
                            ...state.stats,
                            totalKanjiMastered: isNewMastery
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
                            practiceCount: PRACTICE_MASTERY_COUNT, // Force to mastery threshold if manually mastered
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
                // Always increment max unlocked stage after clearing current stage
                return { maxUnlockedStage: (state.maxUnlockedStage || 1) + 1 };
            }),
            updateStageRating: (level, world, order, rating) =>
                set((state) => {
                    const key = `${level}-${world}-${order}`;
                    const currentRating = state.stageRatings[key] || 0;
                    if (rating > currentRating) {
                        return {
                            stageRatings: {
                                ...state.stageRatings,
                                [key]: rating,
                            },
                        };
                    }
                    return {};
                }),
            setSelectedChapter: (chapter) => set({ selectedChapter: chapter }),
            addShinySkin: (skinId) =>
                set((state) => {
                    const shiny = state.partners.shinySkins || [];
                    if (shiny.includes(skinId)) return {};
                    return { partners: { ...state.partners, shinySkins: [...shiny, skinId] } };
                }),
            recordClutchWin: () => set((state) => ({ clutchWins: (state.clutchWins || 0) + 1 })),
            recordDailyActivity: () => {
                const state = get();
                const today = new Date();
                const dateKey = (d: Date) =>
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const todayKey = dateKey(today);
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                const yesterdayKey = dateKey(yesterday);
                const twoDaysAgo = new Date(today);
                twoDaysAgo.setDate(today.getDate() - 2);
                const twoDaysAgoKey = dateKey(twoDaysAgo);

                const cur = state.dailyStreak || { count: 0, lastDate: '', freezes: 0 };
                if (cur.lastDate === todayKey) {
                    return { count: cur.count, milestone: null }; // already counted today
                }

                let count: number;
                let freezes = cur.freezes;
                if (cur.lastDate === yesterdayKey) {
                    count = cur.count + 1;
                } else if (cur.lastDate === twoDaysAgoKey && freezes > 0) {
                    // One missed day — a streak freeze saves it
                    freezes -= 1;
                    count = cur.count + 1;
                } else {
                    count = 1;
                }

                const milestone = STREAK_MILESTONES.includes(count) ? count : null;
                if (milestone) {
                    freezes += 1; // milestones grant a streak freeze
                }
                set({ dailyStreak: { count, lastDate: todayKey, freezes } });
                if (milestone) {
                    get().addExp(STREAK_MILESTONE_EXP);
                }
                return { count, milestone };
            },
            submitScoreAttack: (version, score) => {
                const state = get();
                const best = state.scoreAttackBest || {};
                const prev = best[version] || 0;
                if (score > prev) {
                    set({ scoreAttackBest: { ...best, [version]: score } });
                    return true;
                }
                return false;
            },
            checkStageCompletion: (stageId, version) => {
                const state = useUserStore.getState();

                const allKanji = getAllKanji();

                // stageId is now the world number (chapter number)
                const world = stageId;

                // Get all kanji from this world/chapter (order 1-3)
                const stageKanji = allKanji.filter((k) =>
                    k.level === version &&
                    k.world === world
                );

                // Check if all kanji in this chapter are mastered (practiceCount >= 20)
                const allMastered = stageKanji.length > 0 && stageKanji.every((k) => {
                    const progress = state.progress[k.id];
                    return progress && (progress.practiceCount || 0) >= PRACTICE_MASTERY_COUNT;
                });

                if (!allMastered) return [];

                // Find stage reward monsters that match this stage
                // Format: STAGE:VERSION-WORLD (e.g., STAGE:N5-1)
                const unlockKey = `STAGE:${version}-${world}`;
                const rewardMonsters = Object.values(MONSTER_DB).filter((monster) => {
                    return monster.unlockCondition === unlockKey;
                });

                // Unlock the monsters and return their IDs
                const newUnlocks: string[] = [];
                rewardMonsters.forEach((monster) => {
                    if (!state.partners.unlockedSkins.includes(monster.id)) {
                        set((currentState) => ({
                            partners: {
                                ...currentState.partners,
                                unlockedSkins: [...currentState.partners.unlockedSkins, monster.id],
                            },
                        }));
                        newUnlocks.push(monster.id);
                    }
                });

                return newUnlocks;
            },
            checkPracticeStageCompletion: (world: number, order: number, version: GameVersion) => {
                const state = get(); // Use get() instead of useUserStore.getState()
                const allKanji = getAllKanji();

                // Get kanji for this specific stage (Logic from stageUtils.getStageKanji)
                const targetOrders = order === 4 ? [1, 2, 3] : [order];
                const stageKanji = allKanji.filter((k) =>
                    k.level === version &&
                    k.world === world &&
                    k.order &&
                    targetOrders.includes(k.order)
                );

                // Check mastery (Practice Count >= 20)
                const allMastered = stageKanji.length > 0 && stageKanji.every((k) => {
                    const progress = state.progress[k.id];
                    return progress && (progress.practiceCount || 0) >= PRACTICE_MASTERY_COUNT;
                });

                if (!allMastered) return null;

                // Get Meta Monster Reward
                // We need to import getMetaMonsterForStage from enemyUtils
                // But circular dependency might be an issue if enemyUtils imports types/store?
                // enemyUtils imports types. userStore imports types. implementation-wise it should be fine.
                // However, userStore is already large.
                // Dynamic import or just inline?
                // Actually userStore imports `getAllKanji` from `kanjiUtils`.
                // Let's assume we can import `getMetaMonsterForStage` at the top of the file.
                // But I haven't added the import yet. I will do that in a separate chunk or just use require?
                // No, ES modules.
                // I will use a helper or assume it's imported.
                // Wait, I can't assume. I must add the import statement.

                // For now, let's just return the check status, and handle the "Get ID and Unlock" in the Component?
                // The Component has easy access to `getMetaMonsterForStage`.
                // So let's make this returns `true` if complete.
                // "checkStageCompletion" returned IDs.
                // Let's stick to the pattern: Component checks completions, Store handles data.
                const metaId = getMetaMonsterForStage(world, order, version);
                if (metaId && !state.partners.unlockedSkins.includes(metaId)) {
                    set((currentState) => ({
                        partners: {
                            ...currentState.partners,
                            unlockedSkins: [...currentState.partners.unlockedSkins, metaId],
                        },
                    }));
                    return metaId;
                }
                return null;
            },
            updateDebugSettings: (settings) =>
                set((state) => ({
                    debugSettings: { ...state.debugSettings, ...settings },
                })),
            setStageKanjiPracticeCount: (world, order, count) => {
                const state = get();
                const version = state.profile.currentVersion;
                const allKanji = getAllKanji();

                // Get kanji for this stage
                const targetOrders = order === 4 ? [1, 2, 3] : [order];
                const stageKanji = allKanji.filter((k) =>
                    k.level === version &&
                    k.world === world &&
                    k.order &&
                    targetOrders.includes(k.order)
                );

                const newProgress = { ...state.progress };

                stageKanji.forEach((k) => {
                    const current = newProgress[k.id] || {
                        status: 'new',
                        nextReview: 0,
                        interval: 0,
                        streak: 0,
                        masteryCount: 0,
                        practiceCount: 0
                    };

                    newProgress[k.id] = {
                        ...current,
                        practiceCount: count,
                        status: count >= PRACTICE_MASTERY_COUNT ? 'mastered' : current.status === 'new' && count > 0 ? 'learning' : current.status
                    };
                });

                set({ progress: newProgress });
            },

            // Friend management
            ensurePlayerId: () => {
                const state = get();
                if (state.profile.playerId) {
                    return state.profile.playerId;
                }
                const newId = generatePlayerId();
                set((s) => ({
                    profile: { ...s.profile, playerId: newId }
                }));
                return newId;
            },
            addFriend: (friendId, friendName) =>
                set((state) => {
                    // Don't add duplicates
                    if (state.friends.some(f => f.id === friendId)) {
                        return state;
                    }
                    return {
                        friends: [...state.friends, { id: friendId, name: friendName, addedAt: Date.now() }]
                    };
                }),
            removeFriend: (friendId) =>
                set((state) => ({
                    friends: state.friends.filter(f => f.id !== friendId)
                })),
            updateFriendName: (friendId, newName) =>
                set((state) => ({
                    friends: state.friends.map(f =>
                        f.id === friendId ? { ...f, name: newName } : f
                    )
                })),
            recordWin: (opponentId) =>
                set((state) => {
                    const current = state.battleRecords[opponentId] || { wins: 0, losses: 0 };
                    return {
                        battleRecords: {
                            ...state.battleRecords,
                            [opponentId]: { ...current, wins: current.wins + 1 }
                        }
                    };
                }),
            recordLoss: (opponentId) =>
                set((state) => {
                    const current = state.battleRecords[opponentId] || { wins: 0, losses: 0 };
                    return {
                        battleRecords: {
                            ...state.battleRecords,
                            [opponentId]: { ...current, losses: current.losses + 1 }
                        }
                    };
                }),
            syncBattleStats: (opponentId, remoteStats) =>
                set((state) => {
                    const current = state.battleRecords[opponentId] || { wins: 0, losses: 0 };
                    // My wins = max(my wins, their losses)
                    // My losses = max(my losses, their wins)
                    const newWins = Math.max(current.wins, remoteStats.losses);
                    const newLosses = Math.max(current.losses, remoteStats.wins);

                    if (newWins === current.wins && newLosses === current.losses) {
                        return state;
                    }
                    return {
                        battleRecords: {
                            ...state.battleRecords,
                            [opponentId]: { wins: newWins, losses: newLosses }
                        }
                    };
                }),

        }),
        {
            name: 'kanjigo-storage',
        }
    )
);
