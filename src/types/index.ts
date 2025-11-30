export const ElementType = {
    FIRE: 'FIRE',     // 火・熱・攻撃
    AQUA: 'AQUA',     // 水・冷・流
    NATURE: 'NATURE', // 木・草・生
    METAL: 'METAL',   // 金・土・岩
    LIGHT: 'LIGHT',   // 日・月・光・神
    LIFE: 'LIFE',     // 人・心・体
    CHRONO: 'CHRONO', // 時・移動
    MAGIC: 'MAGIC',   // 学・知・抽象
    BOSS: 'BOSS'      // ボス
} as const;

export type ElementType = typeof ElementType[keyof typeof ElementType];

export const GameVersion = {
    RED: 'N5',
    GREEN: 'N4',
    BLUE: 'N3'
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
    stage?: number;
    isBoss?: boolean;
}

export interface UserState {
    profile: {
        name: string;
        currentVersion: GameVersion; // 選択中のソフト
        avatarId: string;
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
    // 学習進捗 (SRSデータ)
    progress: {
        [kanjiChar: string]: {
            status: 'new' | 'learning' | 'mastered';
            nextReview: number; // Timestamp
            interval: number;   // Days
            streak: number;     // 連続正解数
            masteryCount: number; // 累計正解回数（進化判定用）
        };
    };
}
