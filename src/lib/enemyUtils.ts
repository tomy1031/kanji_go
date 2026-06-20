import { ElementType, GameVersion } from '../types';
import stageDataRaw from '../data/stage_data.csv?raw';
import { getCsvOverride } from './csvOverride';
import { MONSTER_DB, type MonsterData } from './evolutionUtils';

// Re-export EnemyData as MonsterData for compatibility
export type EnemyData = MonsterData;

// Get raw CSV data (from override or static) - Stage Data only
const getStageDataRaw = (): string => {
    return getCsvOverride('stage_data') || stageDataRaw;
};

// Deprecated: Uses shared MONSTER_DB now
export const getEnemyDb = (): MonsterData[] => {
    return Object.values(MONSTER_DB).filter(m => m.isEnemy);
};

// Refresh database - Wrapper for shared refresh
export const refreshEnemyDb = (): void => {
    // Shared DB refresh logic handles everything now
    // We could import refreshMonsterDb but circular dependency risks if evolutionUtils imports strict enemy stuff
    // But currently evolutionUtils handles parsing.
    console.log('[EnemyDB] Refresh delegated to MonsterDB');
};

// For backward compatibility
export const ENEMY_DB = Object.values(MONSTER_DB).filter(m => m.isEnemy);

export const getEnemiesByElement = (element: ElementType): MonsterData[] => {
    return ENEMY_DB.filter(e => e.element === element);
};

export const getEnemyById = (id: string): MonsterData | undefined => {
    return MONSTER_DB[id];
};

export const getEnemyForStage = (world: number, order: number, level: GameVersion): MonsterData | undefined => {
    const lines = getStageDataRaw().trim().split('\n');

    const mapping = lines.slice(1).find((line: string) => {
        const [lvl, w, o] = line.split(',');
        return lvl === level &&
            parseInt(w) === world &&
            parseInt(o) === order;
    });

    if (mapping) {
        const [, , , , enemyId] = mapping.split(',');
        return getEnemyById(enemyId.trim());
    }
    return undefined;
};

// Check if a stage is a boss stage based on stage_type in CSV
export const isBossStage = (world: number, order: number, level: GameVersion): boolean => {
    const lines = getStageDataRaw().trim().split('\n');

    const mapping = lines.slice(1).find((line: string) => {
        const [lvl, w, o] = line.split(',');
        return lvl === level &&
            parseInt(w) === world &&
            parseInt(o) === order;
    });

    if (mapping) {
        const [, , , stageType] = mapping.split(',');
        return stageType.trim() === 'boss';
    }
    return false;
};

// Get enemy level for a specific stage from CSV
export const getEnemyLevelForStage = (world: number, order: number, level: GameVersion): number => {
    const lines = getStageDataRaw().trim().split('\n');

    const mapping = lines.slice(1).find((line: string) => {
        const [lvl, w, o] = line.split(',');
        return lvl === level &&
            parseInt(w) === world &&
            parseInt(o) === order;
    });

    if (mapping) {
        const parts = mapping.split(',');
        // enemy_level is the 6th column (index 5)
        if (parts.length > 5) {
            const enemyLevel = parseInt(parts[5].trim());
            if (!isNaN(enemyLevel)) {
                return enemyLevel;
            }
        }
    }
    // Default to 1 if not found
    return 1;
};

export const getMetaMonsterForStage = (world: number, order: number, level: GameVersion): string | undefined => {
    const lines = getStageDataRaw().trim().split('\n');

    const mapping = lines.slice(1).find((line: string) => {
        const [lvl, w, o] = line.split(',');
        return lvl === level &&
            parseInt(w) === world &&
            parseInt(o) === order;
    });

    if (mapping) {
        const parts = mapping.split(',');
        // meta_monster_id is the 7th column (index 6, but check length)
        if (parts.length > 6) {
            const metaId = parts[6].trim();
            if (metaId && metaId !== '') {
                return metaId;
            }
        }
    }
    return undefined;
};

