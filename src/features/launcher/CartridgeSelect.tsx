import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameVersion } from '../../types';
import { useUserStore } from '../../store/userStore';

interface CartridgeSelectProps {
    onSelect: (version: GameVersion) => void;
}

const cartridges = [
    {
        id: GameVersion.RED,
        title: 'KanjiGo! RED(N5)',
        color: 'from-red-500 to-red-700',
        icon: '🔥',
        bg: 'bg-red-600',
        description: 'N5 Level - Fire & Passion',
        image: '/assets/bg_n5.png' // Placeholder path
    },
    {
        id: GameVersion.GREEN,
        title: 'KanjiGo! GREEN(N4)',
        color: 'from-green-500 to-green-700',
        icon: '🌿',
        bg: 'bg-green-600',
        description: 'N4 Level - Nature & Growth',
        image: '/assets/bg_n4.png' // Placeholder path
    },
    {
        id: GameVersion.BLUE,
        title: 'KanjiGo! BLUE(N3)',
        color: 'from-blue-500 to-blue-700',
        icon: '💧',
        bg: 'bg-blue-600',
        description: 'N3 Level - Ocean & Depth',
        image: '/assets/bg_n3.png' // Placeholder path
    }
];

const CartridgeSelect: React.FC<CartridgeSelectProps> = ({ onSelect }) => {
    const [selectedId, setSelectedId] = useState<GameVersion | null>(null);
    const [focusedId, setFocusedId] = useState<GameVersion>(GameVersion.RED);
    const setProfile = useUserStore(state => state.setProfile);

    const handleSelect = (version: GameVersion) => {
        setSelectedId(version);
        // Play sound effect here
        setTimeout(() => {
            setProfile({ currentVersion: version });
            onSelect(version);
        }, 1000);
    };

    return (
        <div className="w-full h-dvh bg-[#0f172a] text-white font-sans overflow-hidden flex flex-col relative">
            {/* Background Tech Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')] pointer-events-none" />

            {/* Top Bar */}
            <div className="flex justify-between items-center p-8 px-12 z-10 border-b border-white/10 bg-[#1e293b]/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-cyan-500 overflow-hidden border-2 border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                        {/* User Avatar Placeholder */}
                        <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg text-cyan-100">Student: Player</span>
                        <span className="text-xs text-cyan-400">Level 1 • Novice Coder</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-cyan-300 font-mono">
                    <span>SYS.ONLINE</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
            </div>

            {/* Main Content (Game Row) */}
            <div className="flex-1 flex items-center justify-center gap-8 px-12 overflow-x-auto no-scrollbar z-10">
                {cartridges.map((cartridge) => {
                    const isFocused = focusedId === cartridge.id;
                    const isSelected = selectedId === cartridge.id;

                    return (
                        <div key={cartridge.id} className="relative flex flex-col items-center gap-4">
                            <motion.div
                                layoutId={cartridge.id}
                                onClick={() => {
                                    setFocusedId(cartridge.id);
                                    if (isFocused) handleSelect(cartridge.id);
                                }}
                                animate={{
                                    scale: isFocused ? 1.1 : 1,
                                    opacity: selectedId && !isSelected ? 0 : 1,
                                    y: isFocused ? -10 : 0
                                }}
                                className={`
                            w-64 h-80 rounded-xl cursor-pointer relative z-10
                            bg-gradient-to-b from-gray-800 to-gray-900
                            border-2 ${isFocused ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'border-gray-700'}
                            flex flex-col items-center overflow-hidden
                            transition-colors duration-300
                        `}
                            >
                                {/* Background Image (Optional) */}
                                {cartridge.image && (
                                    <div
                                        className="absolute inset-0 bg-cover bg-center opacity-20 group-hover:opacity-40 transition-opacity"
                                        style={{ backgroundImage: `url(${cartridge.image})` }}
                                    />
                                )}
                                <div className="absolute inset-0 bg-black/40" /> {/* Overlay for readability */}
                                {/* Header Color Strip */}
                                <div className={`w-full h-2 bg-gradient-to-r ${cartridge.color}`} />

                                {/* Content */}
                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                                    <div className="text-6xl mb-4 filter drop-shadow-lg transform group-hover:scale-110 transition-transform">
                                        {cartridge.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{cartridge.title}</h3>
                                    <p className="text-xs text-gray-400 font-mono">{cartridge.description}</p>
                                </div>

                                {/* Footer Status */}
                                <div className="w-full bg-black/30 p-2 flex justify-between items-center px-4">
                                    <span className="text-[10px] text-gray-500 font-mono">MOD.0{cartridge.id === GameVersion.RED ? '1' : cartridge.id === GameVersion.GREEN ? '2' : '3'}</span>
                                    <div className={`w-2 h-2 rounded-full ${cartridge.bg}`} />
                                </div>
                            </motion.div>

                            {/* Selection Indicator */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: isFocused ? 1 : 0 }}
                                className="text-cyan-400 font-mono text-sm tracking-widest"
                            >
                                [ SELECT MODULE ]
                            </motion.div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Bar (System Icons) */}
            <div className="p-6 px-12 flex justify-center gap-12 border-t border-white/10 bg-[#1e293b]/50 backdrop-blur-md z-10">
                {[
                    { label: 'Dashboard', icon: '📊' },
                    { label: 'Curriculum', icon: '📚' },
                    { label: 'Achievements', icon: '🏆' },
                    { label: 'Settings', icon: '⚙️' }
                ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-2 group cursor-pointer hover:text-cyan-400 transition-colors text-gray-400">
                        <div className="text-2xl group-hover:scale-110 transition-transform">
                            {item.icon}
                        </div>
                        <span className="text-xs font-mono uppercase">{item.label}</span>
                    </div>
                ))}
            </div>

            {/* Loading Overlay */}
            <AnimatePresence>
                {selectedId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-[#0a192f] z-50 flex items-center justify-center"
                    >
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
                            <div className="text-cyan-400 text-xl font-mono tracking-widest animate-pulse">
                                INITIALIZING ENVIRONMENT...
                            </div>
                            <div className="text-gray-500 text-xs mt-2 font-mono">
                                Loading module: {selectedId}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CartridgeSelect;
