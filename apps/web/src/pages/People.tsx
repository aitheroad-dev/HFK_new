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
import { PersonForm } from "@/components/hkf/PersonForm";

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

const allStatuses = ["applied", "interviewing", "accepted", "enrolled", "rejected"];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
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

    const headers = ["First Name", "Last Name", "Email", "Phone", "Status", "Program", "Applied Date"];
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">People</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredPeople.length} {filteredPeople.length === 1 ? "person" : "people"} found
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!people?.length}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Person
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Status
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedStatuses.length}
                </Badge>
              )}
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
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
          <Button variant="ghost" onClick={() => setSelectedStatuses([])}>
            Clear filters
          </Button>
        )}
      </div>

      {/* People Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">All People</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading people...
            </div>
          ) : filteredPeople.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery || selectedStatuses.length > 0
                ? "No people match your search criteria."
                : "No people found. Add someone to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    Name
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    Email
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    Phone
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    Program
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    Added
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

      {/* Add Person Dialog */}
      <PersonForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  );
}

export default People;
