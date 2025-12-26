
import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Atom, Code, BookOpen, TrendingUp, Paperclip, Mic, Bot, User } from "lucide-react";
import { ChatService, ChatMessage, ChatMode } from "../../services/chatService";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';


interface ChatViewProps {
    groqKey: string;
    openRouterKey: string;
    onClose?: () => void;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    onSend?: (msg: string) => void;
}

const CHAT_HISTORY_KEY = 'crytonix_chat_history_v1';

const suggestions = [
    {
        title: "Explain Quantum Entanglement like I'm five",
        icon: Atom,
    },
    {
        title: "Write a Python script for a simple web scraper",
        icon: Code,
    },
    {
        title: "How can I improve my academic productivity?",
        icon: BookOpen,
    },
    {
        title: "Summarize the latest trends in Artificial Intelligence",
        icon: TrendingUp,
    },
];

const ChatView: React.FC<ChatViewProps> = ({ groqKey, openRouterKey, messages, setMessages, isLoading, setIsLoading, onSend }) => {

    // Removing internal messages state and isLoading since they are now props
    // const [messages, setMessages] ... 

    const [input, setInput] = useState("");
    const [selectedModel, setSelectedModel] = useState<ChatMode>("pro");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatServiceRef = useRef<ChatService | null>(null);

    // Effect for local storage - REMOVED (Handled by App.tsx)

    useEffect(() => {
        chatServiceRef.current = new ChatService({
            groqKey,
            openRouterKey
        });
    }, [groqKey, openRouterKey]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSuggestionClick = (suggestion: string) => {
        handleSubmit(suggestion);
    };

    const handleSubmit = async (text?: string) => {
        const query = text || input;
        if (!query.trim() || !chatServiceRef.current || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: query };
        // setMessages(prev => [...prev, userMsg]); // Handled by onSend wrapper if needed, or direct
        // Ideally App.tsx handles the stream? No, lets keep stream logic here but update state via prop.

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
            setMessages(prev => [...prev, assistantMsg]);

            const stream = chatServiceRef.current.streamChat([...messages, userMsg], selectedModel);

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

    const MarkdownContent = ({ content }: { content: string }) => {
        return (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p: ({ children }) => <p className="mb-4 last:mb-0 leading-[1.6]">{children}</p>,
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                            <div className="my-4 rounded-lg bg-secondary/50 overflow-hidden border border-border/50">
                                <div className="bg-secondary/80 px-4 py-2 text-xs font-mono text-muted-foreground border-b border-border/50 flex justify-between">
                                    <span>{match ? match[1] : 'code'}</span>
                                </div>
                                <pre className="p-4 overflow-x-auto text-sm font-mono scrollbar-thin">
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                </pre>
                            </div>
                        ) : (
                            <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono text-accent" {...props}>
                                {children}
                            </code>
                        );
                    },
                    ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-accent/50 pl-4 py-1 italic text-muted-foreground my-4">{children}</blockquote>,
                    table: ({ children }) => <div className="overflow-x-auto my-6 rounded-lg border border-border"><table className="w-full">{children}</table></div>,
                    th: ({ children }) => <th className="bg-secondary/50 px-4 py-2 text-left text-xs font-bold uppercase text-muted-foreground border-b border-border">{children}</th>,
                    td: ({ children }) => <td className="px-4 py-2 text-sm border-t border-border/50">{children}</td>,
                }}
            >
                {content}
            </ReactMarkdown>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-40 no-scrollbar">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center animate-fade-in">
                        {/* Main Heading */}
                        <div className="text-center mb-10 max-w-2xl px-2">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight leading-tight">
                                How can I help you today?
                            </h1>
                            <p className="text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed">
                                Your intelligent companion for solving complex questions,
                                <br className="hidden sm:block" />
                                architecting code, and mastering academics.
                            </p>
                        </div>

                        {/* Suggestions Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-3xl px-2">
                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion.title)}
                                    className="suggestion-card group"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 group-hover:scale-110 transition-all duration-300">
                                            <suggestion.icon className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                        </div>
                                        <p className="text-xs sm:text-sm text-foreground leading-relaxed pt-1">
                                            {suggestion.title}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto space-y-6">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-4 animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Bot className="w-5 h-5 text-primary" />
                                    </div>
                                )}
                                <div className={`rounded-2xl p-4 sm:p-6 max-w-[85%] sm:max-w-[75%] ${msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                    : 'bg-card border border-border/50 shadow-sm rounded-tl-sm'
                                    }`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                                            <MarkdownContent content={msg.content} />
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-1">
                                        <User className="w-5 h-5 text-accent" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-4 animate-fade-in">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                    <Bot className="w-5 h-5 text-primary" />
                                </div>
                                <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-1.5 shadow-sm">
                                    <div className="w-2 h-2 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent pt-12 z-20">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-card/80 backdrop-blur-xl border border-accent/20 rounded-2xl sm:rounded-3xl p-2 sm:p-3 shadow-[0_0_30px_rgba(59,130,246,0.1)] hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] transition-all duration-300">
                        {/* Model Selector */}
                        <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-1 mb-2 w-fit">
                            {(["pro", "flash", "uncensored"] as ChatMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setSelectedModel(mode)}
                                    className={`model-pill text-[10px] sm:text-xs px-3 py-1.5 capitalize ${selectedModel === mode ? "model-pill-active" : "model-pill-inactive"
                                        }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all" title="Attach file">
                                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>

                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit();
                                    }
                                }}
                                placeholder="Ask your question..."
                                disabled={isLoading}
                                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm sm:text-base px-2"
                            />

                            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all" title="Voice input">
                                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>

                            <button
                                onClick={() => handleSubmit()}
                                disabled={isLoading || !input.trim()}
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${input.trim()
                                    ? "bg-accent text-accent-foreground hover:scale-105 shadow-md"
                                    : "bg-secondary text-muted-foreground"
                                    }`}
                            >
                                <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-[10px] text-muted-foreground/60 mt-3">
                        AI can make mistakes. Check important info.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatView;
