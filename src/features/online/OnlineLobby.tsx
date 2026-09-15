import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStore } from './onlineStore';
import { networkManager, MatchCancelledError, NoOpponentError } from './NetworkManager';
import { useUserStore } from '../../store/userStore';
import { getAllKanji } from '../../lib/kanjiUtils';
import { getRank } from './rankUtils';
import Stage from '../../components/ui/Stage';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { getAssetPath } from '../../utils/assetUtils';

// One question set per match: a shuffled slice of the version's kanji. Both
// players are matched inside the same version's lobby, so the pool always
// agrees and nobody has to choose anything.
const MATCH_KANJI_COUNT = 20;

interface OnlineLobbyProps {
    onBack: () => void;
}

const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onBack }) => {
    const { playerStats, setCurrentRoom, setConnectionStatus } = useOnlineStore();
    const { profile, setProfile } = useUserStore();

    const [isSearching, setIsSearching] = useState(false);
    const [waitingCount, setWaitingCount] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(profile.name);
    const searchStartRef = useRef(0);

    // Never leave matchmaking running when the screen goes away
    useEffect(() => {
        return () => {
            networkManager.cancelMatchmaking();
        };
    }, []);

    // Elapsed-time ticker while searching
    useEffect(() => {
        if (!isSearching) return;
        const iv = setInterval(() => {
            setElapsed(Math.floor((Date.now() - searchStartRef.current) / 1000));
        }, 500);
        return () => clearInterval(iv);
    }, [isSearching]);

    const handleBattle = async () => {
        setError(null);
        setWaitingCount(0);
        setElapsed(0);
        searchStartRef.current = Date.now();
        setIsSearching(true);
        setConnectionStatus('connecting');

        try {
            // No timeout: whoever taps first simply keeps waiting until the
            // other player arrives (or they cancel).
            await networkManager.joinQuickMatch({
                onWaiting: (count: number) => setWaitingCount(count),
            });

            // My question set (used when I turn out to be the host; the host's
            // list is what both sides play).
            const pool = getAllKanji()
                .filter((k) => k.level === profile.currentVersion)
                .map((k) => k.char);
            const kanjiList = [...new Set(pool)]
                .sort(() => Math.random() - 0.5)
                .slice(0, MATCH_KANJI_COUNT);

            setCurrentRoom({
                id: 'quick-match',
                hostName: profile.name,
                level: profile.currentVersion,
                world: 1,
                order: 1,
                kanjiList,
                createdAt: Date.now(),
            });
            setConnectionStatus('connected');
        } catch (err) {
            setConnectionStatus('idle');
            if (err instanceof MatchCancelledError) {
                // user pressed cancel — no error message
            } else if (err instanceof NoOpponentError) {
                setError('あいてが みつかりませんでした。もういちど ためしてね。');
            } else {
                console.error('Quick match failed:', err);
                const msg = String((err as Error)?.message || '');
                // "transport failure" = the realtime socket never connected
                // (DNS/blocked/paused server), not a matchmaking problem.
                setError(
                    /transport/i.test(msg)
                        ? 'たいせんサーバーに とどきませんでした。\nネットにつながっているか たしかめて、しばらくしてから もういちど おしてね。'
                        : 'つながりませんでした。でんぱの いいところで もういちど ためしてね。'
                );
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleCancel = () => {
        networkManager.cancelMatchmaking();
        setIsSearching(false);
        setConnectionStatus('idle');
    };

    const saveName = () => {
        const next = nameDraft.trim();
        if (next) setProfile({ name: next });
        else setNameDraft(profile.name);
        setIsEditingName(false);
    };

    const rank = getRank(playerStats.rating);
    const totalGames = playerStats.wins + playerStats.losses;

    return (
        <Stage art={getAssetPath('/backgrounds/main_menu.png')} blur>
            <ScreenHeader eyebrow="ONLINE" title="オンラインたいせん" onBack={onBack} />
            <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="max-w-md mx-auto px-4 pb-28 flex flex-col gap-3">

                {/* Rank card */}
                <div className="g-panel p-4 flex items-center gap-4">
                    <div className="text-4xl">{rank.tier.icon}</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                            <span className={`font-black text-lg ${rank.tier.color}`}>{rank.tier.name}</span>
                            <span className="text-xs text-gray-400 font-mono">レート {playerStats.rating}</span>
                        </div>
                        {rank.next ? (
                            <>
                                <div className="mt-1 g-meter !h-2">
                                    <div
                                        className="transition-all duration-700" 
                                        style={{ width: `${rank.progress * 100}%` }}
                                    />
                                </div>
                                <div className="text-[11px] text-gray-400 mt-0.5">
                                    {rank.next.icon} {rank.next.name}まで あと{' '}
                                    <span className="text-white font-bold">{rank.pointsToNext}</span> pt
                                </div>
                            </>
                        ) : (
                            <div className="text-[11px] text-fuchsia-300 mt-1 font-bold">さいこうランク！</div>
                        )}
                    </div>
                </div>

                {/* Name (the opponent sees this) */}
                <div className="g-panel !rounded-[14px] px-4 py-2.5 flex items-center gap-3">
                    <span className="text-xs text-gray-400 shrink-0">なまえ</span>
                    {isEditingName ? (
                        <>
                            <input
                                autoFocus
                                value={nameDraft}
                                onChange={(e) => setNameDraft(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                                maxLength={12}
                                className="flex-1 min-w-0 bg-gray-900 text-white rounded-lg px-3 py-1.5 border border-cyan-500 focus:outline-none"
                            />
                            <button
                                onClick={saveName}
                                className="g-btn g-btn-player !min-h-[40px] !px-4 text-sm"
                            >
                                OK
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="flex-1 min-w-0 truncate font-bold text-white">{profile.name}</span>
                            <button
                                onClick={() => {
                                    setNameDraft(profile.name);
                                    setIsEditingName(true);
                                }}
                                className="g-btn g-btn-ghost !min-h-[40px] !px-3 text-xs"
                            >
                                ✏️ かえる
                            </button>
                        </>
                    )}
                </div>

                {/* The one and only action */}
                <AnimatePresence mode="wait">
                    {isSearching ? (
                        <motion.div
                            key="searching"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="g-panel-solid p-6 flex flex-col items-center gap-4" style={{ boxShadow: "var(--shadow-glow-player), var(--shadow-float)" }}
                        >
                            <div className="w-12 h-12 border-4 border-[color:var(--color-player)] border-t-transparent rounded-full animate-spin" />
                            <div className="text-center">
                                <div className="text-white font-black text-lg">あいてを さがしています…</div>
                                <div className="text-sm text-cyan-300 mt-1">
                                    まっている人: <span className="font-black">{Math.max(waitingCount, 1)}</span>にん
                                </div>
                                <div className="text-[11px] text-gray-500 mt-1 font-mono">{elapsed}びょう</div>
                            </div>
                            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                                あいてが このボタンを おしたら すぐ はじまるよ。<br />
                                この まま まっていて だいじょうぶ！
                            </p>
                            <button
                                onClick={handleCancel}
                                className="g-btn g-btn-danger !px-8 text-sm"
                            >
                                やめる
                            </button>
                        </motion.div>
                    ) : (
                        <motion.button
                            key="battle"
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleBattle}
                            className="g-btn g-btn-primary w-full !min-h-[128px] !rounded-[var(--radius-card)] !flex-col !gap-0 text-2xl g-shimmer"
                        >
                            <div className="text-4xl mb-1">⚔️</div>
                            たたかう！
                            <div className="text-xs font-bold opacity-75 mt-1">
                                ボタンを おすだけ・あいことば いらず
                            </div>
                        </motion.button>
                    )}
                </AnimatePresence>

                {error && (
                    <div className="g-panel !rounded-[14px] p-3 text-sm text-center whitespace-pre-line" style={{ borderColor: "rgba(255,90,110,0.5)" }}>
                        {error}
                    </div>
                )}

                {/* How it works — two lines, no jargon */}
                {!isSearching && (
                    <div className="g-panel !rounded-[14px] p-3 text-[11px] text-[color:var(--color-ink-2)] leading-relaxed">
                        ① ふたりとも このがめんで「たたかう！」をおす<br />
                        ② あいてが みつかったら すぐ バトルスタート！<br />
                        <span className="text-gray-500">
                            ※ さきに おした人は そのまま まっていればOK。
                            ちがうソフト（N5/N4/N3）の人とも たたかえます
                        </span>
                    </div>
                )}

                {/* Record */}
                <div className="g-panel p-4">
                    <h3 className="g-eyebrow mb-3">せんせき</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                            <div className="text-2xl font-black text-green-400">{playerStats.wins}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">かち</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-red-400">{playerStats.losses}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">まけ</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-gray-400">{playerStats.draws}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">ひきわけ</div>
                        </div>
                    </div>
                    {totalGames > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                            <span className="text-xs text-gray-400">しょうりつ</span>
                            <span className="text-lg font-black text-white">
                                {((playerStats.wins / totalGames) * 100).toFixed(0)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>
            </div>
        </Stage>
    );
};

export default OnlineLobby;
