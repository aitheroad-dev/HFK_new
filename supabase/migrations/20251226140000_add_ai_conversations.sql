-- Migration: Add AI Conversations Tables
-- Purpose: Store AI conversation sessions for audit trail and session recovery

-- ============================================================================
-- AI Conversations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Session identification
  session_id TEXT NOT NULL UNIQUE,

  -- User who initiated the conversation
  user_id UUID,
  user_email TEXT,

  -- Optional context links
  person_id UUID REFERENCES people(id),

  -- Metadata
  title TEXT,
  message_count INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS ai_conversations_org_idx ON ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS ai_conversations_user_idx ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_status_idx ON ai_conversations(status);
CREATE INDEX IF NOT EXISTS ai_conversations_last_msg_idx ON ai_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS ai_conversations_session_idx ON ai_conversations(session_id);

-- ============================================================================
-- AI Conversation Messages Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT,

  -- Tool execution details (for assistant messages)
  tool_calls JSONB,
  tool_results JSONB,

  -- Metadata
  stop_reason TEXT,
  tokens_used INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS ai_messages_conv_idx ON ai_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ai_messages_created_idx ON ai_conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS ai_messages_role_idx ON ai_conversation_messages(conversation_id, role);

-- ============================================================================
-- Row Level Security (Single-Tenant - All authenticated users can access)
-- ============================================================================
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read all conversations
CREATE POLICY "ai_conversations_read_all" ON ai_conversations
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can insert conversations
CREATE POLICY "ai_conversations_insert" ON ai_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: All authenticated users can update conversations
CREATE POLICY "ai_conversations_update" ON ai_conversations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: All authenticated users can read all messages
CREATE POLICY "ai_messages_read_all" ON ai_conversation_messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can insert messages
CREATE POLICY "ai_messages_insert" ON ai_conversation_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role bypass for API server
CREATE POLICY "ai_conversations_service_all" ON ai_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ai_messages_service_all" ON ai_conversation_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Trigger: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_conversations_updated_at_trigger
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversations_updated_at();
