// 5属性 + 特殊属性
export const ElementType = {
    FIRE: 'FIRE',       // 🔥 火 (Weak: Water)
    WATER: 'WATER',     // 💧 水 (Weak: Nature)
    NATURE: 'NATURE',   // 🌿 木 (Weak: Fire)
    LIGHT: 'LIGHT',     // ✨ 光 (Weak: Dark)
    DARK: 'DARK',       // 🌑 闇 (Weak: Light)
    // 特殊
    BOSS: 'BOSS',
    NONE: 'NONE'        // 弱点なし等
} as const;

export type ElementType = typeof ElementType[keyof typeof ElementType];

export const GameVersion = {
    RED: 'N5',
    GREEN: 'N3',
    BLUE: 'N4'
} as const;

export type GameVersion = typeof GameVersion[keyof typeof GameVersion];

export interface KanjiData {
    id: string;             // unique id (e.g., "n5_fire_hi")
    char: string;           // "火"
    level: GameVersion;     // "N5"
    element: ElementType;   // "FIRE"
    readings: {
        on: string[];         // ["KA"]
        kun: string[];        // ["hi"]
    };
    meanings: string[];     // ["fire", "Tuesday"]
    strokes: number;        // 4 (画数 = 基礎HP係数)
    tags: string[];         // ["basic", "nature"]
    world?: number;         // World number (1, 2, 3...)
    order?: number;         // Order within world (1, 2, 3, 4 where 4=BOSS)
    exampleSentence?: string;
    exampleReading?: string;
}

export interface KanjiProgress {
    status: 'new' | 'learning' | 'mastered';
    nextReview: number; // Timestamp
    interval: number;   // Days
    streak: number;     // 連続正解数
    masteryCount: number; // 累計正解回数（進化判定用）
    practiceCount?: number; // Number of times written in Practice Mode
}

export interface UserState {
    profile: {
        name: string;
        currentVersion: GameVersion; // 選択中のソフト
        avatarId: string;
        playerId?: string; // Persistent peer ID (auto-generated)
    };
    stats: {
        playerLevel: number;
        currentExp: number;
        totalKanjiMastered: number;
    };
    partners: {
        currentMonsterId: string;
        unlockedSkins: string[]; // 取得済みモンスタースキンID
    };
    currentStageId?: number;
    maxUnlockedStage: number;
    selectedChapter?: number | null; // Currently selected chapter in WorldMap
    stageRatings: Record<string, number>; // Key: `${level}-${stageId}`, Value: 0-3
    // 学習進捗 (SRSデータ)
    progress: Record<string, KanjiProgress>;
    debugSettings: {
        practiceExpMode: 'CHAR' | 'COMPLETE';
    };
    // Friends list for online battle
    // Friends list for online battle
    friends: Friend[];
    battleRecords: Record<string, { wins: number; losses: number }>;
}

// Friend for online battle lobby
export interface Friend {
    id: string;      // Their permanent player ID
    name: string;    // Display name (may be outdated)
    addedAt: number; // Timestamp when added
}
