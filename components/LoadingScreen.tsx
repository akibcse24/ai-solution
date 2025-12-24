import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
    onComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [shouldRender, setShouldRender] = useState(true);

    useEffect(() => {
        // Smooth progress simulation
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(timer);
                    setTimeout(() => setShouldRender(false), 500); // Wait for fade out
                    setTimeout(onComplete, 500);
                    return 100;
                }
                // Decelerating progress
                const remaining = 100 - prev;
                return prev + (remaining * 0.1) + 0.5;
            });
        }, 50);

        return () => clearInterval(timer);
    }, [onComplete]);

    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center transition-opacity duration-700 ease-out ${progress >= 100 ? 'opacity-0' : 'opacity-100'}`}>
            <div className="w-full max-w-sm px-8 flex flex-col items-center gap-6">
                {/* Minimalist Logo Area */}
                <div className="flex flex-col items-center gap-2">
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900">
                        CRYTONIX
                    </h1>
                    <div className="flex gap-2 items-center">
                        <span className="w-1.5 h-1.5 bg-slate-900 rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">System Initializing</span>
                    </div>
                </div>

                {/* Ultra-Clean Progress Bar */}
                <div className="w-full relative h-0.5 bg-slate-100 overflow-hidden rounded-full mt-8">
                    <div
                        className="absolute left-0 top-0 h-full bg-slate-900 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Numeric Indicator */}
                <div className="text-[10px] font-medium tabular-nums text-slate-300 font-mono">
                    {Math.round(progress)}%
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;
