import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Program {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

/**
 * Fetch all programs (single-tenant - no org filter needed)
 */
export function usePrograms() {
  return useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Program[];
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
