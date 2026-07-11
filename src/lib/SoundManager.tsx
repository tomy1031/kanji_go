import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SoundContext } from './SoundContext';
import { useUserStore } from '../store/userStore';
import { GameVersion } from '../types';
import { getAssetPath } from '../utils/assetUtils';

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
    title: (version: GameVersion) => getAssetPath(`/music/${getVersionPrefix(version)}-opening.mp3`),
    battle: (version: GameVersion) => getAssetPath(`/music/${getVersionPrefix(version)}-battle.mp3`),
    map: (version: GameVersion) => getAssetPath(`/music/${getVersionPrefix(version)}-field.mp3`),
    boss: () => getAssetPath('/music/boss.mp3'), // Version-independent
    practice: () => getAssetPath('/music/practice.mp3'), // Version-independent
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isMuted, setIsMuted] = useState(false);
    const bgmRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    // Mute flag mirrored in a ref so the play callbacks can stay referentially
    // stable (consumers use them in effect dependency arrays).
    const isMutedRef = useRef(isMuted);

    const toggleMute = useCallback(() => {
        setIsMuted(prev => !prev);
    }, []);

    useEffect(() => {
        isMutedRef.current = isMuted;
        if (bgmRef.current) {
            bgmRef.current.muted = isMuted;
        }
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
        }
    }, [isMuted]);

    // Pause/Resume BGM when page visibility changes (background/foreground)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (bgmRef.current) {
                if (document.hidden) {
                    bgmRef.current.pause();
                } else {
                    bgmRef.current.play().catch(e => console.warn('Resume play failed:', e));
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const currentTrackRef = useRef<string | null>(null);

    const playBgm = useCallback((track: 'title' | 'battle' | 'map' | 'boss' | 'practice') => {
        // Read the current version at call time (keeps this callback stable)
        const version = useUserStore.getState().profile.currentVersion;
        // Boss and practice tracks are version-independent
        const src = (track === 'boss' || track === 'practice')
            ? bgmTracks[track]()
            : bgmTracks[track](version);

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
        audio.muted = isMutedRef.current;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Auto-play prevented:", error);
            });
        }

        bgmRef.current = audio;
        currentTrackRef.current = src;
    }, []);

    // Synthesize SFX using Web Audio API (or play from file for certain effects)
    const playSfx = useCallback((effect: 'select' | 'hit' | 'win' | 'evolve' | 'mistake' | 'critical' | 'boss_siren') => {
        if (isMutedRef.current) return;

        // For boss_siren, play from audio file
        if (effect === 'boss_siren') {
            const audio = new Audio(getAssetPath('/sfx/boss_siren.mp3'));
            audio.volume = 0.7;
            audio.play().catch(e => console.warn('SFX play failed:', e));
            return;
        }

        if (!audioContextRef.current) return;

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
    }, []);

    // Stop current BGM
    const stopBgm = useCallback(() => {
        if (bgmRef.current) {
            bgmRef.current.pause();
            bgmRef.current = null;
        }
        currentTrackRef.current = null;
    }, []);

    const contextValue = useMemo(
        () => ({ isMuted, toggleMute, playBgm, stopBgm, playSfx }),
        [isMuted, toggleMute, playBgm, stopBgm, playSfx]
    );

    return (
        <SoundContext.Provider value={contextValue}>
            {children}
            {/* Global mute button — floating bottom-right, semi-transparent so it
                doesn't collide with screen headers/back buttons (top corners are
                used by every scene) */}
            <button
                onClick={toggleMute}
                aria-label={isMuted ? 'ミュート解除' : 'ミュート'}
                className="fixed bottom-20 right-2 z-[90] bg-black/40 text-white text-sm p-1.5 rounded-full opacity-60 hover:opacity-100 active:opacity-100 hover:bg-black/70 transition-opacity border border-white/10"
            >
                {isMuted ? '🔇' : '🔊'}
            </button>
        </SoundContext.Provider>
    );
};
