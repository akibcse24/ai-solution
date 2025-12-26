
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./src/hooks/use-theme";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Header from "./src/components/Header";
import Sidebar from "./src/components/Sidebar";
import ChatView from "./src/components/ChatView";
import AnsSheetView from "./src/components/AnsSheetView";
import GenerationProgress from "./src/components/GenerationProgress";
import SolutionView from "./src/components/SolutionView";
import FileUpload from "./src/components/FileUpload";

import { analyzeExamPaper, refineAcademicAnswer, generateTechnicalDiagram, generateChatTitle } from './services/geminiService';
import { AppState, ExamAnalysis, ExamQuestion, RefinedQuestion, AnswerPart, HistoryItem } from './types';
import { ChatMessage, ChatService } from './services/chatService';

// Storage Keys
const HISTORY_STORAGE_KEY = 'academic_architect_history_v2';
const STORAGE_PREF_KEY = 'academic_architect_storage_pref_v2';
const LOCAL_GEMINI_KEY_STORAGE = 'gemini_api_key_local_v3';
const LOCAL_OPENROUTER_KEY_STORAGE = 'openrouter_api_key_local_v3';
const LOCAL_GROQ_KEY_STORAGE = 'groq_api_key_local_v3';

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"chatbot" | "anssheet">("chatbot");
  const [sessionKey, setSessionKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Hoist Messages State
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // App State
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [analysis, setAnalysis] = useState<ExamAnalysis | null>(null);
  const [refinedQuestions, setRefinedQuestions] = useState<RefinedQuestion[]>([]);

  // Generation State
  const [currentGenStep, setCurrentGenStep] = useState(0);
  const [totalGenSteps, setTotalGenSteps] = useState(0);

  const [isLoading, setIsLoading] = useState(false); // For analyzing
  const [error, setError] = useState<string | null>(null);

  const [geminiKey, setGeminiKey] = useState<string | null>(null);
  const [openRouterKey, setOpenRouterKey] = useState<string | null>(null);
  const [groqKey, setGroqKey] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load Keys & History
  useEffect(() => {
    // 1. Key Loading with Fallback to .env (Vite)
    const loadKey = (localKey: string, envKey: string, setter: (val: string) => void) => {
      const local = localStorage.getItem(localKey);
      if (local) {
        setter(local);
      } else {
        // Fallback to VITE_ env vars
        const env = import.meta.env[envKey];
        if (env) setter(env);
      }
    };

    loadKey(LOCAL_GEMINI_KEY_STORAGE, 'VITE_GEMINI_API_KEY', setGeminiKey);
    loadKey(LOCAL_OPENROUTER_KEY_STORAGE, 'VITE_OPENROUTER_API_KEY', setOpenRouterKey);
    loadKey(LOCAL_GROQ_KEY_STORAGE, 'VITE_GROQ_API_KEY', setGroqKey);

    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) { console.error("History parse fail", e); }
    }
  }, []);

  // Auto-save Chat History
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Refs to access latest state inside timeouts without dependency loops
  const historyRef = React.useRef(history);
  const currentChatIdRef = React.useRef(currentChatId);
  const messagesRef = React.useRef(messages); // Track latest messages for saving

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    if (messages.length === 0) return;

    const saveToHistory = async () => {
      const currentMessages = messagesRef.current;
      if (currentMessages.length === 0) return;

      let id = currentChatIdRef.current;

      // If no ID, create one and update immediately
      if (!id) {
        id = crypto.randomUUID();
        setCurrentChatId(id); // Trigger state update
        currentChatIdRef.current = id; // Update ref immediately for this cycle
      }

      // Access latest history via ref to avoid stale closure
      const currentHistory = historyRef.current;
      const existingItem = currentHistory.find(h => h.id === id);

      let title = "New Chat";
      if (existingItem?.title && existingItem.title !== "New Chat") {
        title = existingItem.title;
      } else if (currentMessages.length >= 2 && (!existingItem?.title || existingItem.title === "New Chat")) {
        // Generate title using ChatService class directly
        try {
          // Static import is now available at the top
          const svc = new ChatService({ groqKey: groqKey || undefined, openRouterKey: openRouterKey || undefined });
          console.log("Generating title for messages count:", currentMessages.length);
          title = await svc.generateTitle(currentMessages);
          console.log("Generated Title:", title);
        } catch (e) {
          console.error("Failed to load ChatService for title", e);
        }
      }

      const newItem: HistoryItem = {
        id: id!,
        timestamp: existingItem ? existingItem.timestamp : Date.now(),
        data: { examTitle: 'Chat Session', totalMarks: 0, questions: [] }, // Dummy data for chat items
        messages: currentMessages,
        title: title,
        tags: []
      };

      // Functional update is safe for concurrency
      setHistory(prev => {
        const others = prev.filter(h => h.id !== id);
        const next = [newItem, ...others];
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };

    // Debounce save 
    const timeout = setTimeout(saveToHistory, 1000);
    return () => clearTimeout(timeout);

  }, [messages, groqKey, openRouterKey]);

  // --- Generation Logic ---

  const processQuestion = async (q: ExamQuestion): Promise<RefinedQuestion> => {
    // Default to Gemini for refinement for now, or use a setting
    // We can randomize or use the 'fast' model
    const refinedAnswerRaw = await refineAcademicAnswer(q, 'gemini-3-flash-preview', 'gemini');

    // --- CLEANUP & NORMALIZATION ---
    let refinedAnswer = refinedAnswerRaw.replace(/<\s*([bu])\s*>/gi, '<$1>');
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
            refinedAnswer: `<div class="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold">Generation failed for this specific question.</div>`,
            parts: [{ type: 'text', content: `<b style="color:#ef4444">Generation failed for this question.</b>` }],
            isJustified: q.isJustified
          } as RefinedQuestion;
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


  // --- Event Handlers ---

  const handleFileUpload = async (files: { data: string, mimeType: string }[]) => {
    setIsLoading(true);
    setError(null);
    try {
      // FORCE FASTEST MODEL FOR SCANNING/ANALYSIS - using preview as per instruction
      const result = await analyzeExamPaper(files, 'gemini-3-flash-preview');

      result.questions = result.questions.map(q => ({ ...q, enabled: true }));
      setAnalysis(result);
      setState(AppState.REVIEWING);
    } catch (err: any) {
      setError(err?.message || "Analysis failed. Please check your network or API key.");
      setState(AppState.IDLE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!analysis) return;
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      data: analysis,
      timestamp: Date.now(),
      tags: [],
      refinedQuestions: state === AppState.COMPLETED ? refinedQuestions : undefined
    };
    const nextHistory = [newItem, ...history];
    setHistory(nextHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
    alert("Project saved to history");
  };

  const handleUpdateQuestion = (id: string, updated: Partial<ExamQuestion>) => {
    if (!analysis) return;
    const nextQuestions = analysis.questions.map(q => q.id === id ? { ...q, ...updated } : q);
    setAnalysis({ ...analysis, questions: nextQuestions });
  };


  const handleNewChat = () => {
    setAnalysis(null);
    setRefinedQuestions([]);
    setMessages([]);
    setCurrentChatId(null);
    setState(AppState.IDLE);
    setActiveTab("chatbot");
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-accent/20">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onHistoryClick={() => setIsSidebarOpen(!isSidebarOpen)}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        history={history}
        onHistorySelect={(item) => {
          if (item.data && item.data.questions?.length > 0) {
            setAnalysis(item.data);
            if (item.refinedQuestions) {
              setRefinedQuestions(item.refinedQuestions);
              setState(AppState.COMPLETED);
            } else {
              setState(AppState.REVIEWING);
            }
            setActiveTab("anssheet");
          } else if (item.messages) {
            setMessages(item.messages);
            setCurrentChatId(item.id);
            setActiveTab("chatbot");
          }
          setIsSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDeleteHistory={(id) => {
          const nextHistory = history.filter(h => h.id !== id);
          setHistory(nextHistory);
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
        }}
      />

      <main className={`pt-20 sm:pt-24 h-screen transition-all duration-300 ${isSidebarOpen ? "md:pl-72" : "pl-0"}`}>
        {activeTab === "chatbot" ? (
          <ChatView
            groqKey={groqKey || ''}
            openRouterKey={openRouterKey || ''}
            messages={messages}
            setMessages={setMessages}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        ) : (
          <div className="container mx-auto px-4 py-8">
            {error && <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>}

            {state === AppState.IDLE && (
              <FileUpload onFilesSelected={handleFileUpload} isLoading={isLoading} />
            )}

            {state === AppState.ANALYZING && (
              <div className="flex flex-col items-center justify-center p-32 animate-fade-in">
                <div className="w-20 h-20 border-[6px] border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="mt-10 text-slate-500 font-black uppercase text-xs tracking-[0.5em]">Scanning Structural Layout...</p>
              </div>
            )}

            {state === AppState.REVIEWING && analysis && (
              <AnsSheetView
                analysis={analysis}
                onConfirm={startGeneration}
                onSave={handleSaveDraft}
                onUpdateQuestion={handleUpdateQuestion}
              />
            )}

            {state === AppState.GENERATING && (
              <GenerationProgress current={currentGenStep} total={totalGenSteps} />
            )}

            {state === AppState.COMPLETED && analysis && (
              <SolutionView
                refinedQuestions={refinedQuestions}
                examTitle={analysis.examTitle}
                onSave={handleSaveDraft}
                onNewProject={() => setState(AppState.IDLE)}
                onUpdateQuestions={setRefinedQuestions}
              />
            )}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card w-full max-w-md p-6 rounded-3xl border border-border shadow-2xl">
            <h2 className="text-xl font-bold mb-4">API Settings</h2>
            <div className="space-y-4">
              <input
                placeholder="Gemini API Key"
                className="w-full p-2 rounded-lg border border-border bg-secondary"
                value={geminiKey || ''}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
              <input
                placeholder="OpenRouter API Key"
                className="w-full p-2 rounded-lg border border-border bg-secondary"
                value={openRouterKey || ''}
                onChange={(e) => setOpenRouterKey(e.target.value)}
              />
              <input
                placeholder="Groq API Key"
                className="w-full p-2 rounded-lg border border-border bg-secondary"
                value={groqKey || ''}
                onChange={(e) => setGroqKey(e.target.value)}
              />
              <button onClick={() => {
                if (geminiKey) localStorage.setItem(LOCAL_GEMINI_KEY_STORAGE, geminiKey);
                if (openRouterKey) localStorage.setItem(LOCAL_OPENROUTER_KEY_STORAGE, openRouterKey);
                if (groqKey) localStorage.setItem(LOCAL_GROQ_KEY_STORAGE, groqKey);
                setIsSettingsOpen(false);
              }} className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-bold">Save & Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
