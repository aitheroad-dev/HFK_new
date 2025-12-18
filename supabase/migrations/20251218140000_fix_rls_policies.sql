-- Migration: Fix RLS policies for single-tenant HKF CRM
-- Created: 2025-12-18
-- Description: Add authenticated user policies to new tables
-- Note: Single-tenant deployment - all authenticated users can access all data

-- ============================================================================
-- Fix events table policies
-- ============================================================================

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Service role has full access to events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
DROP POLICY IF EXISTS "Authenticated users can update events" ON events;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON events;
DROP POLICY IF EXISTS "Service role bypass for events" ON events;

-- Add policies for authenticated users (single-tenant: all authenticated users have access)
CREATE POLICY "Authenticated users can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (true);

-- Service role bypass (for backend operations)
CREATE POLICY "Service role bypass for events"
  ON events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Fix event_registrations table policies
-- ============================================================================

DROP POLICY IF EXISTS "Service role has full access to event_registrations" ON event_registrations;
DROP POLICY IF EXISTS "Authenticated users can view event_registrations" ON event_registrations;
DROP POLICY IF EXISTS "Authenticated users can create event_registrations" ON event_registrations;
DROP POLICY IF EXISTS "Authenticated users can update event_registrations" ON event_registrations;
DROP POLICY IF EXISTS "Authenticated users can delete event_registrations" ON event_registrations;
DROP POLICY IF EXISTS "Service role bypass for event_registrations" ON event_registrations;

CREATE POLICY "Authenticated users can view event_registrations"
  ON event_registrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create event_registrations"
  ON event_registrations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update event_registrations"
  ON event_registrations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete event_registrations"
  ON event_registrations FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Service role bypass for event_registrations"
  ON event_registrations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Fix escalations table policies
-- ============================================================================

DROP POLICY IF EXISTS "Service role has full access to escalations" ON escalations;
DROP POLICY IF EXISTS "Authenticated users can view escalations" ON escalations;
DROP POLICY IF EXISTS "Authenticated users can create escalations" ON escalations;
DROP POLICY IF EXISTS "Authenticated users can update escalations" ON escalations;
DROP POLICY IF EXISTS "Authenticated users can delete escalations" ON escalations;
DROP POLICY IF EXISTS "Service role bypass for escalations" ON escalations;

CREATE POLICY "Authenticated users can view escalations"
  ON escalations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create escalations"
  ON escalations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update escalations"
  ON escalations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete escalations"
  ON escalations FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Service role bypass for escalations"
  ON escalations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Fix communications table policies
-- ============================================================================

DROP POLICY IF EXISTS "Service role has full access to communications" ON communications;
DROP POLICY IF EXISTS "Authenticated users can view communications" ON communications;
DROP POLICY IF EXISTS "Authenticated users can create communications" ON communications;
DROP POLICY IF EXISTS "Authenticated users can update communications" ON communications;
DROP POLICY IF EXISTS "Authenticated users can delete communications" ON communications;
DROP POLICY IF EXISTS "Service role bypass for communications" ON communications;

CREATE POLICY "Authenticated users can view communications"
  ON communications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create communications"
  ON communications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update communications"
  ON communications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete communications"
  ON communications FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Service role bypass for communications"
  ON communications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Grant table permissions to authenticated and service_role
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON escalations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON communications TO authenticated;

GRANT ALL ON events TO service_role;
GRANT ALL ON event_registrations TO service_role;
GRANT ALL ON escalations TO service_role;
GRANT ALL ON communications TO service_role;
