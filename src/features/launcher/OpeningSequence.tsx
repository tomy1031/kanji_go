import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface OpeningSequenceProps {
    onComplete: () => void;
}

const OpeningSequence: React.FC<OpeningSequenceProps> = ({ onComplete }) => {
    const [step, setStep] = useState<'matrix' | 'logo' | 'fade'>('matrix');

    useEffect(() => {
        // Step 1: Matrix/Code effect (2s)
        const timer1 = setTimeout(() => {
            setStep('logo');
        }, 2000);

        // Step 2: Logo hold (2s)
        const timer2 = setTimeout(() => {
            setStep('fade');
        }, 4000);

        // Step 3: Complete
        const timer3 = setTimeout(() => {
            onComplete();
        }, 4500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [onComplete]);

    const [matrixChars] = useState(() => {
        return Array(1000).fill(0).map((_, i) => ({
            id: i,
            opacity: Math.random(),
            char: Math.random() > 0.5 ? '1' : '0',
            kanji: Math.random() > 0.8 ? '漢' : ''
        }));
    });

    return (
        <motion.div
            className="fixed inset-0 z-50 bg-[#0a192f] flex items-center justify-center overflow-hidden font-mono cursor-pointer"
            animate={{ opacity: step === 'fade' ? 0 : 1 }}
            transition={{ duration: 0.5 }}
            onClick={onComplete}
        >
            {/* Skip hint */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 text-[11px] text-gray-500 animate-pulse pointer-events-none">
                タップで スキップ
            </div>
            {/* Matrix Background Effect (Simplified) */}
            <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="animate-pulse text-green-500 text-xs leading-3 break-all">
                    {matrixChars.map((item) => (
                        <span key={item.id} style={{ opacity: item.opacity }}>
                            {item.char} {item.kanji}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex flex-col items-center z-10 relative">
                {step === 'matrix' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-cyan-400 text-xl mb-4"
                    >
                        &gt; INITIALIZING PATHWAY...
                    </motion.div>
                )}

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center"
                >
                    {/* Logo Icon: Circuit Torii Gate */}
                    <div className="relative w-32 h-32 mb-6">
                        {/* Torii Top */}
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="absolute top-0 left-0 h-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                        />
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '80%' }}
                            transition={{ delay: 0.7, duration: 0.5 }}
                            className="absolute top-8 left-[10%] h-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
                        />
                        {/* Pillars */}
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: '100%' }}
                            transition={{ delay: 0.9, duration: 0.5 }}
                            className="absolute top-0 left-[20%] w-4 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-sm"
                        />
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: '100%' }}
                            transition={{ delay: 0.9, duration: 0.5 }}
                            className="absolute top-0 right-[20%] w-4 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-sm"
                        />

                        {/* Circuit Dots */}
                        <motion.div
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute top-0 left-[20%] w-4 h-4 bg-white rounded-full blur-sm"
                        />
                        <motion.div
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                            className="absolute bottom-0 right-[20%] w-4 h-4 bg-white rounded-full blur-sm"
                        />
                    </div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.5 }}
                        className="text-white text-3xl md:text-5xl font-bold tracking-wider text-center"
                    >
                        <span className="text-cyan-400">JAPANESE</span> <span className="text-white">IT</span> PATHWAY
                    </motion.h1>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2 }}
                        className="mt-4 text-gray-400 text-sm tracking-[0.5em] uppercase"
                    >
                        Bridge to your Future
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default OpeningSequence;
