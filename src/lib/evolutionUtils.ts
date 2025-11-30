import { ElementType } from '../types';
import evolutionDataRaw from '../data/evolution_data.csv?raw';

export interface MonsterData {
    id: string;
    name: string;
    element: ElementType;
    baseHp: number;
    baseAttack: number;
    evolutionConditionType: 'LEVEL' | 'MASTERY' | 'NONE';
    evolutionConditionValue: number;
    nextFormId: string | null;
    description: string;
    unlockText: string;
    elementalStrengths: string[];
    elementalWeaknesses: string[];
    unlockCondition?: string;
}

export const parseEvolutionData = (): Record<string, MonsterData> => {
    const lines = evolutionDataRaw.trim().split('\n');
    const headers = lines[0].split(',');
    const data: Record<string, MonsterData> = {};

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length < headers.length) continue;

        const id = currentLine[0];
        const name = currentLine[1];
        const element = currentLine[2] as ElementType;
        const baseHp = parseInt(currentLine[3]);
        const baseAttack = parseInt(currentLine[4]);
        const evolutionConditionType = currentLine[5] as 'LEVEL' | 'MASTERY' | 'NONE';
        const evolutionConditionValue = parseInt(currentLine[6]);
        const nextFormId = currentLine[7] || null;
        const description = currentLine[8];
        const unlockText = currentLine[9];
        const elementalStrengths = currentLine[10] ? currentLine[10].split('|') : [];
        const elementalWeaknesses = currentLine[11] ? currentLine[11].split('|') : [];
        const unlockCondition = currentLine[12] || 'NONE';

        data[id] = {
            id,
            name,
            element,
            baseHp,
            baseAttack,
            evolutionConditionType,
            evolutionConditionValue,
            nextFormId,
            description,
            unlockText,
            elementalStrengths,
            elementalWeaknesses,
            unlockCondition
        };
    }
    return data;
};

export const MONSTER_DB = parseEvolutionData();

export const checkEvolution = (monsterId: string, currentLevel: number): string | null => {
    const monster = MONSTER_DB[monsterId];
    if (!monster) return null;

    if (monster.evolutionConditionType === 'LEVEL' && currentLevel >= monster.evolutionConditionValue && monster.nextFormId) {
        return monster.nextFormId;
    }

    return null;
};

// Check if a skin should be unlocked based on user progress
import { getAllKanji } from './kanjiUtils';
import type { UserState } from '../types';

export const checkSkinUnlock = (monsterId: string, userState: UserState): boolean => {
    const monster = MONSTER_DB[monsterId];
    if (!monster) return false;

    // Already unlocked?
    if (userState.partners.unlockedSkins.includes(monsterId)) return true;

    const condition = monster.unlockCondition;
    if (!condition || condition === 'NONE' || condition === 'EVOLUTION') return false;
    if (condition === 'STARTER') return true;

    const parts = condition.split(':');
    const type = parts[0];

    if (type === 'MASTERY') {
        const element = parts[1];
        const requiredCount = parseInt(parts[2], 10);

        const allKanji = getAllKanji();
        const masteredCount = allKanji.filter(k => {
            if (k.element !== element) return false;
            const prog = userState.progress[k.id];
            return prog && prog.masteryCount >= 10;
        }).length;

        return masteredCount >= requiredCount;
    }

    return false;
};

export const getMonsterStats = (monsterId: string, level: number) => {
    const monster = MONSTER_DB[monsterId];
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
