import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { ElementType } from '../../types';

interface StarterSelectionProps {
    onSelect: () => void;
}

const starters = [
    {
        id: 'starter_fire',
        name: 'Hinoko',
        element: ElementType.FIRE,
        description: 'A spirited flame that burns with potential.',
        color: 'from-red-500 to-orange-600',
        icon: '🔥'
    },
    {
        id: 'starter_water',
        name: 'Mizuku',
        element: ElementType.WATER,
        description: 'A calm droplet that flows like water.',
        color: 'from-blue-500 to-cyan-600',
        icon: '💧'
    },
    {
        id: 'starter_nature',
        name: 'Kusa',
        element: ElementType.NATURE,
        description: 'A gentle sprout connected to the earth.',
        color: 'from-green-500 to-emerald-600',
        icon: '🌱'
    }
];

const StarterSelection: React.FC<StarterSelectionProps> = ({ onSelect }) => {
    const unlockSkin = useUserStore(state => state.unlockSkin);
    const setPartner = useUserStore(state => state.setPartner);
    const [focusedId, setFocusedId] = useState<string | null>(null);

    const handleSelect = (monsterId: string) => {
        // Unlock all starters
        starters.forEach(s => unlockSkin(s.id));
        // Set selected partner
        setPartner(monsterId);
        onSelect();
    };

    return (
        <div className="w-full h-dvh bg-gray-900 text-white flex flex-col items-center justify-center relative overflow-y-auto py-8">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse" />

            <motion.h1
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-bold mb-12 z-10 tracking-widest text-cyan-300"
            >
                CHOOSE YOUR PARTNER
            </motion.h1>

            <div className="flex flex-col md:flex-row gap-8 z-10">
                {starters.map((starter) => (
                    <motion.div
                        key={starter.id}
                        whileHover={{ scale: 1.05, y: -10 }}
                        className={`
                            w-64 h-96 rounded-2xl cursor-pointer relative overflow-hidden border-4 transition-all duration-300
                            ${focusedId === starter.id ? 'border-white shadow-[0_0_30px_rgba(255,255,255,0.3)]' : 'border-gray-700 opacity-80'}
                            bg-gradient-to-b ${starter.color}
                        `}
                        onMouseEnter={() => setFocusedId(starter.id)}
                        onMouseLeave={() => setFocusedId(null)}
                        onClick={() => handleSelect(starter.id)}
                    >
                        <div className="absolute inset-0 bg-black/20" />

                        <div className="relative z-10 h-full flex flex-col items-center p-6 text-center">
                            <div className="text-8xl mb-6 filter drop-shadow-lg">{starter.icon}</div>
                            <h2 className="text-3xl font-bold mb-2">{starter.name}</h2>
                            <div className="px-3 py-1 rounded-full bg-black/30 text-xs font-mono mb-4">
                                {starter.element} TYPE
                            </div>
                            <p className="text-sm font-medium leading-relaxed opacity-90">
                                {starter.description}
                            </p>

                            <div className="mt-auto w-full">
                                <button className="w-full py-2 bg-white/20 hover:bg-white/40 rounded-lg font-bold transition-colors">
                                    SELECT
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default StarterSelection;
