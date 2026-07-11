import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStore, calculateRatingChange } from './onlineStore';
import { networkManager } from './NetworkManager';
import { useUserStore } from '../../store/userStore';
import { useSound } from '../../hooks/useSound';
import { getAssetPath } from '../../utils/assetUtils';
import { KANJI_DB } from '../../lib/kanjiUtils';
import { KanjiInfoDisplay } from '../../components/KanjiInfoDisplay';
import { KanjiListModal } from '../../components/KanjiListModal';
import KanjiWriterCanvas from '../../components/KanjiWriterCanvas';
import { BattleEventType } from './types';
import type { BattleEvent } from './types';
import { getMonsterStats, MONSTER_DB } from '../../lib/evolutionUtils';
import { getDebugParams } from '../../components/DebugMode';
import { useCanvasSize } from '../../hooks/useCanvasSize';

interface OnlineBattleSceneProps {
    onLeave: () => void;
}

// Module-scope clock helper: handleNetworkEvent only runs from network
// callbacks (never during render), so reading the clock there is safe.
const nowMs = () => Date.now();

const OnlineBattleScene: React.FC<OnlineBattleSceneProps> = ({ onLeave }) => {
    // Stores
    const {
        currentRoom,
        connectionStatus,
        errorMessage,
        opponentName,
        opponentHp,
        setOpponentHp,
        playerStats: onlinePlayerStats,
        updateRating,
        addPoints,
        incrementWins,
        incrementLosses,
        setConnectionStatus,
        setConnected,
        setOpponentName
    } = useOnlineStore();

    const handleLeave = () => {
        console.log("OnlineBattleScene: Leaving battle...");
        networkManager.disconnect();
        setConnectionStatus('idle');
        setConnected(false);
        // Clean up current room to prevent stuck state
        useOnlineStore.getState().setCurrentRoom(null);
        onLeave();
    };
    const { profile, partners, stats: userStats } = useUserStore();
    const myPlayerId = useUserStore((state) => state.ensurePlayerId());
    const { playBgm, playSfx } = useSound();

    // Derived Stats (Calculated from UserStore)
    const currentPartner = MONSTER_DB[partners.currentMonsterId] || {
        id: 'starter_fire',
        name: 'Unknown',
        imagePath: getAssetPath('/monsters/starter_fire.png'),
        element: 'FIRE',
        weakness: 'WATER'
    }; // Fallback

    // Stats calculation
    const playerStats = getMonsterStats(partners.currentMonsterId, userStats.playerLevel);
    const maxPlayerHp = playerStats.hp;

    // Game State
    const [gameState, setGameState] = useState<'WAITING' | 'READY' | 'BATTLE' | 'VICTORY' | 'DEFEAT'>('WAITING');
    const [currentKanjiIndex, setCurrentKanjiIndex] = useState(0);
    const [myHp, setMyHp] = useState(maxPlayerHp);

    // Opponent State (Some from store, some local)
    const [opponentMaxHp, setOpponentMaxHp] = useState(100);
    const [opponentRating, setOpponentRating] = useState(1000);
    const [opponentMonsterId, setOpponentMonsterId] = useState<string>('wolf_fire');
    const opponentPlayerIdRef = useRef<string | null>(null);
    const [message, setMessage] = useState('Waiting for opponent...');
    const [combo, setCombo] = useState(0);

    // Initial Opponent Name Setup from Store
    useEffect(() => {
        // If we joined, we might have name already
        // But HANDSHAKE handles updates
    }, []);

    // Opponent Derived Stats
    // If we have an ID from handshake, use it. Otherwise fallback.
    const opponentMonsterData = opponentMonsterId ? MONSTER_DB[opponentMonsterId] : null;
    // Fallback logic for display
    const opponentImageDisplay = opponentMonsterData ? getAssetPath(`/monsters/${opponentMonsterData.id}.png`) : null;

    // Visual State
    const [damageNumbers, setDamageNumbers] = useState<{ id: number; value: number; isCritical: boolean; isPlayer: boolean }[]>([]);
    const [isPlayerHit, setIsPlayerHit] = useState(false);
    const [isOpponentHit, setIsOpponentHit] = useState(false);
    const [slashEffect, setSlashEffect] = useState<{ id: number; x: number; y: number } | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);

    // BGM
    useEffect(() => {
        playBgm('battle');
    }, [playBgm]);

    // Track the transport-level connection (opponent presence). Polling keeps
    // the handshake effect re-running until the opponent actually arrives —
    // required for the symmetric passphrase match where both players can enter
    // this scene before being paired.
    const [netConnected, setNetConnected] = useState(false);
    useEffect(() => {
        const iv = setInterval(() => {
            setNetConnected(networkManager.getConnectionStatus() === 'connected');
        }, 800);
        return () => clearInterval(iv);
    }, []);

    // Heartbeat / Disconnect Detection (3 consecutive failed pings = disconnect)
    const lastPingRef = useRef<number>(0);
    const failedPingCountRef = useRef<number>(0);
    const MAX_FAILED_PINGS = 3;

    useEffect(() => {
        if (gameState !== 'BATTLE') return;
        lastPingRef.current = Date.now();

        // Send ping and check response every 2 seconds
        const pingInterval = setInterval(() => {
            const timeSinceLastPing = Date.now() - lastPingRef.current;

            // If no response in 3 seconds, count as failed
            if (timeSinceLastPing > 3000) {
                failedPingCountRef.current++;
                console.log(`[OnlineBattleScene] Ping failed (${failedPingCountRef.current}/${MAX_FAILED_PINGS})`);

                if (failedPingCountRef.current >= MAX_FAILED_PINGS) {
                    console.log('[OnlineBattleScene] Opponent disconnect detected');
                    setMessage('相手の接続が切れました...');
                    setGameState('VICTORY'); // Win by disconnect
                    playSfx('win');
                    return;
                }
            }

            // Send ping
            networkManager.sendEvent({
                type: BattleEventType.PING,
                timestamp: Date.now()
            });
        }, 2000);

        return () => {
            clearInterval(pingInterval);
        };
    }, [gameState, playSfx]);

    // Initial Handshake & Setup
    useEffect(() => {
        // If we have an error, don't just leave, show it.
        if (connectionStatus === 'error') {
            console.log("OnlineBattleScene: Connection Error State");
            return;
        }

        if (!currentRoom) {
            console.log("OnlineBattleScene: No room, leaving...");
            // onLeave(); 
            return;
        }

        let handshakeInterval: ReturnType<typeof setInterval> | null = null;

        // Guest logic: repeatedly send READY until Host replies (game starts)
        // Only start handshake once the opponent is actually present
        if (!networkManager.isHosting() && gameState === 'WAITING' && netConnected) {
            const sendHandshake = () => {
                console.log("OnlineBattleScene: Guest sending READY handshake...");
                const handshakeEvent: BattleEvent = {
                    type: BattleEventType.READY,
                    payload: {
                        maxHp: maxPlayerHp,
                        rating: onlinePlayerStats.rating,
                        monsterId: partners.currentMonsterId,
                        name: profile.name,
                        id: myPlayerId
                    },
                    timestamp: Date.now()
                };
                networkManager.sendEvent(handshakeEvent);
            };

            // Send immediate
            sendHandshake();
            // Retry every 2 seconds
            handshakeInterval = setInterval(sendHandshake, 2000);
        } else if (networkManager.isHosting()) {
            console.log("OnlineBattleScene: Hosting, waiting for Guest...");
            console.log("OnlineBattleScene: Connection status:", networkManager.getConnectionStatus());
        }

        return () => {
            if (handshakeInterval) clearInterval(handshakeInterval);
        };
    }, [currentRoom, connectionStatus, netConnected, maxPlayerHp, gameState, onlinePlayerStats.rating, partners.currentMonsterId, profile.name, myPlayerId]);

    // Handler ref (kept fresh each render) to avoid stale closures
    const handleNetworkEventRef = useRef<(event: BattleEvent) => void>(() => { });

    // Register event listener once
    useEffect(() => {
        console.log("OnlineBattleScene: Registering event callback");
        const unsubscribe = networkManager.onEvent((event) => {
            console.log("OnlineBattleScene: Received event:", event.type);
            if (handleNetworkEventRef.current) {
                handleNetworkEventRef.current(event);
            }
        });
        return () => {
            unsubscribe();
        };
    }, []);

    const handleNetworkEvent = (event: BattleEvent) => {
        console.log("Received Event:", event);
        switch (event.type) {
            case BattleEventType.READY:
                console.log("[OnlineBattleScene] Received READY payload:", event.payload);
                if (event.payload?.maxHp) {
                    setOpponentMaxHp(event.payload.maxHp);
                    setOpponentHp(event.payload.maxHp);
                }
                if (event.payload?.rating) {
                    setOpponentRating(event.payload.rating);
                }
                if (event.payload?.monsterId) {
                    setOpponentMonsterId(event.payload.monsterId);
                }
                if (event.payload?.name) {
                    setOpponentName(event.payload.name);
                }
                if (event.payload?.id) {
                    opponentPlayerIdRef.current = event.payload.id;
                    if (event.payload.stats) {
                        useUserStore.getState().syncBattleStats(event.payload.id, event.payload.stats);
                    }
                }

                // Host sends kanjiList in READY response
                if (event.payload?.kanjiList && event.payload.kanjiList.length > 0 && currentRoom) {
                    console.log("Received kanjiList:", event.payload.kanjiList);
                    // Update room with kanjiList from Host
                    useOnlineStore.getState().setCurrentRoom({
                        ...currentRoom,
                        kanjiList: event.payload.kanjiList
                    });
                }

                // If Host receiving READY, reply with own READY including kanjiList
                if (networkManager.isHosting()) {
                    console.log("OnlineBattleScene: Host received READY, replying with kanjiList...");
                    const responseEvent: BattleEvent = {
                        type: BattleEventType.READY,
                        payload: {
                            maxHp: maxPlayerHp,
                            rating: onlinePlayerStats.rating,
                            monsterId: partners.currentMonsterId,
                            name: profile.name,
                            kanjiList: currentRoom?.kanjiList || [] // Send kanji list to Guest
                        },
                        timestamp: nowMs()
                    };
                    networkManager.sendEvent(responseEvent);
                }

                // Both sides transition to BATTLE on receiving READY (Host receives Guest's, Guest receives Host's)
                if (gameState === 'WAITING') {
                    setGameState('BATTLE');
                    setMessage('BATTLE START!');
                    setTimeout(() => setMessage(''), 2000);
                }
                break;

            case BattleEventType.HANDSHAKE:
                console.log("[OnlineBattleScene] Received HANDSHAKE payload:", event.payload);
                if (event.payload?.name) {
                    setOpponentName(event.payload.name);
                }
                if (event.payload?.id) {
                    opponentPlayerIdRef.current = event.payload.id;
                }

                // If we are waiting, this is our cue to get READY
                if (gameState === 'WAITING' || gameState === 'READY') {
                    // Send READY back with our stats against this opponent
                    const opponentId = event.payload?.id;
                    const myStats = opponentId ? useUserStore.getState().battleRecords[opponentId] || { wins: 0, losses: 0 } : undefined;

                    const readyEvent: BattleEvent = {
                        type: BattleEventType.READY,
                        payload: {
                            maxHp: maxPlayerHp,
                            rating: onlinePlayerStats.rating,
                            monsterId: partners.currentMonsterId,
                            name: profile.name,
                            id: myPlayerId,
                            stats: myStats
                        },
                        timestamp: nowMs()
                    };
                    networkManager.sendEvent(readyEvent);
                    setGameState('BATTLE');
                    // Also start turn? Or wait for START_WRITING?
                    // Original code sent READY then waited or started.
                    // Actually, both send READY. When both receive READY?
                    // The logic here is simplified P2P handshake.
                }
                break;

            case BattleEventType.DISCONNECT:
                // Only treat as error if battle has actually started
                // During WAITING, ignore disconnects (could be from ping tests)
                if (gameState === 'BATTLE') {
                    console.log("OnlineBattleScene: Opponent disconnected during battle");
                    useOnlineStore.getState().setConnectionStatus('disconnected');
                    useOnlineStore.getState().setErrorMessage('Opponent disconnected');
                } else {
                    console.log("OnlineBattleScene: Connection closed during WAITING, ignoring (may be ping)");
                }
                break;

            case BattleEventType.COMPLETE_WRITING: {
                const damage = event.payload?.damage || 0;
                const isCritical = event.payload?.isCritical || false;

                // Show damage on ME
                showDamageNumber(damage, true, isCritical);
                setIsPlayerHit(true);
                setTimeout(() => setIsPlayerHit(false), 500);
                playSfx(isCritical ? 'critical' : 'hit');

                setMyHp((prev: number) => {
                    const newHp = Math.max(0, prev - damage);
                    if (newHp === 0) {
                        handleDefeat();
                    }
                    return newHp;
                });
                break;
            }

            case BattleEventType.VICTORY:
                if (opponentPlayerIdRef.current) {
                    useUserStore.getState().recordLoss(opponentPlayerIdRef.current);
                }
                handleDefeat();
                break;

            case BattleEventType.DEFEAT:
                if (opponentPlayerIdRef.current) {
                    useUserStore.getState().recordWin(opponentPlayerIdRef.current);
                }
                handleVictory();
                break;

            case BattleEventType.PING:
                // Update last ping time and reset failure counter - opponent is still connected
                lastPingRef.current = nowMs();
                failedPingCountRef.current = 0;
                break;

            case BattleEventType.MISTAKE: {
                const mistakeDamage = event.payload?.damage || 0;
                // Opponent made a mistake -> Show damage on opponent
                showDamageNumber(mistakeDamage, false, false);
                setIsOpponentHit(true);
                setTimeout(() => setIsOpponentHit(false), 500);

                // Use current state value as useOnlineStore setter doesn't support callback
                setOpponentHp(Math.max(0, useOnlineStore.getState().opponentHp - mistakeDamage));
                break;
            }

        }
    };

    // Keep the network handler ref fresh (defined after the handler to avoid
    // use-before-declaration)
    useEffect(() => {
        handleNetworkEventRef.current = handleNetworkEvent;
    });

    const handleVictory = () => {
        if (gameState === 'VICTORY' || gameState === 'DEFEAT') return;
        setGameState('VICTORY');
        setMessage('YOU WIN!');
        playSfx('win');

        // Update Stats
        incrementWins();
        addPoints(100);
        const ratingDelta = calculateRatingChange(onlinePlayerStats.rating, opponentRating, true);
        updateRating(ratingDelta);
    };

    const handleDefeat = () => {
        if (gameState === 'VICTORY' || gameState === 'DEFEAT') return;
        setGameState('DEFEAT');
        setMessage('YOU LOSE...');
        playSfx('mistake');

        incrementLosses();
        addPoints(20);
        const ratingDelta = calculateRatingChange(onlinePlayerStats.rating, opponentRating, false);
        updateRating(ratingDelta);

        networkManager.sendEvent({
            type: BattleEventType.DEFEAT,
            timestamp: Date.now()
        });
    };

    const showDamageNumber = (value: number, isPlayer: boolean, isCritical: boolean) => {
        const id = Date.now();
        setDamageNumbers(prev => [...prev, { id, value, isCritical, isPlayer }]);
        setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1000);
    };

    const handleWriteComplete = () => {
        if (gameState !== 'BATTLE') return;

        // Calculate damage using Debug Params
        const debugParams = getDebugParams();
        const baseDamage = debugParams.onlineAttackDamage ?? 15;

        // Critical calculation
        const isCritical = Math.random() < (debugParams.criticalChance ?? 0.1);
        const damage = Math.floor(baseDamage * (isCritical ? (debugParams.criticalMultiplier ?? 1.5) : 1.0));

        // Update Opponent Visuals
        showDamageNumber(damage, false, isCritical);
        setIsOpponentHit(true);
        setTimeout(() => setIsOpponentHit(false), 500);
        playSfx(isCritical ? 'critical' : 'hit');

        // Optimistic HP update
        setOpponentHp(Math.max(0, opponentHp - damage));

        // Send Attack
        networkManager.sendEvent({
            type: BattleEventType.COMPLETE_WRITING,
            payload: {
                damage,
                isCritical
            },
            timestamp: Date.now()
        });

        // Slash Effect
        setSlashEffect({
            id: Date.now(),
            x: Math.random() * 100 - 50,
            y: Math.random() * 100 - 50
        });
        setTimeout(() => setSlashEffect(null), 200);

        // Next Kanji
        if (currentRoom?.kanjiList) {
            setCurrentKanjiIndex(prev => (prev + 1) % currentRoom.kanjiList.length);
        }
    };

    const currentKanjiChar = currentRoom?.kanjiList?.[currentKanjiIndex] || '漢';
    const canvasSize = useCanvasSize(280, 0.36);

    // Safe room access
    const roomIdDisplay = currentRoom?.id || "Unknown Room";
    // Random matches meet on an auto-generated private pair channel — showing
    // that code (or passphrase instructions) would only confuse players.
    const isRandomPair = networkManager.getRoomId()?.startsWith('pair-') ?? false;

    return (
        <div className="w-full h-[100dvh] text-white flex flex-col relative overflow-hidden">
            {/* Battle Arena - Top Section */}
            <div className="relative flex-1 flex items-center justify-center min-h-0 bg-gray-900">
                {/* Diagonal Split Background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        className="absolute inset-0 bg-gradient-to-br from-red-900 via-red-800 to-red-950"
                        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                    />
                    <div
                        className="absolute inset-0 bg-gradient-to-tl from-blue-900 via-blue-800 to-blue-950"
                        style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
                    />
                    <div
                        className="absolute inset-0 opacity-30"
                        style={{
                            background: 'repeating-conic-gradient(from 0deg, transparent 0deg 10deg, rgba(255,255,255,0.05) 10deg 20deg)',
                            transformOrigin: 'center center',
                        }}
                    />
                </div>

                {/* Persistent Room ID Display (Top Left) */}
                <div className="absolute top-4 left-4 z-40 bg-black/50 px-3 py-1 rounded border border-white/20">
                    <div className="text-[10px] text-gray-400 font-mono">ROOM ID</div>
                    <div className="text-sm font-bold text-white font-mono select-all">
                        {roomIdDisplay}
                    </div>
                </div>

                {/* Waiting Overlay */}
                {gameState === 'WAITING' && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-4 animate-fade-in text-center p-6 md:p-8 bg-gray-900 rounded-2xl border border-blue-500 shadow-2xl max-w-md w-full mx-4">
                            <div className="text-yellow-400 font-black text-xl md:text-2xl animate-pulse">あいてを まっています…</div>

                            {isRandomPair ? (
                                <div className="w-full bg-black px-6 py-5 rounded-xl border-2 border-dashed border-purple-500/60">
                                    <div className="text-3xl mb-2">🌍</div>
                                    <div className="text-xl font-black text-white">ランダムマッチ</div>
                                    <div className="text-xs text-purple-300 mt-2">あいてと せつぞくしています…</div>
                                </div>
                            ) : (
                                <div className="w-full bg-black px-6 py-5 rounded-xl border-2 border-dashed border-gray-600 relative overflow-hidden group">
                                    <div className="text-xs text-gray-400 mb-2 font-mono uppercase tracking-widest">
                                        {networkManager.isMatchMode() ? 'あいことば' : 'Room ID'}
                                    </div>
                                    <div className="text-3xl md:text-4xl font-mono font-bold text-white tracking-widest select-all break-all">
                                        {roomIdDisplay}
                                    </div>
                                    {networkManager.isMatchMode() && (
                                        <div className="text-xs text-cyan-300 mt-3">
                                            あいても おなじ あいことばで「たたかう！」を押すと はじまるよ
                                        </div>
                                    )}
                                    <div className="flex justify-center mt-4">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(roomIdDisplay)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-full flex items-center gap-2 transition-colors"
                                        >
                                            <span>📋</span> コピー
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-gray-500 font-mono mt-2">
                                Status: {connectionStatus} <br />
                                {networkManager.isHosting() ? '(HOST)' : '(GUEST)'}
                                {errorMessage && (
                                    <div className="text-red-400 font-bold mt-1">
                                        ERROR: {errorMessage}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleLeave}
                                className="mt-4 px-8 py-3 bg-red-900/50 hover:bg-red-800/50 border border-red-500 text-red-200 rounded-lg text-sm font-bold transition-colors w-full"
                            >
                                キャンセル (Lobbyへ戻る)
                            </button>
                        </div>
                    </div>
                )}

                {/* Center Message (Battle Start / Win / Lose) */}
                <AnimatePresence>
                    {message && gameState !== 'WAITING' && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 2, opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                        >
                            <h1 className="text-5xl md:text-7xl font-black text-white stroke-black drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] text-center px-4">
                                {message}
                            </h1>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Fighters Row */}
                <div className="absolute inset-0 flex items-center justify-between px-4 z-10 max-w-5xl mx-auto w-full">
                    {/* Combo Display */}
                    {combo > 0 && (
                        <motion.div
                            initial={{ scale: 0, y: -20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-600 to-red-600 px-4 py-1 rounded-full border-2 border-yellow-400 z-20 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                        >
                            <span className="text-white font-black text-sm md:text-base">🔥 {combo} COMBO</span>
                        </motion.div>
                    )}

                    {/* Left: Opponent (Red) */}
                    <motion.div
                        className="flex flex-col items-center w-[40%]"
                        animate={{ x: isOpponentHit ? [-10, 10, -10, 10, 0] : 0 }}
                        style={{ filter: isOpponentHit ? 'brightness(2) saturate(2)' : 'none' }}
                    >
                        {/* Role tag: opponent */}
                        <div className="bg-red-600 text-white text-[10px] md:text-xs font-black px-3 py-0.5 rounded-full mb-1 tracking-widest shadow-md">
                            あいて
                        </div>
                        {/* Name Badge */}
                        <div className="text-red-400 text-[10px] md:text-sm font-black mb-1 flex items-center gap-1 bg-black/40 px-3 py-1 rounded-full border border-red-900/50 backdrop-blur-sm max-w-full">
                            <span>👹</span>
                            <span className="truncate">{opponentName || 'Rival'}</span>
                            <span className="text-xs text-red-300 ml-1 hidden md:inline">Rating: {opponentRating}</span>
                        </div>

                        {/* Avatar Frame */}
                        <div
                            className="w-full aspect-square max-w-[100px] md:max-w-[140px] rounded-xl border-4 flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-gray-900 to-black shadow-2xl"
                            style={{ borderColor: '#ff4444' }}
                        >
                            {/* Opponent Image */}
                            {opponentImageDisplay ? (
                                <img
                                    src={opponentImageDisplay}
                                    alt="Opponent"
                                    className="w-[80%] h-[80%] object-contain drop-shadow-lg"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            ) : (
                                <span className="text-5xl md:text-7xl drop-shadow-lg">👹</span>
                            )}

                            {/* Slash Effect */}
                            <AnimatePresence>
                                {slashEffect && (
                                    <motion.div
                                        key={slashEffect.id}
                                        initial={{ opacity: 1, scale: 0.5, rotate: -45 }}
                                        animate={{ opacity: 0, scale: 1.5, rotate: 45 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                                        style={{ left: slashEffect.x, top: slashEffect.y }}
                                    >
                                        <div className="w-32 h-2 bg-white shadow-[0_0_15px_#fff] transform" />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Damage Numbers */}
                            <AnimatePresence>
                                {damageNumbers.filter(d => !d.isPlayer).map(dn => (
                                    <motion.div
                                        key={dn.id}
                                        initial={{ opacity: 1, y: 0, scale: 0.5 }}
                                        animate={{ opacity: 0, y: -40, scale: 1.2 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                                    >
                                        <span className={`text-3xl md:text-5xl font-black ${dn.isCritical ? 'text-yellow-400' : 'text-white'} drop-shadow-lg stroke-black`}>
                                            {dn.value}{dn.isCritical && '!'}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* HP Bar */}
                        <div className="w-full max-w-[100px] md:max-w-[140px] mt-3">
                            <div className="flex justify-between text-[10px] md:text-xs text-gray-300 mb-1">
                                <span>HP</span>
                                <span>{opponentHp}/{opponentMaxHp}</span>
                            </div>
                            <div className="h-3 bg-gray-900 rounded-full border border-gray-600 overflow-hidden relative shadow-inner">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-red-600 to-red-500 relative z-10"
                                    initial={{ width: '100%' }}
                                    animate={{ width: `${(opponentHp / opponentMaxHp) * 100}%` }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                                {/* Glass shine */}
                                <div className="absolute top-0 left-0 right-0 h-[50%] bg-white/20 z-20 pointer-events-none" />
                            </div>
                        </div>
                    </motion.div>

                    {/* VS Badge */}
                    <div className="flex items-center justify-center z-0">
                        <motion.div
                            className="text-3xl md:text-5xl font-black text-white italic"
                            style={{
                                textShadow: '0 0 20px #ff6600, 0 0 40px #ff3300, 4px 4px 0 #993300',
                                fontFamily: "'Black Ops One', sans-serif"
                            }}
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        >
                            VS
                        </motion.div>
                    </div>

                    {/* Right: Player (Blue) */}
                    <motion.div
                        className="flex flex-col items-center w-[40%]"
                        animate={{ x: isPlayerHit ? [-10, 10, -10, 10, 0] : 0 }}
                        style={{ filter: isPlayerHit ? 'brightness(2)' : 'none' }}
                    >
                        {/* Role tag: YOU — bouncing marker so your side is obvious at a glance */}
                        <motion.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                            className="bg-cyan-400 text-cyan-950 text-[10px] md:text-xs font-black px-3 py-0.5 rounded-full mb-1 tracking-widest shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                        >
                            ▼ あなた
                        </motion.div>
                        {/* Name Badge */}
                        <div className="text-cyan-400 text-[10px] md:text-sm font-black mb-1 flex items-center gap-1 bg-black/40 px-3 py-1 rounded-full border border-blue-900/50 backdrop-blur-sm max-w-full">
                            <span>✨</span>
                            <span className="truncate">{profile.name}</span>
                            <span className="text-xs text-cyan-300 ml-1 hidden md:inline">Lv.{userStats.playerLevel}</span>
                        </div>

                        {/* Avatar Frame (cyan glow marks your side) */}
                        <div
                            className="w-full aspect-square max-w-[100px] md:max-w-[140px] rounded-xl border-4 flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-gray-900 to-black shadow-2xl ring-2 ring-cyan-400/60 shadow-[0_0_25px_rgba(34,211,238,0.45)]"
                            style={{ borderColor: '#4488ff' }}
                        >
                            {/* Player Image */}
                            <img
                                src={getAssetPath(`/monsters/${currentPartner.id}.png`)} // Assuming standard path
                                alt={currentPartner.name}
                                className="w-[80%] h-[80%] object-contain drop-shadow-lg"
                                onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iIzQ0ODhmZiIvPjwvc3ZnPg=='; }}
                            />

                            {/* Hit flash overlay */}
                            {isPlayerHit && (
                                <div className="absolute inset-0 bg-red-500/50 z-20 pointer-events-none" />
                            )}

                            {/* Damage Numbers on Player */}
                            <AnimatePresence>
                                {damageNumbers.filter(d => d.isPlayer).map(dn => (
                                    <motion.div
                                        key={dn.id}
                                        initial={{ opacity: 1, y: 0, scale: 0.5 }}
                                        animate={{ opacity: 0, y: 40, scale: 1.2 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                                    >
                                        <span className="text-3xl md:text-5xl font-black text-red-500 drop-shadow-lg stroke-white">
                                            -{dn.value}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* HP Bar */}
                        <div className="w-full max-w-[100px] md:max-w-[140px] mt-3">
                            <div className="flex justify-between text-[10px] md:text-xs text-gray-300 mb-1">
                                <span>HP</span>
                                <span>{myHp}/{maxPlayerHp}</span>
                            </div>
                            <div className="h-3 bg-gray-900 rounded-full border border-gray-600 overflow-hidden relative shadow-inner">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 relative z-10"
                                    initial={{ width: '100%' }}
                                    animate={{ width: `${(myHp / maxPlayerHp) * 100}%` }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                                {/* Glass shine */}
                                <div className="absolute top-0 left-0 right-0 h-[50%] bg-white/20 z-20 pointer-events-none" />
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Paper Texture Divider */}
            <div
                className="relative h-3 w-full z-10 flex-shrink-0"
                style={{
                    background: 'linear-gradient(180deg, transparent 0%, #d4c4a8 30%)',
                }}
            >
                <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full">
                    <path d="M0,10 Q10,5 20,8 T40,6 T60,9 T80,5 T100,8 L100,10 Z" fill="#d4c4a8" />
                </svg>
            </div>

            {/* Bottom Card / Kanji Area - Matches BattleScene Height via flex logic or fixed height */}
            <div className="w-full bg-[#d4c4a8] relative z-0 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center py-3">
                {/* Paper Texture Overlay */}
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%235b4636' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                    }}
                />

                {/* Return Button (Victory/Defeat) */}
                {(gameState === 'VICTORY' || gameState === 'DEFEAT') && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                        <button
                            onClick={handleLeave}
                            className="px-10 py-4 bg-white text-black font-black text-xl rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)] hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
                        >
                            <span>↩️</span> Return to Lobby
                        </button>
                    </div>
                )}

                {/* Canvas Container */}
                <div className="relative">
                    {/* Battle Canvas */}
                    {gameState === 'BATTLE' && (
                        <>
                            {/* Kanji Reading/Hint Display */}
                            {(() => {
                                const kanjiData = KANJI_DB.find(k => k.char === currentKanjiChar);
                                if (kanjiData) {
                                    return (
                                        <KanjiInfoDisplay
                                            kanji={kanjiData}
                                            className="mb-4 relative z-20"
                                            onClick={() => setIsModalOpen(true)}
                                        />
                                    );
                                }
                                return null;
                            })()}

                            <div className="relative bg-white rounded-xl shadow-inner border-4 border-[#8b7355] p-2">
                                {/* Size adjusted to match BattleScene somewhat (280px is standard there) */}
                                <KanjiWriterCanvas
                                    key={`${currentKanjiChar}-${currentKanjiIndex}`}
                                    char={currentKanjiChar}
                                    size={canvasSize}
                                    quizMode={true}
                                    onComplete={handleWriteComplete}
                                    onMistake={() => {
                                        playSfx('mistake');
                                        setCombo(0);

                                        // Apply mistake damage to SELF
                                        const debugParams = getDebugParams();
                                        const mistakeDamage = debugParams.onlineMistakeDamage ?? 5;

                                        showDamageNumber(mistakeDamage, true, false); // Show on self (true)
                                        setIsPlayerHit(true);
                                        setTimeout(() => setIsPlayerHit(false), 500);

                                        setMyHp((prev: number) => {
                                            const newHp = Math.max(0, prev - mistakeDamage);
                                            if (newHp === 0) {
                                                handleDefeat();
                                            }
                                            return newHp;
                                        });

                                        // Send MISTAKE event to opponent
                                        networkManager.sendEvent({
                                            type: BattleEventType.MISTAKE,
                                            payload: {
                                                damage: mistakeDamage
                                            },
                                            timestamp: Date.now()
                                        });
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {/* Waiting Message if no canvas */}
                    {gameState === 'WAITING' && (
                        <div style={{ width: canvasSize, height: canvasSize }} className="flex items-center justify-center bg-black/10 rounded-xl border-4 border-dashed border-[#8b7355]/30">
                            <span className="text-[#8b7355] font-bold text-lg animate-pulse">Battle Area</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Kanji List Modal */}
            <KanjiListModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                kanjiList={KANJI_DB}
            />
        </div>
    );
};

export default OnlineBattleScene;
