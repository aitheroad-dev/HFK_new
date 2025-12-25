import { useState, useMemo } from "react";
import { Plus, MoreHorizontal, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiActionButton } from "@/components/jarvis";
import { usePeopleWithEnrollments, type PersonWithEnrollment } from "@/hooks/usePeople";
import { useDashboardStats } from "@/hooks/useDashboardStats";

const statusVariants: Record<string, string> = {
  applied: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  interviewing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  enrolled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const statusLabels: Record<string, string> = {
  applied: "הגיש מועמדות",
  interviewing: "בראיון",
  accepted: "התקבל",
  enrolled: "רשום",
  pending: "ממתין",
  active: "פעיל",
};

function getAiAction(person: PersonWithEnrollment): string {
  const status = person.enrollment_status || person.status;
  switch (status) {
    case "applied":
      return "קבע ראיון";
    case "interviewing":
      return "רשום תוצאה";
    case "accepted":
      return "שלח מייל קבלה";
    case "enrolled":
      return "צפה בהתקדמות";
    default:
      return "צפה בפרופיל";
  }
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("he-IL", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `${Math.round(amount / 1000)}K`;
  }
  return amount.toString();
}

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "neutral";
  isLoading?: boolean;
}

function StatCard({ title, value, change, trend, isLoading }: StatCardProps) {
  return (
    <Card className="p-3">
      <CardDescription className="text-xs">{title}</CardDescription>
      {isLoading ? (
        <div className="h-6 w-10 bg-muted animate-pulse rounded mt-1" />
      ) : (
        <div className="text-xl font-bold text-primary mt-1">{value}</div>
      )}
      {change && (
        <p
          className={`text-xs mt-0.5 ${trend === "up" ? "text-accent" : "text-muted-foreground"}`}
        >
          {change}
        </p>
      )}
    </Card>
  );
}

interface DashboardProps {
  onViewPeople?: () => void;
  onAddPerson?: () => void;
  onSelectPerson?: (person: PersonWithEnrollment) => void;
}

type StatusFilter = "all" | "applied" | "interviewing" | "accepted";

export function Dashboard({ onViewPeople, onAddPerson, onSelectPerson }: DashboardProps) {
  const { data: people, isLoading: peopleLoading, refetch } = usePeopleWithEnrollments();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Filter people based on selected tab
  const filteredPeople = useMemo(() => {
    if (!people) return [];
    if (statusFilter === "all") return people;
    return people.filter((person) => {
      const status = person.enrollment_status || person.status;
      return status === statusFilter;
    });
  }, [people, statusFilter]);

  // Export people to CSV
  const handleExport = () => {
    if (!people || people.length === 0) return;

    const headers = ["שם פרטי", "שם משפחה", "אימייל", "טלפון", "סטטוס", "תוכנית", "תאריך הגשה"];
    const csvContent = [
      headers.join(","),
      ...people.map((p) => [
        p.first_name,
        p.last_name,
        p.email || "",
        p.phone || "",
        p.enrollment_status || p.status,
        p.program_name || "",
        p.applied_at || p.created_at || "",
      ].map(field => `"${field}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `people_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">לוח בקרה</h1>
          <p className="text-sm text-muted-foreground mt-1">
            סקירת CRM - נתונים בזמן אמת
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!people?.length}>
            <Download className="w-4 h-4 ml-2" />
            ייצוא
          </Button>
          <Button onClick={onAddPerson}>
            <Plus className="w-4 h-4 ml-2" />
            הוסף איש
          </Button>
        </div>
      </div>

      {/* Stats Grid - 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          title="סה״כ אנשים"
          value={stats?.totalPeople.toString() || "0"}
          change={stats?.recentActivity.newThisWeek ? `+${stats.recentActivity.newThisWeek} השבוע` : undefined}
          trend={stats?.recentActivity.newThisWeek ? "up" : "neutral"}
          isLoading={statsLoading}
        />
        <StatCard
          title="ראיונות ממתינים"
          value={stats?.pendingInterviews.toString() || "0"}
          change={stats?.recentActivity.interviewsToday ? `${stats.recentActivity.interviewsToday} היום` : undefined}
          isLoading={statsLoading}
        />
        <StatCard
          title="התקבלו"
          value={stats?.acceptedCount.toString() || "0"}
          isLoading={statsLoading}
        />
        <StatCard
          title="תשלומים"
          value={stats?.totalPayments ? formatCurrency(stats.totalPayments) : "0"}
          isLoading={statsLoading}
        />
      </div>

      {/* People Table */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-base">
              אנשים {filteredPeople?.length ? `(${filteredPeople.length})` : ""}
            </CardTitle>
            {onViewPeople && (
              <Button variant="link" className="h-auto p-0 text-sm" onClick={onViewPeople}>
                צפה בכולם
              </Button>
            )}
          </div>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} className="w-full sm:w-auto overflow-x-auto">
            <TabsList className="h-8 w-full sm:w-auto">
              <TabsTrigger value="all" className="text-xs px-2 sm:px-3 flex-1 sm:flex-none">
                הכל
              </TabsTrigger>
              <TabsTrigger value="applied" className="text-xs px-2 sm:px-3 flex-1 sm:flex-none">
                הגישו מועמדות
              </TabsTrigger>
              <TabsTrigger value="interviewing" className="text-xs px-2 sm:px-3 flex-1 sm:flex-none">
                בראיון
              </TabsTrigger>
              <TabsTrigger value="accepted" className="text-xs px-2 sm:px-3 flex-1 sm:flex-none">
                התקבלו
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {peopleLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              טוען אנשים מהמסד נתונים...
            </div>
          ) : !filteredPeople?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              {statusFilter === "all"
                ? "לא נמצאו אנשים. הוסף מישהו כדי להתחיל."
                : `לא נמצאו אנשים בסטטוס "${statusLabels[statusFilter] || statusFilter}".`}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    שם
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    תוכנית
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    סטטוס
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    נוסף
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    פעולות AI
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeople.map((person) => {
                  const displayStatus = person.enrollment_status || person.status;
                  return (
                    <TableRow
                      key={person.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => onSelectPerson?.(person)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="jarvis-gradient text-white text-xs">
                              {getInitials(person.first_name, person.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {person.first_name} {person.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {person.email || "אין אימייל"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{person.program_name || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusVariants[displayStatus] || statusVariants.pending}
                        >
                          {statusLabels[displayStatus] || displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(person.applied_at || person.created_at)}
                      </TableCell>
                      <TableCell>
                        <AiActionButton
                          label={getAiAction(person)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPerson?.(person);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
