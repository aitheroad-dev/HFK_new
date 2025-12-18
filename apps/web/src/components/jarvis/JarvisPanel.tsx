import { useState, useRef, useEffect } from "react";
import { X, Send, Layers, Wifi, WifiOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useJarvis } from "@/hooks/useJarvis";

interface JarvisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function JarvisPanel({ isOpen, onClose, className }: JarvisPanelProps) {
  const { messages, isConnected, isLoading, sendMessage, clearHistory } = useJarvis();
  const [inputValue, setInputValue] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change - scroll container, not page
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  if (!isOpen) return null;

  return (
    <aside
      className={cn(
        "w-[22rem] bg-card border-r border-border transition-all duration-200",
        "flex flex-col h-full",
        className
      )}
    >
      {/* Header - fixed at top */}
      <div className="shrink-0 p-4 border-b border-border flex items-center gap-3 jarvis-gradient-subtle bg-card">
        <div className="w-9 h-9 jarvis-gradient rounded-md flex items-center justify-center text-white">
          <Layers className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-primary">JARVIS</div>
          <div className="flex items-center gap-1.5 text-xs">
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3 text-accent" />
                <span className="text-accent">מחובר</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-destructive" />
                <span className="text-destructive">מנותק</span>
              </>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearHistory}
          className="text-muted-foreground hover:text-foreground"
          title="נקה שיחה"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Chat Messages - scrollable area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[90%] p-3 px-4 rounded-lg text-sm leading-relaxed",
              message.role === "assistant"
                ? "bg-muted self-start rounded-bl-sm"
                : "jarvis-gradient text-white self-end rounded-br-sm",
              message.isLoading && "animate-pulse"
            )}
          >
            <div className="whitespace-pre-wrap">{message.content}</div>

            {/* Show tool calls if any */}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <span className="font-medium">פעולות שבוצעו:</span>
                <ul className="mt-1 space-y-0.5">
                  {message.toolCalls.map((tool) => (
                    <li key={tool.id} className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-accent" />
                      {tool.name.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestion chips */}
            {message.suggestions && message.suggestions.length > 0 && !message.isLoading && (
              <div className="flex flex-wrap gap-2 mt-3">
                {message.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-background border border-border text-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input Area - fixed at bottom */}
      <div className="shrink-0 p-4 border-t border-border bg-card">
        {!isConnected && (
          <div className="mb-2 text-xs text-destructive text-center">
            מתחבר מחדש ל-JARVIS...
          </div>
        )}
        <div className="flex gap-2 p-2 bg-muted rounded-lg border border-border focus-within:border-primary">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={isConnected ? "שאל את JARVIS כל דבר..." : "ממתין לחיבור..."}
            className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-2"
            disabled={!isConnected || isLoading}
          />
          <Button
            onClick={handleSend}
            size="icon"
            className="jarvis-gradient text-white hover:opacity-90"
            disabled={!isConnected || isLoading || !inputValue.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default JarvisPanel;
