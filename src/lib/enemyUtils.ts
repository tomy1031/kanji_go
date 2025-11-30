import { ElementType } from '../types';
import enemyDataRaw from '../data/enemy_data.csv?raw';
import stageEnemiesRaw from '../data/stage_enemies.csv?raw';

export interface EnemyData {
    id: string;
    name: string;
    element: ElementType;
    hp: number;
    attack: number;
    imagePath: string;
    expReward: number;
    goldReward: number;
}

export const parseEnemyData = (): EnemyData[] => {
    const lines = enemyDataRaw.trim().split('\n');
    // const headers = lines[0].split(',');

    return lines.slice(1).map(line => {
        const values = line.split(',');
        return {
            id: values[0],
            name: values[1],
            element: values[2] as ElementType,
            hp: parseInt(values[3]),
            attack: parseInt(values[4]),
            imagePath: values[5],
            expReward: parseInt(values[6]),
            goldReward: parseInt(values[7])
        };
    });
};

export const ENEMY_DB = parseEnemyData();

export const getEnemiesByElement = (element: ElementType): EnemyData[] => {
    return ENEMY_DB.filter(e => e.element === element);
};

export const getEnemyById = (id: string): EnemyData | undefined => {
    return ENEMY_DB.find(e => e.id === id);
};

export const getEnemyForStage = (stageId: number): EnemyData | undefined => {
    const lines = stageEnemiesRaw.trim().split('\n');
    const mapping = lines.slice(1).find(line => {
        const [sId] = line.split(',');
        return parseInt(sId) === stageId;
    });

    if (mapping) {
        const [, enemyId] = mapping.split(',');
        return getEnemyById(enemyId.trim());
    }
    return undefined;
};
