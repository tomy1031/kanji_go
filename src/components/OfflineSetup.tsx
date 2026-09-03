import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { allAssets, countCached, warmAssets } from '../lib/offlineAssets';

type InstallEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

const isStandalone = (): boolean =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

const isIOS = (): boolean =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Offline / install panel.
 *
 * Two things the game previously could not do:
 *  - actually finish downloading everything for offline play (there was no
 *    control for it, and the boot preloader's work was largely wasted)
 *  - install to the home screen on iOS, where `beforeinstallprompt` never
 *    fires so the only path was an alert() with instructions.
 *
 * Installing matters beyond convenience: iOS Safari erases a site's storage
 * (saves AND caches) after ~7 days of not visiting, but a home-screen app is
 * exempt — so "install" is what actually protects progress and offline data.
 */
const OfflineSetup: React.FC = () => {
    const [total, setTotal] = useState(0);
    const [cached, setCached] = useState(0);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
    const [showIosSheet, setShowIosSheet] = useState(false);
    const stopRef = useRef(false);

    const refresh = useCallback(async () => {
        const urls = allAssets();
        const done = await countCached(urls);
        setTotal(urls.length);
        setCached(done);
    }, []);

    useEffect(() => {
        void refresh();
        return () => {
            stopRef.current = true;
        };
    }, [refresh]);

    useEffect(() => {
        const onPrompt = (e: Event) => {
            e.preventDefault();
            setInstallEvent(e as InstallEvent);
        };
        window.addEventListener('beforeinstallprompt', onPrompt);
        return () => window.removeEventListener('beforeinstallprompt', onPrompt);
    }, []);

    const download = async () => {
        setBusy(true);
        setProgress(0);
        setFailedCount(0);
        stopRef.current = false;

        // Ask the browser to keep this data (ignored on iOS, honoured elsewhere)
        try {
            await navigator.storage?.persist?.();
        } catch {
            // best-effort only
        }

        const urls = allAssets();
        // Two passes: the second retries only what the first could not store,
        // which is what makes a flaky mobile connection eventually finish.
        let result = await warmAssets(
            urls,
            (done, t) => setProgress(Math.floor((done / t) * 100)),
            () => stopRef.current
        );
        if (result.failed.length > 0 && !stopRef.current) {
            result = await warmAssets(result.failed, undefined, () => stopRef.current);
        }
        setFailedCount(result.failed.length);
        await refresh();
        setBusy(false);
    };

    const install = async () => {
        if (installEvent) {
            installEvent.prompt();
            await installEvent.userChoice;
            setInstallEvent(null);
        } else {
            setShowIosSheet(true);
        }
    };

    const ready = total > 0 && cached >= total;
    const pct = total > 0 ? Math.floor((cached / total) * 100) : 0;
    const installed = isStandalone();

    return (
        <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                    📥 オフラインで あそぶ じゅんび
                </h3>
                {ready && <span className="text-[11px] font-bold text-green-400">✓ かんりょう</span>}
            </div>

            {/* Download progress */}
            <div>
                <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full ${ready ? 'bg-green-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}
                        animate={{ width: `${busy ? progress : pct}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                    <span>
                        {busy
                            ? 'ダウンロード中…'
                            : ready
                                ? 'ぜんぶ ダウンロードずみ！'
                                : `のこり ${total - cached}こ`}
                    </span>
                    <span className="font-mono">{cached}/{total}</span>
                </div>
                {!busy && failedCount > 0 && (
                    <p className="text-[11px] text-yellow-300 mt-1">
                        {failedCount}こ ダウンロードできませんでした。
                        でんぱの いいところで もういちど おしてね。
                    </p>
                )}
            </div>

            {!ready && (
                <button
                    onClick={download}
                    disabled={busy}
                    className={`w-full min-h-[44px] rounded-xl font-black text-white transition-all ${busy
                        ? 'bg-gray-600'
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 active:scale-[0.98]'
                        }`}
                >
                    {busy
                        ? `ダウンロード中… ${progress}%`
                        : cached > 0
                            ? '⬇️ つづきを ダウンロード'
                            : '⬇️ ぜんぶ ダウンロード（Wi-Fi すいしょう）'}
                </button>
            )}

            {/* Install to home screen */}
            {installed ? (
                <div className="text-[11px] text-green-300 bg-green-900/20 border border-green-700/40 rounded-lg px-3 py-2">
                    ✓ ホームがめんの アプリとして あそんでいます（データが きえにくい モード）
                </div>
            ) : (
                <>
                    <button
                        onClick={install}
                        className="w-full min-h-[44px] rounded-xl font-black text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                        📱 ホームがめんに ついかする
                    </button>
                    <p className="text-[11px] text-yellow-300/90 leading-relaxed">
                        ⚠️ ブラウザのままだと、しばらく あそばないと きろくが きえることがあります。
                        ホームがめんに ついかすると あんぜんです。
                    </p>
                </>
            )}

            {/* iOS install instructions (beforeinstallprompt never fires there) */}
            <AnimatePresence>
                {showIosSheet && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-black/80 flex items-end md:items-center justify-center p-4"
                        onClick={() => setShowIosSheet(false)}
                    >
                        <motion.div
                            initial={{ y: 40, scale: 0.98 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gray-900 border border-gray-600 rounded-2xl p-5 max-w-sm w-full"
                        >
                            <h4 className="text-lg font-black text-white mb-3">ホームがめんに ついかする方法</h4>
                            {isIOS() ? (
                                <ol className="text-sm text-gray-200 space-y-3">
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-black flex items-center justify-center">1</span>
                                        <span>がめんの下（または上）の <span className="font-black text-cyan-300">きょうゆうボタン ⬆️</span> を おす</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-black flex items-center justify-center">2</span>
                                        <span>メニューを 下に スクロールして <span className="font-black text-cyan-300">「ホーム画面に追加」</span> を えらぶ</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-black flex items-center justify-center">3</span>
                                        <span>右上の <span className="font-black text-cyan-300">「追加」</span> を おして かんりょう！</span>
                                    </li>
                                </ol>
                            ) : (
                                <ol className="text-sm text-gray-200 space-y-3">
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-black flex items-center justify-center">1</span>
                                        <span>ブラウザの メニュー（⋮）を ひらく</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-black flex items-center justify-center">2</span>
                                        <span><span className="font-black text-cyan-300">「アプリをインストール」</span> または <span className="font-black text-cyan-300">「ホーム画面に追加」</span> を えらぶ</span>
                                    </li>
                                </ol>
                            )}
                            <button
                                onClick={() => setShowIosSheet(false)}
                                className="w-full mt-5 min-h-[44px] rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold"
                            >
                                とじる
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default OfflineSetup;
