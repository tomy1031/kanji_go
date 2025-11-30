import { useContext } from 'react';
import { SoundContext } from '../lib/SoundContext';

export const useSound = () => {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSound must be used within a SoundProvider');
    }
    return context;
};
