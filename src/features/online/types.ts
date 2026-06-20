import type { GameVersion } from '../../types';

export interface OnlineRoom {
    id: string; // Peer ID
    hostName: string;
    level: GameVersion;
    world: number;
    order: number;
    kanjiList: string[]; // Array of kanji characters
    createdAt: number; // Timestamp
}

export interface PlayerStats {
    rating: number; // ELO-based rating (default: 1000)
    points: number; // Absolute points earned
    wins: number;
    losses: number;
    draws: number;
}

export const BattleEventType = {
    READY: 'READY',
    START_WRITING: 'START_WRITING',
    COMPLETE_WRITING: 'COMPLETE_WRITING',
    DAMAGE_DEALT: 'DAMAGE_DEALT',
    VICTORY: 'VICTORY',
    DEFEAT: 'DEFEAT',
    DISCONNECT: 'DISCONNECT',
    EMOTE: 'EMOTE',
    PING: 'PING', // Heartbeat for disconnect detection
    MISTAKE: 'MISTAKE', // Player made a mistake (self-damage)
    HANDSHAKE: 'HANDSHAKE',
} as const;

export type BattleEventType = typeof BattleEventType[keyof typeof BattleEventType];

export interface BattleEvent {
    type: BattleEventType;
    payload?: any; // Using any for flexibility, can be refined later
    timestamp: number;
    data?: {
        damage?: number;
        hp?: number;
        kanjiId?: string;
        emoteId?: string;
    };
}

export interface OnlineState {
    isConnected: boolean;
    currentRoom: OnlineRoom | null;
    availableRooms: OnlineRoom[];
    playerStats: PlayerStats;
    opponentName: string;
    opponentHp: number;
    connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
    errorMessage: string | null;
}
