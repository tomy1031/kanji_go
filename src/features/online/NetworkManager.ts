import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { BattleEvent } from './types';
import { BattleEventType } from './types';

type EventCallback = (event: BattleEvent) => void;

// ICE servers for P2P connectivity
export const PEER_CONFIG = {
    debug: 2, // Enable PeerJS debug logging
    config: {
        iceTransportPolicy: 'all',
        iceServers: [
            // OpenRelay (Free TURN) - Essential for mobile networks (Symmetric NAT)
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject',
                password: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject',
                password: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject',
                password: 'openrelayproject'
            },
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    }
};

class NetworkManager {
    private static instance: NetworkManager;
    private peer: Peer | null = null;
    private connection: DataConnection | null = null;
    private eventCallbacks: EventCallback[] = [];
    private roomId: string | null = null;
    private isHost: boolean = false;

    // Use the exported config
    private readonly PEER_CONFIG = PEER_CONFIG;

    private constructor() { }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    /**
     * Create a new room (become host)
     * @param customRoomId Optional custom room ID (e.g., player's permanent ID)
     * Returns the room ID that others can use to join
     */
    public async createRoom(customRoomId?: string): Promise<string> {
        // Ensure clean state
        this.disconnect();

        return new Promise((resolve, reject) => {
            try {
                // Use custom room ID if provided, otherwise generate one
                const roomId = customRoomId || this.generateRoomId();

                this.peer = new Peer(roomId, this.PEER_CONFIG);
                this.isHost = true;
                this.roomId = roomId;

                this.peer.on('open', () => {
                    console.log('[NetworkManager] Room created:', roomId);
                    resolve(roomId);
                });

                console.log('[NetworkManager] Host: Setting up connection listener for incoming guests');
                this.peer.on('connection', (conn: DataConnection) => {
                    console.log('[NetworkManager] Host: Guest connecting (signaling):', conn.peer);

                    // Debug: Monitor ICE connection state
                    const pc = (conn as any).peerConnection as RTCPeerConnection | undefined;
                    if (pc) {
                        console.log('[NetworkManager] ICE state:', pc.iceConnectionState);
                        pc.oniceconnectionstatechange = () => {
                            console.log('[NetworkManager] ICE state changed:', pc.iceConnectionState);
                            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                                console.error('[NetworkManager] ICE connection failed (likely NAT issue)');
                                this.sendDisconnectEvent(); // Notify app
                            }
                        };
                        pc.onicegatheringstatechange = () => {
                            console.log('[NetworkManager] ICE gathering state:', pc.iceGatheringState);
                        };
                        pc.onicecandidate = (e) => {
                            if (e.candidate) {
                                console.log('[NetworkManager] ICE candidate:', e.candidate.type, e.candidate.address);
                            }
                        };
                    }

                    // Timeout for data channel opening
                    const timeout = setTimeout(() => {
                        console.error('[NetworkManager] Host: Data channel open timeout');
                    }, 45000); // Extended to 45s

                    // Wait for data channel to actually open before considering connected
                    conn.on('open', () => {
                        clearTimeout(timeout);
                        console.log('[NetworkManager] Guest data channel opened:', conn.peer);
                        this.connection = conn;
                        this.setupConnectionHandlers(conn);
                    });

                    conn.on('error', (err) => {
                        clearTimeout(timeout);
                        console.error('[NetworkManager] Guest connection error:', err);
                    });
                });

                this.peer.on('error', (err: Error) => {
                    console.error('[NetworkManager] Peer error:', err);
                    reject(err);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Join an existing room (become guest)
     */
    public async joinRoom(roomId: string): Promise<void> {
        // Ensure clean state
        this.disconnect();

        return new Promise((resolve, reject) => {
            try {
                // Pass undefined as first arg to let PeerJS generate an ID, while passing config options
                this.peer = new Peer(undefined, this.PEER_CONFIG);
                this.isHost = false;
                this.roomId = roomId;

                this.peer.on('open', () => {
                    console.log('[NetworkManager] Connecting to room:', roomId);
                    const conn = this.peer!.connect(roomId, {
                        reliable: true
                    });

                    // Wait for connection to actually open
                    const connectionPromise = new Promise<void>((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Connection timed out'));
                        }, 45000); // Extended to 45s

                        conn.on('open', () => {
                            clearTimeout(timeout);
                            console.log('[NetworkManager] Connection fully opened');
                            this.connection = conn;

                            // Monitor ICE on Guest side too
                            const pc = (conn as any).peerConnection as RTCPeerConnection | undefined;
                            if (pc) {
                                pc.oniceconnectionstatechange = () => {
                                    console.log('[NetworkManager] Guest ICE state changed:', pc.iceConnectionState);
                                    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                                        console.error('[NetworkManager] Guest ICE connection failed');
                                        this.sendDisconnectEvent();
                                    }
                                };
                            }

                            this.setupConnectionHandlers(conn);
                            resolve();
                        });

                        conn.on('error', (err) => {
                            clearTimeout(timeout);
                            console.error('[NetworkManager] Connection peer error:', err);
                            reject(err);
                        });
                    });

                    // Wait for connection
                    connectionPromise.then(resolve).catch((err) => {
                        // Cleanup if failed
                        conn.close();
                        reject(err);
                    });

                    // Fallback: setup generic error handler for immediate failures
                    // this.connection = conn; // Don't set connection until opened
                });

                this.peer.on('error', (err: Error) => {
                    console.error('[NetworkManager] Connection error:', err);
                    reject(err);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send a battle event to the opponent
     */
    public sendEvent(event: BattleEvent): void {
        if (!this.connection || !this.connection.open) {
            console.warn('[NetworkManager] Cannot send event: No active connection');
            return;
        }

        try {
            this.connection.send(event);
            console.log('[NetworkManager] Sent event:', event.type);
        } catch (error) {
            console.error('[NetworkManager] Error sending event:', error);
        }
    }

    /**
     * Register a callback for incoming events
     */
    public onEvent(callback: EventCallback): () => void {
        this.eventCallbacks.push(callback);
        return () => {
            this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
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
        console.log('[NetworkManager] Disconnecting...');

        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        this.roomId = null;
        this.isHost = false;
        this.eventCallbacks = [];
    }

    /**
     * Get current connection status
     */
    public getConnectionStatus(): 'idle' | 'connecting' | 'connected' | 'disconnected' {
        if (!this.peer) return 'idle';
        if (this.connection && this.connection.open) return 'connected';
        if (this.peer.disconnected) return 'disconnected';
        return 'connecting';
    }

    /**
     * Check if currently hosting a room
     */
    public isHosting(): boolean {
        return this.isHost;
    }

    /**
     * Get current room ID
     */
    public getRoomId(): string | null {
        return this.roomId;
    }

    private setupConnectionHandlers(conn: DataConnection): void {
        conn.on('open', () => {
            console.log('[NetworkManager] Connection established');
        });

        conn.on('data', (data: unknown) => {
            console.log('[NetworkManager] Received event:', data);
            const event = data as BattleEvent;

            // Notify all registered callbacks
            this.eventCallbacks.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error('[NetworkManager] Error in event callback:', error);
                }
            });
        });

        conn.on('close', () => {
            console.log('[NetworkManager] Connection closed');
            this.sendDisconnectEvent();
        });

        conn.on('error', (err: Error) => {
            console.error('[NetworkManager] Connection error:', err);
        });
    }

    private sendDisconnectEvent(): void {
        const event: BattleEvent = {
            type: BattleEventType.DISCONNECT,
            timestamp: Date.now(),
        };

        this.eventCallbacks.forEach(callback => {
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
