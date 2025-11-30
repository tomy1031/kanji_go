import { createContext } from 'react';

export interface SoundContextType {
    isMuted: boolean;
    toggleMute: () => void;
    playBgm: (track: 'title' | 'battle' | 'map') => void;
    playSfx: (effect: 'select' | 'hit' | 'win' | 'evolve' | 'mistake' | 'critical') => void;
}

export const SoundContext = createContext<SoundContextType | undefined>(undefined);
