import { useState, useMemo } from "react";
import { Plus, Search, Filter, Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePeopleWithEnrollments, type PersonWithEnrollment } from "@/hooks/usePeople";
import { useIsMobile } from "@/hooks/use-mobile";
import { PersonForm } from "@/components/hkf/PersonForm";
import { MobilePersonCard } from "@/components/hkf/MobilePersonCard";
import { ResponsiveList } from "@/components/hkf/ResponsiveList";

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

const allStatuses = ["applied", "interviewing", "accepted", "enrolled", "rejected"];

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

interface PeopleProps {
  onSelectPerson?: (person: PersonWithEnrollment) => void;
  initialSearch?: string;
}

export function People({ onSelectPerson, initialSearch = "" }: PeopleProps) {
  const { data: people, isLoading } = usePeopleWithEnrollments();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const isMobile = useIsMobile();

  // Filter people based on search and status filters
  const filteredPeople = useMemo(() => {
    if (!people) return [];

    return people.filter((person) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          person.first_name.toLowerCase().includes(query) ||
          person.last_name.toLowerCase().includes(query) ||
          person.email?.toLowerCase().includes(query) ||
          person.phone?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (selectedStatuses.length > 0) {
        const personStatus = person.enrollment_status || person.status;
        if (!selectedStatuses.includes(personStatus)) return false;
      }

      return true;
    });
  }, [people, searchQuery, selectedStatuses]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  // Export people to CSV
  const handleExport = () => {
    const dataToExport = filteredPeople.length > 0 ? filteredPeople : people;
    if (!dataToExport || dataToExport.length === 0) return;

    const headers = ["שם פרטי", "שם משפחה", "אימייל", "טלפון", "סטטוס", "תוכנית", "תאריך הגשה"];
    const csvContent = [
      headers.join(","),
      ...dataToExport.map((p) => [
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-primary">אנשים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            נמצאו {filteredPeople.length} {filteredPeople.length === 1 ? "איש" : "אנשים"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!people?.length} size={isMobile ? "sm" : "default"}>
            <Download className="w-4 h-4 ml-2" />
            {!isMobile && "ייצוא"}
          </Button>
          <Button onClick={() => setIsFormOpen(true)} size={isMobile ? "sm" : "default"}>
            <Plus className="w-4 h-4 ml-2" />
            {isMobile ? "הוסף" : "הוסף איש"}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={isMobile ? "חיפוש..." : "חפש לפי שם, אימייל או טלפון..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 h-12 sm:h-10"
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size={isMobile ? "default" : "default"} className="h-12 sm:h-10">
                <Filter className="w-4 h-4 ml-2" />
                {!isMobile && "סטטוס"}
                {selectedStatuses.length > 0 && (
                  <Badge variant="secondary" className="mr-2">
                    {selectedStatuses.length}
                  </Badge>
                )}
                <ChevronDown className="w-4 h-4 mr-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {allStatuses.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={selectedStatuses.includes(status)}
                  onCheckedChange={() => toggleStatus(status)}
                >
                  {statusLabels[status]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedStatuses.length > 0 && (
            <Button variant="ghost" onClick={() => setSelectedStatuses([])} className="h-12 sm:h-10">
              {isMobile ? "נקה" : "נקה מסננים"}
            </Button>
          )}
        </div>
      </div>

      {/* People List - Responsive */}
      {isMobile ? (
        /* Mobile: Card List */
        <ResponsiveList
          items={filteredPeople}
          isLoading={isLoading}
          loadingMessage="טוען אנשים..."
          emptyMessage={
            searchQuery || selectedStatuses.length > 0
              ? "לא נמצאו אנשים התואמים את החיפוש."
              : "לא נמצאו אנשים. הוסף מישהו כדי להתחיל."
          }
          renderCard={(person) => (
            <MobilePersonCard
              key={person.id}
              person={person}
              onClick={() => onSelectPerson?.(person)}
            />
          )}
          renderTable={() => null}
        />
      ) : (
        /* Desktop: Table */
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">כל האנשים</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                טוען אנשים...
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery || selectedStatuses.length > 0
                  ? "לא נמצאו אנשים התואמים את החיפוש."
                  : "לא נמצאו אנשים. הוסף מישהו כדי להתחיל."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs uppercase tracking-wide font-semibold">
                      שם
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold">
                      אימייל
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide font-semibold">
                      טלפון
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
                            <span className="font-medium">
                              {person.first_name} {person.last_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {person.email || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {person.phone || "-"}
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Person Dialog */}
      <PersonForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  );
}

export default People;
