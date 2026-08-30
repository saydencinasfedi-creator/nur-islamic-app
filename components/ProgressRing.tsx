import React from 'react';

interface ProgressRingProps {
    progress: number; // 0..1
    strokeWidth?: number;
    color?: string;
    // Class-based (not a hex prop) specifically so it can carry a dark: variant — a fixed
    // hex passed straight to the `stroke` attribute can't respond to the light/dark theme.
    trackClassName?: string;
}

// Shared partial-fill ring, extracted from Tasbih's counter (pages/Tasbih.tsx).
// Sized entirely by its wrapping element (`relative size-*`) — fills it via inset-0.
const ProgressRing: React.FC<ProgressRingProps> = ({ progress, strokeWidth = 3, color = '#11d483', trackClassName = 'text-gray-200 dark:text-[#152820]' }) => {
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(progress, 1));
    const offset = circumference - clamped * circumference;

    return (
        <svg className="absolute inset-0 size-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={trackClassName} />
            <circle
                cx="50" cy="50" r={radius} fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
            />
        </svg>
    );
};

export default ProgressRing;
