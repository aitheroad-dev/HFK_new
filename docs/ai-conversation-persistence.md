# AI Conversation Persistence & Viewer

> **Implemented**: 2025-12-26
> **Commit**: `0df31c0`
> **Feature**: Store all AI conversations for audit trail and session recovery

---

## Overview

This feature adds persistent storage for all AI (JARVIS/Noam) conversations, enabling:

1. **Audit Trail** - View all past conversations with full message history
2. **Session Recovery** - Reconnect to existing conversation after WebSocket disconnect
3. **Tool Call Visibility** - See exactly what tools the AI used and their results
4. **Conversation Management** - Archive old conversations, filter by status

---

## Architecture

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  API Server │────▶│  Supabase   │
│  (WebSocket)│     │  (Fastify)  │     │ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  1. Send message  │                   │
       │──────────────────▶│                   │
       │                   │  2. Save user msg │
       │                   │──────────────────▶│
       │                   │                   │
       │                   │  3. Call Claude   │
       │                   │──────────────────▶│ (Anthropic)
       │                   │                   │
       │                   │  4. Execute tools │
       │                   │──────────────────▶│
       │                   │                   │
       │                   │  5. Save response │
       │                   │──────────────────▶│
       │  6. Return result │                   │
       │◀──────────────────│                   │
       │                   │                   │
```

### Session Recovery Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │  API Server │     │  Supabase   │
│ (reconnect) │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  1. Connect with  │                   │
       │     sessionId     │                   │
       │──────────────────▶│                   │
       │                   │  2. Find existing │
       │                   │     conversation  │
       │                   │──────────────────▶│
       │                   │                   │
       │                   │  3. Load messages │
       │                   │◀──────────────────│
       │                   │                   │
       │                   │  4. Rebuild       │
       │                   │     session state │
       │                   │                   │
       │  5. Ready to      │                   │
       │     continue      │                   │
       │◀──────────────────│                   │
```

---

## Database Schema

### Tables

#### `ai_conversations`
Stores conversation metadata - one record per chat session.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations |
| `session_id` | TEXT | WebSocket session ID (unique) |
| `user_id` | UUID | Supabase auth user ID |
| `user_email` | TEXT | User email for display |
| `person_id` | UUID | Optional: related person |
| `title` | TEXT | Optional: conversation title |
| `message_count` | INTEGER | Number of messages |
| `status` | TEXT | 'active' or 'archived' |
| `started_at` | TIMESTAMP | When conversation began |
| `last_message_at` | TIMESTAMP | Last activity |
| `created_at` | TIMESTAMP | Record creation |
| `updated_at` | TIMESTAMP | Record update |

#### `ai_conversation_messages`
Stores individual messages with tool execution details.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `conversation_id` | UUID | FK to ai_conversations |
| `role` | TEXT | 'user' or 'assistant' |
| `content` | TEXT | Message text |
| `tool_calls` | JSONB | Array of tool calls |
| `tool_results` | JSONB | Array of tool results |
| `stop_reason` | TEXT | 'end_turn', 'tool_use', etc. |
| `tokens_used` | INTEGER | Optional token tracking |
| `created_at` | TIMESTAMP | Message timestamp |

### JSONB Structures

**tool_calls:**
```json
[
  {
    "id": "toolu_01ABC123",
    "name": "search_people",
    "input": {
      "query": "דנה כהן"
    }
  }
]
```

**tool_results:**
```json
[
  {
    "toolUseId": "toolu_01ABC123",
    "result": {
      "count": 1,
      "people": [{"id": "...", "name": "דנה כהן"}]
    },
    "isError": false
  }
]
```

### Indexes

```sql
-- ai_conversations
CREATE INDEX ai_conversations_org_idx ON ai_conversations(organization_id);
CREATE INDEX ai_conversations_user_idx ON ai_conversations(user_id);
CREATE INDEX ai_conversations_status_idx ON ai_conversations(status);
CREATE INDEX ai_conversations_last_msg_idx ON ai_conversations(last_message_at DESC);
CREATE INDEX ai_conversations_session_idx ON ai_conversations(session_id);

-- ai_conversation_messages
CREATE INDEX ai_messages_conv_idx ON ai_conversation_messages(conversation_id);
CREATE INDEX ai_messages_created_idx ON ai_conversation_messages(created_at);
CREATE INDEX ai_messages_role_idx ON ai_conversation_messages(conversation_id, role);
```

### RLS Policies

Single-tenant configuration - all authenticated users can access:

