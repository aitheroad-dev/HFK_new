import { createRequire } from 'module';
import { getToolDefinitions, executeToolCall, type ToolName } from './tools.js';

// Use createRequire to load CommonJS module in ESM context
const require = createRequire(import.meta.url);
const AnthropicSDK = require('@anthropic-ai/sdk');
const Anthropic = AnthropicSDK.default || AnthropicSDK;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Type aliases for Anthropic SDK types
type MessageParam = { role: 'user' | 'assistant'; content: string | Array<{ type: string; [key: string]: unknown }> };
type ContentBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown };
type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
type ToolResultBlockParam = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolUseId: string;
  result: unknown;
  isError?: boolean;
}

export interface ChatResponse {
  message: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  stopReason: string;
}

/**
 * Conversation session - maintains state for a single chat session
 */
export class ConversationSession {
  private messages: MessageParam[] = [];
  private organizationId: string;
  private systemPrompt: string;

  constructor(organizationId: string, systemPrompt?: string) {
    this.organizationId = organizationId;
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
  }

  private getDefaultSystemPrompt(): string {
    return `אתה JARVIS, עוזר AI חכם לניהול מערכת CRM.
אתה עוזר למשתמשים לנהל אנשים, תוכניות, ראיונות, תשלומים ותקשורת.

ענה תמיד בעברית. השתמש בפורמט טקסט מימין לשמאל.

הקשר הארגון:
- מזהה הארגון: ${this.organizationId}
- כל פעולות הנתונים מוגבלות לארגון זה

היכולות שלך:
- חיפוש ואחזור רשומות אנשים
- יצירה ועדכון אנשים במסד הנתונים
- שאילתות על תוכניות, מחזורים והרשמות
- עזרה בפעולות CRM יומיומיות

כאשר המשתמש מתייחס למישהו בשם (לא מזהה), חובה:
1. קודם להפעיל search_people עם השם כשאילתא
2. להשתמש ב-personId שחוזר לפעולות הבאות (send_message, get_person וכו')
3. אם לא נמצאו תוצאות, ליידע את המשתמש שהאדם לא נמצא

הנחיות:
- היה תמציתי ומועיל
- כשמשתמשים מבקשים למצוא מישהו, השתמש בכלי search_people
- כשמשתמשים רוצים פרטים, השתמש בכלי get_person
- הצע פעולות שימושיות באופן יזום בהתאם להקשר
- אם אינך יכול למצוא מידע, אמור זאת בבירור
- תמיד אשר לפני ביצוע שינויים בנתונים`;
  }

  /**
   * Send a message and get a response, handling tool calls automatically
   */
  async chat(userMessage: string): Promise<ChatResponse> {
    // Add user message to history
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    // Get tool definitions
    const tools = getToolDefinitions();

    // Call Claude
    let response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system: this.systemPrompt,
      tools,
      messages: this.messages,
    });

    // Handle tool use loop
    const allToolCalls: ToolCall[] = [];
    const allToolResults: ToolResult[] = [];

    while (response.stop_reason === 'tool_use') {
      // Extract tool use blocks
      const toolUseBlocks = response.content.filter(
        (block: ContentBlock): block is ToolUseBlock => block.type === 'tool_use'
      );

      // Add assistant message with tool calls to history
      this.messages.push({
        role: 'assistant',
        content: response.content,
      });

      // Execute each tool call
      const toolResults: ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        allToolCalls.push({
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
        });

        try {
          const result = await executeToolCall(
            toolUse.name as ToolName,
            toolUse.input as Record<string, unknown>,
            this.organizationId
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });

          allToolResults.push({
            toolUseId: toolUse.id,
            result,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: errorMessage }),
            is_error: true,
          });

          allToolResults.push({
            toolUseId: toolUse.id,
            result: { error: errorMessage },
            isError: true,
          });
        }
      }

      // Add tool results to history
      this.messages.push({
        role: 'user',
        content: toolResults,
      });

      // Continue conversation with tool results
      response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: this.systemPrompt,
        tools,
        messages: this.messages,
      });
    }

    // Extract final text response
    const textContent = response.content.find(
      (block: ContentBlock): block is ContentBlock & { type: 'text' } => block.type === 'text'
    );

    const assistantMessage = textContent?.text || '';

    // Add final assistant message to history
    this.messages.push({
      role: 'assistant',
      content: response.content,
    });

    return {
      message: assistantMessage,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      stopReason: response.stop_reason || 'end_turn',
    };
  }

  /**
   * Get conversation history for debugging/logging
   */
  getHistory(): MessageParam[] {
    return [...this.messages];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
  }
}

/**
 * Session with metadata for TTL tracking
 */
interface SessionEntry {
  session: ConversationSession;
  lastAccessed: number;
  createdAt: number;
}

/**
 * Session manager - maintains multiple conversation sessions with TTL cleanup
 */
class SessionManager {
  private sessions: Map<string, SessionEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Session expires after 24 hours of inactivity
  private readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  // Run cleanup every hour
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
  // Maximum sessions to prevent memory exhaustion
  private readonly MAX_SESSIONS = 1000;

  constructor() {
    // Start periodic cleanup
    this.startCleanup();
  }

  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL_MS);

    // Don't prevent Node from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }

    console.log('[SessionManager] Started session cleanup (24h TTL, hourly check)');
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, entry] of this.sessions.entries()) {
      if (now - entry.lastAccessed > this.SESSION_TTL_MS) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionManager] Cleaned up ${cleaned} expired sessions. Active: ${this.sessions.size}`);
    }
  }

  getOrCreateSession(sessionId: string, organizationId: string): ConversationSession {
    const existing = this.sessions.get(sessionId);

    if (existing) {
      // Update last accessed time
      existing.lastAccessed = Date.now();
      return existing.session;
    }

    // Check if we're at capacity
    if (this.sessions.size >= this.MAX_SESSIONS) {
      // Remove oldest session
      let oldestId: string | null = null;
      let oldestTime = Infinity;

      for (const [id, entry] of this.sessions.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestId = id;
        }
      }

      if (oldestId) {
        this.sessions.delete(oldestId);
        console.log(`[SessionManager] Evicted oldest session to make room (max: ${this.MAX_SESSIONS})`);
      }
    }

    // Create new session
    const session = new ConversationSession(organizationId);
    const now = Date.now();

    this.sessions.set(sessionId, {
      session,
      lastAccessed: now,
      createdAt: now,
    });

    return session;
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get session stats for monitoring
   */
  getStats(): { active: number; maxSessions: number; ttlHours: number } {
    return {
      active: this.sessions.size,
      maxSessions: this.MAX_SESSIONS,
      ttlHours: this.SESSION_TTL_MS / (60 * 60 * 1000),
    };
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();
