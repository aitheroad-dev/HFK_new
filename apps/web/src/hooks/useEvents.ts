import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, HKF_ORG_ID } from "@/lib/supabase";

export interface Event {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  location: string | null;
  location_url: string | null;
  capacity: number | null;
  registration_count: number;
  target_audience: {
    programIds?: string[];
    cohortIds?: string[];
    statuses?: string[];
    tags?: string[];
  };
  status: "draft" | "published" | "cancelled" | "completed";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  organization_id: string;
  event_id: string;
  person_id: string;
  status: "registered" | "cancelled" | "waitlisted" | "attended" | "no_show";
  guests: number;
  checked_in_at: string | null;
  notes: string | null;
  registered_at: string;
  created_at: string;
  updated_at: string;
}

export interface EventRegistrationWithDetails extends EventRegistration {
  person_name: string;
  person_email: string | null;
}

export interface EventWithStats extends Event {
  registrations_count: number;
  attended_count: number;
}

/**
 * Fetch all events with registration stats
 */
export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      // Get all events
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: false });

      if (eventsError) throw eventsError;

      // Get registration counts per event
      const { data: registrations, error: registrationsError } = await supabase
        .from("event_registrations")
        .select("event_id, status");

      if (registrationsError) throw registrationsError;

      // Calculate stats per event
      return (events || []).map((event) => {
        const eventRegs = (registrations || []).filter((r) => r.event_id === event.id);
        return {
          ...event,
          registrations_count: eventRegs.filter(
            (r) => r.status === "registered" || r.status === "attended"
          ).length,
          attended_count: eventRegs.filter((r) => r.status === "attended").length,
        } as EventWithStats;
      });
    },
  });
}

/**
 * Fetch a single event by ID
 */
export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (error) throw error;
      return data as Event;
    },
    enabled: !!eventId,
  });
}

/**
 * Fetch registrations for an event
 */
export function useEventRegistrations(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-registrations", eventId],
    queryFn: async () => {
      if (!eventId) return [];

      // Get registrations
      const { data: registrations, error: registrationsError } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .order("registered_at", { ascending: false });

      if (registrationsError) throw registrationsError;

      // Get people for name lookup
      const { data: people, error: peopleError } = await supabase
        .from("people")
        .select("id, first_name, last_name, email");

      if (peopleError) throw peopleError;

      // Create lookup map
      const peopleMap = new Map(
        (people || []).map((p) => [
          p.id,
          { name: `${p.first_name} ${p.last_name}`, email: p.email },
        ])
      );

      // Enrich registrations with person details
      return (registrations || []).map((reg) => {
        const person = peopleMap.get(reg.person_id);
        return {
          ...reg,
          person_name: person?.name || "לא ידוע",
          person_email: person?.email,
        } as EventRegistrationWithDetails;
      });
    },
    enabled: !!eventId,
  });
}

/**
 * Create a new event
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: Omit<Event, "id" | "organization_id" | "created_at" | "updated_at" | "registration_count">) => {
      const { data, error } = await supabase
        .from("events")
        .insert({
          ...event,
          organization_id: HKF_ORG_ID,
          registration_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

/**
 * Update an event
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Event> & { id: string }) => {
      const { data, error } = await supabase
        .from("events")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Event;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", data.id] });
    },
  });
}

/**
 * Delete an event
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("events").delete().eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

/**
 * Check in a registration
 */
export function useCheckInRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registrationId, eventId }: { registrationId: string; eventId: string }) => {
      const { data, error } = await supabase
        .from("event_registrations")
        .update({
          status: "attended",
          checked_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", registrationId)
        .select()
        .single();

      if (error) throw error;
      return { data, eventId };
    },
    onSuccess: ({ eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

/**
 * Cancel a registration
 */
export function useCancelRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ registrationId, eventId }: { registrationId: string; eventId: string }) => {
      const { data, error } = await supabase
        .from("event_registrations")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", registrationId)
        .select()
        .single();

      if (error) throw error;
      return { data, eventId };
    },
    onSuccess: ({ eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
