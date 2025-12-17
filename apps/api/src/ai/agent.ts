import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  message: string;
  toolCalls?: Array<{
    name: string;
    input: Record<string, unknown>;
  }>;
}

/**
 * JARVIS AI Agent - handles conversational interactions
 * This will be expanded with 18 tools as per the AI Orchestration spec
 */
export async function chat(
  messages: ChatMessage[],
  organizationId: string,
  systemPrompt?: string
): Promise<ChatResponse> {
  const defaultSystemPrompt = `You are JARVIS, an AI assistant for managing a CRM system.
You help users manage people, programs, interviews, payments, and communications.
You have access to various tools to query and modify data.
Organization ID: ${organizationId}

Be concise, helpful, and proactive in suggesting actions.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt || defaultSystemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find((c) => c.type === 'text');

  return {
    message: textContent?.type === 'text' ? textContent.text : '',
  };
}
