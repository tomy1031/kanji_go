import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { BattleEvent } from './types';
import { BattleEventType } from './types';

type EventCallback = (event: BattleEvent) => void;
type Role = 'host' | 'guest';

const channelName = (roomId: string) => `kanjigo-room-${roomId}`;

/**
 * Online transport for battles.
 *
 * Previously this used PeerJS (WebRTC P2P), which failed in practice because
 * the free signaling broker and anonymous TURN servers are unreliable, so
 * cross-network (mobile / symmetric NAT) connections rarely established.
 *
 * It now uses Supabase Realtime as a free cloud relay: both players join the
 * same channel (named after the room id), presence tells us when the opponent
 * is connected, and battle events are exchanged via channel broadcast. There is
 * no NAT traversal and no TURN, so it connects reliably on any network. The
 * public API is unchanged.
 */
class NetworkManager {
    private static instance: NetworkManager;

    private channel: RealtimeChannel | null = null;
    private eventCallbacks: EventCallback[] = [];
    private roomId: string | null = null;
    private isHost = false;
    private subscribed = false;
    private otherPresent = false;
    private connectionLost = false;

    private constructor() { }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    private otherRole(): Role {
        return this.isHost ? 'guest' : 'host';
    }

    private hasRole(role: Role): boolean {
        if (!this.channel) return false;
        const state = this.channel.presenceState() as Record<string, Array<{ role?: string }>>;
        return Object.values(state).some((entries) => entries.some((e) => e.role === role));
    }

    private recomputePresence(): void {
        const wasPresent = this.otherPresent;
        this.otherPresent = this.hasRole(this.otherRole());
        if (wasPresent && !this.otherPresent) {
            // Opponent left the room
            this.connectionLost = true;
            this.sendDisconnectEvent();
        }
    }

    private attachHandlers(channel: RealtimeChannel): void {
        channel.on('broadcast', { event: 'battle' }, ({ payload }) => {
            const event = payload as BattleEvent;
            this.eventCallbacks.forEach((cb) => {
                try {
                    cb(event);
                } catch (error) {
                    console.error('[NetworkManager] Error in event callback:', error);
                }
            });
        });
        channel.on('presence', { event: 'sync' }, () => this.recomputePresence());
        channel.on('presence', { event: 'join' }, () => this.recomputePresence());
        channel.on('presence', { event: 'leave' }, () => this.recomputePresence());
    }

