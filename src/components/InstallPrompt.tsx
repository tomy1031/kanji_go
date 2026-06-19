import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Chrome/Android fire this before showing their own mini-infobar; we defer it
// and surface our own button instead (the recommended install pattern).
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    prompt: () => Promise<void>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'kanjigo-install-dismissed';

const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true;

const isIos = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    // Exclude in-app browsers / Chrome iOS where Add-to-Home-Screen isn't available
    /safari/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent);

/**
 * A lightweight, dismissible install affordance:
 * - Android/desktop Chrome: a one-tap "Install" button driven by the deferred
 *   beforeinstallprompt event.
 * - iOS Safari: an instructional banner (no programmatic prompt exists there).
 * Renders nothing once the app is installed/launched standalone.
 */
const InstallPrompt = () => {
    const deferred = useRef<BeforeInstallPromptEvent | null>(null);
    const [canInstall, setCanInstall] = useState(false);
    // iOS never fires beforeinstallprompt, so decide the manual hint up front
    // (lazy init avoids calling setState inside the effect).
    const [showIosHint, setShowIosHint] = useState(
        () => !isStandalone() && localStorage.getItem(DISMISS_KEY) !== '1' && isIos()
    );

    useEffect(() => {
        if (isStandalone()) return;
        if (localStorage.getItem(DISMISS_KEY) === '1') return;

        const onBeforeInstall = (e: Event) => {
            e.preventDefault();
            deferred.current = e as BeforeInstallPromptEvent;
            setCanInstall(true);
        };
        const onInstalled = () => {
            deferred.current = null;
            setCanInstall(false);
            setShowIosHint(false);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstall);
        window.addEventListener('appinstalled', onInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstall);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const handleInstall = async () => {
        const prompt = deferred.current;
        if (!prompt) return;
        await prompt.prompt();
        await prompt.userChoice; // 'accepted' | 'dismissed'
        deferred.current = null;
        setCanInstall(false);
    };

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, '1');
        setCanInstall(false);
        setShowIosHint(false);
    };

    return (
        <AnimatePresence>
            {canInstall && (
                <motion.div
                    key="install-btn"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full bg-cyan-600/95 pl-4 pr-2 py-2 shadow-lg backdrop-blur-md border border-white/20"
                >
                    <button onClick={handleInstall} className="flex items-center gap-2 font-bold text-white text-sm">
                        <span>📲</span> アプリをインストール
                    </button>
                    <button
                        onClick={dismiss}
                        aria-label="閉じる"
                        className="w-6 h-6 rounded-full bg-black/30 text-white/80 hover:text-white text-xs"
                    >
                        ✕
                    </button>
                </motion.div>
            )}

            {showIosHint && !canInstall && (
                <motion.div
                    key="ios-hint"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-sm rounded-xl bg-gray-900/95 p-4 shadow-lg backdrop-blur-md border border-white/20"
                >
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">📲</span>
                        <div className="text-sm text-white/90 leading-relaxed">
                            ホーム画面に追加してアプリとして使えます：
                            共有ボタン <span className="font-bold">[ ⬆️ ]</span> →
                            「<span className="font-bold">ホーム画面に追加</span>」
                        </div>
                        <button
                            onClick={dismiss}
                            aria-label="閉じる"
                            className="ml-auto w-6 h-6 shrink-0 rounded-full bg-black/30 text-white/80 hover:text-white text-xs"
                        >
                            ✕
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default InstallPrompt;
