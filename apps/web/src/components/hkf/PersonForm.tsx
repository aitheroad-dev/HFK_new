import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreatePerson, useUpdatePerson, type Person } from "@/hooks/usePeople";
import { DEFAULT_ORG_ID } from "@/lib/supabase";

interface PersonFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person | null; // If provided, we're in edit mode
}

export function PersonForm({ open, onOpenChange, person }: PersonFormProps) {
  const isEdit = !!person;

  const [firstName, setFirstName] = useState(person?.first_name || "");
  const [lastName, setLastName] = useState(person?.last_name || "");
  const [email, setEmail] = useState(person?.email || "");
  const [phone, setPhone] = useState(person?.phone || "");

  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();

  const isLoading = createPerson.isPending || updatePerson.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) return;

    try {
      if (isEdit && person) {
        await updatePerson.mutateAsync({
          id: person.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        });
      } else {
        await createPerson.mutateAsync({
          organization_id: DEFAULT_ORG_ID,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          status: "pending",
          metadata: {},
          tags: [],
        });
      }

      // Reset form and close
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save person:", error);
    }
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    } else if (person) {
      // Populate form with person data when opening in edit mode
      setFirstName(person.first_name);
      setLastName(person.last_name);
      setEmail(person.email || "");
      setPhone(person.phone || "");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Person" : "Add Person"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !firstName.trim() || !lastName.trim()}>
              {isLoading ? "Saving..." : isEdit ? "Save Changes" : "Add Person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PersonForm;
