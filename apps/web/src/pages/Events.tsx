import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Edit,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  ChevronLeft,
} from "lucide-react";
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
  useEvents,
  useEventRegistrations,
  useDeleteEvent,
  useCheckInRegistration,
  useCancelRegistration,
  type EventWithStats,
  type EventRegistrationWithDetails,
} from "@/hooks/useEvents";
import { EventForm } from "@/components/hkf/EventForm";

type StatusFilter = "all" | "published" | "draft" | "completed";

const statusVariants: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const statusLabels: Record<string, string> = {
  draft: "טיוטה",
  published: "פורסם",
  cancelled: "בוטל",
  completed: "הסתיים",
};

const registrationStatusLabels: Record<string, string> = {
  registered: "רשום",
  cancelled: "בוטל",
  waitlisted: "בהמתנה",
  attended: "השתתף",
  no_show: "לא הגיע",
};

const registrationStatusVariants: Record<string, string> = {
  registered: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-800",
  waitlisted: "bg-yellow-100 text-yellow-800",
  attended: "bg-green-100 text-green-800",
  no_show: "bg-red-100 text-red-800",
};

const eventTypeLabels: Record<string, string> = {
  workshop: "סדנה",
  meeting: "פגישה",
  webinar: "וובינר",
  conference: "כנס",
  social: "אירוע חברתי",
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

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("he-IL", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isUpcoming(dateString: string | null): boolean {
  if (!dateString) return false;
  return new Date(dateString) > new Date();
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  return parts.map((p) => p.charAt(0)).join("").toUpperCase().slice(0, 2);
}

interface EventsProps {
  onSelectPerson?: (personId: string) => void;
}

export function Events({ onSelectPerson }: EventsProps) {
  const { data: events, isLoading, refetch } = useEvents();
  const deleteEvent = useDeleteEvent();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithStats | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithStats | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventWithStats | null>(null);

  // Filter events based on selected tab
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (statusFilter === "all") return events;
    return events.filter((event) => event.status === statusFilter);
  }, [events, statusFilter]);

  // Separate upcoming and past events
  const { upcomingEvents, pastEvents } = useMemo(() => {
    return {
      upcomingEvents: filteredEvents.filter((e) => isUpcoming(e.starts_at)),
      pastEvents: filteredEvents.filter((e) => !isUpcoming(e.starts_at)),
    };
  }, [filteredEvents]);

  const handleEditEvent = (event: EventWithStats) => {
    setEditingEvent(event);
    setIsFormOpen(true);
  };

  const handleDeleteEvent = () => {
    if (deletingEvent) {
      deleteEvent.mutate(deletingEvent.id, {
        onSuccess: () => setDeletingEvent(null),
      });
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
  };

  // Show event detail view
  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        onBack={() => setSelectedEvent(null)}
        onEdit={() => handleEditEvent(selectedEvent)}
        onSelectPerson={onSelectPerson}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">אירועים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ניהול אירועים והרשמות
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4 ml-2" />
            אירוע חדש
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{upcomingEvents.length}</div>
                <div className="text-sm text-muted-foreground">אירועים קרובים</div>
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
                <div className="text-2xl font-bold">
                  {events?.reduce((sum, e) => sum + e.registrations_count, 0) || 0}
                </div>
                <div className="text-sm text-muted-foreground">נרשמים</div>
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
                  {events?.filter((e) => e.status === "draft").length || 0}
                </div>
                <div className="text-sm text-muted-foreground">טיוטות</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pastEvents.length}</div>
                <div className="text-sm text-muted-foreground">הסתיימו</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">
            רשימת אירועים {filteredEvents?.length ? `(${filteredEvents.length})` : ""}
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
              <TabsTrigger value="published" className="text-xs px-3">
                פורסמו
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs px-3">
                טיוטות
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs px-3">
                הסתיימו
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען אירועים...</div>
          ) : !filteredEvents?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>אין אירועים</p>
              <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
                <Plus className="w-4 h-4 ml-2" />
                צור אירוע חדש
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    אירוע
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    תאריך ושעה
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    מיקום
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    נרשמים
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    סטטוס
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow
                    key={event.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{event.name}</div>
                        {event.type && (
                          <div className="text-xs text-muted-foreground">
                            {eventTypeLabels[event.type] || event.type}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{formatDate(event.starts_at)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(event.starts_at)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {event.location ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{event.location}</span>
                        </div>
                      ) : event.location_url ? (
                        <Badge variant="outline">
                          <ExternalLink className="w-3 h-3 ml-1" />
                          אונליין
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{event.registrations_count}</span>
                        {event.capacity && (
                          <span className="text-muted-foreground">/{event.capacity}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusVariants[event.status] || statusVariants.draft}
                      >
                        {statusLabels[event.status] || event.status}
                      </Badge>
                      {isUpcoming(event.starts_at) && event.status === "published" && (
                        <Badge variant="outline" className="mr-2 text-xs">
                          קרוב
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(event);
                            }}
                          >
                            <Edit className="w-4 h-4 ml-2" />
                            ערוך
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingEvent(event);
                            }}
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

      {/* Event Form Dialog */}
      <EventForm open={isFormOpen} onOpenChange={handleCloseForm} event={editingEvent} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingEvent} onOpenChange={() => setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק את האירוע?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את האירוע "{deletingEvent?.name}" לצמיתות.
              {deletingEvent?.registrations_count ? (
                <span className="block mt-2 text-destructive">
                  שים לב: יש {deletingEvent.registrations_count} נרשמים לאירוע זה.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEvent.isPending ? "מוחק..." : "מחק"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ Event Detail View ============

interface EventDetailProps {
  event: EventWithStats;
  onBack: () => void;
  onEdit: () => void;
  onSelectPerson?: (personId: string) => void;
}

function EventDetail({ event, onBack, onEdit, onSelectPerson }: EventDetailProps) {
  const { data: registrations, isLoading } = useEventRegistrations(event.id);
  const checkIn = useCheckInRegistration();
  const cancelReg = useCancelRegistration();

  const handleCheckIn = (registration: EventRegistrationWithDetails) => {
    checkIn.mutate({ registrationId: registration.id, eventId: event.id });
  };

  const handleCancelRegistration = (registration: EventRegistrationWithDetails) => {
    cancelReg.mutate({ registrationId: registration.id, eventId: event.id });
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">{event.name}</h1>
          <p className="text-sm text-muted-foreground">{formatDateTime(event.starts_at)}</p>
        </div>
        <Badge
          variant="secondary"
          className={statusVariants[event.status] || statusVariants.draft}
        >
          {statusLabels[event.status] || event.status}
        </Badge>
        <Button variant="outline" onClick={onEdit}>
          <Edit className="w-4 h-4 ml-2" />
          ערוך
        </Button>
      </div>

      {/* Event Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{event.registrations_count}</div>
                <div className="text-sm text-muted-foreground">
                  נרשמים {event.capacity ? `מתוך ${event.capacity}` : ""}
                </div>
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
                <div className="text-2xl font-bold">{event.attended_count}</div>
                <div className="text-sm text-muted-foreground">השתתפו</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium truncate max-w-[200px]">
                  {event.location || "אונליין"}
                </div>
                {event.location_url && (
                  <a
                    href={event.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    קישור
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {event.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">תיאור</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Registrations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            רשימת נרשמים ({registrations?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען נרשמים...</div>
          ) : !registrations?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>אין נרשמים לאירוע זה</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    משתתף
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    תאריך הרשמה
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    סטטוס
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    צ'ק אין
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg) => (
                  <TableRow key={reg.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="jarvis-gradient text-white text-xs">
                            {getInitials(reg.person_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{reg.person_name}</div>
                          {reg.person_email && (
                            <div className="text-xs text-muted-foreground">
                              {reg.person_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(reg.registered_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={registrationStatusVariants[reg.status]}
                      >
                        {registrationStatusLabels[reg.status] || reg.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {reg.checked_in_at ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          {formatTime(reg.checked_in_at)}
                        </span>
                      ) : reg.status === "registered" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckIn(reg)}
                          disabled={checkIn.isPending}
                        >
                          <CheckCircle className="w-4 h-4 ml-1" />
                          צ'ק אין
                        </Button>
                      ) : (
                        "-"
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
                            onClick={() => onSelectPerson?.(reg.person_id)}
                          >
                            <Users className="w-4 h-4 ml-2" />
                            צפה במשתתף
                          </DropdownMenuItem>
                          {reg.status === "registered" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleCancelRegistration(reg)}
                            >
                              <XCircle className="w-4 h-4 ml-2" />
                              בטל הרשמה
                            </DropdownMenuItem>
                          )}
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
    </div>
  );
}

export default Events;
