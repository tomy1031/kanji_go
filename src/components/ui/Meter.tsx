import React from 'react';
import { motion } from 'framer-motion';

interface MeterProps {
    value: number;          // 0..1
    tone?: 'player' | 'enemy' | 'gold' | 'success' | 'magic';
    className?: string;
    critical?: boolean;     // pulse when low
}

const TONES: Record<NonNullable<MeterProps['tone']>, string> = {
    player: 'linear-gradient(90deg, #1d9bff, #38d6ff)',
    enemy: 'linear-gradient(90deg, #d9263f, #ff5a6e)',
    gold: 'linear-gradient(90deg, #ffb31a, #ffe08a)',
    success: 'linear-gradient(90deg, #22b872, #5ee29a)',
    magic: 'linear-gradient(90deg, #7c4dff, #b98cff)',
};

const Meter: React.FC<MeterProps> = ({ value, tone = 'player', className = '', critical }) => (
    <div className={`g-meter ${className}`}>
        <motion.div
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
            transition={{ type: 'spring', stiffness: 220, damping: 28 }}
            style={{ background: TONES[tone], animation: critical ? 'hpCritical 0.8s ease-in-out infinite' : undefined }}
        />
    </div>
);

export default Meter;
