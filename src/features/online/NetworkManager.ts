import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { BattleEvent } from './types';
import { BattleEventType } from './types';

type EventCallback = (event: BattleEvent) => void;

/** Waiters older than this are treated as ghosts (closed tab, dead network). */
const STALE_WAITER_MS = 30 * 60 * 1000;

/**
 * One lobby for everyone, regardless of which version (N5/N4/N3) each player
 * is on: splitting the lobby per version made it far too likely that nobody
 * was waiting in yours. The question set is reconciled in the handshake
 * instead (the host builds it from the easier of the two versions).
 */
const LOBBY_TOPIC = 'kanjigo-lobby-all';
/**
 * How long the paired players stay visible in the lobby after deciding on each
 * other. Leaving instantly created a race where the faster peer vanished
 * before the slower one had synced the pair, so the slower one never learned
 * the pair code and both sat waiting.
 */
const LOBBY_LINGER_MS = 5000;

export class MatchCancelledError extends Error {
    constructor() {
        super('CANCELLED');
        this.name = 'MatchCancelledError';
    }
}

export class NoOpponentError extends Error {
    constructor() {
        super('NO_OPPONENT');
        this.name = 'NoOpponentError';
    }
}

/**
 * Online transport for battles, over Supabase Realtime (a free cloud relay —
 * no NAT traversal, so it connects on any network).
 *
 * Matchmaking is a single flow: everyone who taps "battle" waits in a lobby
 * channel for their game version, the two earliest waiters pair up
 * (first-come-first-served), and the pair moves to its own private channel so
 * bystanders never see their battle events. Roles (host/guest) are decided
 * deterministically from the pair's keys — there is no room creation, no code
 * to type and no host/guest asymmetry for the player.
 */
class NetworkManager {
    private static instance: NetworkManager;

    private channel: RealtimeChannel | null = null;
    private lobbyChannel: RealtimeChannel | null = null;
    private lobbyLingerTimer: ReturnType<typeof setTimeout> | null = null;
    private eventCallbacks: EventCallback[] = [];
    private roomId: string | null = null;
    private isHost = false;
    private subscribed = false;
    private otherPresent = false;
    private connectionLost = false;
    private myKey: string | null = null;
    private roleDecided = false;
    /** Bumped by cancelMatchmaking() so an in-flight match can never revive. */
    private matchToken = 0;

    private constructor() { }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    // ---- internal helpers -------------------------------------------------

