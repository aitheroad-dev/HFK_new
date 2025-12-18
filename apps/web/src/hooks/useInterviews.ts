import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, DEFAULT_ORG_ID } from "@/lib/supabase";

export interface Interview {
  id: string;
  organization_id: string;
  person_id: string;
  interviewer_id: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  score: number | null;
  scores_breakdown: Record<string, number>;
  notes: string | null;
  recommendation: "strong_accept" | "accept" | "maybe" | "reject" | "strong_reject" | null;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface InterviewWithDetails extends Interview {
  person_name?: string;
  interviewer_name?: string;
}

/**
 * Fetch all interviews for the current organization
 */
export function useInterviews(organizationId: string = DEFAULT_ORG_ID) {
  return useQuery({
    queryKey: ["interviews", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .eq("organization_id", organizationId)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as Interview[];
    },
  });
}

/**
 * Fetch interviews for a specific person
 */
export function usePersonInterviews(personId: string | undefined) {
  return useQuery({
    queryKey: ["interviews", "person", personId],
    queryFn: async () => {
      if (!personId) return [];

      const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .eq("person_id", personId)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      return data as Interview[];
    },
    enabled: !!personId,
  });
}

/**
 * Schedule a new interview
 */
export function useScheduleInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interview: {
      person_id: string;
      organization_id?: string;
      scheduled_at: string;
      interviewer_id?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("interviews")
        .insert({
          ...interview,
          organization_id: interview.organization_id || DEFAULT_ORG_ID,
          status: "scheduled",
          scores_breakdown: {},
        })
        .select()
        .single();

      if (error) throw error;
      return data as Interview;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["interviews", "person", data.person_id] });
      queryClient.invalidateQueries({ queryKey: ["people-enrollments"] });
    },
  });
}

/**
 * Update an interview (reschedule, add feedback, etc.)
 */
export function useUpdateInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Interview> & { id: string }) => {
      const { data, error } = await supabase
        .from("interviews")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Interview;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["interviews", "person", data.person_id] });
      queryClient.invalidateQueries({ queryKey: ["people-enrollments"] });
    },
  });
}

/**
 * Complete an interview with feedback
 */
export function useCompleteInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      score,
      scores_breakdown,
      notes,
      recommendation,
    }: {
      id: string;
      score: number;
      scores_breakdown?: Record<string, number>;
      notes?: string;
      recommendation: Interview["recommendation"];
    }) => {
      const { data, error } = await supabase
        .from("interviews")
        .update({
          score,
          scores_breakdown: scores_breakdown || {},
          notes,
          recommendation,
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Interview;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["interviews", "person", data.person_id] });
      queryClient.invalidateQueries({ queryKey: ["people-enrollments"] });
    },
  });
}

/**
 * Cancel an interview
 */
export function useCancelInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interviewId: string) => {
      const { data, error } = await supabase
        .from("interviews")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", interviewId)
        .select()
        .single();

      if (error) throw error;
      return data as Interview;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["interviews", "person", data.person_id] });
      queryClient.invalidateQueries({ queryKey: ["people-enrollments"] });
    },
  });
}
