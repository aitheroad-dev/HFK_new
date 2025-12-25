import { useState } from "react";
import {
  Plus,
  MoreHorizontal,
  Users,
  Calendar,
  GraduationCap,
  ChevronLeft,
  Edit,
  Trash2,
  FolderOpen,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  useProgramsWithStats,
  useCohorts,
  useDeleteProgram,
  useDeleteCohort,
  type ProgramWithStats,
  type CohortWithStats,
} from "@/hooks/usePrograms";
import { ProgramForm } from "@/components/hkf/ProgramForm";
import { CohortForm } from "@/components/hkf/CohortForm";

const programTypeLabels: Record<string, string> = {
  fellowship: "פלואושיפ",
  course: "קורס",
  workshop: "סדנה",
  membership: "חברות",
  track: "מסלול",
};

const cohortStatusVariants: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  open: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const cohortStatusLabels: Record<string, string> = {
  draft: "טיוטה",
  open: "פתוח להרשמה",
  closed: "סגור",
  completed: "הושלם",
};

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("he-IL", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ProgramsProps {
  onViewProgramEnrollments?: (programId: string) => void;
}

export function Programs({ onViewProgramEnrollments }: ProgramsProps) {
  const { data: programs, isLoading } = useProgramsWithStats();
  const deleteProgram = useDeleteProgram();

  // Dialog states
  const [isProgramFormOpen, setIsProgramFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramWithStats | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithStats | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<ProgramWithStats | null>(null);

  const handleEditProgram = (program: ProgramWithStats) => {
    setEditingProgram(program);
    setIsProgramFormOpen(true);
  };

  const handleDeleteProgram = () => {
    if (deletingProgram) {
      deleteProgram.mutate(deletingProgram.id, {
        onSuccess: () => {
          setDeletingProgram(null);
          if (selectedProgram?.id === deletingProgram.id) {
            setSelectedProgram(null);
          }
        },
      });
    }
  };

  const handleCloseForm = () => {
    setIsProgramFormOpen(false);
    setEditingProgram(null);
  };

  // Show program detail view
  if (selectedProgram) {
    return (
      <ProgramDetail
        program={selectedProgram}
        onBack={() => setSelectedProgram(null)}
        onEdit={() => handleEditProgram(selectedProgram)}
        onViewEnrollments={() => onViewProgramEnrollments?.(selectedProgram.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">תוכניות</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ניהול תוכניות ומחזורים
          </p>
        </div>
        <Button onClick={() => setIsProgramFormOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          תוכנית חדשה
        </Button>
      </div>

      {/* Programs Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !programs?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">אין תוכניות</h3>
            <p className="text-muted-foreground mb-4">
              צור תוכנית חדשה כדי להתחיל לנהל מחזורים והרשמות
            </p>
            <Button onClick={() => setIsProgramFormOpen(true)}>
              <Plus className="w-4 h-4 ml-2" />
              תוכנית חדשה
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.filter(p => p.is_active).map((program) => (
            <Card
              key={program.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedProgram(program)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                    {program.type && (
                      <CardDescription>
                        {programTypeLabels[program.type] || program.type}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleEditProgram(program);
                      }}>
                        <Edit className="w-4 h-4 ml-2" />
                        ערוך
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProgram(program);
                        }}
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        מחק
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {program.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {program.description}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-lg font-semibold">{program.cohorts_count}</div>
                    <div className="text-xs text-muted-foreground">מחזורים</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-lg font-semibold">{program.active_cohorts}</div>
                    <div className="text-xs text-muted-foreground">פתוחים</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-lg font-semibold">{program.total_enrollments}</div>
                    <div className="text-xs text-muted-foreground">הרשמות</div>
                  </div>
                </div>

                {/* Config badges */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {program.config?.requiresInterview && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="w-3 h-3 ml-1" />
                      דורש ראיון
                    </Badge>
                  )}
                  {program.config?.requiresPayment && (
                    <Badge variant="outline" className="text-xs">
                      ₪{program.config.paymentAmount?.toLocaleString() || "תשלום"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Program Form Dialog */}
      <ProgramForm
        open={isProgramFormOpen}
        onOpenChange={handleCloseForm}
        program={editingProgram}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingProgram} onOpenChange={() => setDeletingProgram(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק את התוכנית?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תבטל את התוכנית "{deletingProgram?.name}".
              {deletingProgram?.total_enrollments ? (
                <span className="block mt-2 text-destructive">
                  שים לב: יש {deletingProgram.total_enrollments} הרשמות לתוכנית זו.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProgram}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProgram.isPending ? "מוחק..." : "מחק"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ Program Detail View ============

interface ProgramDetailProps {
  program: ProgramWithStats;
  onBack: () => void;
  onEdit: () => void;
  onViewEnrollments?: () => void;
}

function ProgramDetail({ program, onBack, onEdit, onViewEnrollments }: ProgramDetailProps) {
  const { data: cohorts, isLoading: cohortsLoading } = useCohorts(program.id);
  const deleteCohort = useDeleteCohort();

  const [isCohortFormOpen, setIsCohortFormOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<CohortWithStats | null>(null);
  const [deletingCohort, setDeletingCohort] = useState<CohortWithStats | null>(null);

  const handleEditCohort = (cohort: CohortWithStats) => {
    setEditingCohort(cohort);
    setIsCohortFormOpen(true);
  };

  const handleDeleteCohort = () => {
    if (deletingCohort) {
      deleteCohort.mutate(
        { cohortId: deletingCohort.id, programId: program.id },
        { onSuccess: () => setDeletingCohort(null) }
      );
    }
  };

  const handleCloseCohortForm = () => {
    setIsCohortFormOpen(false);
    setEditingCohort(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">{program.name}</h1>
          {program.type && (
            <p className="text-sm text-muted-foreground">
              {programTypeLabels[program.type] || program.type}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={onEdit}>
          <Edit className="w-4 h-4 ml-2" />
          ערוך תוכנית
        </Button>
      </div>

      {/* Program Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{program.cohorts_count}</div>
                <div className="text-sm text-muted-foreground">מחזורים</div>
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
                <div className="text-2xl font-bold">{program.active_cohorts}</div>
                <div className="text-sm text-muted-foreground">מחזורים פתוחים</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{program.total_enrollments}</div>
                <div className="text-sm text-muted-foreground">הרשמות</div>
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
                <div className="text-2xl font-bold">
                  {program.config?.requiresInterview ? "כן" : "לא"}
                </div>
                <div className="text-sm text-muted-foreground">דורש ראיון</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Program Description */}
      {program.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">תיאור</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{program.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Cohorts Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">מחזורים</CardTitle>
          <Button size="sm" onClick={() => setIsCohortFormOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            מחזור חדש
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {cohortsLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען מחזורים...</div>
          ) : !cohorts?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>אין מחזורים. צור מחזור חדש כדי להתחיל.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">שם מחזור</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">תאריך התחלה</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">תאריך סיום</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">משתתפים</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">סטטוס</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.map((cohort) => (
                  <TableRow key={cohort.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{cohort.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(cohort.start_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(cohort.end_date)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{cohort.enrolled_count}</span>
                      {cohort.max_participants && (
                        <span className="text-muted-foreground">/{cohort.max_participants}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cohortStatusVariants[cohort.status] || cohortStatusVariants.draft}
                      >
                        {cohortStatusLabels[cohort.status] || cohort.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCohort(cohort)}>
                            <Edit className="w-4 h-4 ml-2" />
                            ערוך
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeletingCohort(cohort)}
                          >
                            <Trash2 className="w-4 h-4 ml-2" />
                            מחק
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cohort Form Dialog */}
      <CohortForm
        open={isCohortFormOpen}
        onOpenChange={handleCloseCohortForm}
        programId={program.id}
        cohort={editingCohort}
      />

      {/* Delete Cohort Confirmation Dialog */}
      <AlertDialog open={!!deletingCohort} onOpenChange={() => setDeletingCohort(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק את המחזור?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את המחזור "{deletingCohort?.name}" לצמיתות.
              {deletingCohort?.enrolled_count ? (
                <span className="block mt-2 text-destructive">
                  שים לב: יש {deletingCohort.enrolled_count} משתתפים במחזור זה.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCohort}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCohort.isPending ? "מוחק..." : "מחק"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Programs;
