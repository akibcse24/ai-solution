
import React, { useState, useEffect, useRef } from 'react';
import { AppState, ExamAnalysis, ExamQuestion, RefinedQuestion, AnswerPart, HistoryItem } from './types';
import { analyzeExamPaper, refineAcademicAnswer, generateTechnicalDiagram } from './services/geminiService';
import FileUpload from './components/FileUpload';
import AnalysisView from './components/AnalysisView';
import GenerationProgress from './components/GenerationProgress';
import katex from 'katex';

const DRAFT_STORAGE_KEY = 'academic_architect_autosave_v2';
const HISTORY_STORAGE_KEY = 'academic_architect_history_v1';
const STORAGE_PREF_KEY = 'academic_architect_storage_pref_v1';
const LOCAL_GEMINI_KEY_STORAGE = 'gemini_api_key_local';
const LOCAL_OPENROUTER_KEY_STORAGE = 'openrouter_api_key_local';

const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fastest)', provider: 'gemini' as const },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Reasoning)', provider: 'gemini' as const },
  { id: 'gemini-2.5-flash-latest', name: 'Gemini 2.5 Flash', provider: 'gemini' as const },
  { id: 'gemini-2.5-pro-latest', name: 'Gemini 2.5 Pro', provider: 'gemini' as const },
  { id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', name: 'Dolphin Mistral 24B Venice (Free)', provider: 'openrouter' as const },
  { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (Free)', provider: 'openrouter' as const },
];

// Cookie Helper Functions
const setCookie = (name: string, value: string, days: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
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

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [analysis, setAnalysis] = useState<ExamAnalysis | null>(null);
  const [refinedQuestions, setRefinedQuestions] = useState<RefinedQuestion[]>([]);
  const [currentGenStep, setCurrentGenStep] = useState(0);
  const [totalGenSteps, setTotalGenSteps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [immersivePageIndex, setImmersivePageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [storageType, setStorageType] = useState<'local' | 'cookie'>('local');
  const [selectedModel, setSelectedModel] = useState<string>(
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free'
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [openRouterKeyInput, setOpenRouterKeyInput] = useState('');
  const [savedGeminiKey, setSavedGeminiKey] = useState<string | null>(null);
  const [savedOpenRouterKey, setSavedOpenRouterKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Load History on Mount from both sources
  useEffect(() => {
    try {
      const local = localStorage.getItem(HISTORY_STORAGE_KEY);
      const cookie = getCookie(HISTORY_STORAGE_KEY);
      const pref = localStorage.getItem(STORAGE_PREF_KEY) as 'local' | 'cookie' | null;

      let items: HistoryItem[] = [];
      if (local) items = [...items, ...JSON.parse(local)];
      if (cookie) {
        try {
          const cookieItems = JSON.parse(cookie);
          const existingIds = new Set(items.map(i => i.id));
          cookieItems.forEach((i: HistoryItem) => {
            if (!existingIds.has(i.id)) items.push(i);
          });
        } catch (e) { console.error("Cookie parse error", e); }
      }

      // Sort by timestamp desc
      items.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(items);
      if (pref) {
        setStorageType(pref);
      } else if (!local && cookie) {
        setStorageType('cookie');
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_PREF_KEY, storageType);
  }, [storageType]);

  useEffect(() => {
    try {
      const storedGeminiKey = localStorage.getItem(LOCAL_GEMINI_KEY_STORAGE);
      if (storedGeminiKey) {
        setSavedGeminiKey(storedGeminiKey);
        setGeminiKeyInput(storedGeminiKey);
      }
      const storedOpenRouterKey = localStorage.getItem(LOCAL_OPENROUTER_KEY_STORAGE);
      if (storedOpenRouterKey) {
        setSavedOpenRouterKey(storedOpenRouterKey);
        setOpenRouterKeyInput(storedOpenRouterKey);
      }
    } catch (e) {
      console.error("Failed to load local API key", e);
    }
  }, []);

  // Auto-save draft logic
  useEffect(() => {
    if (analysis) {
      const saveObject = {
        title: analysis.examTitle,
        questions: analysis.questions.map(q => ({
          id: q.id,
          suggestedAnswer: q.suggestedAnswer,
          diagramRequired: q.diagramRequired,
          diagramDescription: q.diagramDescription,
          isJustified: q.isJustified,
          enabled: q.enabled,
          marks: q.marks
        }))
      };
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(saveObject));
      } catch (e) {
        console.error("Draft save failed", e);
      }
    }
  }, [analysis]);

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

  const persistHistory = (items: HistoryItem[], target: 'local' | 'cookie') => {
    const json = JSON.stringify(items);
    if (target === 'cookie') {
      if (new Blob([json]).size > 4000) {
        alert("Warning: History data exceeds Cookie size limit (4KB). Saving to Local Storage instead.");
        setStorageType('local');
        localStorage.setItem(HISTORY_STORAGE_KEY, json);
        setCookie(HISTORY_STORAGE_KEY, "", -1);
        return 'local';
      }
      setCookie(HISTORY_STORAGE_KEY, json, 30);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      return 'cookie';
    }
    localStorage.setItem(HISTORY_STORAGE_KEY, json);
    setCookie(HISTORY_STORAGE_KEY, "", -1);
    return 'local';
  };

  const saveToHistory = () => {
    if (!analysis) return;

    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      data: analysis,
      refinedQuestions: state === AppState.COMPLETED ? refinedQuestions : undefined,
      tags: []
    };

    try {
      let actualStore: 'local' | 'cookie' = storageType;
      setHistory(prev => {
        const updatedHistory = [newItem, ...prev];
        actualStore = persistHistory(updatedHistory, storageType);
        return updatedHistory;
      });
      alert(actualStore === 'cookie' ? "Project saved to Cookies!" : "Project saved to Local Storage!");
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        alert("Storage Full: Could not save project. Try deleting old history items or clearing space.");
      } else {
        console.error(e);
        alert("Failed to save project.");
      }
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const updatedHistory = prev.filter(item => item.id !== id);
      persistHistory(updatedHistory, storageType);
      return updatedHistory;
    });
  };

  const updateHistoryTags = (id: string, tags: string[]) => {
    setHistory(prev => {
      const updatedHistory = prev.map(item => item.id === id ? { ...item, tags } : item);
      persistHistory(updatedHistory, storageType);
      return updatedHistory;
    });
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setAnalysis(item.data);
    if (item.refinedQuestions && item.refinedQuestions.length > 0) {
      setRefinedQuestions(item.refinedQuestions);
      setState(AppState.COMPLETED);
    } else {
      setRefinedQuestions([]);
      setState(AppState.REVIEWING);
    }
  };

  const handleFilesSelected = async (files: { data: string, mimeType: string }[]) => {
    setState(AppState.ANALYZING);
    setError(null);
    try {
      // FORCE FASTEST MODEL FOR SCANNING/ANALYSIS
      const result = await analyzeExamPaper(files, 'gemini-3-flash-preview');

      result.questions = result.questions.map(q => ({ ...q, enabled: true }));

      const savedData = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.title === result.examTitle) {
            result.questions = result.questions.map(q => {
              const matched = parsed.questions.find((sq: any) => sq.id === q.id);
              return matched ? { ...q, ...matched } : q;
            });
          }
        } catch (err) {
          console.error("Restoration failed", err);
        }
      }

      setAnalysis(result);
      setState(AppState.REVIEWING);
    } catch (err: any) {
      setError(err?.message || "Analysis failed. Please check your network or API key.");
      setState(AppState.IDLE);
    }
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
            parts: [{ type: 'text', content: `<b style="color:#ef4444">Generation failed for this question.</b>` }],
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

  const saveLocalKeys = () => {
    const geminiTrimmed = geminiKeyInput.trim();
    const openRouterTrimmed = openRouterKeyInput.trim();
    if (geminiTrimmed) {
      localStorage.setItem(LOCAL_GEMINI_KEY_STORAGE, geminiTrimmed);
      setSavedGeminiKey(geminiTrimmed);
    }
    if (openRouterTrimmed) {
      localStorage.setItem(LOCAL_OPENROUTER_KEY_STORAGE, openRouterTrimmed);
      setSavedOpenRouterKey(openRouterTrimmed);
    }
    setIsSettingsOpen(false);
  };

  const clearLocalGeminiKey = () => {
    localStorage.removeItem(LOCAL_GEMINI_KEY_STORAGE);
    setSavedGeminiKey(null);
    setGeminiKeyInput('');
  };

  const clearLocalOpenRouterKey = () => {
    localStorage.removeItem(LOCAL_OPENROUTER_KEY_STORAGE);
    setSavedOpenRouterKey(null);
    setOpenRouterKeyInput('');
  };

  const handleExportPDF = async () => {
    if (refinedQuestions.length === 0) return;
    setIsExporting(true);
    const element = exportContainerRef.current;
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

  const renderPart = (part: AnswerPart, index: number) => {
    switch (part.type) {
      case 'math':
        try {
          // Double cleanup for nested tags that might have slipped through
          const cleanContent = part.content.replace(/\[\[MATH\]\]/g, '').replace(/\[\[\/MATH\]\]/g, '');

          // Heuristic: Use display mode (larger, centered) for fractions, integrals, sums, or long equations
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
          // For drag and drop, we need the original index from the main array
          // If immersive/filtered, we use qIdx as index which might be wrong, but DnD is usually disabled in immersive mode.
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
              {/* Drag Handle - Visible on hover only when not in immersive mode */}
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

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-10 md:py-12 flex flex-col min-h-screen">
      <header className="text-center mb-12 md:mb-16 no-print animate-fade-in">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="order-2 md:order-1 px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] shadow-sm hover:bg-slate-50 transition-all"
          >
            Settings
          </button>
          <h1 className="order-1 md:order-2 text-4xl md:text-7xl font-black text-slate-900 tracking-tighter cursor-pointer" onClick={() => setState(AppState.IDLE)}>
            Academic <span className="text-blue-600">Architect</span>
          </h1>
        </div>
        <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[9px] md:text-[11px] mt-4 opacity-70">Hifi Solution Scans</p>
        {(savedGeminiKey || savedOpenRouterKey) && (
          <p className="mt-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
            {savedGeminiKey ? `${savedGeminiKey.split(/[,\n]/).filter(k => k.trim()).length} Gemini Key(s)` : ''}
            {savedGeminiKey && savedOpenRouterKey ? ' • ' : ''}
            {savedOpenRouterKey ? `${savedOpenRouterKey.split(/[,\n]/).filter(k => k.trim()).length} OpenRouter Key(s)` : ''}
          </p>
        )}
      </header>

      <main className="flex-grow">
        {error && <div className="mb-10 p-6 bg-red-50 text-red-700 rounded-3xl font-bold border border-red-100 shadow-xl">{error}</div>}

        {state === AppState.IDLE && (
          <div className="max-w-5xl mx-auto space-y-16">
            <FileUpload onFilesSelected={handleFilesSelected} isLoading={false} />

            {history.length > 0 && (
              <div className="animate-fade-in">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 px-2 gap-6">
                  <div className="flex items-center gap-4 flex-grow">
                    <div className="h-px bg-slate-200 flex-grow"></div>
                    <h3 className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs whitespace-nowrap">Project History</h3>
                    <div className="h-px bg-slate-200 flex-grow"></div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Model:</span>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-[9px] font-black uppercase tracking-widest bg-transparent text-blue-600 focus:outline-none cursor-pointer"
                      >
                        {AVAILABLE_MODELS.map(m => (
                          <option key={m.id} value={m.id}>{m.name} • {m.provider === 'openrouter' ? 'OpenRouter' : 'Gemini'}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Storage:</span>
                      <select
                        value={storageType}
                        onChange={(e) => setStorageType(e.target.value as 'local' | 'cookie')}
                        className="text-[9px] font-black uppercase tracking-widest bg-transparent text-blue-600 focus:outline-none cursor-pointer"
                      >
                        <option value="local">Local Storage</option>
                        <option value="cookie">Cookies (Limited)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mb-6 px-2">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects or tags..."
                    className="w-full md:w-96 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {history
                    .filter(item => {
                      const query = searchQuery.trim().toLowerCase();
                      if (!query) return true;
                      const titleMatch = item.data.examTitle.toLowerCase().includes(query);
                      const tagMatch = (item.tags || []).some(tag => tag.toLowerCase().includes(query));
                      return titleMatch || tagMatch;
                    })
                    .map(item => (
                      <div
                        key={item.id}
                        onClick={() => loadHistoryItem(item)}
                        className={`group bg-white rounded-[2rem] border p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden ${item.refinedQuestions ? 'border-green-200 hover:border-green-400' : 'border-slate-200 hover:border-blue-300'}`}
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            onClick={(e) => deleteHistoryItem(item.id, e)}
                            className="p-2 bg-red-50 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${item.refinedQuestions ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                            {item.data.questions.length}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</p>
                            <p className="text-[10px] text-slate-300 font-medium">{new Date(item.timestamp).toLocaleTimeString()}</p>
                          </div>
                          {item.refinedQuestions && (
                            <div className="ml-auto">
                              <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded uppercase tracking-wider">Done</span>
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-800 text-lg leading-tight mb-2 line-clamp-2 min-h-[3rem]">{item.data.examTitle}</h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {(item.tags || []).map(tag => (
                            <button
                              key={tag}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateHistoryTags(item.id, (item.tags || []).filter(t => t !== tag));
                              }}
                              className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Remove tag"
                            >
                              {tag} ×
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                          <input
                            value={tagInputs[item.id] || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setTagInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Add tag"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const raw = (tagInputs[item.id] || '').trim();
                              if (!raw) return;
                              const nextTags = Array.from(new Set([...(item.tags || []), raw]));
                              updateHistoryTags(item.id, nextTags);
                              setTagInputs(prev => ({ ...prev, [item.id]: '' }));
                            }}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{item.data.totalMarks} Marks</span>
                          <span className={`text-[10px] font-black uppercase tracking-widest group-hover:underline decoration-2 underline-offset-4 ${item.refinedQuestions ? 'text-green-600' : 'text-blue-600'}`}>
                            {item.refinedQuestions ? 'View Solution' : 'Resume'} &rarr;
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {state === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center p-32 animate-fade-in">
            <div className="w-20 h-20 border-[6px] border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-10 text-slate-500 font-black uppercase text-xs tracking-[0.5em]">Scanning Structural Layout...</p>
          </div>
        )}

        {state === AppState.REVIEWING && analysis && (
          <AnalysisView
            analysis={analysis}
            onConfirm={startGeneration}
            onSave={saveToHistory}
            onUpdateQuestion={(id, upd) => setAnalysis({ ...analysis, questions: analysis.questions.map(q => q.id === id ? { ...q, ...upd } : q) })}
          />
        )}

        {state === AppState.GENERATING && (
          <GenerationProgress current={currentGenStep} total={totalGenSteps} />
        )}

        {state === AppState.COMPLETED && (
          <div className="space-y-12 md:space-y-16 animate-fade-in pb-24 md:pb-32">
            <div className="flex flex-col md:flex-row items-center justify-between bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-2xl no-print gap-6 md:gap-10">
              <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight text-center md:text-left">Solution Matrix Finalized</h2>
              <div className="flex flex-wrap gap-5 justify-center">
                <button onClick={saveToHistory} className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-[2rem] font-black text-[11px] uppercase tracking-widest border border-slate-200 transition-all flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  Save Project
                </button>
                <button onClick={() => setIsImmersiveMode(true)} className="px-8 py-3 md:py-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-[2rem] font-black text-[10px] md:text-[11px] uppercase tracking-widest border transition-all">Immersive View</button>
                <button onClick={handleExportPDF} disabled={isExporting} className="px-10 md:px-12 py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] md:text-[11px] uppercase tracking-widest rounded-[2rem] shadow-[0_15px_30px_rgba(37,99,235,0.3)] transition-all">{isExporting ? 'Exporting...' : 'Save A3 PDF'}</button>
                <button onClick={() => setState(AppState.IDLE)} className="px-9 md:px-10 py-3 md:py-4 bg-slate-900 hover:bg-black text-white font-black text-[10px] md:text-[11px] uppercase tracking-widest rounded-[2rem] transition-all">New Project</button>
              </div>
            </div>
            <div className="hidden"><div ref={exportContainerRef}>{renderPages()}</div></div>
            <div className="w-full flex justify-center overflow-visible">{renderPages()}</div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in no-print">
          <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Settings</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">Local Gemini Key</p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
              >
                Close
              </button>
            </div>
            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Gemini API Key(s)</label>
                <textarea
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder="Paste your Gemini API keys (separate with commas or newlines for random rotation)"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                />
                <p className="text-[11px] text-slate-400">
                  Used for analysis and diagram generation. Supports multiple keys for random rotation. Stored locally in your browser.
                </p>
                <button
                  onClick={clearLocalGeminiKey}
                  className="px-6 py-2 bg-white text-slate-600 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all"
                >
                  Clear Gemini Key
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">OpenRouter API Key(s)</label>
                <textarea
                  value={openRouterKeyInput}
                  onChange={(e) => setOpenRouterKeyInput(e.target.value)}
                  placeholder="Paste your OpenRouter API keys (separate with commas or newlines for random rotation)"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                />
                <p className="text-[11px] text-slate-400">
                  Used for OpenRouter models. Supports multiple keys for random rotation. Stored locally in your browser.
                </p>
                <button
                  onClick={clearLocalOpenRouterKey}
                  className="px-6 py-2 bg-white text-slate-600 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all"
                >
                  Clear OpenRouter Key
                </button>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4">
                <button
                  onClick={saveLocalKeys}
                  className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-lg hover:bg-blue-700 transition-all"
                >
                  Save Keys
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isImmersiveMode && (
        <div className="fixed inset-0 z-[100] bg-slate-950/99 backdrop-blur-3xl animate-fade-in flex flex-col items-center overflow-auto no-print immersive-scroller">
          <div className="sticky top-6 w-[92%] z-[110] mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/10 backdrop-blur-2xl p-5 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
            <div className="flex items-center bg-white/5 p-2 rounded-[2rem] border border-white/5">
              <button onClick={() => setImmersivePageIndex(prev => Math.max(0, prev - 1))} className="p-3 md:p-4 text-white hover:text-blue-400 transition-colors">Prev</button>
              <span className="px-6 md:px-10 text-lg md:text-2xl font-black text-blue-400 tabular-nums">{immersivePageIndex + 1} / {refinedQuestions.length}</span>
              <button onClick={() => setImmersivePageIndex(prev => Math.min(refinedQuestions.length - 1, prev + 1))} className="p-3 md:p-4 text-white hover:text-blue-400 transition-colors">Next</button>
            </div>
            <button onClick={() => setIsImmersiveMode(false)} className="px-8 md:px-12 py-3 md:py-4 bg-red-500 hover:bg-red-600 text-white rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-[0.3em] shadow-xl transition-all">Close Viewer</button>
          </div>
          <div className="w-full flex justify-center px-4 md:px-10 pb-24 md:pb-40">{renderPages(true, immersivePageIndex)}</div>
        </div>
      )}
    </div>
  );
};

export default App;
