-- Migration: Add events, escalations, and communications tables
-- Created: 2025-12-18
-- Description: Support for the 9 additional AI tools

-- ============================================================================
-- Events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  type TEXT, -- tenant-defined: workshop, meeting, webinar, etc.

  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  timezone TEXT DEFAULT 'Asia/Jerusalem',

  location TEXT,
  location_url TEXT,

  capacity INTEGER,
  registration_count INTEGER DEFAULT 0,

  target_audience JSONB DEFAULT '{}',

  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_events_starts_at ON events(starts_at);
CREATE INDEX idx_events_status ON events(organization_id, status);

-- ============================================================================
-- Event registrations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled', 'waitlisted', 'attended', 'no_show')),
  guests INTEGER DEFAULT 0,

  checked_in_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,

  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_event_registrations_org ON event_registrations(organization_id);
CREATE INDEX idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_person ON event_registrations(person_id);

-- Unique constraint: one registration per person per event
CREATE UNIQUE INDEX idx_event_reg_unique ON event_registrations(event_id, person_id);

-- ============================================================================
-- Escalations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  reason TEXT NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),

  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  interview_id UUID REFERENCES interviews(id) ON DELETE SET NULL,

  context JSONB DEFAULT '{}',

  assigned_to UUID,
  assigned_at TIMESTAMP WITH TIME ZONE,

  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  source TEXT DEFAULT 'ai_agent' CHECK (source IN ('ai_agent', 'webhook', 'manual', 'system')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_escalations_org ON escalations(organization_id);
CREATE INDEX idx_escalations_status ON escalations(organization_id, status);
CREATE INDEX idx_escalations_urgency ON escalations(organization_id, urgency);
CREATE INDEX idx_escalations_person ON escalations(person_id);

-- ============================================================================
-- Communications log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms', 'phone', 'in_app')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  subject TEXT,
  message TEXT NOT NULL,
  template_id TEXT,

  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  external_id TEXT,

  metadata JSONB DEFAULT '{}',

  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_communications_org ON communications(organization_id);
CREATE INDEX idx_communications_person ON communications(person_id);
CREATE INDEX idx_communications_channel ON communications(channel);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- Service role bypass for all tables
CREATE POLICY "Service role has full access to events"
  ON events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to event_registrations"
  ON event_registrations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to escalations"
  ON escalations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to communications"
  ON communications FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Update timestamp trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_registrations_updated_at
  BEFORE UPDATE ON event_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escalations_updated_at
  BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
