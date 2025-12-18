import { useState, useCallback, useEffect, useRef } from "react";

export interface JarvisMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  isLoading?: boolean;
}

interface WsResponse {
  type: "message" | "error" | "pong" | "tool_use" | "connected";
  content?: string;
  sessionId?: string;
  toolCalls?: JarvisMessage["toolCalls"];
  error?: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Hook to connect to JARVIS AI backend via WebSocket
 */
export function useJarvis() {
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = API_URL.replace(/^http/, "ws") + "/chat";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log("JARVIS WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data: WsResponse = JSON.parse(event.data);

        if (data.type === "connected") {
          setSessionId(data.sessionId || null);
          // Add welcome message
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                data.content ||
                "Shalom! I'm JARVIS, your AI assistant. How can I help you today?",
              suggestions: ["Show recent candidates", "Dashboard summary", "Search people"],
            },
          ]);
        } else if (data.type === "message") {
          setIsLoading(false);
          setMessages((prev) => {
            // Remove loading message and add real response
            const filtered = prev.filter((m) => !m.isLoading);
            return [
              ...filtered,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: data.content || "",
                toolCalls: data.toolCalls,
                suggestions: generateSuggestions(data.content || ""),
              },
            ];
          });
        } else if (data.type === "error") {
          setIsLoading(false);
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.isLoading);
            return [
              ...filtered,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: `Error: ${data.error || "Something went wrong"}`,
              },
            ];
          });
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("JARVIS WebSocket disconnected");

      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        console.log("Attempting to reconnect...");
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("JARVIS WebSocket error:", error);
    };

    wsRef.current = ws;
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("WebSocket not connected");
        return;
      }

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          content,
        },
      ]);

      // Add loading indicator
      setIsLoading(true);
      setMessages((prev) => [
        ...prev,
        {
          id: "loading",
          role: "assistant",
          content: "Thinking...",
          isLoading: true,
        },
      ]);

      // Send to server
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          message: content,
          sessionId,
        })
      );
    },
    [sessionId]
  );

  // Clear conversation
  const clearHistory = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "clear_history",
          sessionId,
        })
      );
    }
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Conversation cleared. How can I help you?",
        suggestions: ["Show recent candidates", "Dashboard summary", "Search people"],
      },
    ]);
  }, [sessionId]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    messages,
    isConnected,
    isLoading,
    sendMessage,
    clearHistory,
    connect,
    disconnect,
  };
}

/**
 * Generate contextual suggestions based on the response
 */
function generateSuggestions(content: string): string[] {
  const lower = content.toLowerCase();

  if (lower.includes("person") || lower.includes("candidate")) {
    return ["View details", "Schedule interview", "Send message"];
  }
  if (lower.includes("interview")) {
    return ["Record outcome", "Reschedule", "View candidates"];
  }
  if (lower.includes("payment")) {
    return ["Send reminder", "View history", "Export report"];
  }
  if (lower.includes("program")) {
    return ["View enrollments", "Create cohort", "Program stats"];
  }

  return ["More details", "Back to dashboard", "Another question"];
}
