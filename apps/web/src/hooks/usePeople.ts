import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, DEFAULT_ORG_ID } from "@/lib/supabase";

export interface Person {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive" | "pending" | "archived";
  metadata: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PersonWithEnrollment extends Person {
  enrollment_status?: string;
  program_name?: string;
  cohort_name?: string;
  applied_at?: string;
  interview_date?: string;
  notes?: string;
}

/**
 * Fetch all people for the current organization
 */
export function usePeople(organizationId: string = DEFAULT_ORG_ID) {
  return useQuery({
    queryKey: ["people", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Person[];
    },
  });
}

/**
 * Fetch people with their enrollment info
 */
export function usePeopleWithEnrollments(organizationId: string = DEFAULT_ORG_ID) {
  return useQuery({
    queryKey: ["people-enrollments", organizationId],
    queryFn: async () => {
      // First get people
      const { data: people, error: peopleError } = await supabase
        .from("people")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (peopleError) throw peopleError;

      // Then get enrollments with program and cohort info
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select(`
          person_id,
          status,
          applied_at,
          notes,
          programs (
            name
          ),
          cohorts (
            name
          )
        `)
        .eq("organization_id", organizationId);

      if (enrollmentsError) throw enrollmentsError;

      // Get interviews for these people
      const personIds = people?.map(p => p.id) || [];
      const { data: interviews } = await supabase
        .from("interviews")
        .select("person_id, scheduled_at")
        .in("person_id", personIds)
        .order("scheduled_at", { ascending: true });

      const interviewMap = new Map(
        interviews?.map((i) => [i.person_id, i.scheduled_at])
      );

      // Merge the data
      const enrollmentMap = new Map(
        enrollments?.map((e) => [
          e.person_id,
          {
            enrollment_status: e.status,
            program_name: (e.programs as { name: string })?.name,
            cohort_name: (e.cohorts as { name: string })?.name,
            applied_at: e.applied_at,
            notes: e.notes,
          },
        ])
      );

      return (people || []).map((person) => ({
        ...person,
        ...enrollmentMap.get(person.id),
        interview_date: interviewMap.get(person.id),
      })) as PersonWithEnrollment[];
    },
  });
}

/**
 * Fetch a single person by ID
 */
export function usePerson(personId: string | undefined) {
  return useQuery({
    queryKey: ["person", personId],
    queryFn: async () => {
      if (!personId) return null;

      const { data, error } = await supabase
        .from("people")
        .select("*")
        .eq("id", personId)
        .single();

      if (error) throw error;
      return data as Person;
    },
    enabled: !!personId,
  });
}

/**
 * Create a new person
 */
export function useCreatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      newPerson: Omit<Person, "id" | "created_at" | "updated_at">
    ) => {
      const { data, error } = await supabase
        .from("people")
        .insert(newPerson)
        .select()
        .single();

      if (error) throw error;
      return data as Person;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["people-enrollments"] });
    },
  });
}

/**
 * Update a person
 */
export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Person> & { id: string }) => {
      const { data, error } = await supabase
        .from("people")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Person;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["people-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["person", variables.id] });
    },
  });
}

/**
 * Delete a person
 */
export function useDeletePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (personId: string) => {
      const { error } = await supabase
        .from("people")
        .delete()
        .eq("id", personId);

      if (error) throw error;
      return personId;
    },
    onSuccess: (personId) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["people-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["person", personId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
