import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DashboardStats {
  totalPeople: number;
  pendingInterviews: number;
  acceptedCount: number;
  totalPayments: number;
  recentActivity: {
    newThisWeek: number;
    interviewsToday: number;
  };
}

/**
 * Fetch dashboard statistics (single-tenant - no org filter needed)
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // Get total people count
      const { count: totalPeople } = await supabase
        .from("people")
        .select("*", { count: "exact", head: true });

      // Get pending interviews count
      const { count: pendingInterviews } = await supabase
        .from("interviews")
        .select("*", { count: "exact", head: true })
        .eq("status", "scheduled");

      // Get accepted enrollments count
      const { count: acceptedCount } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted");

      // Get total payments amount
      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "completed");

      const totalPayments = (payments || []).reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );

      // Get people added this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { count: newThisWeek } = await supabase
        .from("people")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString());

      // Get interviews scheduled for today
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { count: interviewsToday } = await supabase
        .from("interviews")
        .select("*", { count: "exact", head: true })
        .eq("status", "scheduled")
        .gte("scheduled_at", startOfDay)
        .lte("scheduled_at", endOfDay);

      return {
        totalPeople: totalPeople || 0,
        pendingInterviews: pendingInterviews || 0,
        acceptedCount: acceptedCount || 0,
        totalPayments,
        recentActivity: {
          newThisWeek: newThisWeek || 0,
          interviewsToday: interviewsToday || 0,
        },
      } as DashboardStats;
    },
  });
}