    /**
     * Create a new room (become host). Resolves once the room channel is ready;
     * the guest may join afterwards (detected via presence).
     */
    public async createRoom(customRoomId?: string): Promise<string> {
        this.disconnect();

        const roomId = customRoomId || this.generateRoomId();
        this.isHost = true;
        this.roomId = roomId;
        this.connectionLost = false;

        const channel = supabase.channel(channelName(roomId), {
            config: { broadcast: { self: false }, presence: { key: 'host' } },
        });
        this.channel = channel;
        this.attachHandlers(channel);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('接続がタイムアウトしました')), 15000);
            channel.subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timeout);
                    this.subscribed = true;
                    channel.track({ role: 'host', roomId });
                    console.log('[NetworkManager] Room created:', roomId);
                    resolve();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    clearTimeout(timeout);
                    reject(err || new Error('接続に失敗しました'));
                }
            });
        });

        return roomId;
    }

    /**
     * Join an existing room (become guest). Resolves once the host is detected
     * in the room; rejects if no host appears (wrong code / host left).
     */
    public async joinRoom(roomId: string): Promise<void> {
        this.disconnect();

        this.isHost = false;
        this.roomId = roomId;
        this.connectionLost = false;

        const channel = supabase.channel(channelName(roomId), {
            config: { broadcast: { self: false }, presence: { key: 'guest' } },
        });
        this.channel = channel;
        this.attachHandlers(channel);

        await new Promise<void>((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error('ルームが見つかりません（相手がホストしていない可能性があります）'));
            }, 15000);

            const checkHost = () => {
                if (settled) return;
                this.recomputePresence();
                if (this.hasRole('host')) {
                    settled = true;
                    clearTimeout(timeout);
                    console.log('[NetworkManager] Joined room, host present:', roomId);
                    resolve();
                }
            };

            channel.on('presence', { event: 'sync' }, checkHost);
            channel.on('presence', { event: 'join' }, checkHost);

            channel.subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    this.subscribed = true;
                    channel.track({ role: 'guest', roomId });
                    checkHost();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);
                    reject(err || new Error('接続に失敗しました'));
                }
            });
        });
    }

    /**
     * Check whether a room is currently online (host present) — used by the
     * friend list to show online status. Non-invasive: joins presence only.
     */
    public async checkRoomOnline(roomId: string, timeoutMs = 6000): Promise<boolean> {
        return new Promise((resolve) => {
            const probe = supabase.channel(channelName(roomId), {
                config: { presence: { key: `probe-${Date.now()}` } },
            });
            let done = false;
            const finish = (value: boolean) => {
                if (done) return;
                done = true;
                try {
                    supabase.removeChannel(probe);
                } catch {
                    // ignore
                }
                resolve(value);
            };
            const timeout = setTimeout(() => finish(false), timeoutMs);
            const check = () => {
                const state = probe.presenceState() as Record<string, Array<{ role?: string }>>;
                const hostPresent = Object.values(state).some((entries) =>
                    entries.some((e) => e.role === 'host')
                );
                if (hostPresent) {
                    clearTimeout(timeout);
                    finish(true);
                }
            };
            probe.on('presence', { event: 'sync' }, check);
            probe.on('presence', { event: 'join' }, check);
            probe.subscribe((status) => {
                if (status === 'SUBSCRIBED') check();
            });
        });
    }

    /**
     * Send a battle event to the opponent
     */
    public sendEvent(event: BattleEvent): void {
        if (!this.channel || !this.subscribed) {
            console.warn('[NetworkManager] Cannot send event: No active channel');
            return;
        }
        this.channel.send({ type: 'broadcast', event: 'battle', payload: event });
    }

    /**
     * Register a callback for incoming events
     */
    public onEvent(callback: EventCallback): () => void {
        this.eventCallbacks.push(callback);
        return () => {
            this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
        };
    }

    /**
     * Remove all event callbacks
     */
    public clearEventCallbacks(): void {
        this.eventCallbacks = [];
    }

    /**
     * Disconnect from current room
     */
    public disconnect(): void {
        if (this.channel) {
            try {
                supabase.removeChannel(this.channel);
            } catch {
                // ignore
            }
            this.channel = null;
        }
        this.subscribed = false;
        this.otherPresent = false;
        this.connectionLost = false;
        this.roomId = null;
        this.isHost = false;
        this.eventCallbacks = [];
    }

    /**
     * Get current connection status
     */
    public getConnectionStatus(): 'idle' | 'connecting' | 'connected' | 'disconnected' {
        if (!this.channel) return 'idle';
        if (this.connectionLost) return 'disconnected';
        if (this.otherPresent) return 'connected';
        return 'connecting';
    }

    public isHosting(): boolean {
        return this.isHost;
    }

    public getRoomId(): string | null {
        return this.roomId;
    }

    private sendDisconnectEvent(): void {
        const event: BattleEvent = {
            type: BattleEventType.DISCONNECT,
            timestamp: Date.now(),
        };
        this.eventCallbacks.forEach((callback) => {
            try {
                callback(event);
            } catch (error) {
                console.error('[NetworkManager] Error in disconnect callback:', error);
            }
        });
    }

    private generateRoomId(): string {
        const adjectives = ['fire', 'water', 'thunder', 'wind', 'earth', 'light', 'shadow'];
        const nouns = ['dragon', 'phoenix', 'tiger', 'wolf', 'eagle', 'serpent', 'lion'];

        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 100);

        return `${adj}-${noun}-${num}`;
    }
}

export const networkManager = NetworkManager.getInstance();
