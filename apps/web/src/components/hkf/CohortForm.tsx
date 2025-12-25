import { useState, useEffect } from "react";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useCreateCohort,
  useUpdateCohort,
  type Cohort,
} from "@/hooks/usePrograms";

const cohortStatuses = [
  { value: "draft", label: "טיוטה" },
  { value: "open", label: "פתוח להרשמה" },
  { value: "closed", label: "סגור" },
  { value: "completed", label: "הושלם" },
];

interface CohortFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  cohort?: Cohort | null;
}

export function CohortForm({ open, onOpenChange, programId, cohort }: CohortFormProps) {
  const createCohort = useCreateCohort();
  const updateCohort = useUpdateCohort();
  const isEditing = !!cohort;

  const [formData, setFormData] = useState({
    name: "",
    status: "draft" as Cohort["status"],
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    maxParticipants: "",
  });

  // Reset form when dialog opens/closes or cohort changes
  useEffect(() => {
    if (open && cohort) {
      setFormData({
        name: cohort.name,
        status: cohort.status,
        startDate: cohort.start_date ? new Date(cohort.start_date) : undefined,
        endDate: cohort.end_date ? new Date(cohort.end_date) : undefined,
        maxParticipants: cohort.max_participants?.toString() || "",
      });
    } else if (open && !cohort) {
      setFormData({
        name: "",
        status: "draft",
        startDate: undefined,
        endDate: undefined,
        maxParticipants: "",
      });
    }
  }, [open, cohort]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cohortData = {
      name: formData.name,
      program_id: programId,
      status: formData.status,
      start_date: formData.startDate?.toISOString() || null,
      end_date: formData.endDate?.toISOString() || null,
      max_participants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null,
    };

    if (isEditing && cohort) {
      updateCohort.mutate(
        { id: cohort.id, ...cohortData },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createCohort.mutate(cohortData, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    }
  };

  const isPending = createCohort.isPending || updateCohort.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "עריכת מחזור" : "מחזור חדש"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "עדכן את פרטי המחזור"
                : "צור מחזור חדש לתוכנית"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">שם המחזור *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: מחזור 2025א"
                required
              />
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">סטטוס</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as Cohort["status"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סטטוס" />
                </SelectTrigger>
                <SelectContent>
                  {cohortStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="grid gap-2">
              <Label>תאריך התחלה</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !formData.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {formData.startDate
                      ? format(formData.startDate, "PPP", { locale: he })
                      : "בחר תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.startDate}
                    onSelect={(date) => setFormData({ ...formData, startDate: date })}
                    locale={he}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="grid gap-2">
              <Label>תאריך סיום</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !formData.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {formData.endDate
                      ? format(formData.endDate, "PPP", { locale: he })
                      : "בחר תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.endDate}
                    onSelect={(date) => setFormData({ ...formData, endDate: date })}
                    locale={he}
                    disabled={(date) =>
                      formData.startDate ? date < formData.startDate : false
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Max Participants */}
            <div className="grid gap-2">
              <Label htmlFor="maxParticipants">מספר משתתפים מקסימלי</Label>
              <Input
                id="maxParticipants"
                type="number"
                min="0"
                value={formData.maxParticipants}
                onChange={(e) =>
                  setFormData({ ...formData, maxParticipants: e.target.value })
                }
                placeholder="ללא הגבלה"
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={!formData.name || isPending}>
              {isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {isEditing ? "שמור שינויים" : "צור מחזור"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CohortForm;
