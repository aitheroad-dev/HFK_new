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
import { Textarea } from "@/components/ui/textarea";
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
  useCreateEvent,
  useUpdateEvent,
  type Event,
} from "@/hooks/useEvents";

const eventTypes = [
  { value: "workshop", label: "סדנה" },
  { value: "meeting", label: "פגישה" },
  { value: "webinar", label: "וובינר" },
  { value: "conference", label: "כנס" },
  { value: "social", label: "אירוע חברתי" },
];

const eventStatuses = [
  { value: "draft", label: "טיוטה" },
  { value: "published", label: "פורסם" },
  { value: "cancelled", label: "בוטל" },
  { value: "completed", label: "הסתיים" },
];

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event | null;
}

export function EventForm({ open, onOpenChange, event }: EventFormProps) {
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const isEditing = !!event;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    status: "draft" as Event["status"],
    startsAt: undefined as Date | undefined,
    startTime: "10:00",
    endsAt: undefined as Date | undefined,
    endTime: "12:00",
    location: "",
    locationUrl: "",
    capacity: "",
  });

  // Reset form when dialog opens/closes or event changes
  useEffect(() => {
    if (open && event) {
      const startDate = event.starts_at ? new Date(event.starts_at) : undefined;
      const endDate = event.ends_at ? new Date(event.ends_at) : undefined;

      setFormData({
        name: event.name,
        description: event.description || "",
        type: event.type || "",
        status: event.status,
        startsAt: startDate,
        startTime: startDate
          ? `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`
          : "10:00",
        endsAt: endDate,
        endTime: endDate
          ? `${endDate.getHours().toString().padStart(2, "0")}:${endDate.getMinutes().toString().padStart(2, "0")}`
          : "12:00",
        location: event.location || "",
        locationUrl: event.location_url || "",
        capacity: event.capacity?.toString() || "",
      });
    } else if (open && !event) {
      setFormData({
        name: "",
        description: "",
        type: "",
        status: "draft",
        startsAt: undefined,
        startTime: "10:00",
        endsAt: undefined,
        endTime: "12:00",
        location: "",
        locationUrl: "",
        capacity: "",
      });
    }
  }, [open, event]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Combine date and time
    let startsAt: Date | undefined;
    if (formData.startsAt) {
      startsAt = new Date(formData.startsAt);
      const [hours, minutes] = formData.startTime.split(":").map(Number);
      startsAt.setHours(hours, minutes, 0, 0);
    }

    let endsAt: Date | undefined;
    if (formData.endsAt) {
      endsAt = new Date(formData.endsAt);
      const [hours, minutes] = formData.endTime.split(":").map(Number);
      endsAt.setHours(hours, minutes, 0, 0);
    }

    const eventData = {
      name: formData.name,
      description: formData.description || null,
      type: formData.type || null,
      status: formData.status,
      starts_at: startsAt?.toISOString() || new Date().toISOString(),
      ends_at: endsAt?.toISOString() || null,
      timezone: "Asia/Jerusalem",
      location: formData.location || null,
      location_url: formData.locationUrl || null,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      target_audience: {},
      metadata: {},
    };

    if (isEditing && event) {
      updateEvent.mutate(
        { id: event.id, ...eventData },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createEvent.mutate(eventData, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    }
  };

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "עריכת אירוע" : "אירוע חדש"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "עדכן את פרטי האירוע" : "צור אירוע חדש"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">שם האירוע *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: סדנת מנהיגות"
                required
              />
            </div>

            {/* Type & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">סוג אירוע</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוג" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">סטטוס</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as Event["status"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">תיאור</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור קצר של האירוע..."
                rows={3}
              />
            </div>

            {/* Start Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>תאריך התחלה *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right font-normal",
                        !formData.startsAt && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {formData.startsAt
                        ? format(formData.startsAt, "PPP", { locale: he })
                        : "בחר תאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.startsAt}
                      onSelect={(date) => setFormData({ ...formData, startsAt: date })}
                      locale={he}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="startTime">שעת התחלה</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
            </div>

            {/* End Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>תאריך סיום</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right font-normal",
                        !formData.endsAt && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {formData.endsAt
                        ? format(formData.endsAt, "PPP", { locale: he })
                        : "בחר תאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.endsAt}
                      onSelect={(date) => setFormData({ ...formData, endsAt: date })}
                      locale={he}
                      disabled={(date) =>
                        formData.startsAt ? date < formData.startsAt : false
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">שעת סיום</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>

            {/* Location */}
            <div className="grid gap-2">
              <Label htmlFor="location">מיקום</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="כתובת או 'אונליין'"
              />
            </div>

            {/* Location URL */}
            <div className="grid gap-2">
              <Label htmlFor="locationUrl">קישור (Zoom, Meet וכו')</Label>
              <Input
                id="locationUrl"
                type="url"
                value={formData.locationUrl}
                onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>

            {/* Capacity */}
            <div className="grid gap-2">
              <Label htmlFor="capacity">מספר משתתפים מקסימלי</Label>
              <Input
                id="capacity"
                type="number"
                min="0"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="ללא הגבלה"
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={!formData.name || !formData.startsAt || isPending}>
              {isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {isEditing ? "שמור שינויים" : "צור אירוע"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EventForm;
