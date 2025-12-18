import { useState, useEffect } from "react";
import { X, Mail, Phone, Calendar as CalendarIcon, FileText, Edit2, Trash2, UserPlus, ClipboardCheck, Scale, Plus, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import type { PersonWithEnrollment } from "@/hooks/usePeople";
import { useUpdateEnrollmentNotes } from "@/hooks/useEnrollments";

const statusVariants: Record<string, string> = {
  applied: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  interviewing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  enrolled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabels: Record<string, string> = {
  applied: "הגיש מועמדות",
  interviewing: "בראיון",
  accepted: "התקבל",
  enrolled: "רשום",
  pending: "ממתין",
  active: "פעיל",
  rejected: "נדחה",
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("he-IL", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PersonDetailProps {
  person: PersonWithEnrollment;
  onClose: () => void;
  onEdit?: (person: PersonWithEnrollment) => void;
  onDelete?: (personId: string) => void;
  onScheduleInterview?: (person: PersonWithEnrollment) => void;
  onSubmitFeedback?: (person: PersonWithEnrollment) => void;
  onMakeDecision?: (person: PersonWithEnrollment) => void;
  isDeleting?: boolean;
  className?: string;
}

export function PersonDetail({ person, onClose, onEdit, onDelete, onScheduleInterview, onSubmitFeedback, onMakeDecision, isDeleting, className }: PersonDetailProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(person.notes || "");
  const updateNotes = useUpdateEnrollmentNotes();
  const displayStatus = person.enrollment_status || person.status;

  // Reset notes value when person changes
  useEffect(() => {
    setNotesValue(person.notes || "");
    setIsEditingNotes(false);
  }, [person.id, person.notes]);

  const handleSaveNotes = () => {
    updateNotes.mutate(
      { personId: person.id, notes: notesValue },
      {
        onSuccess: () => {
          setIsEditingNotes(false);
        },
      }
    );
  };

  const handleDelete = () => {
    onDelete?.(person.id);
    setShowDeleteDialog(false);
  };

  return (
    <div
      className={cn(
        "w-[400px] bg-card border-l border-border flex flex-col shrink-0",
        className
      )}
    >
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="jarvis-gradient text-white text-lg">
              {getInitials(person.first_name, person.last_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-lg">
              {person.first_name} {person.last_name}
            </h2>
            <Badge
              variant="secondary"
              className={statusVariants[displayStatus] || statusVariants.pending}
            >
              {statusLabels[displayStatus] || displayStatus}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              סקירה
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              ציר זמן
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              הערות
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="p-4 space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  פרטי התקשרות
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {person.email || "לא סופק אימייל"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {person.phone || "לא סופק טלפון"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Program Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  תוכנית
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {person.program_name || "לא שויך לתוכנית"}
                  </span>
                </div>
                {person.cohort_name && (
                  <div className="text-sm text-muted-foreground">
                    מחזור: {person.cohort_name}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Dates */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  תאריכים חשובים
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">הגשה</div>
                    <div className="text-sm">
                      {formatDate(person.applied_at || person.created_at)}
                    </div>
                  </div>
                </div>
                {person.interview_date ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">ראיון</div>
                        <div className="text-sm">{formatDate(person.interview_date)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onSubmitFeedback?.(person)}
                      >
                        <ClipboardCheck className="w-4 h-4 ml-1" />
                        משוב
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onMakeDecision?.(person)}
                      >
                        <Scale className="w-4 h-4 ml-1" />
                        החלטה
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => onScheduleInterview?.(person)}
                  >
                    <UserPlus className="w-4 h-4 ml-2" />
                    קבע ראיון
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Notes Preview */}
            {person.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    הערות
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {person.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="p-4">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">נוצר</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(person.created_at)}
                  </div>
                </div>
              </div>
              {person.applied_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">הגיש מועמדות</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(person.applied_at)}
                    </div>
                  </div>
                </div>
              )}
              {person.interview_date && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">ראיון נקבע</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(person.interview_date)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="p-4 space-y-4">
            {isEditingNotes ? (
              <div className="space-y-3">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="הוסף הערות על אדם זה..."
                  className="min-h-[150px] resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={updateNotes.isPending}
                  >
                    {updateNotes.isPending ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 ml-2" />
                    )}
                    שמור
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNotesValue(person.notes || "");
                      setIsEditingNotes(false);
                    }}
                    disabled={updateNotes.isPending}
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {person.notes ? (
                  <div className="text-sm whitespace-pre-wrap">{person.notes}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    אין הערות עדיין. הוסף הערה כדי לעקוב אחר מידע חשוב.
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingNotes(true)}
                >
                  {person.notes ? (
                    <>
                      <Edit2 className="w-4 h-4 ml-2" />
                      ערוך הערה
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 ml-2" />
                      הוסף הערה
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 p-4 border-t border-border flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onEdit?.(person)}>
          <Edit2 className="w-4 h-4 ml-2" />
          ערוך
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isDeleting}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את {person.first_name} {person.last_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              לא ניתן לבטל פעולה זו. פעולה זו תמחק לצמיתות את האדם הזה
              ואת כל הנתונים הקשורים אליו כולל הרשמות, ראיונות ורשומות תשלום.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "מוחק..." : "מחק"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PersonDetail;
