import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import LoadingScreen from './components/LoadingScreen';
import ChatInterface from './components/ChatInterface';
import AnalysisView from './components/AnalysisView';
import { analyzeExamPaper, refineAcademicAnswer, generateTechnicalDiagram, ModelProvider } from './services/geminiService';
import { AppState, ExamAnalysis, ExamQuestion, RefinedQuestion, AnswerPart, HistoryItem } from './types';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const DRAFT_STORAGE_KEY = 'academic_architect_autosave_v3';
const HISTORY_STORAGE_KEY = 'academic_architect_history_v2';
const STORAGE_PREF_KEY = 'academic_architect_storage_pref_v2';
const LOCAL_GEMINI_KEY_STORAGE = 'gemini_api_key_local_v3';
const LOCAL_OPENROUTER_KEY_STORAGE = 'openrouter_api_key_local_v3';
const LOCAL_GROQ_KEY_STORAGE = 'groq_api_key_local_v3';

const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast)', provider: 'gemini' as const },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Complex)', provider: 'gemini' as const },
  { id: 'gemini-2.5-flash-latest', name: 'Gemini 2.5 Flash', provider: 'gemini' as const },
  { id: 'gemini-2.5-pro-latest', name: 'Gemini 2.5 Pro', provider: 'gemini' as const },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (Fastest)', provider: 'openrouter' as const },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro (Complex)', provider: 'openrouter' as const },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B (Powerhouse)', provider: 'openrouter' as const },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Native)', provider: 'gemini' as const },
];

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'chatbot' | 'answer-sheet'>('chatbot');
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<ExamAnalysis | null>(null);
  const [refinedQuestions, setRefinedQuestions] = useState<RefinedQuestion[]>([]);
  const [currentGenStep, setCurrentGenStep] = useState(0);
  const [totalGenSteps, setTotalGenSteps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [openRouterKeyInput, setOpenRouterKeyInput] = useState('');
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [savedGeminiKey, setSavedGeminiKey] = useState<string | null>(null);
  const [savedOpenRouterKey, setSavedOpenRouterKey] = useState<string | null>(null);
  const [savedGroqKey, setSavedGroqKey] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [immersivePageIndex, setImmersivePageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [storageType, setStorageType] = useState<'local' | 'cloud'>('local');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Default to light mode unless explicitly set to dark
    return localStorage.getItem('crytonix_theme') === 'dark';
  });
  const exportContainerRef = React.useRef<HTMLDivElement>(null);

  const setCookie = (name: string, value: string, days: number) => {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
  };

  const getCookie = (name: string) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  // Load state and keys
  useEffect(() => {
    try {
      const storedGeminiKey = localStorage.getItem(LOCAL_GEMINI_KEY_STORAGE);
      if (storedGeminiKey) { setSavedGeminiKey(storedGeminiKey); setGeminiKeyInput(storedGeminiKey); }
      const storedOpenRouterKey = localStorage.getItem(LOCAL_OPENROUTER_KEY_STORAGE);
      if (storedOpenRouterKey) { setSavedOpenRouterKey(storedOpenRouterKey); setOpenRouterKeyInput(storedOpenRouterKey); }
      const storedGroqKey = localStorage.getItem(LOCAL_GROQ_KEY_STORAGE);
      if (storedGroqKey) { setSavedGroqKey(storedGroqKey); setGroqKeyInput(storedGroqKey); }

      const storedStorageType = localStorage.getItem(STORAGE_PREF_KEY) as 'local' | 'cloud';
      if (storedStorageType) setStorageType(storedStorageType);

      const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      let items = rawHistory ? JSON.parse(rawHistory) : [];

      if (storedStorageType === 'cloud') {
        const cookieHistory = getCookie(HISTORY_STORAGE_KEY);
        if (cookieHistory) items = JSON.parse(cookieHistory);
      }

      items.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setHistory(items);
    } catch (e) { console.error("Failed to load init state", e); }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('crytonix_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('crytonix_theme', 'light');
    }
  }, [isDarkMode]);

  // Keyboard navigation for immersive mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isImmersiveMode) return;
      if (e.key === 'Escape') setIsImmersiveMode(false);
      else if (e.key === 'ArrowRight') setImmersivePageIndex(prev => Math.min(refinedQuestions.length - 1, prev + 1));
      else if (e.key === 'ArrowLeft') setImmersivePageIndex(prev => Math.max(0, prev - 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImmersiveMode, refinedQuestions.length]);

  const saveLocalKeys = () => {
    const gKey = geminiKeyInput.trim();
    const oKey = openRouterKeyInput.trim();
    const grKey = groqKeyInput.trim();
    if (gKey) { localStorage.setItem(LOCAL_GEMINI_KEY_STORAGE, gKey); setSavedGeminiKey(gKey); }
    if (oKey) { localStorage.setItem(LOCAL_OPENROUTER_KEY_STORAGE, oKey); setSavedOpenRouterKey(oKey); }
    if (grKey) { localStorage.setItem(LOCAL_GROQ_KEY_STORAGE, grKey); setSavedGroqKey(grKey); }
    setIsSettingsOpen(false);
  };

  const clearLocalGeminiKey = () => { localStorage.removeItem(LOCAL_GEMINI_KEY_STORAGE); setSavedGeminiKey(null); setGeminiKeyInput(''); };
  const clearLocalOpenRouterKey = () => { localStorage.removeItem(LOCAL_OPENROUTER_KEY_STORAGE); setSavedOpenRouterKey(null); setOpenRouterKeyInput(''); };
  const clearLocalGroqKey = () => { localStorage.removeItem(LOCAL_GROQ_KEY_STORAGE); setSavedGroqKey(null); setGroqKeyInput(''); };

  const handleFilesSelected = async (files: { data: string, mimeType: string }[]) => {
    try {
      setError(null);
      setState(AppState.ANALYZING);
      const result = await analyzeExamPaper(files, 'gemini-3-flash-preview');
      setAnalysis(result);
      setState(AppState.REVIEWING);
      setViewMode('answer-sheet');
    } catch (err: any) {
      setError(err.message || "Scanning failed.");
      setState(AppState.IDLE);
    }
  };

  const updateQuestion = (id: string, updated: Partial<ExamQuestion>) => {
    if (!analysis) return;
    const nextQuestions = analysis.questions.map(q =>
      q.id === id ? { ...q, ...updated } : q
    );
    setAnalysis({ ...analysis, questions: nextQuestions });
  };

  const saveDraft = () => {
    if (!analysis) return;
    saveToHistory(analysis);
    alert('Draft Saved to History');
  };

  const getSelectedModel = () => {
    return AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];
  };

  const processQuestion = async (q: ExamQuestion): Promise<RefinedQuestion> => {
    const model = getSelectedModel();
    let refinedAnswer = await refineAcademicAnswer(q, model.id, model.provider);

    // --- CLEANUP & NORMALIZATION ---
    refinedAnswer = refinedAnswer.replace(/<\s*([bu])\s*>/gi, '<$1>');
    refinedAnswer = refinedAnswer.replace(/<\s*\/\s*([bu])\s*>/gi, '</$1>');
    refinedAnswer = refinedAnswer.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    refinedAnswer = refinedAnswer.replace(/^###\s*(.*$)/gm, '<b><u>$1</u></b>');
    refinedAnswer = refinedAnswer.replace(/^##\s*(.*$)/gm, '<b>$1</b>');
    refinedAnswer = refinedAnswer.replace(/([^\\[])\$(.+?)\$([^\\]])/g, '$1[[MATH]]$2[[/MATH]]$3');
    refinedAnswer = refinedAnswer.replace(/(^|[^\\])\*([^*]+?)\*/g, '$1<i>$2</i>');
    // -------------------------------

    const parts: AnswerPart[] = [];
    // Updated Regex to split by MATH, DIAGRAM, and CODE
    const rawParts = refinedAnswer.split(/(\[\[MATH\]\].*?\[\[\/MATH\]\]|\[\[DIAGRAM\]\].*?\[\[\/DIAGRAM\]\]|\[\[CODE\]\].*?\[\[\/CODE\]\])/gs);

    for (const raw of rawParts) {
      if (!raw) continue;
      if (raw.startsWith('[[MATH]]')) {
        parts.push({ type: 'math', content: raw.slice(8, -9) });
      } else if (raw.startsWith('[[DIAGRAM]]')) {
        const desc = raw.slice(11, -12) || q.diagramDescription || q.text;
        try {
          const imageUrl = await generateTechnicalDiagram(desc);
          parts.push({ type: 'diagram', content: desc, imageUrl });
        } catch (e) {
          parts.push({ type: 'diagram', content: desc });
        }
      } else if (raw.startsWith('[[CODE]]')) {
        parts.push({ type: 'code', content: raw.slice(8, -9) });
      } else {
        parts.push({ type: 'text', content: raw });
      }
    }

    if (q.diagramRequired && !parts.some(p => p.type === 'diagram')) {
      const desc = q.diagramDescription || q.text;
      try {
        const imageUrl = await generateTechnicalDiagram(desc);
        parts.push({ type: 'diagram', content: desc, imageUrl });
      } catch (e) {
        parts.push({ type: 'diagram', content: desc });
      }
    }

    return {
      label: q.label,
      text: q.text,
      marks: q.marks,
      refinedAnswer,
      parts,
      isJustified: q.isJustified
    };
  };

  const startGeneration = async () => {
    if (!analysis) return;
    setState(AppState.GENERATING);
    setError(null);

    const enabledQuestions = analysis.questions.filter(q => q.enabled);
    setTotalGenSteps(enabledQuestions.length);
    setCurrentGenStep(0);

    const results: RefinedQuestion[] = [];
    const batchSize = 3;
    let failureCount = 0;

    for (let i = 0; i < enabledQuestions.length; i += batchSize) {
      const batch = enabledQuestions.slice(i, i + batchSize);

      const batchResults = await Promise.all(batch.map(async (q) => {
        try {
          return await processQuestion(q);
        } catch (err) {
          console.error(`Failed to process question ${q.label}:`, err);
          failureCount++;
          return {
            label: q.label,
            text: q.text,
            marks: q.marks,
            refinedAnswer: `<div class="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold">Generation failed for this specific question after all retry attempts.</div>`,
            parts: [{ type: 'text' as const, content: `<b style="color:#ef4444">Generation failed for this question.</b>` }],
            isJustified: q.isJustified
          };
        }
      }));

      results.push(...batchResults);
      setCurrentGenStep(prev => Math.min(prev + batch.length, enabledQuestions.length));
    }

    setRefinedQuestions(results);
    setState(AppState.COMPLETED);

    if (failureCount > 0) {
      setError(`${failureCount} question(s) failed to generate, but the rest are available below.`);
    }
  };

  const saveToHistory = (data: ExamAnalysis, refined?: RefinedQuestion[]) => {
    const newItem: HistoryItem = { id: crypto.randomUUID(), data, refinedQuestions: refined, timestamp: Date.now(), tags: [] };
    const nextHistory = [newItem, ...history];
    setHistory(nextHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    if (storageType === 'cloud') {
      setCookie(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory), 30);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = history.filter(h => h.id !== id);
    setHistory(next);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    if (storageType === 'cloud') {
      setCookie(HISTORY_STORAGE_KEY, JSON.stringify(next), 30);
    }
  };

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

    setRefinedQuestions(updatedQuestions);
    setDraggedIndex(null);
  };

  const handleExportPDF = async () => {
    if (refinedQuestions.length === 0) return;
    setIsExporting(true);
    const element = exportContainerRef.current;
    if (!element) return;
    const opt = {
      margin: 0,
      filename: `${analysis?.examTitle || 'Solutions'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a3', orientation: 'portrait' }
    };
    try {
      // @ts-ignore
      await window.html2pdf().set(opt).from(element).save();
    } catch (err) {
      window.print();
    } finally {
      setIsExporting(false);
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

  const renderPart = (part: AnswerPart, index: number) => {
    switch (part.type) {
      case 'math':
        try {
          const cleanContent = part.content.replace(/\[\[MATH\]\]/g, '').replace(/\[\[\/MATH\]\]/g, '');
          const shouldUseDisplayMode = cleanContent.length > 25 || ['\\frac', '\\int', '\\sum', '\\lim'].some(k => cleanContent.includes(k));
          const html = katex.renderToString(cleanContent, { throwOnError: false, displayMode: shouldUseDisplayMode, trust: true });
          return <span key={index} className={`math-text ${shouldUseDisplayMode ? 'block my-3 text-center' : 'mx-1'}`} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch (e) { return <span key={index} className="math-text mx-1">{part.content}</span>; }
      case 'code':
        return <div key={index} className="my-4 not-italic"><pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto text-sm font-mono text-slate-800 shadow-sm"><code>{part.content.trim()}</code></pre></div>;
      case 'diagram':
        return part.imageUrl ? <img key={index} src={part.imageUrl} className="my-10 max-w-full rounded-[2.5rem] shadow-2xl border border-slate-100" /> : <div key={index} className="bg-red-50 p-4 rounded-xl text-red-500">Diagram failed: {part.content}</div>;
      case 'text': return <div key={index} className="prose prose-slate max-w-none mb-6" dangerouslySetInnerHTML={{ __html: part.content }} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden transition-colors duration-500">
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}

      <div className={`transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {/* Universal Header Pill - Reorganized */}
        <header className="max-w-[1400px] mx-auto pt-8 px-6 no-print relative z-[100]">
          <div className="premium-card px-6 py-4 rounded-full flex justify-between items-center transition-all bg-white/90 dark:bg-slate-900/90 gap-6">

            {/* Left: Logo & Main Toggle */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-1 cursor-pointer group shrink-0" onClick={() => { setState(AppState.IDLE); setViewMode('chatbot'); }}>
                <span className="text-2xl font-[900] tracking-tighter text-slate-900 dark:text-white transition-colors">Crytonix<span className="text-blue-500 group-hover:text-blue-400 transition-colors">.</span></span>
              </div>

              <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-full flex items-center gap-1">
                <button
                  onClick={() => setViewMode('chatbot')}
                  className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${viewMode === 'chatbot' ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md transform scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  Chatbot
                </button>
                <button
                  onClick={() => { setViewMode('answer-sheet'); if (state === AppState.COMPLETED) setState(AppState.IDLE); }}
                  className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${viewMode === 'answer-sheet' ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md transform scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Ans Sheet Pro
                </button>
              </div>
            </div>

            {/* Center: Nav Links */}
            <nav className="flex items-center gap-8 hidden md:flex">
              {['Features', 'Support', 'Contact'].map(link => (
                <button key={link} className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:-translate-y-0.5">
                  {link}
                </button>
              ))}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="text-slate-400 hover:text-blue-500 transition-all p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
              </button>

              <button
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all hover:scale-105"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                History
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-6 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-900/10 dark:shadow-none hover:bg-black dark:hover:bg-slate-200"
              >
                Settings
              </button>
            </div>
          </div>
        </header>

        {/* System Ready Banner - Fixed Bottom Right */}
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <div className="premium-card px-5 py-2 rounded-full flex items-center gap-3 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 shadow-2xl animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              System Ready <span className="text-slate-300 dark:text-slate-600 mx-1">•</span> {savedGroqKey ? 'Groq' : ''} {savedGroqKey && savedOpenRouterKey ? '/' : ''} {savedOpenRouterKey ? 'Neural' : ''} Online
            </p>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="max-w-[1200px] mx-auto px-6 pb-40 mt-12">
          {viewMode === 'chatbot' ? (
            <div className="animate-fade-in min-h-[60vh] relative">
              <ChatInterface
                groqKey={savedGroqKey || ''}
                openRouterKey={savedOpenRouterKey || ''}
              />
            </div>
          ) : (
            <div className="animate-fade-in">
              {state === AppState.IDLE && (
                <div className="max-w-4xl mx-auto py-10">
                  <FileUpload onFilesSelected={handleFilesSelected} isLoading={false} />

                  {history.length > 0 && (
                    <div className="mt-24">
                      <h3 className="text-center text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 mb-12">Archived Sessions</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {history.map(item => (
                          <div key={item.id} onClick={() => { setAnalysis(item.data); if (item.refinedQuestions) { setRefinedQuestions(item.refinedQuestions); setState(AppState.COMPLETED); } else { setState(AppState.REVIEWING); } }} className="premium-card rounded-[3rem] p-10 group relative overflow-hidden transition-all hover:scale-[1.03] cursor-pointer border border-transparent hover:border-blue-100 active:scale-95">
                            <button onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id, e); }} className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 p-2.5 text-slate-300 hover:text-red-500 bg-slate-50 rounded-full transition-all hover:rotate-90">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                            <div className="mb-6">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{new Date(item.timestamp).toLocaleDateString()}</span>
                            </div>
                            <h4 className="font-black text-slate-800 text-xl mb-6 line-clamp-2 leading-tight tracking-tight">{item.data.examTitle}</h4>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.data.questions.length} Units Found</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {state === AppState.ANALYZING && (
                <div className="text-center py-32 animate-fade-in">
                  <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] mx-auto flex items-center justify-center animate-spin mb-10 shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12,1V3a9,9,0,1,1-9,9H1a11,11,0,1,0,11-11Z" /></svg>
                  </div>
                  <h2 className="text-2xl font-[900] text-slate-900 uppercase tracking-[0.4em] mb-4">Vision Pulse</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Decoding Exam Architecture via Gemini 3</p>
                </div>
              )}

              {state === AppState.REVIEWING && analysis && (
                <AnalysisView
                  analysis={analysis}
                  onConfirm={startGeneration}
                  onSave={saveDraft}
                  onUpdateQuestion={updateQuestion}
                />
              )}

              {state === AppState.GENERATING && (
                <div className="max-w-2xl mx-auto py-32 text-center animate-fade-in">
                  <div className="mb-12 relative px-10">
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-blue-600 transition-all duration-700 ease-out" style={{ width: `${(currentGenStep / totalGenSteps) * 100}%` }}></div>
                    </div>
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-black text-blue-600 uppercase tracking-[0.4em]">{Math.round((currentGenStep / totalGenSteps) * 100)}% Synthesized</span>
                  </div>
                  <h2 className="text-2xl font-[900] text-slate-900 uppercase tracking-[0.4em] mb-4">Architecting</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Refining Academic Answers for Perfection</p>
                </div>
              )}

              {state === AppState.COMPLETED && (
                <div className="animate-fade-in space-y-16">
                  {/* Floating Action Controls */}
                  <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] no-print">
                    <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 p-2 rounded-full shadow-2xl flex items-center gap-2">
                      <button
                        onClick={() => setIsImmersiveMode(!isImmersiveMode)}
                        className={`p-4 rounded-full transition-all ${isImmersiveMode ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Toggle Immersive Mode"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                      <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="px-8 py-4 bg-white text-slate-950 rounded-full font-black uppercase tracking-widest text-[10px] flex items-center gap-3 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-xl"
                      >
                        {isExporting ? <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent animate-spin rounded-full"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" /></svg>}
                        Export A3 PDF
                      </button>
                      <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                      <button
                        onClick={() => setState(AppState.IDLE)}
                        className="p-4 text-slate-400 hover:text-white transition-all"
                        title="New Project"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Document Title Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border-2 border-slate-100 rounded-[3rem] p-10 md:p-14 mb-12 backdrop-blur-sm no-print relative group">
                    <div className="flex-1">
                      <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4">{analysis?.examTitle}</h2>
                      <div className="flex flex-wrap gap-4">
                        <span className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">Professional Grade</span>
                        <span className="bg-slate-100 text-slate-500 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">{refinedQuestions.length} Pages Generated</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-8 md:mt-0">
                      {isImmersiveMode && (
                        <div className="flex items-center gap-6 bg-slate-900 text-white p-2 rounded-full border border-white/10">
                          <button onClick={() => setImmersivePageIndex(prev => Math.max(0, prev - 1))} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] w-24 text-center">PAGE {immersivePageIndex + 1} / {refinedQuestions.length}</span>
                          <button onClick={() => setImmersivePageIndex(prev => Math.min(refinedQuestions.length - 1, prev + 1))} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (analysis) saveToHistory(analysis, refinedQuestions);
                          setState(AppState.IDLE);
                        }}
                        className="w-16 h-16 md:w-20 md:h-20 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-[2rem] border-2 border-red-100 flex items-center justify-center transition-all shadow-xl shadow-red-500/10 active:scale-95 flex-shrink-0"
                        title="Save & Close"
                      >
                        <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Main Generation Canvas */}
                  <div className={`relative transition-all duration-700 ${isImmersiveMode ? 'fixed inset-0 z-[1000] bg-slate-950 flex flex-col items-center pt-20 overflow-y-auto immersive-scroller' : ''}`}>
                    {isImmersiveMode && (
                      <div className="fixed top-8 right-10 flex items-center gap-4 z-[1001]">
                        <div className="flex bg-slate-900 border border-white/10 rounded-full p-1 shadow-2xl">
                          <button onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))} className="p-3 text-slate-400 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4" /></svg></button>
                          <div className="w-[1px] h-4 bg-white/10 my-auto mx-1"></div>
                          <button onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))} className="p-3 text-slate-400 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg></button>
                        </div>
                        <button onClick={() => setIsImmersiveMode(false)} className="w-14 h-14 bg-white text-slate-950 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    )}

                    <div ref={exportContainerRef} className={`${isImmersiveMode ? 'pointer-events-none select-none' : ''}`}>
                      {renderPages(isImmersiveMode, isImmersiveMode ? immersivePageIndex : undefined)}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="max-w-xl mx-auto mt-20 p-10 bg-red-50 rounded-[3rem] border border-red-100 text-center animate-fade-in shadow-2xl shadow-red-500/5">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-black">!</div>
                  <h3 className="text-xl font-black text-red-600 uppercase tracking-[0.2em] mb-4">System Fault</h3>
                  <p className="text-red-400 text-sm font-semibold mb-8 leading-relaxed">{error}</p>
                  <button onClick={() => setError(null)} className="px-10 py-4 bg-red-500 text-white rounded-full font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-red-600 transition-all">Dismiss Fault</button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Global Settings Modal */}
        {
          isSettingsOpen && (
            <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-3xl flex items-center justify-center p-6 animate-fade-in">
              <div className="w-full max-w-xl bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-100">
                <div className="p-10 md:p-14">
                  <div className="flex justify-between items-center mb-12">
                    <h3 className="text-3xl font-[900] text-slate-900 tracking-tighter">Cloud DNA</h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="w-14 h-14 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center transition-all hover:rotate-90">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div className="space-y-10">
                    {[
                      { label: 'Gemini Key', value: geminiKeyInput, set: setGeminiKeyInput, clear: clearLocalGeminiKey, desc: 'Primary core for vision processing' },
                      { label: 'OpenRouter Key', value: openRouterKeyInput, set: setOpenRouterKeyInput, clear: clearLocalOpenRouterKey, desc: 'Model orchestration & fallback node' },
                      { label: 'Groq Key', value: groqKeyInput, set: setGroqKeyInput, clear: clearLocalGroqKey, desc: 'High-speed Llama3 inference engine' }
                    ].map((item, i) => (
                      <div key={i} className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">{item.label}</label>
                          <button onClick={item.clear} className="text-[9px] font-black uppercase text-red-400 hover:text-red-600 transition-all tracking-widest">Wipe Data</button>
                        </div>
                        <input
                          type="password"
                          value={item.value}
                          onChange={(e) => item.set(e.target.value)}
                          placeholder={`Enter system key...`}
                          className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-8 py-5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-200"
                        />
                        <p className="text-[10px] text-slate-300 pl-1 font-medium tracking-tight whitespace-nowrap overflow-hidden text-ellipsis italic opacity-70">{item.desc}</p>
                      </div>
                    ))}

                    <button
                      onClick={saveLocalKeys}
                      className="w-full bg-slate-950 text-white rounded-full py-6 font-black uppercase tracking-[0.5em] shadow-2xl shadow-slate-950/40 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all mt-6 text-[11px]"
                    >
                      Integrate DNA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Global History Modal */}
        {
          isHistoryOpen && (
            <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-3xl flex items-center justify-center p-6 animate-fade-in">
              <div className="w-full max-w-4xl bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
                <div className="p-10 md:p-14 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                  <div>
                    <h3 className="text-3xl font-[900] text-slate-900 tracking-tighter mb-2">Neural Archive</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{history.length} Sessions Synchronized</p>
                  </div>
                  <button onClick={() => setIsHistoryOpen(false)} className="w-14 h-14 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center transition-all hover:rotate-90 shadow-sm">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 md:p-14">
                  {history.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Archived Sessions Found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {history.map(item => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setAnalysis(item.data);
                            if (item.refinedQuestions) {
                              setRefinedQuestions(item.refinedQuestions);
                              setState(AppState.COMPLETED);
                            } else {
                              setState(AppState.REVIEWING);
                            }
                            setIsHistoryOpen(false);
                            setViewMode('answer-sheet');
                          }}
                          className="premium-card rounded-[2.5rem] p-8 group relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer border border-slate-100 hover:border-blue-100 active:scale-95 flex flex-col justify-between h-56"
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id, e); }}
                            className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 p-2.5 text-slate-300 hover:text-red-500 bg-slate-50 rounded-full transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full mb-4 inline-block">{new Date(item.timestamp).toLocaleDateString()}</span>
                            <h4 className="font-black text-slate-800 text-lg line-clamp-2 leading-tight tracking-tight mb-2">{item.data.examTitle}</h4>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.data.questions.length} Units</span>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${item.refinedQuestions ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {item.refinedQuestions ? 'Completed' : 'Draft'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
};

export default App;
