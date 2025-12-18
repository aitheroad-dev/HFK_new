import { useState } from "react";
import { X, Mail, Phone, Calendar as CalendarIcon, FileText, Edit2, Trash2, UserPlus, ClipboardCheck, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  applied: "Applied",
  interviewing: "Interviewing",
  accepted: "Accepted",
  enrolled: "Enrolled",
  pending: "Pending",
  active: "Active",
  rejected: "Rejected",
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
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
  const displayStatus = person.enrollment_status || person.status;

  const handleDelete = () => {
    onDelete?.(person.id);
    setShowDeleteDialog(false);
  };

  return (
    <div
      className={cn(
        "w-[400px] bg-card border-l border-border flex flex-col h-full",
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
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              Timeline
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="p-4 space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {person.email || "No email provided"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {person.phone || "No phone provided"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Program Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Program
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {person.program_name || "No program assigned"}
                  </span>
                </div>
                {person.cohort_name && (
                  <div className="text-sm text-muted-foreground">
                    Cohort: {person.cohort_name}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Dates */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Key Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Applied</div>
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
                        <div className="text-xs text-muted-foreground">Interview</div>
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
                        <ClipboardCheck className="w-4 h-4 mr-1" />
                        Feedback
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onMakeDecision?.(person)}
                      >
                        <Scale className="w-4 h-4 mr-1" />
                        Decision
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
                    <UserPlus className="w-4 h-4 mr-2" />
                    Schedule Interview
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
                    Notes
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
                  <div className="text-sm font-medium">Created</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(person.created_at)}
                  </div>
                </div>
              </div>
              {person.applied_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Applied</div>
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
                    <div className="text-sm font-medium">Interview scheduled</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(person.interview_date)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="p-4">
            <div className="text-sm text-muted-foreground">
              {person.notes || "No notes yet. Add a note to keep track of important information."}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 p-4 border-t border-border flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onEdit?.(person)}>
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
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
            <AlertDialogTitle>Delete {person.first_name} {person.last_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this person
              and all associated data including enrollments, interviews, and payment records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PersonDetail;
