import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { useOnlineStore } from './onlineStore';
import { networkManager } from './NetworkManager';

interface FriendListProps {
    onStartBattle: (friendId: string) => void;
}

interface FriendStatus {
    id: string;
    isOnline: boolean;
    isChecking: boolean;
}

const FriendList: React.FC<FriendListProps> = ({ onStartBattle }) => {
    const { friends, ensurePlayerId, addFriend, removeFriend, profile, setProfile } = useUserStore();
    const { currentRoom } = useOnlineStore(); // Added hook
    const [friendStatuses, setFriendStatuses] = useState<Map<string, FriendStatus>>(new Map());
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [newFriendId, setNewFriendId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Name editing state
    const [isEditingName, setIsEditingName] = useState(false);
    const [editingName, setEditingName] = useState(profile.name);
    const [copied, setCopied] = useState(false);

    // Ensure player has an ID
    const myPlayerId = ensurePlayerId();
    console.log('[FriendList] My player ID:', myPlayerId);

    // Check if a friend is online (currently hosting a room) via Supabase presence.
    const pingFriend = useCallback(async (friendId: string): Promise<boolean> => {
        try {
            return await networkManager.checkRoomOnline(friendId);
        } catch {
            return false;
        }
    }, []);

    // Check friend online status
    const checkFriendStatus = useCallback(async (friendId: string) => {
        setFriendStatuses(prev => new Map(prev).set(friendId, {
            id: friendId,
            isOnline: false,
            isChecking: true
        }));

        try {
            const isOnline = await pingFriend(friendId);
            setFriendStatuses(prev => new Map(prev).set(friendId, {
                id: friendId,
                isOnline,
                isChecking: false
            }));
        } catch {
            setFriendStatuses(prev => new Map(prev).set(friendId, {
                id: friendId,
                isOnline: false,
                isChecking: false
            }));
        }
    }, [pingFriend]);

    // Refresh all friends' status
    const handleRefreshAll = async () => {
        setIsRefreshing(true);
        const checks = friends.map(friend => checkFriendStatus(friend.id));
        await Promise.all(checks);
        setIsRefreshing(false);
    };

    // Check all friend statuses on mount
    useEffect(() => {
        if (friends.length > 0) {
            handleRefreshAll();
        }
    }, []); // Only on mount

    const handleAddFriend = () => {
        if (!newFriendId.trim()) {
            setError('IDを入力してください');
            return;
        }
        if (newFriendId === myPlayerId) {
            setError('自分自身は追加できません');
            return;
        }
        if (friends.some(f => f.id === newFriendId)) {
            setError('このフレンドは既に登録されています');
            return;
        }

        // Add with "Unknown" as default name - they can update their own name
        addFriend(newFriendId.trim(), 'Unknown');
        setNewFriendId('');
        setShowAddFriend(false);
        setError(null);

        // Immediately check if they're online
        checkFriendStatus(newFriendId.trim());
    };

    const handlePasteId = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setNewFriendId(text.trim());
        } catch (e) {
            console.error('Failed to read clipboard', e);
        }
    };

    const handleCopyMyId = async () => {
        try {
            await navigator.clipboard.writeText(myPlayerId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy', e);
        }
    };

    const handleSaveName = () => {
        if (editingName.trim()) {
            setProfile({ name: editingName.trim() });
        }
        setIsEditingName(false);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* My Player Info Section */}
            <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-4 border border-blue-500/30">
                {/* Player Name */}
                <div className="mb-3">
                    <h3 className="text-xs text-gray-400 mb-1">あなたの名前</h3>
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                autoFocus
                                className="flex-1 px-3 py-1.5 bg-gray-700 text-white rounded border border-blue-500 focus:outline-none"
                                maxLength={20}
                            />
                            <button
                                onClick={handleSaveName}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-white text-sm font-bold"
                            >
                                保存
                            </button>
                            <button
                                onClick={() => {
                                    setEditingName(profile.name);
                                    setIsEditingName(false);
                                }}
                                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-white">{profile.name}</span>
                            <button
                                onClick={() => setIsEditingName(true)}
                                className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                            >
                                ✏️ 編集
                            </button>
                        </div>
                    )}
                </div>

                {/* Player ID */}
                <h3 className="text-xs text-gray-400 mb-1">あなたのID</h3>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-cyan-400 flex-1 break-all select-all">
                        {myPlayerId}
                    </span>
                    <button
                        onClick={handleCopyMyId}
                        className={`px-3 py-1.5 rounded text-white text-sm font-bold transition-colors ${copied ? 'bg-green-600' : 'bg-cyan-600 hover:bg-cyan-500'
                            }`}
                    >
                        {copied ? '✓ コピーしました' : '📋 コピー'}
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    このIDを友達に共有してフレンド登録してもらいましょう！
                </p>
            </div>

            {/* Friend List */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-4 gap-2">
                    <h3 className="text-lg font-bold text-white">フレンドリスト</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefreshAll}
                            disabled={isRefreshing}
                            className={`px-3 py-2 rounded-lg text-white text-sm font-bold transition-colors ${isRefreshing
                                ? 'bg-gray-600 cursor-wait'
                                : 'bg-yellow-600 hover:bg-yellow-500'
                                }`}
                        >
                            {isRefreshing ? '🔄 確認中...' : '🔄 更新'}
                        </button>
                        <button
                            onClick={() => setShowAddFriend(true)}
                            className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-bold transition-colors"
                        >
                            ＋ 追加
                        </button>
                    </div>
                </div>

                {friends.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p className="mb-2">まだフレンドがいません</p>
                        <p className="text-sm">IDを交換してフレンドを追加しましょう！</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {friends.map(friend => {
                            const status = friendStatuses.get(friend.id);
                            const isOnline = status?.isOnline ?? false;
                            const isChecking = status?.isChecking ?? false;

                            return (
                                <motion.div
                                    key={friend.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                                >
                                    {/* Online Status Indicator */}
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isChecking ? 'bg-yellow-400 animate-pulse' :
                                        isOnline ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' :
                                            'bg-gray-500'
                                        }`} />

                                    {/* Friend Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{friend.name || 'Unknown'}</p>
                                        <p className="text-xs text-gray-400 font-mono truncate">{friend.id}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => onStartBattle(friend.id)}
                                            disabled={!isOnline || !!currentRoom}
                                            className={`px-3 py-1.5 rounded text-white text-sm font-bold transition-colors ${!isOnline
                                                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                                                : !!currentRoom
                                                    ? 'bg-orange-600/50 cursor-not-allowed text-orange-200'
                                                    : 'bg-blue-600 hover:bg-blue-500'
                                                }`}
                                        >
                                            {currentRoom ? '対戦中' : '対戦'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm(`このフレンドを削除しますか？\n${friend.id}`)) {
                                                    removeFriend(friend.id);
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 border border-red-600 rounded text-red-300 text-sm transition-colors"
                                        >
                                            削除
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Friend Modal */}
            <AnimatePresence>
                {showAddFriend && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowAddFriend(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-600"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-white mb-4">フレンドを追加</h3>

                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="text-sm text-gray-400 mb-1 block">フレンドのID</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newFriendId}
                                            onChange={e => setNewFriendId(e.target.value)}
                                            placeholder="ninja-dragon-1234"
                                            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={handlePasteId}
                                            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
                                            title="ペースト"
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <p className="text-red-400 text-sm">{error}</p>
                                )}

                                <div className="flex gap-3 mt-2">
                                    <button
                                        onClick={() => {
                                            setShowAddFriend(false);
                                            setError(null);
                                        }}
                                        className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 font-bold"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={handleAddFriend}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold"
                                    >
                                        追加
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FriendList;
