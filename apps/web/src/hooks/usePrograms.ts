import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Program {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: string | null;
  config: ProgramConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramConfig {
  requiresInterview?: boolean;
  requiresPayment?: boolean;
  paymentAmount?: number;
  currency?: string;
  maxParticipants?: number;
}

export interface Cohort {
  id: string;
  organization_id: string;
  program_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  max_participants: number | null;
  status: "draft" | "open" | "closed" | "completed";
  created_at: string;
  updated_at: string;
}

export interface CohortWithStats extends Cohort {
  enrolled_count: number;
}

export interface ProgramStats {
  program_id: string;
  program_name: string;
  total_enrollments: number;
  applied: number;
  interviewing: number;
  accepted: number;
  enrolled: number;
}

export interface ProgramWithStats extends Program {
  cohorts_count: number;
  total_enrollments: number;
  active_cohorts: number;
}

// Get organization ID for mutations (single-tenant)
const getOrgId = () => import.meta.env.VITE_HKF_ORG_ID || "00000000-0000-0000-0000-000000000001";

/**
 * Fetch all programs with stats (single-tenant - no org filter needed)
 */
export function usePrograms() {
  return useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Program[];
    },
  });
}

/**
 * Fetch all programs with enrollment and cohort stats
 */
export function useProgramsWithStats() {
  return useQuery({
    queryKey: ["programs-with-stats"],
    queryFn: async () => {
      // Get all programs
      const { data: programs, error: programsError } = await supabase
        .from("programs")
        .select("*")
        .order("name");

      if (programsError) throw programsError;

      // Get cohorts count per program
      const { data: cohorts, error: cohortsError } = await supabase
        .from("cohorts")
        .select("program_id, status");

      if (cohortsError) throw cohortsError;

      // Get enrollments count per program
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("program_id");

      if (enrollmentsError) throw enrollmentsError;

      // Calculate stats per program
      return (programs || []).map((program) => {
        const programCohorts = (cohorts || []).filter(c => c.program_id === program.id);
        const programEnrollments = (enrollments || []).filter(e => e.program_id === program.id);

        return {
          ...program,
          cohorts_count: programCohorts.length,
          active_cohorts: programCohorts.filter(c => c.status === "open").length,
          total_enrollments: programEnrollments.length,
        } as ProgramWithStats;
      });
    },
  });
}

/**
 * Fetch a single program by ID
 */
export function useProgram(programId: string | undefined) {
  return useQuery({
    queryKey: ["program", programId],
    queryFn: async () => {
      if (!programId) return null;

      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("id", programId)
        .single();

      if (error) throw error;
      return data as Program;
    },
    enabled: !!programId,
  });
}

/**
 * Create a new program
 */
export function useCreateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (program: Omit<Program, "id" | "organization_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("programs")
        .insert({
          ...program,
          organization_id: getOrgId(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Program;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["programs-with-stats"] });
    },
  });
}

/**
 * Update an existing program
 */
export function useUpdateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Program> & { id: string }) => {
      const { data, error } = await supabase
        .from("programs")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Program;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["programs-with-stats"] });
      queryClient.invalidateQueries({ queryKey: ["program", data.id] });
    },
  });
}

/**
 * Delete (deactivate) a program
 */
export function useDeleteProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (programId: string) => {
      const { error } = await supabase
        .from("programs")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", programId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["programs-with-stats"] });
    },
  });
}

/**
 * Fetch program stats with enrollment counts
 */
export function useProgramStats() {
  return useQuery({
    queryKey: ["program-stats"],
    queryFn: async () => {
      // Get programs
      const { data: programs, error: programsError } = await supabase
        .from("programs")
        .select("id, name")
        .eq("is_active", true);

      if (programsError) throw programsError;

      // Get enrollment counts grouped by status
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("program_id, status");

      if (enrollmentsError) throw enrollmentsError;

      // Calculate stats per program
      const statsMap = new Map<string, ProgramStats>();

      for (const program of programs || []) {
        statsMap.set(program.id, {
          program_id: program.id,
          program_name: program.name,
          total_enrollments: 0,
          applied: 0,
          interviewing: 0,
          accepted: 0,
          enrolled: 0,
        });
      }

      for (const enrollment of enrollments || []) {
        const stats = statsMap.get(enrollment.program_id);
        if (stats) {
          stats.total_enrollments++;
          if (enrollment.status === "applied") stats.applied++;
          if (enrollment.status === "interviewing") stats.interviewing++;
          if (enrollment.status === "accepted") stats.accepted++;
          if (enrollment.status === "enrolled") stats.enrolled++;
        }
      }

      return Array.from(statsMap.values());
    },
  });
}

// ============ COHORT HOOKS ============

/**
 * Fetch all cohorts for a program
 */
export function useCohorts(programId: string | undefined) {
  return useQuery({
    queryKey: ["cohorts", programId],
    queryFn: async () => {
      if (!programId) return [];

      const { data: cohorts, error: cohortsError } = await supabase
        .from("cohorts")
        .select("*")
        .eq("program_id", programId)
        .order("start_date", { ascending: false });

      if (cohortsError) throw cohortsError;

      // Get enrollment counts per cohort
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("cohort_id")
        .in("cohort_id", (cohorts || []).map(c => c.id));

      if (enrollmentsError) throw enrollmentsError;

      // Calculate enrolled count per cohort
      return (cohorts || []).map((cohort) => {
        const cohortEnrollments = (enrollments || []).filter(e => e.cohort_id === cohort.id);
        return {
          ...cohort,
          enrolled_count: cohortEnrollments.length,
        } as CohortWithStats;
      });
    },
    enabled: !!programId,
  });
}

/**
 * Fetch a single cohort by ID
 */
export function useCohort(cohortId: string | undefined) {
  return useQuery({
    queryKey: ["cohort", cohortId],
    queryFn: async () => {
      if (!cohortId) return null;

      const { data, error } = await supabase
        .from("cohorts")
        .select("*")
        .eq("id", cohortId)
        .single();

      if (error) throw error;
      return data as Cohort;
    },
    enabled: !!cohortId,
  });
}

/**
 * Create a new cohort
 */
export function useCreateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cohort: Omit<Cohort, "id" | "organization_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("cohorts")
        .insert({
          ...cohort,
          organization_id: getOrgId(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Cohort;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cohorts", data.program_id] });
      queryClient.invalidateQueries({ queryKey: ["programs-with-stats"] });
    },
  });
}

/**
 * Update an existing cohort
 */
export function useUpdateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cohort> & { id: string }) => {
      const { data, error } = await supabase
        .from("cohorts")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Cohort;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cohorts", data.program_id] });
      queryClient.invalidateQueries({ queryKey: ["cohort", data.id] });
      queryClient.invalidateQueries({ queryKey: ["programs-with-stats"] });
    },
  });
}

/**
 * Delete a cohort
 */
export function useDeleteCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cohortId, programId }: { cohortId: string; programId: string }) => {
      const { error } = await supabase
        .from("cohorts")
        .delete()
        .eq("id", cohortId);

      if (error) throw error;
      return { programId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cohorts", data.programId] });
      queryClient.invalidateQueries({ queryKey: ["programs-with-stats"] });
    },
  });
}
