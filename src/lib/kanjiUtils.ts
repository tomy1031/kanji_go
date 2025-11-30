import { type KanjiData, type ElementType, type GameVersion } from '../types';
import kanjiMasterRaw from '../data/kanji_master.csv?raw';
import stageKanjiRaw from '../data/stage_kanji.csv?raw';

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
            stage: parseInt(values[9]),
            isBoss: values[10] === 'true'
        } as KanjiData;
    });
};

export const KANJI_DB = parseKanjiData();

export const getAllKanji = (): KanjiData[] => KANJI_DB;

export const getKanjiForStage = (stageId: number): KanjiData[] => {
    const lines = stageKanjiRaw.trim().split('\n');
    const stageLine = lines.slice(1).find(line => {
        const [id] = line.split(',');
        return parseInt(id) === stageId;
    });

    if (stageLine) {
        const [, kanjiIds] = stageLine.split(',');
        const ids = kanjiIds.split('|');
        return KANJI_DB.filter(k => ids.includes(k.id));
    }

    return KANJI_DB.filter(k => k.stage === stageId);
};

export const getKanjiById = (id: string): KanjiData | undefined => {
    return KANJI_DB.find(k => k.id === id);
};
