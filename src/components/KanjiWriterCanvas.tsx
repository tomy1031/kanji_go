
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import HanziWriter from 'hanzi-writer';
import { getDebugParams } from './DebugMode';
import { loadCharData } from '../lib/kanjiStrokeLoader';

interface KanjiWriterCanvasProps {
    char: string;
    size?: number;
    onCorrectStroke?: (strokeData: Record<string, unknown>) => void;
    onMistake?: (strokeData: Record<string, unknown>) => void;
    onComplete?: (summary: { character: string; totalMistakes: number }) => void;
    quizMode?: boolean;
    showSample?: boolean; // Display the kanji in light gray as persistent background
}

export interface KanjiWriterHandle {
    animateStroke: () => void;
    resetQuiz: () => void;
}

const KanjiWriterCanvas = forwardRef<KanjiWriterHandle, KanjiWriterCanvasProps>((
    {
        char,
        size = 300,
        onCorrectStroke,
        onMistake,
        onComplete,
        quizMode = false,
        showSample = false,
    },
    ref
) => {
    const writerRef = useRef<HanziWriter | null>(null);
    const sampleWriterRef = useRef<HanziWriter | null>(null);
    const targetRef = useRef<HTMLDivElement>(null);
    const sampleRef = useRef<HTMLDivElement>(null);
    const isQuizActiveRef = useRef(false);
    const showSampleRef = useRef(showSample);

    // Refs for callbacks to avoid re-initializing HanziWriter when callbacks change
    const callbacksRef = useRef({ onCorrectStroke, onMistake, onComplete });
    useEffect(() => {
        callbacksRef.current = { onCorrectStroke, onMistake, onComplete };
    }, [onCorrectStroke, onMistake, onComplete]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        animateStroke: () => {
            if (writerRef.current) {
                // Cancel current quiz before animating
                if (isQuizActiveRef.current) {
                    writerRef.current.cancelQuiz();
                    isQuizActiveRef.current = false;
                }

                writerRef.current.animateCharacter({
                    onComplete: () => {
                        // Animation complete, fade out after a delay
                        setTimeout(() => {
                            if (writerRef.current) {
                                writerRef.current.hideCharacter({
                                    onComplete: () => {
                                        // Restart quiz after animation
                                        setTimeout(() => {
                                            startQuiz();
                                        }, 300);
                                    }
                                });
                            }
                        }, 1000);
                    }
                });
            }
        },
        resetQuiz: () => {
            if (writerRef.current && isQuizActiveRef.current) {
                writerRef.current.cancelQuiz();
                isQuizActiveRef.current = false;
            }
            setTimeout(() => {
                startQuiz();
            }, 100);
        }
    }));

    const startQuiz = () => {
        if (!writerRef.current || !quizMode) return;

        isQuizActiveRef.current = true;
        writerRef.current.quiz({
            // After 2 misses on a stroke, HanziWriter flashes the correct
            // stroke — a struggling child always gets a way forward.
            showHintAfterMisses: 2,
            onCorrectStroke: (data) => {
                if (callbacksRef.current.onCorrectStroke) callbacksRef.current.onCorrectStroke(data as Record<string, unknown>);
            },
            onMistake: (data) => {
                if (callbacksRef.current.onMistake) callbacksRef.current.onMistake(data as Record<string, unknown>);
            },
            onComplete: (summary) => {
                isQuizActiveRef.current = false;

                // Notify parent
                if (callbacksRef.current.onComplete) {
                    callbacksRef.current.onComplete(summary);
                }

                // Small delay then restart quiz
                // The sample layer stays visible, quiz layer is independent
                setTimeout(() => {
                    startQuiz();
                }, 500);
            },
        });
    };

    // Stroke data is loaded via the shared, session-wide cache + preloader
    // (src/lib/kanjiStrokeLoader.ts): local bundle first, CDN fallback, and
    // results are reused across characters/instances instead of re-fetched.

    // Main effect for quiz HanziWriter
    useEffect(() => {
        const target = targetRef.current;
        if (!target) return;

        target.innerHTML = '';

        const initHanziWriter = async () => {
            try {
                // Immediate loading indicator — never a silent blank square
                target.innerHTML = `
                    <div style="width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
                        <div style="width:28px;height:28px;border:3px solid rgba(120,120,120,0.25);border-top-color:#4A9EFF;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                        <div style="font-size:11px;color:#999;">よみこみ中…</div>
                    </div>
                    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
                `;
                const testData = await loadCharData(char);
                target.innerHTML = '';
                if (!testData) {
                    showFallbackUI(target);
                    return;
                }

                // Get debug parameters for customization
                const debugParams = getDebugParams();

                writerRef.current = HanziWriter.create(target, char, {
                    width: size,
                    height: size,
                    padding: 20,
                    showOutline: !quizMode && debugParams.showOutline,
                    showCharacter: false, // Never show character on quiz layer
                    strokeAnimationSpeed: debugParams.strokeAnimationSpeed,
                    delayBetweenStrokes: debugParams.delayBetweenStrokes,
                    radicalColor: '#168F16',
                    drawingWidth: debugParams.drawingWidth,
                    // Slightly forgiving stroke matching for small fingers on
                    // small screens (1.0 = hanzi-writer default strictness)
                    leniency: debugParams.leniency || 1.15,
                    strokeColor: '#555',
                    outlineColor: '#DDD',
                    highlightColor: '#4A9EFF',
                    // Note: leniency affects stroke matching - higher = more forgiving
                    // HanziWriter uses acceptBackwardsStrokes/strokeHighlightSpeed for this
                    strokeHighlightSpeed: debugParams.strokeHighlightSpeed,
                    charDataLoader: () => Promise.resolve(testData),
                });

                if (quizMode) {
                    startQuiz();
                }
            } catch (error) {
                console.error('Failed to initialize HanziWriter:', error);
                showFallbackUI(target);
            }
        };

        const showFallbackUI = (container: HTMLElement) => {
            const fallbackDiv = document.createElement('div');
            fallbackDiv.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%);
                border-radius: 12px;
            `;
            fallbackDiv.innerHTML = `
                <div style="font-size: ${size / 2.5}px; font-weight: bold; color: #92400e;">${char}</div>
                <div style="font-size: 12px; color: #78350f; margin-top: 8px;">タップで次へ</div>
                <div style="font-size: 10px; color: #a16207; margin-top: 4px;">⚠️ 書き順データなし</div>
            `;

            fallbackDiv.onclick = () => {
                fallbackDiv.style.background = 'linear-gradient(135deg, #a7f3d0 0%, #34d399 100%)';
                fallbackDiv.innerHTML = `
                    <div style="font-size: ${size / 2.5}px; font-weight: bold; color: #065f46;">✓</div>
                    <div style="font-size: 14px; color: #047857; margin-top: 8px;">完了!</div>
                `;
                if (callbacksRef.current.onComplete) {
                    setTimeout(() => {
                        callbacksRef.current.onComplete?.({ character: char, totalMistakes: 0 });
                    }, 500);
                }
            };

            container.appendChild(fallbackDiv);
        };

        initHanziWriter();

        return () => {
            if (writerRef.current) {
                writerRef.current.cancelQuiz();
                isQuizActiveRef.current = false;
            }
            if (target) {
                target.innerHTML = '';
            }
        };
    }, [char, size, quizMode]);

    // Separate effect for sample layer
    useEffect(() => {
        showSampleRef.current = showSample;
        const sampleTarget = sampleRef.current;
        if (!sampleTarget) return;

        sampleTarget.innerHTML = '';

        if (!showSample) {
            sampleWriterRef.current = null;
            return;
        }

        const initSampleWriter = async () => {
            const data = await loadCharData(char);
            if (!data) return;

            sampleWriterRef.current = HanziWriter.create(sampleTarget, char, {
                width: size,
                height: size,
                padding: 20,
                showOutline: false,
                showCharacter: true, // Always show the sample character
                strokeAnimationSpeed: 1,
                strokeColor: 'rgba(150, 150, 150, 0.15)', // Very light gray for sample
                outlineColor: 'rgba(255,255,255,0)', // Must use rgba, not 'transparent'
                charDataLoader: () => Promise.resolve(data),
            });
        };

        initSampleWriter();

        return () => {
            if (sampleTarget) {
                sampleTarget.innerHTML = '';
            }
        };
    }, [char, size, showSample]);

    return (
        <div className="relative flex justify-center items-center bg-white rounded-xl shadow-lg border-4 border-gray-200">
            {/* Sample layer - behind, shows light character when showSample is on */}
            <div
                ref={sampleRef}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 1 }}
            />
            {/* Quiz layer - on top, handles drawing */}
            <div
                ref={targetRef}
                className="cursor-crosshair relative"
                style={{ zIndex: 2 }}
            />
        </div>
    );
});

KanjiWriterCanvas.displayName = 'KanjiWriterCanvas';

export default KanjiWriterCanvas;
