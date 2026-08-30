import React, { useEffect, useRef } from 'react';

const BAR_COUNT = 24;
const SMOOTHING = 0.25; // how much of the gap to the target level to close per frame

// Fixed per-bar multipliers (assigned once, not re-randomized every frame) so the bars
// don't move perfectly in unison like a single block, but also don't jitter chaotically —
// all of them still rise and fall together, driven by the same real `level` value.
const BAR_MULTIPLIERS = Array.from({ length: BAR_COUNT }, (_, i) =>
    0.65 + 0.35 * Math.abs(Math.sin(i * 0.7))
);

interface VoiceWaveformProps {
    // Real mic level, 0..1, already normalized/smoothed upstream from the native
    // SpeechRecognition `rmsChanged` event — see pages/AICompanion.tsx.
    level: number;
}

// Live mic-level waveform for the AI Companion recording UI. Purely presentational —
// just renders whatever `level` it's given, easing toward it each frame so the bars
// pulse smoothly instead of snapping between values.
const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ level }) => {
    const barsRef = useRef<(HTMLDivElement | null)[]>([]);
    const rafRef = useRef<number | null>(null);
    const levelRef = useRef(level);
    const renderedRef = useRef(0);

    useEffect(() => {
        levelRef.current = level;
    }, [level]);

    useEffect(() => {
        const tick = () => {
            renderedRef.current += (levelRef.current - renderedRef.current) * SMOOTHING;
            const clamped = Math.max(0, Math.min(renderedRef.current, 1));
            for (let i = 0; i < BAR_COUNT; i++) {
                const heightPct = 10 + clamped * 85 * BAR_MULTIPLIERS[i];
                const bar = barsRef.current[i];
                if (bar) bar.style.height = `${heightPct}%`;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <div className="flex-1 flex items-center justify-center gap-[3px] h-8 px-2 overflow-hidden min-w-0">
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
                <div
                    key={i}
                    ref={el => { barsRef.current[i] = el; }}
                    className="w-[3px] shrink-0 rounded-full bg-primary"
                    style={{ height: '10%' }}
                ></div>
            ))}
        </div>
    );
};

export default VoiceWaveform;
