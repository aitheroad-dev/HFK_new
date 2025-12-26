import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * AI Conversation from database
 */
export interface Conversation {
  id: string;
  organization_id: string;
  session_id: string;
  user_id: string | null;
  user_email: string | null;
  person_id: string | null;
  title: string | null;
  message_count: number;
  status: "active" | "archived";
  started_at: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Tool call structure
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result structure
 */
export interface ToolResult {
  toolUseId: string;
  result: unknown;
  isError: boolean;
}

/**
 * AI Conversation message from database
 */
export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string | null;
  tool_calls: ToolCall[] | null;
  tool_results: ToolResult[] | null;
  stop_reason: string | null;
  tokens_used: number | null;
  created_at: string;
}

/**
 * Conversation with related person info
 */
export interface ConversationWithDetails extends Conversation {
  person_name?: string;
}

/**
 * Fetch all conversations with pagination
 */
export function useConversations(options?: {
  status?: "active" | "archived" | "all";
  limit?: number;
  offset?: number;
}) {
  const { status = "all", limit = 50, offset = 0 } = options || {};

  return useQuery({
    queryKey: ["conversations", status, limit, offset],
    queryFn: async () => {
      let query = supabase
        .from("ai_conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Conversation[];
    },
  });
}

/**
 * Fetch conversations with person details
 */
export function useConversationsWithDetails(options?: {
  status?: "active" | "archived" | "all";
  limit?: number;
}) {
  const { status = "all", limit = 50 } = options || {};

  return useQuery({
    queryKey: ["conversations-with-details", status, limit],
    queryFn: async () => {
      // Get conversations
      let query = supabase
        .from("ai_conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data: conversations, error: convError } = await query;

      if (convError) throw convError;

      // Get people for name lookup
      const personIds = (conversations || [])
        .filter((c) => c.person_id)
        .map((c) => c.person_id as string);

      let peopleMap = new Map<string, string>();

      if (personIds.length > 0) {
        const { data: people } = await supabase
          .from("people")
          .select("id, first_name, last_name")
          .in("id", personIds);

        peopleMap = new Map(
          (people || []).map((p) => [p.id, `${p.first_name} ${p.last_name}`])
        );
      }

      // Enrich conversations
      return (conversations || []).map((conv) => ({
        ...conv,
        person_name: conv.person_id ? peopleMap.get(conv.person_id) : undefined,
      })) as ConversationWithDetails[];
    },
  });
}

/**
 * Fetch a single conversation by ID
 */
export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("id", conversationId)
        .single();

      if (error) throw error;
      return data as Conversation;
    },
    enabled: !!conversationId,
  });
}

/**
 * Fetch all messages for a conversation
 */
export function useConversationMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("ai_conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ConversationMessage[];
    },
    enabled: !!conversationId,
  });
}

/**
 * Archive a conversation
 */
export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .select()
        .single();

      if (error) throw error;
      return data as Conversation;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-with-details"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
  });
}

/**
 * Unarchive (reactivate) a conversation
 */
export function useUnarchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .select()
        .single();

      if (error) throw error;
      return data as Conversation;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversations-with-details"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
  });
}

/**
 * Get conversation statistics
 */
export function useConversationStats() {
  return useQuery({
    queryKey: ["conversation-stats"],
    queryFn: async () => {
      // Get counts by status
      const { data: active, error: activeErr } = await supabase
        .from("ai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const { data: archived, error: archivedErr } = await supabase
        .from("ai_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "archived");

      // Get total message count
      const { count: messageCount, error: msgErr } = await supabase
        .from("ai_conversation_messages")
        .select("id", { count: "exact", head: true });

      if (activeErr || archivedErr || msgErr) {
        throw activeErr || archivedErr || msgErr;
      }

      return {
        activeConversations: active?.length || 0,
        archivedConversations: archived?.length || 0,
        totalMessages: messageCount || 0,
      };
    },
  });
}
