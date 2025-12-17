import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { getToolDefinitions, executeToolCall, type ToolName } from './tools.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    return `You are JARVIS, an intelligent AI assistant for managing a CRM system.
You help users manage people, programs, interviews, payments, and communications.

Organization Context:
- Organization ID: ${this.organizationId}
- All data operations are scoped to this organization (multi-tenant)

Your Capabilities:
- Search and retrieve person records
- Create and update people in the database
- Query programs, cohorts, and enrollments
- Help with day-to-day CRM operations

Guidelines:
- Be concise and helpful
- When users ask to find someone, use the search_people tool
- When users want details, use get_person tool
- Proactively suggest useful actions based on context
- If you can't find information, say so clearly
- Always confirm before making changes to data`;
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
      model: 'claude-sonnet-4-20250514',
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
        (block): block is ToolUseBlock => block.type === 'tool_use'
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: this.systemPrompt,
        tools,
        messages: this.messages,
      });
    }

    // Extract final text response
    const textContent = response.content.find(
      (block): block is ContentBlock & { type: 'text' } => block.type === 'text'
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
 * Session manager - maintains multiple conversation sessions
 */
class SessionManager {
  private sessions: Map<string, ConversationSession> = new Map();

  getOrCreateSession(sessionId: string, organizationId: string): ConversationSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new ConversationSession(organizationId);
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();
