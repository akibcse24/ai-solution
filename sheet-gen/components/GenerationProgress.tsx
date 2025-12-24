
import React, { useState, useEffect } from 'react';

interface GenerationProgressProps {
  current: number;
  total: number;
}

const GenerationProgress: React.FC<GenerationProgressProps> = ({ current, total }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  const loadingMessages = [
    "Simulating medium-blue ballpoint pen pressure...",
    "Applying CamScanner contrast filters...",
    "Replicating college-ruled paper texture...",
    "Generating cursive-print hybrid strokes...",
    "Rendering hand-drawn technical diagrams...",
    "Ensuring 300 DPI scan authenticity...",
    "Applying subtle page-edge shadows..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-10 md:p-24 bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.06)] max-w-xl mx-auto border border-slate-50 animate-fade-in relative overflow-hidden">
      {/* Background Subtle Glow */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-50/20 to-transparent pointer-events-none"></div>

      {/* Abstract AI Animation */}
      <div className="relative w-40 h-40 md:w-48 md:h-48 mb-10 md:mb-16 flex items-center justify-center">
        {/* Outer Ring */}
        <div className="absolute inset-0 border-[3px] border-slate-100 rounded-full"></div>
        
        {/* Spinning Arcs */}
        <div className="absolute inset-0 border-[4px] border-transparent border-t-blue-500 border-r-blue-400 rounded-full animate-spin duration-[3s]"></div>
        <div className="absolute inset-4 border-[4px] border-transparent border-b-indigo-400 border-l-indigo-300 rounded-full animate-spin duration-[2s] direction-reverse" style={{ animationDirection: 'reverse' }}></div>
        <div className="absolute inset-8 border-[2px] border-slate-200 rounded-full animate-pulse"></div>
        
        {/* Core */}
        <div className="absolute w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full shadow-[0_0_40px_rgba(37,99,235,0.4)] flex items-center justify-center animate-bounce duration-[2s]">
           <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
              <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
           </div>
        </div>

        {/* Orbiting Particles */}
        <div className="absolute inset-0 animate-spin duration-[4s]">
           <div className="absolute top-0 left-1/2 w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] -translate-x-1/2 -translate-y-1.5"></div>
        </div>
      </div>
      
      {/* Status Information */}
      <div className="text-center space-y-6 w-full relative z-10">
        <div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-2">Architecting Solution</h3>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-80">
            Synthesizing Page {current} of {total}
          </p>
        </div>
        
        <div className="h-12 flex items-center justify-center px-4 bg-slate-50 rounded-2xl border border-slate-100 mx-8">
          <p className="text-xs font-bold text-blue-600/80 animate-pulse tracking-wide uppercase">
            {loadingMessages[messageIndex]}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GenerationProgress;
