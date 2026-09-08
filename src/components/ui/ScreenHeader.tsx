import React from 'react';

interface ScreenHeaderProps {
    title: string;
    eyebrow?: string;
    onBack?: () => void;
    backLabel?: string;
    right?: React.ReactNode;
}

/**
 * The one header every screen shares: back pill on the left (44px target),
 * centered title with an optional eyebrow, optional right slot.
 */
const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, eyebrow, onBack, backLabel = 'もどる', right }) => (
    <header className="relative z-20 flex items-center justify-between px-3 py-2.5 md:px-5">
        <div className="w-[96px]">
            {onBack && (
                <button onClick={onBack} className="g-btn g-btn-ghost !min-h-[42px] !px-4 text-sm">
                    <span aria-hidden>‹</span> {backLabel}
                </button>
            )}
        </div>
        <div className="text-center min-w-0">
            {eyebrow && <div className="g-eyebrow">{eyebrow}</div>}
            <h1 className="g-title text-lg md:text-2xl truncate">{title}</h1>
        </div>
        <div className="w-[96px] flex justify-end">{right}</div>
    </header>
);

export default ScreenHeader;
