import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useInterviewsWithDetails,
  useCancelInterview,
  useUpdateInterview,
  type Interview,
} from "@/hooks/useInterviews";

type StatusFilter = "all" | "scheduled" | "completed" | "cancelled";

const statusVariants: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  no_show: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const statusLabels: Record<string, string> = {
  scheduled: "מתוכנן",
  completed: "הושלם",
  no_show: "לא הגיע",
  cancelled: "בוטל",
};

const recommendationLabels: Record<string, { label: string; variant: string }> = {
  strong_accept: { label: "לקבל בהחלט", variant: "bg-green-600 text-white" },
  accept: { label: "לקבל", variant: "bg-green-100 text-green-800" },
  maybe: { label: "אולי", variant: "bg-yellow-100 text-yellow-800" },
  reject: { label: "לדחות", variant: "bg-red-100 text-red-800" },
  strong_reject: { label: "לדחות בהחלט", variant: "bg-red-600 text-white" },
};

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("he-IL", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  return parts.map((p) => p.charAt(0)).join("").toUpperCase().slice(0, 2);
}

function isToday(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isPast(dateString: string | null): boolean {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
}

interface InterviewsProps {
  onSelectPerson?: (personId: string) => void;
}

export function Interviews({ onSelectPerson }: InterviewsProps) {
  const { data: interviews, isLoading, refetch } = useInterviewsWithDetails();
  const cancelInterview = useCancelInterview();
  const updateInterview = useUpdateInterview();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cancellingInterview, setCancellingInterview] = useState<Interview | null>(null);
  const [markingNoShow, setMarkingNoShow] = useState<Interview | null>(null);

  // Filter interviews based on selected tab
  const filteredInterviews = useMemo(() => {
    if (!interviews) return [];
    if (statusFilter === "all") return interviews;
    return interviews.filter((interview) => interview.status === statusFilter);
  }, [interviews, statusFilter]);

  // Separate upcoming and past interviews for scheduled tab
  const { upcomingInterviews, todayInterviews, pastScheduledInterviews } = useMemo(() => {
    const scheduled = filteredInterviews.filter((i) => i.status === "scheduled");
    const now = new Date();

    return {
      todayInterviews: scheduled.filter((i) => isToday(i.scheduled_at)),
      upcomingInterviews: scheduled.filter(
        (i) => i.scheduled_at && new Date(i.scheduled_at) > now && !isToday(i.scheduled_at)
      ),
      pastScheduledInterviews: scheduled.filter(
        (i) => i.scheduled_at && new Date(i.scheduled_at) < now && !isToday(i.scheduled_at)
      ),
    };
  }, [filteredInterviews]);

  // Stats
  const stats = useMemo(() => {
    if (!interviews) return { scheduled: 0, today: 0, completed: 0, pending: 0 };
    return {
      scheduled: interviews.filter((i) => i.status === "scheduled").length,
      today: interviews.filter((i) => i.status === "scheduled" && isToday(i.scheduled_at)).length,
      completed: interviews.filter((i) => i.status === "completed").length,
      pending: interviews.filter(
        (i) => i.status === "scheduled" && isPast(i.scheduled_at)
      ).length,
    };
  }, [interviews]);

  const handleCancelInterview = () => {
    if (cancellingInterview) {
      cancelInterview.mutate(cancellingInterview.id, {
        onSuccess: () => setCancellingInterview(null),
      });
    }
  };

  const handleMarkNoShow = () => {
    if (markingNoShow) {
      updateInterview.mutate(
        { id: markingNoShow.id, status: "no_show" },
        { onSuccess: () => setMarkingNoShow(null) }
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">ראיונות</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ניהול ומעקב אחר ראיונות מועמדים
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.scheduled}</div>
                <div className="text-sm text-muted-foreground">מתוכננים</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-full">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.today}</div>
                <div className="text-sm text-muted-foreground">היום</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.completed}</div>
                <div className="text-sm text-muted-foreground">הושלמו</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.pending}</div>
                <div className="text-sm text-muted-foreground">ממתינים לעדכון</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interviews Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">
            רשימת ראיונות {filteredInterviews?.length ? `(${filteredInterviews.length})` : ""}
          </CardTitle>
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3">
                הכל
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="text-xs px-3">
                מתוכננים
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs px-3">
                הושלמו
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs px-3">
                בוטלו
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען ראיונות...</div>
          ) : !filteredInterviews?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>אין ראיונות בסטטוס זה</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    מועמד
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    תאריך ושעה
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    סטטוס
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    ציון
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    המלצה
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterviews.map((interview) => {
                  const isPastInterview = isPast(interview.scheduled_at);
                  const isTodayInterview = isToday(interview.scheduled_at);

                  return (
                    <TableRow
                      key={interview.id}
                      className={`hover:bg-muted/50 ${
                        isTodayInterview && interview.status === "scheduled"
                          ? "bg-yellow-50 dark:bg-yellow-900/10"
                          : ""
                      }`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="jarvis-gradient text-white text-xs">
                              {getInitials(interview.person_name || "")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{interview.person_name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              {interview.person_email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {interview.person_email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {formatDate(interview.scheduled_at)}
                              {isTodayInterview && (
                                <Badge variant="outline" className="mr-2 text-xs">
                                  היום
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(interview.scheduled_at)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusVariants[interview.status] || statusVariants.scheduled}
                        >
                          {statusLabels[interview.status] || interview.status}
                        </Badge>
                        {interview.status === "scheduled" && isPastInterview && !isTodayInterview && (
                          <Badge variant="destructive" className="mr-2 text-xs">
                            עבר
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {interview.score !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">{interview.score}</span>
                            <span className="text-muted-foreground">/10</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {interview.recommendation ? (
                          <Badge
                            className={
                              recommendationLabels[interview.recommendation]?.variant ||
                              "bg-gray-100"
                            }
                          >
                            {recommendationLabels[interview.recommendation]?.label ||
                              interview.recommendation}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onSelectPerson?.(interview.person_id)}
                            >
                              <User className="w-4 h-4 ml-2" />
                              צפה במועמד
                            </DropdownMenuItem>
                            {interview.status === "scheduled" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setMarkingNoShow(interview)}
                                  className="text-orange-600"
                                >
                                  <XCircle className="w-4 h-4 ml-2" />
                                  סמן כלא הגיע
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setCancellingInterview(interview)}
                                  className="text-destructive"
                                >
                                  <XCircle className="w-4 h-4 ml-2" />
                                  בטל ראיון
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cancel Interview Dialog */}
      <AlertDialog
        open={!!cancellingInterview}
        onOpenChange={() => setCancellingInterview(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם לבטל את הראיון?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תבטל את הראיון עם {cancellingInterview?.person_name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>חזור</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInterview}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelInterview.isPending ? "מבטל..." : "בטל ראיון"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark No-Show Dialog */}
      <AlertDialog open={!!markingNoShow} onOpenChange={() => setMarkingNoShow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>סמן כלא הגיע?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תסמן את {markingNoShow?.person_name} כמי שלא הגיע לראיון.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>חזור</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkNoShow}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {updateInterview.isPending ? "מעדכן..." : "סמן כלא הגיע"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Interviews;
