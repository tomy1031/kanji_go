import { getAllKanji } from './kanjiUtils';


export interface StageData {
    id: number;
    name: string;
    kanjiCount: number;
    isBoss: boolean;
    status: 'locked' | 'unlocked' | 'cleared';
}

export const getStages = (maxUnlockedStage: number): StageData[] => {
    const allKanji = getAllKanji();
    const stages: Record<number, StageData> = {};

    // Group kanji by stage
    allKanji.forEach(kanji => {
        if (!kanji.stage) return;

        if (!stages[kanji.stage]) {
            stages[kanji.stage] = {
                id: kanji.stage,
                name: `Stage ${kanji.stage}`,
                kanjiCount: 0,
                isBoss: false,
                status: 'locked'
            };
        }
        stages[kanji.stage].kanjiCount++;
        if (kanji.isBoss) {
            stages[kanji.stage].isBoss = true;
        }
    });

    // Determine status
    const stageIds = Object.keys(stages).map(Number).sort((a, b) => a - b);

    stageIds.forEach((id) => {
        const stage = stages[id];

        if (id < maxUnlockedStage) {
            stage.status = 'cleared';
        } else if (id === maxUnlockedStage) {
            stage.status = 'unlocked';
        } else {
            stage.status = 'locked';
        }
    });

    return Object.values(stages);
};

export const getStageKanji = (stageId: number) => {
    return getAllKanji().filter(k => k.stage === stageId);
};
