import { getAllKanji } from './kanjiUtils';
import { GameVersion } from '../types';

export interface StageData {
    world: number;           // World number (1, 2, 3...)
    order: number;           // Order within world (1, 2, 3, 4 where 4=BOSS)
    name: string;
    kanjiCount: number;
    isBoss: boolean;
    status: 'locked' | 'unlocked' | 'cleared';
    chapter: number;         // Same as world for display
    displayNumber: string;   // "1", "2", "3", "BOSS"
}

export const getStages = (maxUnlockedStage: number, level: GameVersion): StageData[] => {
    const allKanji = getAllKanji().filter(k => k.level === level);

    // Determine max available worlds based on kanji world count
    const maxWorld = Math.max(...allKanji.map(k => k.world || 0));

    const stages: StageData[] = [];
    let logicStageIndex = 1; // For tracking unlock status

    for (let world = 1; world <= maxWorld; world++) {
        // Orders 1-3 are normal stages, 4 is boss
        for (let order = 1; order <= 4; order++) {
            const isBoss = order === 4;

            let status: StageData['status'] = 'locked';
            if (logicStageIndex < maxUnlockedStage) {
                status = 'cleared';
            } else if (logicStageIndex === maxUnlockedStage) {
                status = 'unlocked';
            }

            stages.push({
                world,
                order,
                name: isBoss ? `Chapter ${world} BOSS` : `Stage ${world}-${order}`,
                kanjiCount: 0,
                isBoss,
                status,
                chapter: world,
                displayNumber: isBoss ? "BOSS" : `${order}`
            });

            logicStageIndex++;
        }
    }

    return stages;
};

export const getStageKanji = (world: number, order: number, level: GameVersion) => {
    // For BOSS stages (order=4), review all kanji from orders 1-3 of the same world
    const targetOrders = order === 4 ? [1, 2, 3] : [order];

    console.log(`Getting kanji for ${level} World ${world} Order ${order}${order === 4 ? ' (BOSS)' : ''}`);

    const result = getAllKanji().filter(k =>
        k.level === level &&
        k.world === world &&
        k.order &&
        targetOrders.includes(k.order)
    );

    console.log(`Found ${result.length} kanji`, result.map(k => ({ char: k.char, world: k.world, order: k.order })));

    return result;
};
