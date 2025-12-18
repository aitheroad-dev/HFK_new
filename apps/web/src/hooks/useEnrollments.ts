import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, DEFAULT_ORG_ID } from "@/lib/supabase";

export type EnrollmentStatus =
  | "applied"
  | "interviewing"
  | "accepted"
  | "rejected"
  | "enrolled"
  | "withdrawn";

export interface Enrollment {
  id: string;
  organization_id: string;
  person_id: string;
  program_id: string;
  cohort_id: string | null;
  status: EnrollmentStatus;
  applied_at: string;
  decision_at: string | null;
  decision_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Update enrollment status (accept/reject a candidate)
 */
export function useUpdateEnrollmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      personId,
      status,
      decisionNotes,
    }: {
      personId: string;
      status: EnrollmentStatus;
      decisionNotes?: string;
    }) => {
      // Find the enrollment for this person
      const { data: enrollment, error: findError } = await supabase
        .from("enrollments")
        .select("id")
        .eq("person_id", personId)
        .single();

      if (findError) {
        // If no enrollment exists, we need to create one
        // But for now, let's just update the person's status directly
        const { error: personError } = await supabase
          .from("people")
          .update({
            status,
            updated_at: new Date().toISOString()
          })
          .eq("id", personId);

        if (personError) throw personError;
        return { personId, status };
      }

      // Update the enrollment
      const { data, error } = await supabase
        .from("enrollments")
        .update({
          status,
          decision_at: new Date().toISOString(),
          decision_notes: decisionNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id)
        .select()
        .single();

      if (error) throw error;

      // Also update the person's status for consistency
      await supabase
        .from("people")
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq("id", personId);

      return data as Enrollment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["people-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["person", variables.personId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    },
  });
}

/**
 * Accept a candidate
 */
export function useAcceptCandidate() {
  const updateStatus = useUpdateEnrollmentStatus();

  return {
    ...updateStatus,
    mutate: (params: { personId: string; notes?: string }, options?: Parameters<typeof updateStatus.mutate>[1]) => {
      updateStatus.mutate(
        { personId: params.personId, status: "accepted", decisionNotes: params.notes },
        options
      );
    },
    mutateAsync: (params: { personId: string; notes?: string }) => {
      return updateStatus.mutateAsync({
        personId: params.personId,
        status: "accepted",
        decisionNotes: params.notes,
      });
    },
  };
}

/**
 * Reject a candidate
 */
export function useRejectCandidate() {
  const updateStatus = useUpdateEnrollmentStatus();

  return {
    ...updateStatus,
    mutate: (params: { personId: string; notes?: string }, options?: Parameters<typeof updateStatus.mutate>[1]) => {
      updateStatus.mutate(
        { personId: params.personId, status: "rejected", decisionNotes: params.notes },
        options
      );
    },
    mutateAsync: (params: { personId: string; notes?: string }) => {
      return updateStatus.mutateAsync({
        personId: params.personId,
        status: "rejected",
        decisionNotes: params.notes,
      });
    },
  };
}
