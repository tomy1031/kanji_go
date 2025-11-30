import expTableRaw from '../data/exp_table.csv?raw';

interface LevelData {
    level: number;
    totalExp: number;
}

export const parseExpTable = (): LevelData[] => {
    const lines = expTableRaw.trim().split('\n');
    // Skip header
    return lines.slice(1).map(line => {
        const [level, totalExp] = line.split(',');
        return {
            level: parseInt(level),
            totalExp: parseInt(totalExp)
        };
    });
};

export const EXP_TABLE = parseExpTable();

export const getLevelFromExp = (exp: number): number => {
    // Find the highest level where totalExp <= exp
    // This assumes EXP_TABLE is sorted by level
    for (let i = EXP_TABLE.length - 1; i >= 0; i--) {
        if (exp >= EXP_TABLE[i].totalExp) {
            return EXP_TABLE[i].level;
        }
    }
    return 1; // Default
};

export const getExpForNextLevel = (currentLevel: number): number => {
    const nextLevelData = EXP_TABLE.find(d => d.level === currentLevel + 1);
    return nextLevelData ? nextLevelData.totalExp : Infinity; // Max level cap
};
