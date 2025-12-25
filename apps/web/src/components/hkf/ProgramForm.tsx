import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateProgram,
  useUpdateProgram,
  type Program,
  type ProgramConfig,
} from "@/hooks/usePrograms";

const programTypes = [
  { value: "fellowship", label: "פלואושיפ" },
  { value: "course", label: "קורס" },
  { value: "workshop", label: "סדנה" },
  { value: "membership", label: "חברות" },
  { value: "track", label: "מסלול" },
];

interface ProgramFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program?: Program | null;
}

export function ProgramForm({ open, onOpenChange, program }: ProgramFormProps) {
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();
  const isEditing = !!program;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    requiresInterview: false,
    requiresPayment: false,
    paymentAmount: "",
    maxParticipants: "",
  });

  // Reset form when dialog opens/closes or program changes
  useEffect(() => {
    if (open && program) {
      setFormData({
        name: program.name,
        description: program.description || "",
        type: program.type || "",
        requiresInterview: program.config?.requiresInterview || false,
        requiresPayment: program.config?.requiresPayment || false,
        paymentAmount: program.config?.paymentAmount?.toString() || "",
        maxParticipants: program.config?.maxParticipants?.toString() || "",
      });
    } else if (open && !program) {
      setFormData({
        name: "",
        description: "",
        type: "",
        requiresInterview: false,
        requiresPayment: false,
        paymentAmount: "",
        maxParticipants: "",
      });
    }
  }, [open, program]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const config: ProgramConfig = {
      requiresInterview: formData.requiresInterview,
      requiresPayment: formData.requiresPayment,
      paymentAmount: formData.paymentAmount ? parseFloat(formData.paymentAmount) : undefined,
      maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : undefined,
      currency: "ILS",
    };

    const programData = {
      name: formData.name,
      description: formData.description || null,
      type: formData.type || null,
      config,
      is_active: true,
    };

    if (isEditing && program) {
      updateProgram.mutate(
        { id: program.id, ...programData },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    } else {
      createProgram.mutate(programData, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    }
  };

  const isPending = createProgram.isPending || updateProgram.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "עריכת תוכנית" : "תוכנית חדשה"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "עדכן את פרטי התוכנית"
                : "צור תוכנית חדשה לניהול מחזורים והרשמות"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">שם התוכנית *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: פלואושיפ 2025"
                required
              />
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">סוג תוכנית</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent>
                  {programTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">תיאור</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור קצר של התוכנית..."
                rows={3}
              />
            </div>

            {/* Configuration toggles */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium">הגדרות תוכנית</h4>

              {/* Requires Interview */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>דורש ראיון</Label>
                  <p className="text-xs text-muted-foreground">
                    מועמדים יעברו תהליך ראיון לפני קבלה
                  </p>
                </div>
                <Switch
                  checked={formData.requiresInterview}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiresInterview: checked })
                  }
                />
              </div>

              {/* Requires Payment */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>דורש תשלום</Label>
                  <p className="text-xs text-muted-foreground">
                    נדרש תשלום להשתתפות בתוכנית
                  </p>
                </div>
                <Switch
                  checked={formData.requiresPayment}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiresPayment: checked })
                  }
                />
              </div>

              {/* Payment Amount (conditional) */}
              {formData.requiresPayment && (
                <div className="grid gap-2">
                  <Label htmlFor="paymentAmount">סכום לתשלום (₪)</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="0"
                    value={formData.paymentAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentAmount: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              )}

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
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={!formData.name || isPending}>
              {isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {isEditing ? "שמור שינויים" : "צור תוכנית"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ProgramForm;
