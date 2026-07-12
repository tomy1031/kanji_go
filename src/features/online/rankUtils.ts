// Rating → rank tier mapping for online battle.
// Visible tiers + a progress bar to the next one turn the abstract ELO number
// into a ladder players want to climb.

export interface RankTier {
    name: string;
    icon: string;
    color: string;     // tailwind text color class
    min: number;       // inclusive rating floor
}

export const RANK_TIERS: RankTier[] = [
    { name: 'ブロンズ', icon: '🥉', color: 'text-amber-600', min: 0 },
    { name: 'シルバー', icon: '🥈', color: 'text-gray-300', min: 1050 },
    { name: 'ゴールド', icon: '🥇', color: 'text-yellow-400', min: 1150 },
    { name: 'プラチナ', icon: '💠', color: 'text-cyan-300', min: 1300 },
    { name: 'ダイヤ', icon: '💎', color: 'text-blue-300', min: 1450 },
    { name: 'マスター', icon: '👑', color: 'text-fuchsia-300', min: 1600 },
];

export interface RankInfo {
    tier: RankTier;
    tierIndex: number;
    next: RankTier | null;
    /** 0-1 progress from this tier's floor to the next tier's floor */
    progress: number;
    /** rating points still needed to reach the next tier */
    pointsToNext: number;
}

export const getRank = (rating: number): RankInfo => {
    let tierIndex = 0;
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
        if (rating >= RANK_TIERS[i].min) {
            tierIndex = i;
            break;
        }
    }
    const tier = RANK_TIERS[tierIndex];
    const next = RANK_TIERS[tierIndex + 1] || null;
    const progress = next
        ? Math.min(1, Math.max(0, (rating - tier.min) / (next.min - tier.min)))
        : 1;
    const pointsToNext = next ? Math.max(0, next.min - rating) : 0;
    return { tier, tierIndex, next, progress, pointsToNext };
};
