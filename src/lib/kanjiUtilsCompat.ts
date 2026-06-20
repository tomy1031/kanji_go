// Helper to get kanji for stage - wrapper for backward compatibility
import { getStageKanji } from './stageUtils';
import { GameVersion } from '../types';

// Convert old world/order calls to new format
export const getKanjiForStage = (world: number, order: number, level: GameVersion) => {
    return getStageKanji(world, order, level);
};
