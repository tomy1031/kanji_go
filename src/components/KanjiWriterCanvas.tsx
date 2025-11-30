
import React, { useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';

interface KanjiWriterCanvasProps {
    char: string;
    size?: number;
    onCorrectStroke?: (strokeData: Record<string, unknown>) => void;
    onMistake?: (strokeData: Record<string, unknown>) => void;
    onComplete?: (summary: { character: string; totalMistakes: number }) => void;
    quizMode?: boolean;
}

const KanjiWriterCanvas: React.FC<KanjiWriterCanvasProps> = ({
    char,
    size = 300,
    onCorrectStroke,
    onMistake,
    onComplete,
    quizMode = false,
}) => {
    const writerRef = useRef<HanziWriter | null>(null);
    const targetRef = useRef<HTMLDivElement>(null);

    // Refs for callbacks to avoid re-initializing HanziWriter when callbacks change
    const callbacksRef = useRef({ onCorrectStroke, onMistake, onComplete });
    useEffect(() => {
        callbacksRef.current = { onCorrectStroke, onMistake, onComplete };
    }, [onCorrectStroke, onMistake, onComplete]);

    useEffect(() => {
        const target = targetRef.current;
        if (!target) return;

        // Initialize HanziWriter
        writerRef.current = HanziWriter.create(target, char, {
            width: size,
            height: size,
            padding: 20,
            showOutline: !quizMode, // If quizMode is true, showOutline is false (blank space)
            showCharacter: false,   // Never show the full character initially
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 1000,
            radicalColor: '#168F16',
            drawingWidth: 20, // Make strokes thicker
        });

        // Start quiz immediately if in quiz mode
        if (quizMode) {
            writerRef.current.quiz({
                onCorrectStroke: (data) => {
                    if (callbacksRef.current.onCorrectStroke) callbacksRef.current.onCorrectStroke(data as Record<string, unknown>);
                },
                onMistake: (data) => {
                    if (callbacksRef.current.onMistake) callbacksRef.current.onMistake(data as Record<string, unknown>);
                },
                onComplete: (summary) => {
                    if (callbacksRef.current.onComplete) callbacksRef.current.onComplete(summary);
                },
            });
        } else {
            // If not quiz mode, maybe animate it or just show outline
            writerRef.current.showCharacter();
        }

        return () => {
            if (target) {
                target.innerHTML = '';
            }
        };
    }, [char, size, quizMode]); // Re-run if char or mode changes

    return (
        <div className="flex justify-center items-center bg-white rounded-xl shadow-lg border-4 border-gray-200">
            <div ref={targetRef} className="cursor-crosshair" />
        </div>
    );
};

export default KanjiWriterCanvas;
