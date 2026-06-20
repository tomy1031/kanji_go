import { createContext } from 'react';

export interface SoundContextType {
    isMuted: boolean;
    toggleMute: () => void;
    playBgm: (track: 'title' | 'battle' | 'map' | 'boss' | 'practice') => void;
    stopBgm: () => void;
    playSfx: (effect: 'select' | 'hit' | 'win' | 'evolve' | 'mistake' | 'critical' | 'boss_siren') => void;
}

export const SoundContext = createContext<SoundContextType | undefined>(undefined);
