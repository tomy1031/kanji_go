import React, { useState } from 'react';
import RoomCreation from './RoomCreation';
import RoomBrowser from './RoomBrowser';
import FriendList from './FriendList';
import { useOnlineStore } from './onlineStore';
import { networkManager } from './NetworkManager';
import { useUserStore } from '../../store/userStore';
import { GameVersion } from '../../types';
import { getKanjiForStage, getAllKanji } from '../../lib/kanjiUtils';

type TabType = 'quick' | 'friends' | 'create' | 'join' | 'stats';

// Shared code used by "match with anyone" — everyone waiting here gets paired.
const RANDOM_MATCH_CODE = 'zz-public-arena';
const QUICK_MATCH_KANJI_COUNT = 20;

interface OnlineLobbyProps {
    onBack: () => void;
}

const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<TabType>('quick');
    const [matchWord, setMatchWord] = useState('');
    const [quickError, setQuickError] = useState<string | null>(null);
    const [isMatching, setIsMatching] = useState(false);
    const { playerStats, resetStats, setCurrentRoom, setConnectionStatus } = useOnlineStore();
    const { profile } = useUserStore();

    const handleBackToMenu = () => {
        onBack();
    };

    // Symmetric passphrase match: both players enter the SAME word and tap
    // battle — no room creation, no ID sharing, host decided automatically.
    const handleQuickMatch = async (rawCode: string) => {
        const code = rawCode.trim().toLowerCase().replace(/\s+/g, '-');
        if (!code) {
            setQuickError('あいことばを いれてね');
            return;
        }
        setQuickError(null);
        setIsMatching(true);
        try {
            setConnectionStatus('connecting');
            await networkManager.joinMatch(code);

            // My question set (used if I end up as host; the host's list wins)
            const pool = getAllKanji().filter(k => k.level === profile.currentVersion).map(k => k.char);
            const shuffled = [...new Set(pool)].sort(() => Math.random() - 0.5);
            const kanjiList = shuffled.slice(0, QUICK_MATCH_KANJI_COUNT);
            if (kanjiList.length === 0) {
                kanjiList.push(...getKanjiForStage(1, 1, GameVersion.RED).map(k => k.char));
            }

            setCurrentRoom({
                id: code,
                hostName: profile.name,
                level: profile.currentVersion,
                world: 1,
                order: 1,
                kanjiList,
                createdAt: Date.now(),
            });
            setConnectionStatus('connected');
        } catch (err) {
            console.error('Quick match failed:', err);
            setQuickError('つながりませんでした。もういちど ためしてね');
            setConnectionStatus('error');
        } finally {
            setIsMatching(false);
        }
    };

    // Start battle with a friend (join their room using their playerId)
    const handleStartBattle = async (friendId: string) => {
        try {
            setConnectionStatus('connecting');
            await networkManager.joinRoom(friendId);

            // Create room object for the battle
            // Initialize with default kanji list to avoid empty state while waiting for host sync
            const defaultKanji = getKanjiForStage(1, 1, GameVersion.RED).map(k => k.char);
            const uniqueKanji = Array.from(new Set(defaultKanji));

            setCurrentRoom({
                id: friendId,
                hostName: 'Friend',
                level: GameVersion.RED,
                world: 1,
                order: 1,
                kanjiList: uniqueKanji,
                createdAt: Date.now()
            });
            setConnectionStatus('connected');
        } catch (err) {
            console.error('Failed to connect to friend:', err);
            setConnectionStatus('error');
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'quick':
                return (
                    <div className="space-y-6">
                        {/* Passphrase match — the simplest way to battle a friend */}
                        <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/30 border border-cyan-500/40 rounded-2xl p-5">
                            <h2 className="text-xl font-black text-white mb-1">🔑 あいことばで対戦</h2>
                            <p className="text-sm text-cyan-200/80 mb-4">
                                ふたりで <span className="font-bold text-white">おなじ あいことば</span> を入れて「たたかう！」を押すだけ。
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={matchWord}
                                    onChange={e => setMatchWord(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !isMatching && handleQuickMatch(matchWord)}
                                    placeholder="れい：ねこパンチ99"
                                    maxLength={24}
                                    className="flex-1 min-w-0 px-4 py-3 bg-gray-900 text-white text-lg rounded-xl border-2 border-cyan-700 focus:border-cyan-400 focus:outline-none placeholder-gray-600"
                                />
                                <button
                                    onClick={() => handleQuickMatch(matchWord)}
                                    disabled={isMatching}
                                    className={`px-5 py-3 rounded-xl font-black text-white whitespace-nowrap transition-all ${isMatching ? 'bg-gray-600' : 'bg-cyan-500 hover:bg-cyan-400 active:scale-95 shadow-[0_0_16px_rgba(34,211,238,0.4)]'}`}
                                >
                                    {isMatching ? 'せつぞく中…' : 'たたかう！'}
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-2">
                                ※ かぶらないように、すこし めずらしい ことばに してね
                            </p>
                        </div>

                        {/* Random match with anyone waiting */}
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-gray-700" />
                            <span className="text-xs text-gray-500">または</span>
                            <div className="h-px flex-1 bg-gray-700" />
                        </div>
                        <button
                            onClick={() => handleQuickMatch(RANDOM_MATCH_CODE)}
                            disabled={isMatching}
                            className={`w-full py-4 rounded-2xl font-black text-white text-lg border transition-all ${isMatching ? 'bg-gray-700 border-gray-600' : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 border-purple-400/40 hover:brightness-110 active:scale-[0.98]'}`}
                        >
                            🌍 だれかとすぐ対戦（ランダムマッチ）
                        </button>

                        {quickError && (
                            <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 text-red-200 text-sm text-center">
                                {quickError}
                            </div>
                        )}

                        <div className="text-xs text-gray-500 leading-relaxed">
                            出題される漢字は、さきにマッチした側（ホスト）のバージョンからランダムに{QUICK_MATCH_KANJI_COUNT}問。
                            こまかく選びたいときは「ルーム作成」タブへ。
                        </div>
                    </div>
                );
            case 'friends':
                return <FriendList onStartBattle={handleStartBattle} />;
            case 'create':
                return <RoomCreation />;
            case 'join':
                return <RoomBrowser />;
            case 'stats':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">対戦成績</h2>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Rating */}
                            <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-lg p-6">
                                <div className="text-sm text-yellow-200 mb-1">レーティング</div>
                                <div className="text-4xl font-black text-white">
                                    {playerStats.rating}
                                </div>
                            </div>

                            {/* Points */}
                            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6">
                                <div className="text-sm text-blue-200 mb-1">獲得ポイント</div>
                                <div className="text-4xl font-black text-white">
                                    {playerStats.points}
                                </div>
                            </div>
                        </div>

                        {/* Win/Loss Record */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-lg font-bold text-white mb-4">対戦記録</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-400">
                                        {playerStats.wins}
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">勝利</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-red-400">
                                        {playerStats.losses}
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">敗北</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-gray-400">
                                        {playerStats.draws}
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">引き分け</div>
                                </div>
                            </div>

                            {/* Win Rate */}
                            {(playerStats.wins + playerStats.losses) > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">勝率</span>
                                        <span className="text-2xl font-bold text-white">
                                            {(
                                                (playerStats.wins / (playerStats.wins + playerStats.losses)) * 100
                                            ).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rating Info */}
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-400 mb-2">
                                レーティングについて
                            </h4>
                            <ul className="text-sm text-gray-400 space-y-1">
                                <li>• 初期レーティング: 1000</li>
                                <li>• 勝利すると上昇、敗北すると下降</li>
                                <li>• 格上との対戦は大きく変動</li>
                                <li>• ポイントは減ることがありません</li>
                            </ul>
                        </div>

                        {/* Reset Button (Debug) */}
                        <button
                            onClick={() => {
                                if (window.confirm('本当に成績をリセットしますか？')) {
                                    resetStats();
                                }
                            }}
                            className="w-full px-4 py-3 bg-red-900/50 hover:bg-red-900/70 border border-red-500 rounded-lg text-red-200 text-sm transition-colors"
                        >
                            成績をリセット (デバッグ用)
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="h-full bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-32 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-black text-white">
                        オンライン対戦
                    </h1>
                    <button
                        onClick={handleBackToMenu}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                    >
                        戻る
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {([
                        { id: 'quick', label: '⚡ クイック', active: 'bg-cyan-600' },
                        { id: 'friends', label: '👥 フレンド', active: 'bg-teal-600' },
                        { id: 'create', label: 'ルーム作成', active: 'bg-green-600' },
                        { id: 'join', label: 'IDで参加', active: 'bg-blue-600' },
                        { id: 'stats', label: '📊 成績', active: 'bg-purple-600' },
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 min-w-[72px] px-3 py-2.5 rounded-lg font-bold text-sm md:text-base transition-all ${activeTab === tab.id
                                ? `${tab.active} text-white scale-105`
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="bg-gray-900/50 rounded-xl p-6">
                    {renderTabContent()}
                </div>

                {/* Info Banner */}
                <div className="mt-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">⚔️</span>
                        <div>
                            <h3 className="text-sm font-bold text-purple-300 mb-1">
                                リアルタイム漢字バトル
                            </h3>
                            <p className="text-xs text-gray-400">
                                インターネットごしに、はやく・正しく漢字を書いたほうが勝ち！
                                いちばんかんたんなのは「⚡ クイック」の あいことば対戦です。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnlineLobby;
