import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OnlineState, OnlineRoom, PlayerStats } from './types';

interface OnlineStore extends OnlineState {
    // Room management
    setCurrentRoom: (room: OnlineRoom | null) => void;
    setAvailableRooms: (rooms: OnlineRoom[]) => void;
    addRoom: (room: OnlineRoom) => void;
    removeRoom: (roomId: string) => void;

    // Connection status
    setConnectionStatus: (status: OnlineState['connectionStatus']) => void;
    setConnected: (connected: boolean) => void;
    setErrorMessage: (message: string | null) => void;

    // Opponent state
    setOpponentName: (name: string) => void;
    setOpponentHp: (hp: number) => void;

    // Player stats
    addPoints: (amount: number) => void;
    updateRating: (delta: number) => void;
    incrementWins: () => void;
    incrementLosses: () => void;
    incrementDraws: () => void;
    resetStats: () => void;
}

const initialPlayerStats: PlayerStats = {
    rating: 1000,
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
};

export const useOnlineStore = create<OnlineStore>()(
    persist(
        (set) => ({
            // Initial state
            isConnected: false,
            currentRoom: null,
            availableRooms: [],
            playerStats: initialPlayerStats,
            opponentName: '',
            opponentHp: 100,
            connectionStatus: 'idle',
            errorMessage: null,

            // Room management
            setCurrentRoom: (room) => set({ currentRoom: room }),

            setAvailableRooms: (rooms) => set({ availableRooms: rooms }),

            addRoom: (room) => set((state) => ({
                availableRooms: [...state.availableRooms, room]
            })),

            removeRoom: (roomId) => set((state) => ({
                availableRooms: state.availableRooms.filter(r => r.id !== roomId)
            })),

            // Connection status
            setConnectionStatus: (status) => set({
                connectionStatus: status,
                errorMessage: status === 'error' ? undefined : null // Keep error message if status is error, otherwise clear it
            }),

            setConnected: (connected) => set({
                isConnected: connected,
                connectionStatus: connected ? 'connected' : 'disconnected'
            }),

            setErrorMessage: (message) => set({
                errorMessage: message,
                connectionStatus: message ? 'error' : 'idle'
            }),

            // Opponent state
            setOpponentName: (name) => set({ opponentName: name }),

            setOpponentHp: (hp) => set({ opponentHp: hp }),

            // Player stats
            addPoints: (amount) => set((state) => ({
                playerStats: {
                    ...state.playerStats,
                    points: state.playerStats.points + amount
                }
            })),

            updateRating: (delta) => set((state) => ({
                playerStats: {
                    ...state.playerStats,
                    rating: Math.max(0, state.playerStats.rating + delta)
                }
            })),

            incrementWins: () => set((state) => ({
                playerStats: {
                    ...state.playerStats,
                    wins: state.playerStats.wins + 1
                }
            })),

            incrementLosses: () => set((state) => ({
                playerStats: {
                    ...state.playerStats,
                    losses: state.playerStats.losses + 1
                }
            })),

            incrementDraws: () => set((state) => ({
                playerStats: {
                    ...state.playerStats,
                    draws: state.playerStats.draws + 1
                }
            })),

            resetStats: () => set({ playerStats: initialPlayerStats }),
        }),
        {
            name: 'kanji-go-online-storage',
            // Only persist player stats, not connection state
            partialize: (state) => ({
                playerStats: state.playerStats
            }),
        }
    )
);

/**
 * Calculate rating change based on ELO system
 * @param playerRating Current player rating
 * @param opponentRating Opponent's rating
 * @param won Whether player won
 * @returns Rating delta
 */
export function calculateRatingChange(
    playerRating: number,
    opponentRating: number,
    won: boolean
): number {
    const K = 32; // K-factor (volatility)
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = won ? 1 : 0;

    return Math.round(K * (actualScore - expectedScore));
}
