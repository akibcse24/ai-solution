
import React, { useState, useEffect, useRef } from 'react';
import { ExamAnalysis, ExamQuestion } from '../types';

interface AnalysisViewProps {
  analysis: ExamAnalysis;
  onConfirm: () => void;
  onSave: () => void;
  onUpdateQuestion: (id: string, updated: Partial<ExamQuestion>) => void;
}

const AutoResizingTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className: string;
  placeholder?: string;
}> = ({ value, onChange, className, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={adjustHeight}
      className={`${className} overflow-hidden resize-none transition-all duration-150`}
      placeholder={placeholder}
      rows={1}
      spellCheck={false}
    />
  );
};

const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis, onConfirm, onSave, onUpdateQuestion }) => {
  const [fullScreenQuestionId, setFullScreenQuestionId] = useState<string | null>(null);

  const enabledCount = analysis.questions.filter(q => q.enabled).length;
  const allEnabled = enabledCount === analysis.questions.length;

  const toggleAll = () => {
    const newState = !allEnabled;
    analysis.questions.forEach(q => {
      onUpdateQuestion(q.id, { enabled: newState });
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 md:pb-16 max-w-7xl mx-auto">
      {/* Sticky Header - Redesigned to match screenshot */}
      <div className="sticky top-4 z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-4 md:p-3 md:pr-6 rounded-3xl shadow-xl border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Deselect All Box - Blue Box Highlight in screenshot */}
          <div className="flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 border-2 border-blue-400/30 rounded-2xl bg-blue-50/10 md:mr-6 ml-1">
            <input 
              type="checkbox"
              id="master-toggle"
              checked={allEnabled}
              onChange={toggleAll}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer"
            />
            <label htmlFor="master-toggle" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] cursor-pointer select-none">
              {allEnabled ? 'Deselect All' : 'Select All'}
            </label>
          </div>
          <div className="hidden sm:block">
            <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight">{analysis.examTitle}</h2>
            <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest mt-1">
              {enabledCount} Enabled • {analysis.totalMarks} Marks Potential
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onSave}
            className="px-5 md:px-6 py-3 md:py-4 bg-white hover:bg-slate-50 text-slate-700 font-black rounded-2xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 text-[9px] md:text-[10px] tracking-[0.2em] uppercase group"
          >
            <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span className="hidden md:inline">Save Draft</span>
          </button>
          
          <button
            onClick={onConfirm}
            className="px-8 md:px-10 py-3 md:py-4 bg-slate-800 hover:bg-black text-white font-black rounded-2xl shadow-lg transition-all flex items-center gap-3 text-[10px] md:text-[11px] tracking-[0.2em] uppercase disabled:opacity-50"
            disabled={enabledCount === 0}
          >
            <span>Finalize Scans</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="grid gap-5 md:gap-6">
        {analysis.questions.map((q) => (
          <div 
            key={q.id} 
            className={`bg-white rounded-[2.5rem] shadow-sm border transition-all ${q.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}
          >
            {/* Header row as per screenshot */}
            <div className={`px-6 md:px-8 py-4 md:py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${q.enabled ? 'bg-slate-50/30' : 'bg-slate-100/50'}`}>
              <div className="flex flex-wrap items-center gap-4">
                <input 
                  type="checkbox"
                  checked={q.enabled}
                  onChange={(e) => onUpdateQuestion(q.id, { enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
                
                {/* Include Label */}
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Include</label>

                {/* Question ID in Dark Circle */}
                <span className={`flex items-center justify-center w-10 h-10 rounded-full font-black text-sm shadow-md transition-all ${q.enabled ? 'bg-slate-800 text-white' : 'bg-slate-300 text-slate-500'}`}>
                  {q.label}
                </span>
                
                {q.enabled && (
                  <div className="flex flex-wrap items-center gap-3 md:gap-4 md:ml-2">
                    {/* Toggles Side-by-Side */}
                    <button 
                      onClick={() => onUpdateQuestion(q.id, { isJustified: !q.isJustified })}
                      className={`flex items-center gap-3 px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all ${q.isJustified ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      <div className={`relative w-8 h-4 rounded-full transition-colors ${q.isJustified ? 'bg-blue-500' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${q.isJustified ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </div>
                      Formal Justified
                    </button>

                    <button 
                      onClick={() => onUpdateQuestion(q.id, { diagramRequired: !q.diagramRequired })}
                      className={`flex items-center gap-3 px-4 py-2 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all ${q.diagramRequired ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                      <div className={`relative w-8 h-4 rounded-full transition-colors ${q.diagramRequired ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${q.diagramRequired ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </div>
                      Gen Diagram
                    </button>
                  </div>
                )}
              </div>
              
              {/* Marks Pill */}
              <div className="flex items-center gap-3 bg-white px-5 py-2 rounded-full border border-slate-200 shadow-sm self-start md:self-auto">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marks</span>
                <input 
                  type="number"
                  value={q.marks}
                  disabled={!q.enabled}
                  onChange={(e) => onUpdateQuestion(q.id, { marks: parseInt(e.target.value) || 0 })}
                  className="w-8 text-sm font-black text-blue-600 focus:outline-none text-center bg-transparent"
                />
              </div>
            </div>
            
            <div className={`p-6 md:p-8 space-y-6 md:space-y-8 ${!q.enabled ? 'pointer-events-none' : ''}`}>
              {/* Context */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Question Context</p>
                <div className="text-slate-600 text-sm p-5 bg-slate-50/80 rounded-2xl border border-slate-100 shadow-inner leading-relaxed">
                  {q.text}
                </div>
              </div>

              {/* Draft Editor - Refined Aesthetics */}
              <div>
                <div className="flex justify-between items-end mb-3 px-1">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Handwritten Synthesis (Editable Draft)</p>
                  <button onClick={() => setFullScreenQuestionId(q.id)} className="text-[9px] font-black text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-widest">Expand</button>
                </div>
                <div className="rounded-[2rem] shadow-sm border-2 border-blue-400/20 overflow-hidden relative bg-blue-50/5" style={{ backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px)', backgroundSize: '100% 2.2rem' }}>
                  <AutoResizingTextarea
                    value={q.suggestedAnswer}
                    onChange={(val) => onUpdateQuestion(q.id, { suggestedAnswer: val })}
                    className="w-full bg-transparent p-5 md:p-6 handwriting text-lg md:text-2xl text-blue-900/80 outline-none leading-[2.1rem] md:leading-[2.2rem]"
                    placeholder="Synthesis starting..."
                  />
                </div>
              </div>
              
              {q.diagramRequired && (
                <div className="p-6 bg-blue-50/20 rounded-[2rem] border-2 border-dashed border-blue-200/50 space-y-3">
                  <p className="text-[10px] font-black text-blue-900/60 uppercase tracking-widest">Technical Figure Specification</p>
                  <AutoResizingTextarea
                    value={q.diagramDescription || ''}
                    onChange={(val) => onUpdateQuestion(q.id, { diagramDescription: val })}
                    className="w-full text-xs text-slate-600 bg-white/60 border border-blue-100 rounded-2xl p-4 outline-none transition-shadow focus:shadow-md"
                    placeholder="Describe specific layout requirements for diagram generation..."
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Full Screen Modal */}
      {fullScreenQuestionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/95 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3.5rem] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 text-white font-black text-sm">
                  {analysis.questions.find(q => q.id === fullScreenQuestionId)?.label}
                </span>
                <h3 className="font-black text-slate-800 uppercase tracking-[0.3em] text-[11px]">Draft Architect</h3>
              </div>
              <button onClick={() => setFullScreenQuestionId(null)} className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all">Exit Editor</button>
            </div>
            <div className="flex-1 overflow-auto p-10 bg-slate-100/30">
              <div className="lined-paper rounded-[3rem] border border-slate-200 h-full min-h-full bg-white p-12 shadow-2xl">
                <textarea 
                  value={analysis.questions.find(q => q.id === fullScreenQuestionId)?.suggestedAnswer}
                  onChange={(e) => onUpdateQuestion(fullScreenQuestionId, { suggestedAnswer: e.target.value })}
                  className="w-full h-full bg-transparent handwriting text-4xl text-blue-900 outline-none leading-[3.5rem]"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisView;
