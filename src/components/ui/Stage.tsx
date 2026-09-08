import React from 'react';

interface StageProps {
    art?: string;           // background image url
    children: React.ReactNode;
    className?: string;
    sparkles?: boolean;
    blur?: boolean;         // blur the art (menus) vs keep it crisp (title)
    artPosition?: string;   // CSS background-position (e.g. 'center 80%')
    artSize?: string;       // CSS background-size (e.g. 'auto 165%') to crop into the art
    veil?: 'normal' | 'heavy';
}

/** Full-screen backdrop: art → veil → content. Consistent on every screen. */
const Stage: React.FC<StageProps> = ({ art, children, className = '', sparkles = true, blur = false, artPosition, artSize, veil = 'normal' }) => (
    <div className={`g-stage w-full h-dvh flex flex-col overflow-hidden ${sparkles ? 'g-sparkles' : ''} ${className}`}>
        {art && (
            <div
                className="g-stage-art"
                style={{
                    backgroundImage: `url(${art})`,
                    backgroundPosition: artPosition,
                    backgroundSize: artSize,
                    filter: blur ? 'blur(12px) saturate(1.15) brightness(0.8)' : undefined,
                    transform: blur ? 'scale(1.08)' : undefined,
                }}
            />
        )}
        <div className="g-stage-veil" style={veil === 'heavy' ? { background: 'radial-gradient(120% 70% at 50% 0%, rgba(11,16,32,0.85), rgba(11,16,32,0.35) 45%, transparent 70%), linear-gradient(180deg, rgba(11,16,32,0.7) 0%, rgba(11,16,32,0.45) 50%, rgba(11,16,32,0.95) 100%)' } : undefined} />
        {children}
    </div>
);

export default Stage;
