import React, { useState } from 'react';
import type { OnlineRoom } from './types';
import { GameVersion } from '../../types';
import { networkManager } from './NetworkManager';
import { useOnlineStore } from './onlineStore';

const RoomBrowser: React.FC = () => {
    const [roomIdInput, setRoomIdInput] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { setCurrentRoom, setConnectionStatus } = useOnlineStore();

    const handleJoinRoom = async (roomId: string) => {
        setIsJoining(true);
        setError(null);
        setConnectionStatus('connecting');

        try {
            await networkManager.joinRoom(roomId);

            // TODO: Get room details from host via P2P
            // For now, create a placeholder room
            const room: OnlineRoom = {
                id: roomId,
                hostName: 'Host',
                level: GameVersion.RED,
                world: 1,
                order: 1,
                kanjiList: [],
                createdAt: Date.now(),
            };

            setCurrentRoom(room);
            setConnectionStatus('connected');
        } catch (err) {
            console.error('Failed to join room:', err);
            setError('ルームへの接続に失敗しました。IDを確認してください。');
            setConnectionStatus('error');
        } finally {
            setIsJoining(false);
        }
    };

    const handleJoinByInput = () => {
        if (roomIdInput.trim()) {
            handleJoinRoom(roomIdInput.trim());
        }
    };



    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">ルーム参加</h2>

            {/* Direct Join by Room ID */}
            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="text font-medium text-gray-300">
                    ルームIDで参加
                </h3>

                <div className="flex flex-col md:flex-row gap-2">
                    <input
                        type="text"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        placeholder="fire-dragon-99"
                        className="w-full md:flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        disabled={isJoining}
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                try {
                                    const text = await navigator.clipboard.readText();
                                    setRoomIdInput(text);
                                } catch (e) {
                                    console.error('Failed to read clipboard', e);
                                }
                            }}
                            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-gray-300 transition-colors"
                            title="Paste from Clipboard"
                        >
                            📋
                        </button>
                        <button
                            onClick={handleJoinByInput}
                            disabled={isJoining || !roomIdInput.trim()}
                            className={`flex-1 md:flex-none px-6 py-3 rounded-lg font-bold text-white transition-all min-w-[100px] ${isJoining || !roomIdInput.trim()
                                ? 'bg-gray-600 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                                }`}
                        >
                            {isJoining ? '接続中...' : '参加'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 text-red-200 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Available Rooms List */}
            <div className="space-y-3">
                {/* Available Rooms List - HIDDEN until signaling server is implemented
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-300">
                        利用可能なルーム
                    </h3>
                     ...
                </div>
                */}

                <div className="bg-gray-800 rounded-lg p-6 text-center">
                    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                        <p className="text-sm text-gray-300 mb-2">
                            対戦方法:
                        </p>
                        <ol className="text-sm text-left text-gray-400 space-y-2 list-decimal list-inside block mx-auto max-w-xs">
                            <li>ホストが「ルーム作成」を行う</li>
                            <li>表示された<span className="text-yellow-400 font-bold">ルームID</span>を教えてもらう</li>
                            <li>この画面でIDを入力して「参加」を押す</li>
                        </ol>
                    </div>
                </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-400 mb-2">
                    💡 ヒント
                </h4>
                <ul className="text-sm text-gray-400 space-y-1">
                    <li>• ルームIDは対戦相手から共有されたものを入力してください</li>
                    <li>• 接続には数秒かかる場合があります</li>
                    <li>• 同じネットワーク環境でなくても対戦できます</li>
                </ul>
            </div>
        </div>
    );
};

export default RoomBrowser;
