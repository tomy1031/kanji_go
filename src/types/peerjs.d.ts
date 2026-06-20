declare module 'peerjs' {
    export interface DataConnection {
        peer: string;
        open: boolean;
        send(data: any): void;
        close(): void;
        on(event: 'open', callback: () => void): void;
        on(event: 'data', callback: (data: any) => void): void;
        on(event: 'close', callback: () => void): void;
        on(event: 'error', callback: (error: Error) => void): void;
    }

    export default class Peer {
        id: string;
        disconnected: boolean;

        constructor(id?: string, options?: any);

        on(event: 'open', callback: (id: string) => void): void;
        on(event: 'connection', callback: (connection: DataConnection) => void): void;
        on(event: 'error', callback: (error: Error) => void): void;
        on(event: 'close', callback: () => void): void;
        on(event: 'disconnected', callback: () => void): void;

        connect(peerId: string, options?: any): DataConnection;
        destroy(): void;
    }
}
