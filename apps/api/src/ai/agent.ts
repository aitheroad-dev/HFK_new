import { createRequire } from 'module';
import { getToolDefinitions, executeToolCall, type ToolName } from './tools.js';
import { db, aiConversations, aiConversationMessages } from '@generic-ai-crm/db';
import { eq, desc } from 'drizzle-orm';

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
  isError: boolean;
}

export interface ChatResponse {
  message: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  stopReason: string;
}

/**
 * User info for conversation tracking
 */
export interface UserInfo {
  userId?: string;
  userEmail?: string;
}

/**
 * Conversation session - maintains state for a single chat session
 * Now with database persistence for audit trail and session recovery
 */
export class ConversationSession {
  private messages: MessageParam[] = [];
  private organizationId: string;
  private systemPrompt: string;
  private sessionId: string;
  private conversationDbId: string | null = null;
  private userInfo: UserInfo;
  private isInitialized: boolean = false;

  constructor(organizationId: string, sessionId: string, userInfo: UserInfo = {}, systemPrompt?: string) {
    this.organizationId = organizationId;
    this.sessionId = sessionId;
    this.userInfo = userInfo;
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
  }

  /**
   * Initialize the session - create or load from database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Try to find existing conversation
      const existing = await db
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.sessionId, this.sessionId))
        .limit(1);

      if (existing.length > 0) {
        // Load existing conversation
        this.conversationDbId = existing[0].id;
        await this.loadMessagesFromDb();
        console.log(`[Session] Loaded existing conversation ${this.sessionId} with ${this.messages.length} messages`);
      } else {
        // Create new conversation
        const [created] = await db
          .insert(aiConversations)
          .values({
            organizationId: this.organizationId,
            sessionId: this.sessionId,
            userId: this.userInfo.userId || null,
            userEmail: this.userInfo.userEmail || null,
            status: 'active',
            messageCount: 0,
          })
          .returning();

        this.conversationDbId = created.id;
        console.log(`[Session] Created new conversation ${this.sessionId}`);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('[Session] Failed to initialize conversation:', error);
      // Continue without persistence - don't break the chat
      this.isInitialized = true;
    }
  }

  /**
   * Load messages from database to restore session
   */
  private async loadMessagesFromDb(): Promise<void> {
    if (!this.conversationDbId) return;

    try {
      const dbMessages = await db
        .select()
        .from(aiConversationMessages)
        .where(eq(aiConversationMessages.conversationId, this.conversationDbId))
        .orderBy(aiConversationMessages.createdAt);

      // Rebuild messages array in Anthropic format
      this.messages = [];
      for (const msg of dbMessages) {
        if (msg.role === 'user') {
          // User messages are simple text
          this.messages.push({
            role: 'user',
            content: msg.content || '',
          });
        } else if (msg.role === 'assistant') {
          // Assistant messages may have tool calls
          if (msg.toolCalls && (msg.toolCalls as ToolCall[]).length > 0) {
            // Build content array with text + tool_use blocks
            const contentBlocks: Array<{ type: string; [key: string]: unknown }> = [];

            if (msg.content) {
              contentBlocks.push({ type: 'text', text: msg.content });
            }

            for (const tc of msg.toolCalls as ToolCall[]) {
              contentBlocks.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.input,
              });
            }

            this.messages.push({
              role: 'assistant',
              content: contentBlocks,
            });

            // Add tool results as user message
            if (msg.toolResults && (msg.toolResults as ToolResult[]).length > 0) {
              const toolResults = (msg.toolResults as ToolResult[]).map(tr => ({
                type: 'tool_result',
                tool_use_id: tr.toolUseId,
                content: JSON.stringify(tr.result),
                is_error: tr.isError || false,
              }));
              this.messages.push({
                role: 'user',
                content: toolResults,
              });
            }
          } else {
            // Simple text response
            this.messages.push({
              role: 'assistant',
              content: [{ type: 'text', text: msg.content || '' }],
            });
          }
        }
      }
    } catch (error) {
      console.error('[Session] Failed to load messages from database:', error);
    }
  }

  /**
   * Save a message to the database
   */
  private async saveMessage(
    role: 'user' | 'assistant',
    content: string | null,
    toolCalls?: ToolCall[],
    toolResults?: ToolResult[],
    stopReason?: string
  ): Promise<void> {
    if (!this.conversationDbId) return;

    try {
      await db.insert(aiConversationMessages).values({
        conversationId: this.conversationDbId,
        role,
        content,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
        toolResults: toolResults && toolResults.length > 0 ? toolResults : null,
        stopReason,
      });

      // Update conversation metadata
      await db
        .update(aiConversations)
        .set({
          lastMessageAt: new Date(),
          messageCount: this.messages.length,
          updatedAt: new Date(),
        })
        .where(eq(aiConversations.id, this.conversationDbId));
    } catch (error) {
      console.error('[Session] Failed to save message:', error);
    }
  }

  private getDefaultSystemPrompt(): string {
    return `אתה נועם, עוזר AI חכם לניהול מערכת CRM.
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
- יצירת מסמכים ודוחות (PDF ו-CSV) מנתוני המערכת

כשמשתמש מבקש ליצור דוח, לייצא נתונים, או להכין PDF/CSV:
- השתמש בכלי create_document
- ניתן לייצר דוחות תשלומים, רשימות אנשים, דוחות תוכניות, לוחות ראיונות ועוד
- המסמך נשמר ומקבל קישור להורדה

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
    // Ensure session is initialized
    await this.initialize();

    // Add user message to history
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    // Save user message to database
    await this.saveMessage('user', userMessage);

    // Get tool definitions
    const tools = getToolDefinitions();
    console.log(`[Chat] Loaded ${tools.length} tools:`, tools.map(t => t.name).join(', '));

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
            isError: false,
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

    // Save assistant response to database (with all tool calls and results)
    await this.saveMessage(
      'assistant',
      assistantMessage,
      allToolCalls.length > 0 ? allToolCalls : undefined,
      allToolResults.length > 0 ? allToolResults : undefined,
      response.stop_reason || 'end_turn'
    );

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
   * Clear conversation history and archive the conversation
   */
  async clearHistory(): Promise<void> {
    this.messages = [];

    // Archive the conversation in database
    if (this.conversationDbId) {
      try {
        await db
          .update(aiConversations)
          .set({ status: 'archived', updatedAt: new Date() })
          .where(eq(aiConversations.id, this.conversationDbId));
        console.log(`[Session] Archived conversation ${this.sessionId}`);
      } catch (error) {
        console.error('[Session] Failed to archive conversation:', error);
      }
    }

    // Reset for a fresh conversation
    this.conversationDbId = null;
    this.isInitialized = false;
  }

  /**
   * Get the database ID for this conversation
   */
  getConversationId(): string | null {
    return this.conversationDbId;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
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

  getOrCreateSession(sessionId: string, organizationId: string, userInfo: UserInfo = {}): ConversationSession {
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

    // Create new session with sessionId and userInfo for persistence
    const session = new ConversationSession(organizationId, sessionId, userInfo);
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
