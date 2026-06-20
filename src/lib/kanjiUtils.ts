import { type KanjiData, type ElementType, type GameVersion } from '../types';
import kanjiMasterRaw from '../data/kanji_master.csv?raw';


export const parseKanjiData = (): KanjiData[] => {
    const lines = kanjiMasterRaw.trim().split('\n');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return {
            id: values[0],
            char: values[1],
            level: values[2] as GameVersion,
            element: values[3] as ElementType,
            readings: {
                on: values[4].split('|'),
                kun: values[5].split('|')
            },
            meanings: values[6].split('|'),
            strokes: parseInt(values[7]),
            tags: values[8].split('|'),
            world: values[9] ? parseInt(values[9]) : undefined,
            order: values[10] ? parseInt(values[10]) : undefined,
            exampleSentence: values[11],
            exampleReading: values[12]
        } as KanjiData;
    });
};

export const KANJI_DB = parseKanjiData();

export const getAllKanji = (): KanjiData[] => KANJI_DB;

import { getStageKanji } from './stageUtils';

export const getKanjiForStage = (world: number, order: number, level: GameVersion): KanjiData[] => {
    return getStageKanji(world, order, level);
};

export const getKanjiById = (id: string): KanjiData | undefined => {
    return KANJI_DB.find(k => k.id === id);
};
