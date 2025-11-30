import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ElementType } from '../../types';

interface MonsterDisplayProps {
    name: string;
    element: ElementType;
    level: number;
    hp: number;
    maxHp: number;
    imagePath?: string;
    isEnemy?: boolean;
    isAttacking?: boolean;
    isHit?: boolean;
}

const getElementColor = (element: ElementType) => {
    switch (element) {
        case ElementType.FIRE: return 'bg-red-500';
        case ElementType.AQUA: return 'bg-blue-500';
        case ElementType.NATURE: return 'bg-green-500';
        case ElementType.METAL: return 'bg-gray-500';
        case ElementType.LIGHT: return 'bg-yellow-400';
        case ElementType.LIFE: return 'bg-pink-500';
        case ElementType.CHRONO: return 'bg-purple-500';
        case ElementType.MAGIC: return 'bg-indigo-500';
        case ElementType.BOSS: return 'bg-black';
        default: return 'bg-gray-400';
    }
};

const MonsterDisplay: React.FC<MonsterDisplayProps> = ({
    name,
    element,
    level,
    hp,
    maxHp,
    imagePath,
    isEnemy = false,
    isAttacking = false,
    isHit = false,
}) => {
    const hpPercentage = (hp / maxHp) * 100;
    // const colorClass = getElementColor(element);

    return (
        <div className="flex flex-col items-center justify-center p-4">
            {/* Monster Name & Level */}
            <div className="bg-white/80 backdrop-blur-sm px-4 py-1 rounded-full mb-2 shadow-sm border border-gray-200">
                <span className="font-bold text-gray-800">Lv.{level} {name}</span>
            </div>

            {/* Monster Visual (Placeholder for now) */}
            <motion.div
                animate={{
                    scale: isAttacking ? 1.2 : 1,
                    x: isHit ? [0, -10, 10, -10, 10, 0] : 0,
                    rotate: isHit ? [0, -5, 5, -5, 5, 0] : 0,
                }}
                transition={{ duration: 0.3 }}
            >
                {/* Avatar / Image */}
                <div className={`w-32 h-32 mb-4 relative ${isEnemy ? 'order-2' : 'order-1'}`}>
                    {imagePath ? (
                        <img src={imagePath} alt={name} className="w-full h-full object-contain drop-shadow-lg" />
                    ) : (
                        <div className={`w-full h-full rounded-full ${getElementColor(element)} flex items-center justify-center shadow-lg border-4 border-white/20`}>
                            <span className="text-4xl">
                                {element === ElementType.FIRE ? '🔥' : element === ElementType.AQUA ? '💧' : element === ElementType.NATURE ? '🌿' : '👾'}
                            </span>
                        </div>
                    )}

                    {/* Element Badge */}
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gray-800 border-2 border-white flex items-center justify-center text-xs">
                        {element.charAt(0)}
                    </div>
                </div>

                {/* Hit Effect Overlay */}
                <AnimatePresence>
                    {isHit && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/50 mix-blend-overlay"
                        />
                    )}
                </AnimatePresence>
            </motion.div>

            {/* HP Bar */}
            <div className="w-48 h-4 bg-gray-200 rounded-full mt-4 overflow-hidden border border-gray-300">
                <motion.div
                    className={`h-full ${hpPercentage < 30 ? 'bg-red-500' : 'bg-green-500'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${hpPercentage}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>
        </div>
    );
};

export default MonsterDisplay;
