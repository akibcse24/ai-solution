import React, { useState, useRef, useEffect } from 'react';
import { ChatService, ChatMessage, ChatMode } from '../services/chatService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

interface ChatInterfaceProps {
    groqKey: string;
    openRouterKey: string;
    onClose?: () => void;
}

const CHAT_HISTORY_KEY = 'crytonix_chat_history_v1';

const SuggestedPrompts = ({ onSelect }: { onSelect: (text: string) => void }) => {
    const prompts = [
        "Explain Quantum Entanglement like I'm five",
        "Write a Python script for a simple web scraper",
        "How can I improve my academic productivity?",
        "Summarize the latest trends in Artificial Intelligence"
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl px-6 animate-fade-in text-center">
            {prompts.map((prompt, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(prompt)}
                    className="premium-card p-8 text-left rounded-[2.5rem] hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden transition-all duration-300"
                >
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <p className="text-[15px] font-bold text-slate-700 dark:text-slate-200 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{prompt}</p>
                    <div className="mt-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 duration-300">
                        <span className="text-[9px] font-black uppercase text-blue-500 tracking-[0.2em]">Launch Query</span>
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </div>
                </button>
            ))}
        </div>
    );
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ groqKey, openRouterKey, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(CHAT_HISTORY_KEY);
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<ChatMode>('pro');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatServiceRef = useRef<ChatService | null>(null);

    useEffect(() => {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        chatServiceRef.current = new ChatService({
            groqKey,
            openRouterKey
        });
    }, [groqKey, openRouterKey]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (text?: string) => {
        const query = text || input;
        if (!query.trim() || !chatServiceRef.current || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: query };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
            setMessages(prev => [...prev, assistantMsg]);

            const stream = chatServiceRef.current.streamChat([...messages, userMsg], mode);

            let fullContent = '';
            for await (const chunk of stream) {
                fullContent += chunk;
                setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: fullContent };
                    return newMsgs;
                });
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'system', content: `Error: ${error instanceof Error ? error.message : 'Failed to connect'}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        if (confirm("Clear all messages?")) {
            setMessages([]);
            localStorage.removeItem(CHAT_HISTORY_KEY);
        }
    };

    const MarkdownContent = ({ content }: { content: string }) => {
        return (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        const [copied, setCopied] = useState(false);

                        const handleCopy = () => {
                            navigator.clipboard.writeText(codeString);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        };

                        return !inline ? (
                            <div className="my-6 rounded-3xl border border-slate-200 bg-slate-900 overflow-hidden shadow-2xl group flex flex-col">
                                <div className="bg-white/5 px-6 py-3 border-b border-white/5 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{match ? match[1] : 'code'}</span>
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-widest">{copied ? 'Copied' : 'Copy'}</span>
                                        {copied ? (
                                            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                        )}
                                    </button>
                                </div>
                                <pre className="p-6 overflow-x-auto text-[13px] font-mono text-blue-50/90 leading-relaxed scrollbar-thin scrollbar-white/10">
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                </pre>
                            </div>
                        ) : (
                            <code className="bg-slate-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-lg text-[0.85em]" {...props}>
                                {children}
                            </code>
                        );
                    },
                    p: ({ children }) => <p className="mb-6 last:mb-0 leading-[1.8] text-[15px] text-slate-700 dark:text-slate-300">{children}</p>,
                    h1: ({ children }) => <h1 className="text-2xl font-black mb-6 text-slate-900 dark:text-white tracking-tight">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-black mb-5 text-slate-800 dark:text-slate-100 tracking-tight">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200 tracking-tight">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700 dark:text-slate-300">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 mb-6 space-y-2 text-slate-700 dark:text-slate-300">{children}</ol>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-6 py-2 italic text-slate-600 dark:text-slate-400 mb-6 bg-blue-50/50 dark:bg-blue-900/20 rounded-r-2xl">{children}</blockquote>,
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <table className="w-full text-left border-collapse">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">{children}</thead>,
                    th: ({ children }) => <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{children}</th>,
                    td: ({ children }) => <td className="px-6 py-4 text-sm border-t border-slate-50 dark:border-slate-800 text-slate-600 dark:text-slate-300">{children}</td>,
                }}
            >
                {content}
            </ReactMarkdown>
        );
    };

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden px-4">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto space-y-12 no-scrollbar pb-40 pt-10">
                {messages.length === 0 && (
                    <div className="min-h-[70vh] flex flex-col items-center justify-center -mt-20">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-6 text-center">How can I help you today?</h2>
                        <p className="text-slate-400 dark:text-slate-500 text-sm md:text-base font-medium tracking-wide mb-16 text-center max-w-lg leading-relaxed">Your intelligent companion for solving complex questions, architecting code, and mastering academics.</p>
                        <SuggestedPrompts onSelect={(text) => handleSubmit(text)} />
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex w-full animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-start gap-4 max-w-[90%] md:max-w-[80%]">
                            {msg.role === 'assistant' && (
                                <div className="w-10 h-10 rounded-2xl bg-slate-950 flex-shrink-0 flex items-center justify-center mt-1 shadow-lg shadow-slate-900/10">
                                    <span className="text-white text-[10px] font-black tracking-tighter">CX</span>
                                </div>
                            )}
                            <div className={`rounded-3xl p-6 lg:p-8 transition-all duration-500 ${msg.role === 'user'
                                ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20 rounded-tr-none ring-1 ring-white/10'
                                : msg.role === 'system'
                                    ? 'bg-red-50 text-red-600 w-full text-center border border-red-100 font-bold uppercase tracking-widest text-[10px]'
                                    : 'bg-white border border-slate-100 text-slate-700 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.03)] rounded-tl-none'
                                }`}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-slate max-w-none">
                                        <MarkdownContent content={msg.content} />
                                    </div>
                                ) : (
                                    <p className="leading-relaxed whitespace-pre-wrap font-medium text-[15px]">{msg.content}</p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-fade-in pl-14">
                        <div className="bg-white border border-slate-100 rounded-2xl px-5 py-3 shadow-sm flex gap-1.5">
                            {[0, 150, 300].map((delay) => (
                                <div key={delay} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                            ))}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Floating Input Area */}
            <div className="fixed bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/90 dark:via-slate-950/90 to-transparent pointer-events-none z-[90]"></div>
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[95%] max-w-[850px] z-[100]">
                <div className="relative premium-card dark:bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] p-3 flex flex-col gap-3 group transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 ring-8 ring-white/50 dark:ring-slate-900/50 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.15)] pointer-events-auto border border-white/20 dark:border-white/5">
                    {/* Top Options Bar */}
                    <div className="flex items-center justify-between px-3 pt-1">
                        <div className="flex bg-slate-50 dark:bg-slate-950/50 p-1 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                            {(['pro', 'flash', 'uncensored'] as ChatMode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-100 dark:ring-slate-700' : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'
                                        }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-100/50 dark:border-emerald-500/20">
                                {openRouterKey ? 'Neural Active' : 'Native Exp'}
                            </span>
                            <button
                                onClick={clearChat}
                                className="p-2 text-slate-300 dark:text-slate-700 hover:text-red-500 transition-all rounded-full hover:bg-red-50 dark:hover:bg-red-500/10"
                                title="Purge Context"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Input Field */}
                    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex items-center gap-4 bg-slate-50/50 dark:bg-slate-950/50 rounded-3xl p-2 focus-within:bg-white dark:focus-within:bg-slate-950 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30 transition-all border border-transparent focus-within:border-blue-200 dark:focus-within:border-blue-800/50">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={`Message CX-${mode.toUpperCase()}...`}
                            className="flex-1 bg-transparent border-none outline-none text-[15px] font-medium text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 px-6 py-2"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="w-14 h-14 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-[1.2rem] shadow-2xl disabled:opacity-30 disabled:shadow-none hover:bg-black dark:hover:bg-slate-200 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center shrink-0"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
