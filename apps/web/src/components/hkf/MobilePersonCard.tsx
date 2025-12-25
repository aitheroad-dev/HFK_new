import { ChevronLeft } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("he-IL", {
    month: "short",
    day: "numeric",
  });
}

interface MobilePersonCardProps {
  person: PersonWithEnrollment;
  onClick: () => void;
}

export function MobilePersonCard({ person, onClick }: MobilePersonCardProps) {
  const displayStatus = person.enrollment_status || person.status;
  const displayDate = person.applied_at || person.created_at;

  return (
    <Card
      className="cursor-pointer active:bg-muted/50 transition-colors touch-target"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarFallback className="jarvis-gradient text-white text-sm">
              {getInitials(person.first_name, person.last_name)}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">
                {person.first_name} {person.last_name}
              </span>
              <ChevronLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>

            {person.email && (
              <p className="text-sm text-muted-foreground truncate">{person.email}</p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="secondary"
                className={`text-xs ${statusVariants[displayStatus] || statusVariants.pending}`}
              >
                {statusLabels[displayStatus] || displayStatus}
              </Badge>
              {displayDate && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(displayDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
