import { useState } from "react";
import { CheckCircle2, XCircle, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAcceptCandidate, useRejectCandidate } from "@/hooks/useEnrollments";
import { useSendAcceptanceEmail, useSendRejectionEmail } from "@/hooks/useNotifications";
import type { PersonWithEnrollment } from "@/hooks/usePeople";
import type { Interview } from "@/hooks/useInterviews";

interface DecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: PersonWithEnrollment;
  interview?: Interview | null;
}

export function DecisionDialog({
  open,
  onOpenChange,
  person,
  interview,
}: DecisionDialogProps) {
  const [decision, setDecision] = useState<"accept" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [sendNotification, setSendNotification] = useState(true);

  const acceptCandidate = useAcceptCandidate();
  const rejectCandidate = useRejectCandidate();
  const sendAcceptanceEmail = useSendAcceptanceEmail();
  const sendRejectionEmail = useSendRejectionEmail();

  const isLoading = acceptCandidate.isPending || rejectCandidate.isPending ||
    sendAcceptanceEmail.isPending || sendRejectionEmail.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!decision) return;

    try {
      if (decision === "accept") {
        await acceptCandidate.mutateAsync({
          personId: person.id,
          notes: notes.trim() || undefined,
        });

        // Send acceptance email if requested
        if (sendNotification && person.email) {
          await sendAcceptanceEmail.mutateAsync({
            personId: person.id,
            email: person.email,
            name: `${person.first_name} ${person.last_name}`,
            message: notes.trim() || undefined,
          });
        }
      } else {
        await rejectCandidate.mutateAsync({
          personId: person.id,
          notes: notes.trim() || undefined,
        });

        // Send rejection email if requested
        if (sendNotification && person.email) {
          await sendRejectionEmail.mutateAsync({
            personId: person.id,
            email: person.email,
            name: `${person.first_name} ${person.last_name}`,
            message: notes.trim() || undefined,
          });
        }
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to submit decision:", error);
    }
  };

  const resetForm = () => {
    setDecision(null);
    setNotes("");
    setSendNotification(true);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Get interview recommendation if available
  const recommendation = interview?.recommendation;
  const interviewScore = interview?.score;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Make Decision</DialogTitle>
          <DialogDescription>
            Accept or reject {person.first_name} {person.last_name}'s application
          </DialogDescription>
        </DialogHeader>

        {/* Interview Summary */}
        {interview && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">Interview Summary</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Score:</span>{" "}
                <span className="font-medium">{interviewScore || "N/A"}/10</span>
              </div>
              <div>
                <span className="text-muted-foreground">Recommendation:</span>{" "}
                <span className={`font-medium ${
                  recommendation?.includes("accept") ? "text-green-600" :
                  recommendation?.includes("reject") ? "text-red-600" :
                  "text-yellow-600"
                }`}>
                  {recommendation?.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) || "N/A"}
                </span>
              </div>
            </div>
            {interview.notes && (
              <div className="text-sm">
                <span className="text-muted-foreground">Notes:</span>{" "}
                <span className="text-muted-foreground italic">"{interview.notes}"</span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Decision Buttons */}
            <div className="space-y-2">
              <Label>Decision *</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={decision === "accept" ? "default" : "outline"}
                  className={`h-20 flex-col gap-2 ${
                    decision === "accept"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "hover:border-green-600 hover:text-green-600"
                  }`}
                  onClick={() => setDecision("accept")}
                >
                  <CheckCircle2 className="w-6 h-6" />
                  <span>Accept</span>
                </Button>
                <Button
                  type="button"
                  variant={decision === "reject" ? "default" : "outline"}
                  className={`h-20 flex-col gap-2 ${
                    decision === "reject"
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "hover:border-red-600 hover:text-red-600"
                  }`}
                  onClick={() => setDecision("reject")}
                >
                  <XCircle className="w-6 h-6" />
                  <span>Reject</span>
                </Button>
              </div>
            </div>

            {/* Decision Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Decision Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  decision === "accept"
                    ? "Welcome message, next steps, special instructions..."
                    : "Reason for rejection (internal), feedback for candidate..."
                }
                rows={3}
              />
            </div>

            {/* Send Notification */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendNotification"
                checked={sendNotification}
                onCheckedChange={(checked) => setSendNotification(checked === true)}
              />
              <Label htmlFor="sendNotification" className="flex items-center gap-2 cursor-pointer">
                <Mail className="w-4 h-4" />
                Send notification email to candidate
              </Label>
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
            <Button
              type="submit"
              disabled={isLoading || !decision}
              className={
                decision === "accept"
                  ? "bg-green-600 hover:bg-green-700"
                  : decision === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
              }
            >
              {isLoading ? (
                "Saving..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {decision === "accept" ? "Accept Candidate" : decision === "reject" ? "Reject Candidate" : "Submit Decision"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DecisionDialog;
