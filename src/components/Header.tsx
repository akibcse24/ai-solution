import { MessageSquare, FileText, Moon, Sun, Clock, Settings, Menu, X } from "lucide-react";
import { useTheme } from "../hooks/use-theme";
import { useState } from "react";

interface HeaderProps {
    activeTab: "chatbot" | "anssheet";
    onTabChange: (tab: "chatbot" | "anssheet") => void;
    onHistoryClick: () => void;
    onSettingsClick: () => void;
}

const Header = ({
    activeTab,
    onTabChange,
    onHistoryClick,
    onSettingsClick
}: HeaderProps) => {
    const {
        theme,
        toggleTheme
    } = useTheme();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    return <header className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 w-[96%] sm:w-[95%] max-w-5xl">
        <div className="header-container flex items-center justify-between gap-2">
            {/* Logo */}
            <span className="text-lg sm:text-xl font-bold text-foreground tracking-tight whitespace-nowrap">
                Crytonix<span className="text-accent">.</span>
            </span>

            {/* Tabs - Hidden on mobile, shown on sm+ */}
            <div className="hidden sm:flex items-center bg-secondary rounded-full p-1">
                <button onClick={() => onTabChange("chatbot")} className={`nav-pill flex items-center gap-1.5 sm:gap-2 ${activeTab === "chatbot" ? "nav-pill-active" : "nav-pill-inactive"}`}>
                    <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">Chatbot</span>
                </button>
                <button onClick={() => onTabChange("anssheet")} className={`nav-pill flex items-center gap-1.5 sm:gap-2 ${activeTab === "anssheet" ? "nav-pill-active" : "nav-pill-inactive"}`}>
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">Ans Sheet</span>
                </button>
            </div>

            {/* Navigation Links - Hidden on mobile */}
            <nav className="hidden lg:flex items-center gap-6">

                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Contact
                </a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
                <button onClick={toggleTheme} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all" aria-label="Toggle theme">
                    {theme === "dark" ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
                <button onClick={onHistoryClick} className="hidden sm:flex p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all items-center gap-1.5">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden md:inline text-sm">History</span>
                </button>
                <button onClick={onSettingsClick} className="hidden sm:flex nav-pill nav-pill-active items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">Settings</span>
                </button>

                {/* Mobile menu toggle */}
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors">
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && <div className="sm:hidden mt-2 bg-card border border-border rounded-2xl p-4 shadow-lg animate-fade-in">
            <div className="flex flex-col gap-3">
                {/* Mobile Tabs */}
                <div className="flex items-center bg-secondary rounded-full p-1">
                    <button
                        onClick={() => { onTabChange("chatbot"); setMobileMenuOpen(false); }}
                        className={`nav-pill flex-1 flex items-center justify-center gap-2 ${activeTab === "chatbot" ? "nav-pill-active" : "nav-pill-inactive"}`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Chatbot
                    </button>
                    <button
                        onClick={() => { onTabChange("anssheet"); setMobileMenuOpen(false); }}
                        className={`nav-pill flex-1 flex items-center justify-center gap-2 ${activeTab === "anssheet" ? "nav-pill-active" : "nav-pill-inactive"}`}
                    >
                        <FileText className="w-4 h-4" />
                        Ans Sheet
                    </button>
                </div>

                {/* Mobile nav links */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <a href="#" className="py-2 text-sm text-muted-foreground hover:text-foreground">Features</a>
                    <a href="#" className="py-2 text-sm text-muted-foreground hover:text-foreground">Support</a>
                    <a href="#" className="py-2 text-sm text-muted-foreground hover:text-foreground">Contact</a>
                </div>

                {/* Mobile actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <button onClick={() => { onHistoryClick(); setMobileMenuOpen(false); }} className="flex-1 py-2 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-secondary rounded-lg">
                        <Clock className="w-4 h-4" />
                        History
                    </button>
                    <button onClick={() => { onSettingsClick(); setMobileMenuOpen(false); }} className="flex-1 py-2 flex items-center justify-center gap-2 text-sm bg-primary text-primary-foreground rounded-lg">
                        <Settings className="w-4 h-4" />
                        Settings
                    </button>
                </div>
            </div>
        </div>}
    </header>;
};
export default Header;
