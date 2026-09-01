import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import KanjiWriterCanvas from '../../components/KanjiWriterCanvas';
import { useUserStore } from '../../store/userStore';
import { getAllKanji } from '../../lib/kanjiUtils';
import { preloadCharData } from '../../lib/kanjiStrokeLoader';
import { useCanvasSize } from '../../hooks/useCanvasSize';
import { useSound } from '../../hooks/useSound';
import { SCORE_ATTACK_SECONDS } from '../../lib/constants';

interface ScoreAttackProps {
    onBack: () => void;
}

// 60-second writing rush: how many kanji can you complete? Beating your own
// personal best is a self-contained, safe dopamine loop (no comparison with
// others needed).
const ScoreAttack: React.FC<ScoreAttackProps> = ({ onBack }) => {
    const { profile, scoreAttackBest, incrementPracticeCount } = useUserStore();
    const { playSfx, playStroke } = useSound();
    const canvasSize = useCanvasSize(280, 0.42);

    const [phase, setPhase] = useState<'ready' | 'countdown' | 'playing' | 'result'>('ready');
    const [countdown, setCountdown] = useState(3);
    const [timeLeft, setTimeLeft] = useState(SCORE_ATTACK_SECONDS);
    const [score, setScore] = useState(0);
    const [index, setIndex] = useState(0);
    const [isNewBest, setIsNewBest] = useState(false);
    const [runId, setRunId] = useState(0);
    const scoreRef = useRef(0);

    const best = (scoreAttackBest || {})[profile.currentVersion] || 0;

    // Shuffled question queue from the current version's kanji (reshuffled per run)
    const queue = useMemo(() => {
        if (runId < 0) return []; // runId forces a reshuffle at the start of every run
        const pool = getAllKanji().filter(k => k.level === profile.currentVersion);
        return [...pool].sort(() => Math.random() - 0.5);
    }, [profile.currentVersion, runId]);

    const currentKanji = queue.length > 0 ? queue[index % queue.length] : null;

    // Preload a window of upcoming stroke data
    useEffect(() => {
        if (queue.length === 0) return;
        const upcoming = Array.from({ length: 8 }, (_, i) => queue[(index + i) % queue.length].char);
        preloadCharData(upcoming);
    }, [index, queue]);

    // Countdown
    useEffect(() => {
        if (phase !== 'playing') return;
        const iv = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(iv);
                    // Finish: record PB + daily streak
                    const finalScore = scoreRef.current;
                    setIsNewBest(useUserStore.getState().submitScoreAttack(profile.currentVersion, finalScore));
                    useUserStore.getState().recordDailyActivity();
                    setPhase('result');
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(iv);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    const start = () => {
        setScore(0);
        scoreRef.current = 0;
        setIndex(0);
        setRunId(r => r + 1);
        setTimeLeft(SCORE_ATTACK_SECONDS);
        setIsNewBest(false);
        setCountdown(3);
        setPhase('countdown');
        playSfx('select');
    };

    // 3-2-1 countdown before the clock starts
    useEffect(() => {
        if (phase !== 'countdown') return;
        if (countdown <= 0) {
            setPhase('playing');
            return;
        }
        const t = setTimeout(() => {
            playSfx('select');
            setCountdown(c => c - 1);
        }, 800);
        return () => clearTimeout(t);
    }, [phase, countdown, playSfx]);

    // Skip an unknown kanji (small time penalty) — one hard character must
    // not eat the whole 60 seconds
    const handlePass = () => {
        if (phase !== 'playing') return;
        playSfx('mistake');
        setTimeLeft(t => Math.max(1, t - 3));
        setIndex(i => i + 1);
    };

    const handleComplete = () => {
        if (phase !== 'playing' || !currentKanji) return;
        const next = scoreRef.current + 1;
        scoreRef.current = next;
        setScore(next);
        playStroke(next); // rising pitch as the score climbs
        incrementPracticeCount(currentKanji.id);
        setIndex(i => i + 1);
    };

    return (
        <div className="w-full h-dvh bg-gray-900 text-white flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 flex justify-between items-center bg-gray-800 shadow-md z-10 relative">
                <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">← もどる</button>
                <h2 className="text-base md:text-xl font-bold tracking-widest">⏱️ スコアアタック</h2>
                <div className="text-xs text-gray-400 font-mono">ベスト: {best}</div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative z-0 p-3 min-h-0">
                {phase === 'ready' && (
                    <div className="text-center max-w-sm">
                        <div className="text-5xl mb-4">⏱️</div>
                        <h3 className="text-2xl font-black mb-2">{SCORE_ATTACK_SECONDS}秒で 何文字 書ける？</h3>
                        <p className="text-gray-400 text-sm mb-2">正しく書き切るごとに 1点。じぶんのベストに挑戦！</p>
                        {best > 0 && (
                            <p className="text-yellow-400 font-bold mb-4">🏆 じこベスト: {best}文字</p>
                        )}
                        <button
                            onClick={start}
                            className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white font-black text-xl rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.4)] active:scale-95 transition-all"
                        >
                            スタート！
                        </button>
                    </div>
                )}

                {phase === 'countdown' && (
                    <motion.div
                        key={countdown}
                        initial={{ scale: 2.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-8xl font-black text-cyan-300 drop-shadow-[0_0_30px_rgba(34,211,238,0.7)]"
                    >
                        {countdown > 0 ? countdown : 'GO!'}
                    </motion.div>
                )}

                {phase === 'playing' && currentKanji && (
                    <>
                        {/* Timer + Score */}
                        <div className="flex items-center gap-6 mb-2">
                            <div className={`text-3xl font-black font-mono ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                {timeLeft}
                            </div>
                            <motion.div key={score} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-3xl font-black text-cyan-300">
                                {score}<span className="text-sm text-gray-500 ml-1">文字</span>
                            </motion.div>
                        </div>
                        <div className="mb-2 text-center">
                            <span className="text-2xl font-black mr-3">{currentKanji.char}</span>
                            <span className="text-cyan-300 text-sm font-bold">{currentKanji.meanings[0]}</span>
                        </div>
                        <KanjiWriterCanvas
                            key={`${currentKanji.id}-${index}`}
                            char={currentKanji.char}
                            size={canvasSize}
                            quizMode={true}
                            onComplete={handleComplete}
                            onMistake={() => playSfx('mistake')}
                        />
                        <button
                            onClick={handlePass}
                            className="mt-2 px-5 py-1.5 rounded-full text-sm font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 active:scale-95 transition-transform"
                        >
                            パス（-3びょう）→
                        </button>
                    </>
                )}

                <AnimatePresence>
                    {phase === 'result' && (
                        <motion.div
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center"
                        >
                            <div className="text-5xl mb-3">{isNewBest ? '🎉' : '⏱️'}</div>
                            {isNewBest && (
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1] }}
                                    transition={{ duration: 0.8, repeat: Infinity }}
                                    className="text-yellow-300 font-black text-2xl mb-2 drop-shadow-[0_0_16px_rgba(250,204,21,0.8)]"
                                >
                                    ✨ じこベスト更新！！ ✨
                                </motion.div>
                            )}
                            <div className="text-6xl font-black text-white mb-1">{score}<span className="text-2xl text-gray-400">文字</span></div>
                            <div className="text-sm text-gray-400 mb-6">
                                {isNewBest ? 'これが あたらしい きろく！' : `じこベスト: ${best}`}
                            </div>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={start}
                                    className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl active:scale-95 transition-all"
                                >
                                    もういちど！
                                </button>
                                <button
                                    onClick={onBack}
                                    className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl"
                                >
                                    もどる
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ScoreAttack;
