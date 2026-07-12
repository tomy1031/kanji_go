import { createContext } from 'react';

export interface SoundContextType {
    isMuted: boolean;
    toggleMute: () => void;
    playBgm: (track: 'title' | 'battle' | 'map' | 'boss' | 'practice') => void;
    stopBgm: () => void;
    playSfx: (effect: 'select' | 'hit' | 'win' | 'evolve' | 'mistake' | 'critical' | 'boss_siren') => void;
    /** Short blip whose pitch rises with the current combo count. */
    playStroke: (combo: number) => void;
}

export const SoundContext = createContext<SoundContextType | undefined>(undefined);