    private recomputePresence(): void {
        const wasPresent = this.otherPresent;
        const keys = this.channel
            ? Object.keys(this.channel.presenceState()).filter((k) => k.startsWith('p-'))
            : [];
        const others = keys.filter((k) => k !== this.myKey);
        if (!this.roleDecided && this.myKey && others.length > 0) {
            // Smallest key hosts — both peers compute the same answer.
            this.isHost = [...keys].sort()[0] === this.myKey;
            this.roleDecided = true;
            console.log('[NetworkManager] Paired. Role:', this.isHost ? 'host' : 'guest');
        }
        this.otherPresent = others.length > 0;

        if (wasPresent && !this.otherPresent) {
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

    /** Tear down the battle channel only (leaves the lobby untouched). */
    private closeBattleChannel(): void {
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
        this.myKey = null;
        this.roleDecided = false;
    }

    /**
     * Leave the matchmaking lobby. This used to leak: the lobby lived in a
     * local variable, so cancelling left it subscribed and a retry subscribed
     * to the same topic twice — which is what made matchmaking start erroring
     * and stop finding opponents.
     */
    private leaveLobby(): void {
        if (this.lobbyLingerTimer) {
            clearTimeout(this.lobbyLingerTimer);
            this.lobbyLingerTimer = null;
        }
        if (this.lobbyChannel) {
            try {
                supabase.removeChannel(this.lobbyChannel);
            } catch {
                // ignore
            }
            this.lobbyChannel = null;
        }
    }

    // ---- public API -------------------------------------------------------

    /** Abort any in-flight matchmaking and drop every channel. */
    public cancelMatchmaking(): void {
        this.matchToken++;
        this.leaveLobby();
        this.closeBattleChannel();
        this.eventCallbacks = [];
    }

    /**
     * The one and only matchmaking entry point.
     * Both players just tap battle; whoever is waiting gets paired.
     *
     * @param version game version (N5/N4/N3) — a separate lobby per version, so
     *                paired players always share the same question pool.
     * @param onWaiting reports how many players are currently waiting (incl. you)
     */
    public async joinQuickMatch(
        opts?: { timeoutMs?: number; onWaiting?: (count: number) => void }
    ): Promise<void> {
        this.cancelMatchmaking();
        const token = this.matchToken;
        // 0 = wait until the player cancels. Requiring both players to press
        // within the same short window was the main reason matches never
        // happened; now the first one can simply keep waiting.
        const timeoutMs = opts?.timeoutMs ?? 0;

        const myKey = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const lobby = supabase.channel(LOBBY_TOPIC, {
            config: { presence: { key: myKey } },
        });
        this.lobbyChannel = lobby;

        const partnerKey = await new Promise<string>((resolve, reject) => {
            let settled = false;
            const finish = (fn: () => void) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                fn();
            };
            const timer = timeoutMs > 0
                ? setTimeout(() => finish(() => reject(new NoOpponentError())), timeoutMs)
                : undefined;

            const check = () => {
                if (settled) return;
                if (token !== this.matchToken) {
                    finish(() => reject(new MatchCancelledError()));
                    return;
                }
                const state = lobby.presenceState() as Record<string, Array<{ j?: number }>>;
                const now = Date.now();
                const waiters = Object.entries(state)
                    .map(([k, v]) => ({ key: k, joined: v[0]?.j ?? 0 }))
                    .filter((w) => w.key.startsWith('p-') && w.joined > 0 && now - w.joined < STALE_WAITER_MS)
                    // Earliest first; key breaks ties so both peers agree.
                    .sort((a, b) => a.joined - b.joined || (a.key < b.key ? -1 : 1));

                opts?.onWaiting?.(waiters.length);

                if (waiters.length < 2) return;
                const pair = waiters.slice(0, 2);
                if (!pair.some((p) => p.key === myKey)) return; // a pair ahead of us
                const partner = pair.find((p) => p.key !== myKey)!;
                finish(() => resolve(partner.key));
            };

            lobby.on('presence', { event: 'sync' }, check);
            lobby.on('presence', { event: 'join' }, check);
            lobby.on('presence', { event: 'leave' }, check);

            lobby.subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    lobby.track({ j: Date.now() });
                    check();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    if (token !== this.matchToken) return; // our own cancellation
                    finish(() => reject(err || new Error('接続に しっぱいしました')));
                }
            });
        }).catch((err) => {
            this.leaveLobby();
            throw err;
        });

        if (token !== this.matchToken) {
            this.leaveLobby();
            throw new MatchCancelledError();
        }

        // Linger briefly so the partner reliably observes the same pairing
        // before we disappear from the lobby.
        this.lobbyLingerTimer = setTimeout(() => this.leaveLobby(), LOBBY_LINGER_MS);

        const pairCode = [myKey, partnerKey].sort().join('~');
        await this.joinPairChannel(pairCode, token);
    }

    /** Join the private channel shared by exactly one pair of players. */
    private async joinPairChannel(pairCode: string, token: number): Promise<void> {
        this.closeBattleChannel();

        this.roomId = pairCode;
        this.myKey = `p-${Math.random().toString(36).slice(2, 10)}`;
        this.roleDecided = false;

        const channel = supabase.channel(`kanjigo-pair-${pairCode}`, {
            config: { broadcast: { self: false }, presence: { key: this.myKey } },
        });
        this.channel = channel;
        this.attachHandlers(channel);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('接続が タイムアウトしました')), 15000);
            channel.subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timeout);
                    if (token !== this.matchToken) {
                        reject(new MatchCancelledError());
                        return;
                    }
                    this.subscribed = true;
                    channel.track({ t: 1 });
                    resolve();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    clearTimeout(timeout);
                    reject(err || new Error('接続に しっぱいしました'));
                }
            });
        });
    }

    /** Send a battle event to the opponent */
    public sendEvent(event: BattleEvent): void {
        if (!this.channel || !this.subscribed) {
            console.warn('[NetworkManager] Cannot send event: No active channel');
            return;
        }
        this.channel.send({ type: 'broadcast', event: 'battle', payload: event });
    }

    /** Register a callback for incoming events */
    public onEvent(callback: EventCallback): () => void {
        this.eventCallbacks.push(callback);
        return () => {
            this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
        };
    }

    public clearEventCallbacks(): void {
        this.eventCallbacks = [];
    }

    /** Leave the battle (and any matchmaking still running). */
    public disconnect(): void {
        this.matchToken++;
        this.leaveLobby();
        this.closeBattleChannel();
        this.eventCallbacks = [];
    }

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
}

export const networkManager = NetworkManager.getInstance();
