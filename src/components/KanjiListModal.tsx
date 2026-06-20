import React from 'react';
import type { KanjiData } from '../types';

interface KanjiListModalProps {
    isOpen: boolean;
    onClose: () => void;
    kanjiList: KanjiData[];
}

export const KanjiListModal: React.FC<KanjiListModalProps> = ({ isOpen, onClose, kanjiList }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col border border-white/10 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/50 rounded-t-3xl">
                    <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
                        <span>📚</span>
                        <span>漢字一覧</span>
                        <span className="text-base font-normal text-slate-400 ml-2">({kanjiList.length}文字)</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {kanjiList.map((kanji, idx) => (
                            <div
                                key={`${kanji.id}-${idx}`}
                                className="bg-slate-800/50 rounded-xl p-4 flex gap-4 border border-white/5 hover:bg-slate-800 transition-colors"
                            >
                                {/* Kanji Char */}
                                <div className="flex items-center justify-center w-16 h-16 bg-slate-900 rounded-lg border border-slate-700 shrink-0">
                                    <span className="text-4xl font-black text-white">{kanji.char}</span>
                                </div>

                                {/* Info */}
                                <div className="flex flex-col justify-center min-w-0 flex-1 gap-1">
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <span className="text-xs">📣</span>
                                        <span className="text-cyan-300 font-bold text-sm truncate">{kanji.readings.on.join(', ') || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <span className="text-xs">🇯🇵</span>
                                        <span className="text-green-300 font-bold text-sm truncate">{kanji.readings.kun.join(', ') || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <span className="text-xs">🇺🇸</span>
                                        <span className="text-yellow-300 font-bold text-sm truncate">{kanji.meanings[0]}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