```sql
-- Read all conversations
CREATE POLICY "ai_conversations_read_all" ON ai_conversations
  FOR SELECT TO authenticated USING (true);

-- Insert conversations
CREATE POLICY "ai_conversations_insert" ON ai_conversations
  FOR INSERT TO authenticated WITH CHECK (true);

-- Update conversations
CREATE POLICY "ai_conversations_update" ON ai_conversations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Service role bypass for API server
CREATE POLICY "ai_conversations_service_all" ON ai_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## Backend Implementation

### Files Modified

#### `apps/api/src/ai/agent.ts`

**New interfaces:**
```typescript
export interface UserInfo {
  userId?: string;
  userEmail?: string;
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
```

**ConversationSession class changes:**

| Method | Description |
|--------|-------------|
| `constructor(orgId, sessionId, userInfo)` | Now accepts sessionId and userInfo |
| `initialize()` | Creates or loads conversation from database |
| `loadMessagesFromDb()` | Restores message history for session recovery |
| `saveMessage()` | Persists each message to database |
| `clearHistory()` | Archives conversation and resets state |
| `getConversationId()` | Returns database ID |
| `getSessionId()` | Returns WebSocket session ID |

**Key logic in `chat()` method:**
```typescript
async chat(userMessage: string): Promise<ChatResponse> {
  // 1. Initialize session (creates/loads from DB)
  await this.initialize();

  // 2. Save user message
  await this.saveMessage('user', userMessage);

  // 3. Process with Claude (existing logic)
  // ... tool execution loop ...

  // 4. Save assistant response with tool calls
  await this.saveMessage(
    'assistant',
    assistantMessage,
    toolCalls,
    toolResults,
    stopReason
  );

  return response;
}
```

#### `apps/api/src/index.ts`

**WebSocket handler updates:**
```typescript
// Pass user info to session manager
const userInfo: UserInfo = {
  userId: authenticatedUser?.id,
  userEmail: authenticatedUser?.email,
};
const session = sessionManager.getOrCreateSession(sessionId, HKF_ORG_ID, userInfo);

// Archive on clear_history
if (data.type === 'clear_history') {
  if (sessionManager.hasSession(sessionId)) {
    const session = sessionManager.getOrCreateSession(sessionId, HKF_ORG_ID);
    await session.clearHistory();  // Archives in DB
  }
  sessionManager.removeSession(sessionId);
}
```

---

## Frontend Implementation

### Files Created

#### `apps/web/src/hooks/useConversations.ts`

React Query hooks for conversation data:

| Hook | Purpose |
|------|---------|
| `useConversations(options)` | List conversations with filters |
| `useConversationsWithDetails(options)` | List with person names |
| `useConversation(id)` | Single conversation |
| `useConversationMessages(id)` | Messages for conversation |
| `useArchiveConversation()` | Archive mutation |
| `useUnarchiveConversation()` | Unarchive mutation |
| `useConversationStats()` | Dashboard statistics |

**Options:**
```typescript
{
  status?: 'active' | 'archived' | 'all',
  limit?: number,
  offset?: number
}
```

#### `apps/web/src/pages/Conversations.tsx`

Full page component with:

1. **Stats Cards** - Total, Active, Archived, Messages
2. **Conversations Table** - Filterable list with:
   - User email
   - Start date
   - Last activity (relative time)
   - Message count
   - Status badge
   - Actions menu
3. **Conversation Viewer** - Detail view showing:
   - Full message history
   - Message bubbles (user left, assistant right)
   - Expandable tool calls section
   - Tool inputs and results
   - Timestamps

### Files Modified

#### `apps/web/src/components/hkf/AppLayout.tsx`

Added navigation item:
```typescript
operations: [
  // ... existing items
  { label: "שיחות AI", icon: MessageSquare, page: "conversations" as Page },
]
```

#### `apps/web/src/HkfDemo.tsx`

Added routing:
```typescript
{currentPage === "conversations" && <Conversations onSelectPerson={...} />}
```

---

## UI Screenshots Reference

### Conversations List
```
┌────────────────────────────────────────────────────────────┐
│  שיחות AI                                    [🔄 Refresh] │
├────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐              │
│  │ Total  │ │ Active │ │Archived│ │Messages│              │
│  │   24   │ │   18   │ │    6   │ │   156  │              │
│  └────────┘ └────────┘ └────────┘ └────────┘              │
├────────────────────────────────────────────────────────────┤
│  [הכל] [פעילות] [ארכיון]                                   │
├────────────────────────────────────────────────────────────┤
│  משתמש          │ התחלה      │ עדכון    │ הודעות │ סטטוס  │
│  ─────────────────────────────────────────────────────────│
│  yaron@hkf.org  │ 26 Dec     │ לפני 2   │   12   │ פעילה  │
│                 │ 10:23      │ דקות     │        │        │
│  ─────────────────────────────────────────────────────────│
│  sarah@hkf.org  │ 25 Dec     │ אתמול    │    8   │ פעילה  │
│                 │ 14:15      │          │        │        │
└────────────────────────────────────────────────────────────┘
```

### Conversation Viewer
```
┌────────────────────────────────────────────────────────────┐
│  ← חזור    שיחה עם yaron@hkf.org         [פעילה] [ארכיון] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────┐                      │
│  │ yaron@hkf.org (10:23)           │                      │
│  │ שלח מייל לדנה כהן               │                      │
│  └─────────────────────────────────┘                      │
│                                                            │
│                      ┌─────────────────────────────────┐  │
│                      │ נועם (AI) (10:23)               │  │
│                      │ מצאתי את דנה כהן ושלחתי לה      │  │
│                      │ מייל בהצלחה.                    │  │
│                      │                                 │  │
│                      │ ▼ כלים שהופעלו (2)              │  │
│                      │   • search_people               │  │
│                      │     {query: "דנה כהן"}          │  │
│                      │     → נמצא 1 איש               │  │
│                      │   • send_message                │  │
│                      │     {channel: "email"...}       │  │
│                      │     → נשלח בהצלחה              │  │
│                      └─────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## API Reference

### Session Manager

```typescript
// Get or create session with user info
sessionManager.getOrCreateSession(
  sessionId: string,
  organizationId: string,
  userInfo?: UserInfo
): ConversationSession

// Check if session exists in memory
sessionManager.hasSession(sessionId: string): boolean

// Remove session from memory
sessionManager.removeSession(sessionId: string): void
```

### ConversationSession

```typescript
// Initialize (call before first chat or will auto-call)
await session.initialize(): Promise<void>

// Send message and get response
await session.chat(message: string): Promise<ChatResponse>

// Clear history and archive conversation
await session.clearHistory(): Promise<void>

// Get database conversation ID
session.getConversationId(): string | null

// Get WebSocket session ID
session.getSessionId(): string
```

### Supabase Queries

```typescript
// List conversations
const { data } = await supabase
  .from('ai_conversations')
  .select('*')
  .eq('status', 'active')
  .order('last_message_at', { ascending: false });

// Get conversation messages
const { data } = await supabase
  .from('ai_conversation_messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true });

// Archive conversation
await supabase
  .from('ai_conversations')
  .update({ status: 'archived' })
  .eq('id', conversationId);
```

---

## Migration

### File Location
`supabase/migrations/20251226140000_add_ai_conversations.sql`

### Apply Migration
```bash
cd /Users/yaronkra/Projects/aitheroad/hkf-crm
npx supabase db push --linked
```

### Rollback (if needed)
```sql
DROP TABLE IF EXISTS ai_conversation_messages;
DROP TABLE IF EXISTS ai_conversations;
DROP FUNCTION IF EXISTS update_ai_conversations_updated_at();
```

---

## Configuration

No new environment variables required. Uses existing:
- `DATABASE_URL` - For Drizzle ORM
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` - For direct queries
- `HKF_ORG_ID` - Organization context

---

## Future Enhancements

Potential improvements for later:

1. **Search** - Full-text search across conversation content
2. **Export** - Download conversation as PDF/JSON
3. **Analytics** - Tool usage statistics, response times
4. **Token Tracking** - Monitor token usage per conversation
5. **Conversation Tagging** - Add labels/categories
6. **Person Linking** - Auto-detect which person a conversation relates to
7. **Pagination** - Infinite scroll for long conversations
8. **Real-time Updates** - Live refresh when new conversations appear

---

## Troubleshooting

### Session not recovering after disconnect
- Check that `sessionId` is being sent with reconnect
- Verify conversation exists: `SELECT * FROM ai_conversations WHERE session_id = 'xxx'`
- Check API logs for `[Session] Loaded existing conversation`

### Messages not saving
- Check Supabase connection: `DATABASE_URL` env var
- Verify RLS policies allow service_role
- Check API logs for `[Session] Failed to save message`

### Conversation viewer empty
- Verify `conversation_id` is correct
- Check `ai_conversation_messages` table has records
- Check browser console for Supabase errors

### Tool calls not displaying
- Ensure `tool_calls` JSONB is not null
- Verify JSON structure matches expected format
- Check that assistant messages have `toolCalls` populated
