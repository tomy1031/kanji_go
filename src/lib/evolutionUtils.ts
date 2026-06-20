import { ElementType } from '../types';
import monsterDataRaw from '../data/monster_data.csv?raw';
import { getCsvOverride } from './csvOverride';
import { getAssetPath } from '../utils/assetUtils';

export interface MonsterData {
    id: string;
    name: string;
    element: ElementType; // Attack Element
    weakness: ElementType; // Weakness Element
    baseHp: number;
    baseAttack: number;
    description: string;
    unlockCondition?: string;
    version?: string; // N5 | N4 | N3
    expReward?: number;
    goldReward?: number;
    // Legacy fields kept for compatibility or future use, but evolution is now mainly stage-based
    evolutionConditionType?: 'LEVEL' | 'MASTERY' | 'NONE';
    evolutionConditionValue?: number;
    nextFormId?: string | null;
    unlockText?: string;
    isEnemy?: boolean;
    imagePath?: string;
}

// Check if defenseElement implies resistance against attackElement
// Fire > Nature > Water > Fire
export const isResistant = (attackElement: ElementType, defenseElement: ElementType): boolean => {
    if (attackElement === 'FIRE' && defenseElement === 'WATER') return true;
    if (attackElement === 'WATER' && defenseElement === 'NATURE') return true;
    if (attackElement === 'NATURE' && defenseElement === 'FIRE') return true;
    // Light/Dark have no resistances against each other (mutually weak), nor against standard elements
    return false;
};

// Get raw CSV data (from override or static)
const getMonsterDataRaw = (): string => {
    // If we have an override for 'evolution_data' (legacy name?) or 'monster_data' (future?)
    // DebugMode uses 'evolution_data' key for now in override logic, let's keep using it or add new one?
    // User asked to abolish evolution_data. Let's assume we map 'monster_data' to this new file.
    // But DebugMode currently supports 'enemy_data' and 'evolution_data'.
    // I will need to update DebugMode to support 'monster_data' too.
    return getCsvOverride('monster_data') || monsterDataRaw;
};

export const parseMonsterData = (): Record<string, MonsterData> => {
    const raw = getMonsterDataRaw();
    const lines = raw.trim().split('\n');
    const headers = lines[0].split(',');
    const data: Record<string, MonsterData> = {};

    // Helper for dynamic column lookup
    const getColIndex = (name: string) => headers.indexOf(name);

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length < 3) continue; // At least id, name, element

        const id = currentLine[getColIndex('id')] || currentLine[0];
        const name = currentLine[getColIndex('name')] || currentLine[1];
        const element = (currentLine[getColIndex('element')] || currentLine[2]) as ElementType;
        const weakness = (currentLine[getColIndex('weakness')] || 'NONE') as ElementType;
        const baseHp = parseInt(currentLine[getColIndex('hp')] || currentLine[getColIndex('baseHp')] || currentLine[4] || '100');
        const baseAttack = parseInt(currentLine[getColIndex('attack')] || currentLine[getColIndex('baseAttack')] || currentLine[5] || '20');
        const description = currentLine[getColIndex('description')] || '';
        const unlockCondition = currentLine[getColIndex('unlockCondition')] || 'NONE';
        const version = currentLine[getColIndex('version')] || undefined;

        // Optional/Legacy
        const expReward = parseInt(currentLine[getColIndex('expReward')] || '0');
        const goldReward = parseInt(currentLine[getColIndex('goldReward')] || '0');
        const nextFormId = currentLine[getColIndex('nextFormId')] || null;

        // Infer isEnemy based on missing start/evo conditions or unlockCondition being 'None' (but 'None' is used for stages too)
        // Or simply if unlockCondition is 'None' and it's not a starter/evo?
        // Let's assume everything is a monster.
        // We can check if it has Rewards?
        const isEnemy = expReward > 0 || goldReward > 0;
        const imagePath = getAssetPath(`/monsters/${id}.png`);

        data[id] = {
            id,
            name,
            element,
            weakness,
            baseHp,
            baseAttack,
            description,
            unlockCondition,
            version,
            expReward,
            goldReward,
            nextFormId,
            isEnemy,
            imagePath
        };
    }
    return data;
};

// Mutable database that can be refreshed
let MONSTER_DB_CACHE: Record<string, MonsterData> | null = null;

export const getMonsterDb = (): Record<string, MonsterData> => {
    if (!MONSTER_DB_CACHE) {
        MONSTER_DB_CACHE = parseMonsterData();
    }
    return MONSTER_DB_CACHE;
};

// Refresh database (call after CSV override changes)
export const refreshMonsterDb = (): void => {
    MONSTER_DB_CACHE = parseMonsterData();
    console.log('[MonsterDB] Refreshed with', Object.keys(MONSTER_DB_CACHE).length, 'monsters');
};

// Export unified DB
export const MONSTER_DB: Record<string, MonsterData> = parseMonsterData();


/*
    Helper to get evolution chain
*/
export const getEvolutionChain = (startId: string): string[] => {
    const chain: string[] = [startId];
    let currentId = startId;

    while (true) {
        const monster = MONSTER_DB[currentId];
        if (!monster || !monster.nextFormId) break;
        chain.push(monster.nextFormId);
        currentId = monster.nextFormId;
        if (chain.length > 10) break; // Safety break
    }

    return chain;
};

/*
    Check if a monster can evolve
*/
export const checkEvolution = (
    monsterId: string,
    level: number,
    masteryCount: number
): boolean => {
    const monster = MONSTER_DB[monsterId];
    if (!monster || !monster.nextFormId) return false;

    if (monster.evolutionConditionType === 'LEVEL') {
        return level >= (monster.evolutionConditionValue || 0);
    }

    if (monster.evolutionConditionType === 'MASTERY') {
        return masteryCount >= (monster.evolutionConditionValue || 0);
    }

    return false;
};

/*
    Check if a skin is unlocked based on condition
*/
export const checkSkinUnlock = (
    skinId: string,
    unlockedSkins: string[],
    _userLevel: number,
    _masteredKanjiCount: number
): boolean => {
    // If already unlocked, return true
    if (unlockedSkins.includes(skinId)) return true;

    const monster = MONSTER_DB[skinId];
    if (!monster) return false;

    // Starters are unlocked via starter selection (handled elsewhere)
    if (monster.unlockCondition === 'STARTER') return false;

    // Evolution forms are unlocked by evolving via button
    if (monster.unlockCondition === 'EVOLUTION') return false;

    // Check specific conditions if any implemented
    // ...

    return false;
};

export const getMonsterStats = (monsterId: string, level: number) => {
    const db = getMonsterDb();
    const monster = db[monsterId];
    if (!monster) return { hp: 100, attack: 10 };

    // Growth Formula: Base * (1 + (Level - 1) * 0.1)
    // Level 1: 1.0x
    // Level 10: 1.9x
    // Level 50: 5.9x
    const multiplier = 1 + (level - 1) * 0.1;

    return {
        hp: Math.floor(monster.baseHp * multiplier),
        attack: Math.floor(monster.baseAttack * multiplier)
    };
};
