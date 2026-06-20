import React from 'react';
import type { KanjiData } from '../types';

interface KanjiInfoDisplayProps {
    kanji: KanjiData;
    className?: string;
    onClick?: () => void;
}

export const KanjiInfoDisplay: React.FC<KanjiInfoDisplayProps> = ({ kanji, className, onClick }) => {
    // Logic to replace __（...） with ruby
    const formattedSentence = React.useMemo(() => {
        if (!kanji.exampleSentence) return null;

        // Split by the pattern __（reading）
        // Capture group 1 contains the reading
        const parts = kanji.exampleSentence.split(/__（(.*?)）/g);

        return (
            <div className="text-xl md:text-3xl font-black text-white text-center mb-4 leading-relaxed" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                {parts.map((part, index) => {
                    // Even indices are normal text, Odd indices are readings
                    if (index % 2 === 0) {
                        return <span key={index}>{part}</span>;
                    } else {
                        return (
                            <ruby key={index} className="mx-1" >
                                ⬜︎
                                <rt style={{ marginTop: '2px', marginLeft: '-2px' }} className="text-yellow-400 text-sm md:text-lg font-bold">{part}</rt>
                            </ruby>
                        );
                    }
                })}
            </div>
        );
    }, [kanji]);

    return (
        <div
            className={`flex flex-col items-center cursor-pointer transition-transform active:scale-95 ${className || ''}`}
            onClick={onClick}
        >
            {formattedSentence}

            {/* Readings & Meaning */}
            <div className="flex flex-wrap justify-center gap-3 md:gap-6 text-sm md:text-base bg-black/40 px-6 py-3 rounded-2xl backdrop-blur-sm border border-white/10 shadow-lg hover:bg-black/50 transition-colors">
                {kanji.readings.on.length > 0 && kanji.readings.on[0] !== '' && (
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📣</span>
                        <span className="text-cyan-300 font-bold tracking-wide">{kanji.readings.on.join(', ')}</span>
                    </div>
                )}
                {kanji.readings.kun.length > 0 && kanji.readings.kun[0] !== '' && (
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🇯🇵</span>
                        <span className="text-green-300 font-bold tracking-wide">{kanji.readings.kun.join(', ')}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-lg">🇺🇸</span>
                    <span className="text-yellow-300 font-bold tracking-wide">{kanji.meanings[0]}</span>
                </div>
            </div>
        </div>
    );
};
