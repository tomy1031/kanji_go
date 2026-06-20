
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import HanziWriter from 'hanzi-writer';
import { getDebugParams } from './DebugMode';
import { getAssetPath } from '../utils/assetUtils';

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
    const charDataCacheRef = useRef<Record<string, unknown> | null>(null);

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

    // Custom char data loader - prioritize local data, fallback to CDN
    // Local data from: github.com/mnako/hanzi-writer-data-ja (3762 kanji)


    // Custom char data loader - prioritize local data, fallback to CDN
    // Local data from: github.com/mnako/hanzi-writer-data-ja (3762 kanji)
    const charDataLoader = async (character: string) => {
        // Return cached data if available
        if (charDataCacheRef.current) {
            return charDataCacheRef.current;
        }

        const encoded = encodeURIComponent(character);

        // Try local data first (instant, no network latency)
        try {
            const localUrl = getAssetPath(`/kanji-data/${encoded}.json`);
            const response = await fetch(localUrl);
            if (response.ok) {
                const data = await response.json();
                charDataCacheRef.current = data;
                return data;
            }
        } catch {
            // Local not found, try CDN
        }

        // CDN fallback sources for characters not in local data
        const cdnSources = [
            `https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0.1.0/${encoded}.json`, // Detailed version
            `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${encoded}.json`, // Chinese fallback, sometimes valid for Kanji
            `https://raw.githubusercontent.com/mnako/hanzi-writer-data-ja/master/data/${encoded}.json`,
        ];

        for (const url of cdnSources) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    charDataCacheRef.current = data;
                    return data;
                }
            } catch {
                // Silent fail, try next source
            }
        }

        console.warn(`No stroke data available for: ${character}`);
        return null;
    };

    // Main effect for quiz HanziWriter
    useEffect(() => {
        const target = targetRef.current;
        if (!target) return;

        target.innerHTML = '';
        charDataCacheRef.current = null;

        const initHanziWriter = async () => {
            try {
                const testData = await charDataLoader(char);
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
            const data = await charDataLoader(char);
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
