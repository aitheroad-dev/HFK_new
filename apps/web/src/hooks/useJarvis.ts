import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

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
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Get current session token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // Build WebSocket URL with optional auth token
    let wsUrl = API_URL.replace(/^http/, "ws") + "/chat";
    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    console.log("[JARVIS] Attempting to connect to:", wsUrl.split("?")[0]); // Don't log token
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
                "שלום! אני נועם, העוזר החכם שלך. איך אפשר לעזור לך היום?",
              suggestions: ["הצג מועמדים אחרונים", "סיכום לוח בקרה", "חפש אנשים"],
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
          content: "חושב...",
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
        content: "השיחה נוקתה. איך אפשר לעזור לך?",
        suggestions: ["הצג מועמדים אחרונים", "סיכום לוח בקרה", "חפש אנשים"],
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

  if (lower.includes("person") || lower.includes("candidate") || lower.includes("אדם") || lower.includes("מועמד")) {
    return ["הצג פרטים", "קבע ראיון", "שלח הודעה"];
  }
  if (lower.includes("interview") || lower.includes("ראיון")) {
    return ["רשום תוצאה", "קבע מחדש", "הצג מועמדים"];
  }
  if (lower.includes("payment") || lower.includes("תשלום")) {
    return ["שלח תזכורת", "הצג היסטוריה", "ייצא דוח"];
  }
  if (lower.includes("program") || lower.includes("תוכנית")) {
    return ["הצג הרשמות", "צור מחזור", "סטטיסטיקות תוכנית"];
  }

  return ["פרטים נוספים", "חזור ללוח בקרה", "שאלה נוספת"];
}
