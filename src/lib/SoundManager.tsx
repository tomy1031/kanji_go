import React, { useState, useEffect, useRef } from 'react';
import { SoundContext } from './SoundContext';
import { useUserStore } from '../store/userStore';
import { GameVersion } from '../types';

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isMuted, setIsMuted] = useState(false);
    const bgmRef = useRef<HTMLAudioElement | null>(null);
    const { profile } = useUserStore();
    const audioContextRef = useRef<AudioContext | null>(null);

    // Map versions to file prefixes
    const getVersionPrefix = (version: GameVersion) => {
        switch (version) {
            case GameVersion.RED: return 'red';
            case GameVersion.GREEN: return 'green';
            case GameVersion.BLUE: return 'blue';
            default: return 'red';
        }
    };

    const bgmTracks = {
        title: (version: GameVersion) => `/music/${getVersionPrefix(version)}-opening.mp3`,
        battle: (version: GameVersion) => `/music/${getVersionPrefix(version)}-battle.mp3`,
        map: (version: GameVersion) => `/music/${getVersionPrefix(version)}-field.mp3`
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    useEffect(() => {
        if (bgmRef.current) {
            bgmRef.current.muted = isMuted;
        }
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
        }
    }, [isMuted]);

    const currentTrackRef = useRef<string | null>(null);

    const playBgm = (track: 'title' | 'battle' | 'map') => {
        const src = bgmTracks[track](profile.currentVersion);

        // If the same track is already playing, do nothing
        if (currentTrackRef.current === src && bgmRef.current && !bgmRef.current.paused) {
            return;
        }

        // Stop current BGM
        if (bgmRef.current) {
            bgmRef.current.pause();
            bgmRef.current = null;
        }

        const audio = new Audio(src);
        audio.loop = true;
        audio.volume = 0.5;
        audio.muted = isMuted;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Auto-play prevented:", error);
            });
        }

        bgmRef.current = audio;
        currentTrackRef.current = src;
    };

    // Synthesize SFX using Web Audio API
    const playSfx = (effect: 'select' | 'hit' | 'win' | 'evolve' | 'mistake' | 'critical') => {
        if (isMuted || !audioContextRef.current) return;

        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        switch (effect) {
            case 'select':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'hit':
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'win':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
                osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.3);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
                osc.start(now);
                osc.stop(now + 0.6);
                break;
            case 'evolve':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(880, now + 1.5);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.2, now + 1.0);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                osc.start(now);
                osc.stop(now + 1.5);
                break;
            case 'mistake':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'critical':
                osc.type = 'square';
                osc.frequency.setValueAtTime(440, now); // Higher pitch start
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.3); // Longer drop
                gain.gain.setValueAtTime(0.5, now); // Louder
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
        }
    };

    return (
        <SoundContext.Provider value={{ isMuted, toggleMute, playBgm, playSfx }}>
            {children}
            {/* Global Mute Button Overlay */}
            <button
                onClick={toggleMute}
                className="fixed top-4 left-4 z-[100] bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
            >
                {isMuted ? '🔇' : '🔊'}
            </button>
        </SoundContext.Provider>
    );
};

