import React, { useState } from 'react';
import { GameVersion } from '../../types';
import { getKanjiForStage } from '../../lib/kanjiUtils';
import { networkManager } from './NetworkManager';
import { useOnlineStore } from './onlineStore';
import { useUserStore } from '../../store/userStore';
import type { OnlineRoom } from './types';

const RoomCreation: React.FC = () => {
    const [selectedLevel, setSelectedLevel] = useState<GameVersion>(GameVersion.RED);
    const [selectedStages, setSelectedStages] = useState<string[]>(['1-1']); // Format: "world-order"
    const [roomId, setRoomId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { setCurrentRoom, setConnectionStatus } = useOnlineStore();
    const { ensurePlayerId, profile } = useUserStore();

    // Get kanji list for selected stages
    const kanjiList = selectedStages.flatMap(stageParams => {
        const [w, o] = stageParams.split('-').map(Number);
        return getKanjiForStage(w, o, selectedLevel);
    });
    // Remove duplicates
    const uniqueKanjiChars = Array.from(new Set(kanjiList.map(k => k.char)));

    const toggleStage = (world: number, order: number) => {
        const key = `${world}-${order}`;
        setSelectedStages(prev =>
            prev.includes(key)
                ? prev.filter(s => s !== key)
                : [...prev, key]
        );
    };

    const toggleWorld = (world: number) => {
        const stageKeys = [1, 2, 3, 4].map(o => `${world}-${o}`);
        const allSelected = stageKeys.every(key => selectedStages.includes(key));

        if (allSelected) {
            setSelectedStages(prev => prev.filter(s => !stageKeys.includes(s)));
        } else {
            setSelectedStages(prev => {
                const newStages = new Set([...prev, ...stageKeys]);
                return Array.from(newStages);
            });
        }
    };

    const selectAll = () => {
        const allKeys: string[] = [];
        for (let w = 1; w <= 5; w++) {
            for (let o = 1; o <= 4; o++) {
                allKeys.push(`${w}-${o}`);
            }
        }
        if (selectedStages.length === allKeys.length) {
            setSelectedStages([]);
        } else {
            setSelectedStages(allKeys);
        }
    };

    const handleCreateRoom = async () => {
        if (selectedStages.length === 0) {
            setError('ステージを1つ以上選択してください');
            return;
        }

        setIsCreating(true);
        setError(null);
        setConnectionStatus('connecting');

        try {
            // Use the player's permanent ID as the room ID
            const myPlayerId = ensurePlayerId();
            console.log('[RoomCreation] Creating room with playerId:', myPlayerId);
            const id = await networkManager.createRoom(myPlayerId);
            console.log('[RoomCreation] Room created, returned id:', id);
            setRoomId(id);

            // Use the first selected stage as the base "world/order" for now,
            // or modify OnlineRoom type to support multiple stages.
            // For now, let's just pick the first one to satisfy the type, 
            // but we'll need to handle the playlist in the actual battle logic.
            // Ideally we should update OnlineRoom type, but for now let's hack it 
            // by using the first one and maybe passing the full list in a custom event later or modify type now.
            // Actually, let's update the type in a separate step if needed. 
            // For this UI task, I'll pass the first one but the kanji list will contain all.
            const [firstW, firstO] = selectedStages[0].split('-').map(Number);

            const room: OnlineRoom = {
                id,
                hostName: profile.name, // Use player's name
                level: selectedLevel,
                world: firstW,
                order: firstO,
                kanjiList: uniqueKanjiChars,
                createdAt: Date.now(),
            };
            console.log('[RoomCreation] Created room object:', room);

            setCurrentRoom(room);
            setConnectionStatus('connected');
        } catch (err) {
            console.error('Failed to create room:', err);
            setError('ルーム作成に失敗しました。もう一度お試しください。');
            setConnectionStatus('error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopyRoomId = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId);
            // TODO: Show toast notification
        }
    };

    const levelLabels = {
        [GameVersion.RED]: 'N5',
        [GameVersion.GREEN]: 'N3',
        [GameVersion.BLUE]: 'N4',
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">ルーム作成</h2>

            {!roomId ? (
                <div className="space-y-6">
                    {/* Level Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            レベル
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(levelLabels).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedLevel(key as GameVersion)}
                                    className={`px-4 py-3 rounded-lg font-bold transition-all ${selectedLevel === key
                                        ? 'bg-blue-600 text-white scale-105'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stage Selection */}
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <label className="block text-sm font-medium text-gray-300">
                                ステージ選択
                            </label>
                            <button
                                onClick={selectAll}
                                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-blue-300"
                            >
                                {selectedStages.length === 20 ? '全て解除' : '全て選択'}
                            </button>
                        </div>

                        <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {[1, 2, 3, 4, 5].map((world) => (
                                <div key={world} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => toggleWorld(world)}
                                            className="text-xs font-bold text-gray-400 hover:text-white"
                                        >
                                            ワールド {world}
                                        </button>
                                        <div className="h-px flex-1 bg-gray-700"></div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[1, 2, 3, 4].map((order) => {
                                            const key = `${world}-${order}`;
                                            const isSelected = selectedStages.includes(key);
                                            return (
                                                <button
                                                    key={order}
                                                    onClick={() => toggleStage(world, order)}
                                                    className={`px-2 py-2 rounded text-sm font-medium transition-colors ${isSelected
                                                        ? 'bg-blue-600 text-white shadow-lg'
                                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                        }`}
                                                >
                                                    {order} {order === 4 && '👑'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 text-right text-xs text-gray-500">
                            選択中: {selectedStages.length} ステージ
                        </div>
                    </div>

                    {/* Kanji Preview */}
                    <div className="bg-gray-800 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-300 mb-2">
                            出題漢字 ({uniqueKanjiChars.length}文字)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {uniqueKanjiChars.slice(0, 20).map((char, idx) => (
                                <span
                                    key={idx}
                                    className="inline-block w-8 h-8 flex items-center justify-center bg-gray-700 text-white rounded text-sm"
                                >
                                    {char}
                                </span>
                            ))}
                            {uniqueKanjiChars.length > 20 && (
                                <span className="inline-block px-2 h-8 flex items-center justify-center text-gray-400 text-sm">
                                    ...他{uniqueKanjiChars.length - 20}文字
                                </span>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleCreateRoom}
                        disabled={isCreating}
                        className={`w-full px-6 py-4 rounded-lg font-bold text-white transition-all ${isCreating
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 active:scale-95'
                            }`}
                    >
                        {isCreating ? 'ルーム作成中...' : 'ルームを作成'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-green-900/30 border border-green-500 rounded-lg p-6">
                        <h3 className="text-lg font-bold text-green-400 mb-4">
                            ルームが作成されました！
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    ルームID
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 px-4 py-3 bg-gray-800 rounded-lg font-mono text-3xl font-bold text-center text-white tracking-widest">
                                        {roomId}
                                    </div>
                                    <button
                                        onClick={handleCopyRoomId}
                                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
                                    >
                                        コピー
                                    </button>
                                </div>
                            </div>

                            <div className="text-sm text-gray-300">
                                <p>このIDを対戦相手に共有してください。</p>
                                <p className="text-yellow-400 mt-2">
                                    ⏳ 対戦相手の接続を待っています...
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">
                            ステージ情報
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-gray-400">レベル:</div>
                            <div className="text-white font-medium">{levelLabels[selectedLevel]}</div>

                            <div className="text-gray-400">ステージ:</div>
                            <div className="text-white font-medium">{selectedStages.length} ステージ</div>

                            <div className="text-gray-400">漢字数:</div>
                            <div className="text-white font-medium">{uniqueKanjiChars.length}文字</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomCreation;
