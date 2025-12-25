import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, HKF_ORG_ID } from "@/lib/supabase";

export interface Payment {
  id: string;
  organization_id: string;
  person_id: string;
  program_id: string | null;
  enrollment_id: string | null;
  amount: number;
  currency: string;
  description: string | null;
  status: "pending" | "completed" | "failed" | "refunded" | "cancelled";
  provider: string | null;
  external_id: string | null;
  external_data: Record<string, unknown> | null;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithDetails extends Payment {
  person_name: string;
  person_email: string | null;
  program_name: string | null;
}

/**
 * Fetch all payments with person and program details
 */
export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      // Get all payments
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      // Get people for name lookup
      const { data: people, error: peopleError } = await supabase
        .from("people")
        .select("id, first_name, last_name, email");

      if (peopleError) throw peopleError;

      // Get programs for name lookup
      const { data: programs, error: programsError } = await supabase
        .from("programs")
        .select("id, name");

      if (programsError) throw programsError;

      // Create lookup maps
      const peopleMap = new Map(
        (people || []).map((p) => [
          p.id,
          { name: `${p.first_name} ${p.last_name}`, email: p.email },
        ])
      );
      const programsMap = new Map((programs || []).map((p) => [p.id, p.name]));

      // Enrich payments with details
      return (payments || []).map((payment) => {
        const person = peopleMap.get(payment.person_id);
        return {
          ...payment,
          person_name: person?.name || "לא ידוע",
          person_email: person?.email,
          program_name: payment.program_id ? programsMap.get(payment.program_id) : null,
        } as PaymentWithDetails;
      });
    },
  });
}

/**
 * Fetch payment stats
 */
export function usePaymentStats() {
  return useQuery({
    queryKey: ["payment-stats"],
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("amount, status, created_at");

      if (error) throw error;

      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const completed = (payments || []).filter((p) => p.status === "completed");
      const pending = (payments || []).filter((p) => p.status === "pending");
      const thisMonthPayments = completed.filter(
        (p) => new Date(p.created_at) >= thisMonth
      );

      return {
        totalCompleted: completed.reduce((sum, p) => sum + p.amount, 0),
        totalPending: pending.reduce((sum, p) => sum + p.amount, 0),
        completedCount: completed.length,
        pendingCount: pending.length,
        thisMonthTotal: thisMonthPayments.reduce((sum, p) => sum + p.amount, 0),
        thisMonthCount: thisMonthPayments.length,
      };
    },
  });
}

/**
 * Create a new payment
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: Omit<Payment, "id" | "organization_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          ...payment,
          organization_id: HKF_ORG_ID,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
    },
  });
}

/**
 * Update a payment
 */
export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Payment> & { id: string }) => {
      const { data, error } = await supabase
        .from("payments")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
    },
  });
}

/**
 * Mark payment as completed
 */
export function useCompletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase
        .from("payments")
        .update({
          status: "completed",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .select()
        .single();

      if (error) throw error;
      return data as Payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
    },
  });
}

/**
 * Cancel a payment
 */
export function useCancelPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase
        .from("payments")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .select()
        .single();

      if (error) throw error;
      return data as Payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
    },
  });
}
