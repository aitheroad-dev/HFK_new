import { createClient } from "@supabase/supabase-js";

// Supabase client for the HKF CRM
// Uses VITE_ prefixed env vars for browser access
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Default organization ID for HKF
// In production, this would come from auth context
export const DEFAULT_ORG_ID = "2542c6fe-3707-4dd8-abc5-bc70feac7e81";
