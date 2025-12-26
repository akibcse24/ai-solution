import React, { useState, useRef } from 'react';
import katex from 'katex';
import { RefinedQuestion, AnswerPart } from '../../types';

interface SolutionViewProps {
    refinedQuestions: RefinedQuestion[];
    examTitle: string;
    onSave: () => void;
    onNewProject: () => void;
    onUpdateQuestions: (questions: RefinedQuestion[]) => void;
}

const SolutionView: React.FC<SolutionViewProps> = ({
    refinedQuestions,
    examTitle,
    onSave,
    onNewProject,
    onUpdateQuestions
}) => {
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isImmersiveMode, setIsImmersiveMode] = useState(false);
    const [immersivePageIndex, setImmersivePageIndex] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const exportContainerRef = useRef<HTMLDivElement>(null);

    // Drag and Drop Handlers
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (targetIndex: number) => {
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const updatedQuestions = [...refinedQuestions];
        const [draggedItem] = updatedQuestions.splice(draggedIndex, 1);
        updatedQuestions.splice(targetIndex, 0, draggedItem);

        onUpdateQuestions(updatedQuestions);
        setDraggedIndex(null);
    };

    const handleExportPDF = async () => {
        if (refinedQuestions.length === 0) return;
        setIsExporting(true);
        const element = exportContainerRef.current;
        const opt = {
            margin: 0,
            filename: `${examTitle || 'Solutions'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            // @ts-ignore
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a3', orientation: 'portrait' }
        };
        try {
            // @ts-ignore
            await window.html2pdf().set(opt).from(element).save();
        } catch (err) {
            console.error("PDF export failed", err);
            window.print();
        } finally {
            setIsExporting(false);
        }
    };

    const renderPart = (part: AnswerPart, index: number) => {
        switch (part.type) {
            case 'math':
                try {
                    const cleanContent = part.content.replace(/\[\[MATH\]\]/g, '').replace(/\[\[\/MATH\]\]/g, '');
                    const shouldUseDisplayMode = cleanContent.length > 25 ||
                        ['\\frac', '\\int', '\\sum', '\\lim', '\\displaystyle'].some(k => cleanContent.includes(k));

                    const html = katex.renderToString(cleanContent, {
                        throwOnError: false,
                        displayMode: shouldUseDisplayMode,
                        trust: true
                    });

                    return (
                        <span
                            key={index}
                            className={`math-text ${shouldUseDisplayMode ? 'block my-3 text-center' : 'mx-1'}`}
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    );
                } catch (e) {
                    return <span key={index} className="math-text mx-1">{part.content}</span>;
                }
            case 'code':
                return (
                    <div key={index} className="my-4 not-italic">
                        <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto text-sm font-mono text-slate-800 shadow-sm">
                            <code>{part.content.trim()}</code>
                        </pre>
                    </div>
                );
            case 'diagram':
                if (!part.imageUrl) return (
                    <div key={index} className="my-6 flex flex-col items-center w-full px-4">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-400 text-[10px] font-black uppercase tracking-widest">
                            Figure: {part.content} (Gen Failed)
                        </div>
                    </div>
                );
                return (
                    <div key={index} className="my-[2.2rem] flex flex-col items-center w-full">
                        <img src={part.imageUrl} alt="Tech Diagram" className="block w-auto max-w-full h-auto object-contain" style={{ maxHeight: '500px' }} />
                    </div>
                );
            default:
                return <span key={index} className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: part.content }} />;
        }
    };

    const renderPages = (isImmersive: boolean = false, activeIndex?: number) => {
        const displayQuestions = (isImmersive && activeIndex !== undefined) ? [refinedQuestions[activeIndex]] : refinedQuestions;
        return (
            <div className={`flex flex-col items-center gap-10 ${isImmersive ? 'pb-20' : ''}`} style={isImmersive ? { transform: `scale(${zoomLevel})`, transformOrigin: 'top center', width: 'fit-content' } : {}}>
                {displayQuestions.map((q, qIdx) => {
                    const actualIndex = isImmersive && activeIndex !== undefined ? activeIndex : qIdx;
                    const isDragging = draggedIndex === actualIndex;

                    return (
                        <div
                            key={qIdx}
                            className={`a3-sheet-container no-break-inside relative transition-all duration-300 ${isDragging ? 'opacity-30 scale-95' : 'opacity-100'}`}
                            draggable={!isImmersive}
                            onDragStart={() => handleDragStart(actualIndex)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(actualIndex)}
                        >
                            {!isImmersive && (
                                <div className="absolute top-0 -left-12 bottom-0 w-12 flex items-center justify-center opacity-0 hover:opacity-100 cursor-move group">
                                    <div className="h-16 w-6 bg-slate-200 rounded-full flex flex-col items-center justify-center gap-1 group-hover:bg-blue-100 transition-colors">
                                        {[1, 2, 3, 4].map(i => <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>)}
                                    </div>
                                </div>
                            )}

                            <div className="lined-paper">
                                <div className="pt-16 md:pt-24 pb-12 md:pb-16 px-8 md:px-20 relative z-10">
                                    <div className="ml-8 md:ml-[6.5rem]">
                                        <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4 mb-8 md:mb-10 gap-4">
                                            <h3 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">{q.label}</h3>
                                            {!isImmersive && <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest hidden md:inline">Drag to Reorder</span>}
                                        </div>
                                        <div className={`handwriting text-lg md:text-2xl text-blue-900/85 leading-[2rem] md:leading-[2.2rem] transition-all ${q.isJustified ? 'text-justify p-6 md:p-10 bg-blue-50/20 border-2 border-blue-400/40 rounded-[2rem] md:rounded-[3rem] shadow-sm my-8 md:my-10' : ''}`}>
                                            {q.parts.map((part, pIdx) => renderPart(part, pIdx))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (isImmersiveMode) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-900 overflow-hidden flex flex-col animate-fade-in">
                {/* Immersive Controls */}
                <div className="absolute top-6 right-6 flex gap-4 z-50">
                    <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur rounded-full p-2 border border-white/10">
                        <button onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded-full">-</button>
                        <span className="text-xs font-bold text-white w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                        <button onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded-full">+</button>
                    </div>
                    <button onClick={() => setIsImmersiveMode(false)} className="px-6 py-2 bg-white text-slate-900 rounded-full text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">Exit</button>
                </div>

                <div className="flex-1 overflow-auto immersive-scroller flex justify-center p-20">
                    {renderPages(true, immersivePageIndex)}
                </div>

                {/* Navigation */}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6 z-50">
                    <button onClick={() => setImmersivePageIndex(prev => Math.max(0, prev - 1))} disabled={immersivePageIndex === 0} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-30 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="flex items-center text-white/50 text-xs font-black uppercase tracking-widest">
                        Page {immersivePageIndex + 1} / {refinedQuestions.length}
                    </span>
                    <button onClick={() => setImmersivePageIndex(prev => Math.min(refinedQuestions.length - 1, prev + 1))} disabled={immersivePageIndex === refinedQuestions.length - 1} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-30 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-12 md:space-y-16 animate-fade-in pb-24 md:pb-32">
            <div className="flex flex-col md:flex-row items-center justify-between bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-2xl no-print gap-6 md:gap-10">
                <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight text-center md:text-left">Solution Matrix Finalized</h2>
                <div className="flex flex-wrap gap-5 justify-center">
                    <button onClick={onSave} className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-[2rem] font-black text-[11px] uppercase tracking-widest border border-slate-200 transition-all flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        Save Project
                    </button>
                    <button onClick={() => setIsImmersiveMode(true)} className="px-8 py-3 md:py-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-[2rem] font-black text-[10px] md:text-[11px] uppercase tracking-widest border transition-all">Immersive View</button>
                    <button onClick={handleExportPDF} disabled={isExporting} className="px-10 md:px-12 py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] md:text-[11px] uppercase tracking-widest rounded-[2rem] shadow-[0_15px_30px_rgba(37,99,235,0.3)] transition-all">{isExporting ? 'Exporting...' : 'Save A3 PDF'}</button>
                    <button onClick={onNewProject} className="px-9 md:px-10 py-3 md:py-4 bg-slate-900 hover:bg-black text-white font-black text-[10px] md:text-[11px] uppercase tracking-widest rounded-[2rem] transition-all">New Project</button>
                </div>
            </div>
            <div className="hidden"><div ref={exportContainerRef}>{renderPages()}</div></div>
            <div className="w-full flex justify-center overflow-visible">{renderPages()}</div>
        </div>
    );
};

export default SolutionView;
