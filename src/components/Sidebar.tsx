import { Plus, PanelLeftClose, PanelLeft, Clock, X } from "lucide-react";
import { HistoryItem } from "../../types"; // Importing from global types in root (since we will place this in src/components, relative path is ../../types)

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    history: HistoryItem[];
    onHistorySelect: (item: HistoryItem) => void;
    onNewChat: () => void;
    onDeleteHistory: (id: string) => void;
}

const Sidebar = ({ isOpen, onToggle, history, onHistorySelect, onNewChat, onDeleteHistory }: SidebarProps) => {
    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30 lg:hidden"
                    onClick={onToggle}
                />
            )}

            {/* Toggle button - always visible */}
            <button
                onClick={onToggle}
                className={`fixed z-50 top-20 sm:top-24 p-2 bg-card border border-border rounded-r-xl shadow-md hover:bg-secondary hover:scale-105 transition-all duration-300 ${isOpen ? "left-64 sm:left-72" : "left-0"
                    }`}
                aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
            >
                {isOpen ? (
                    <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <PanelLeft className="w-4 h-4 text-muted-foreground" />
                )}
            </button>

            <aside
                className={`fixed left-0 top-16 sm:top-20 h-[calc(100%-4rem)] sm:h-[calc(100%-5rem)] bg-card border-r border-border z-40 transition-all duration-300 ease-out rounded-tr-2xl ${isOpen ? "w-64 sm:w-72 translate-x-0" : "-translate-x-full w-64 sm:w-72"
                    }`}
            >
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="p-4 pt-6 flex items-center justify-between border-b border-border">
                        <h2 className="text-base sm:text-lg font-semibold text-foreground">Chat History</h2>
                        <button
                            onClick={onNewChat}
                            className="p-2 hover:bg-secondary rounded-lg transition-colors text-accent"
                            title="New Chat"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-muted-foreground text-sm h-full opacity-60">
                                <Clock className="w-8 h-8 mb-2" />
                                <span>No chat history yet</span>
                            </div>
                        ) : (
                            history.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => onHistorySelect(item)}
                                    className="p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary hover:border-accent/50 cursor-pointer transition-all group relative pr-8"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{new Date(item.timestamp).toLocaleDateString()}</span>
                                        {item.refinedQuestions && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Completed"></span>}
                                    </div>
                                    <h4 className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-accent transition-colors">
                                        {item.title || item.data?.examTitle || "Untitled Session"}
                                    </h4>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteHistory(item.id); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
                                        title="Delete"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
