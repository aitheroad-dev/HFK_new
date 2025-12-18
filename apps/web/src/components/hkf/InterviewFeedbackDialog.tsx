import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompleteInterview, type Interview } from "@/hooks/useInterviews";
import type { PersonWithEnrollment } from "@/hooks/usePeople";

const recommendationOptions = [
  { value: "strong_accept", label: "Strong Accept", color: "text-green-600" },
  { value: "accept", label: "Accept", color: "text-green-500" },
  { value: "maybe", label: "Maybe", color: "text-yellow-500" },
  { value: "reject", label: "Reject", color: "text-red-500" },
  { value: "strong_reject", label: "Strong Reject", color: "text-red-600" },
] as const;

const scoringCriteria = [
  { key: "motivation", label: "Motivation & Drive" },
  { key: "communication", label: "Communication Skills" },
  { key: "background", label: "Relevant Background" },
  { key: "potential", label: "Growth Potential" },
  { key: "fit", label: "Program Fit" },
];

interface InterviewFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: PersonWithEnrollment;
  interview: Interview;
}

export function InterviewFeedbackDialog({
  open,
  onOpenChange,
  person,
  interview,
}: InterviewFeedbackDialogProps) {
  const [overallScore, setOverallScore] = useState(interview.score || 5);
  const [scoresBreakdown, setScoresBreakdown] = useState<Record<string, number>>(
    interview.scores_breakdown || {}
  );
  const [notes, setNotes] = useState(interview.notes || "");
  const [recommendation, setRecommendation] = useState<Interview["recommendation"]>(
    interview.recommendation || null
  );

  const completeInterview = useCompleteInterview();

  const handleScoreChange = (key: string, value: number[]) => {
    setScoresBreakdown((prev) => ({ ...prev, [key]: value[0] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recommendation) return;

    try {
      await completeInterview.mutateAsync({
        id: interview.id,
        score: overallScore,
        scores_breakdown: scoresBreakdown,
        notes: notes.trim() || undefined,
        recommendation,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interview Feedback</DialogTitle>
          <DialogDescription>
            Submit feedback for {person.first_name} {person.last_name}'s interview
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            {/* Overall Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Overall Score</Label>
                <span className="text-2xl font-bold text-primary">{overallScore}/10</span>
              </div>
              <Slider
                value={[overallScore]}
                onValueChange={(value) => setOverallScore(value[0])}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Poor</span>
                <span>Excellent</span>
              </div>
            </div>

            {/* Detailed Scores */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Detailed Scoring</Label>
              {scoringCriteria.map((criteria) => (
                <div key={criteria.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{criteria.label}</span>
                    <span className="text-sm font-medium">
                      {scoresBreakdown[criteria.key] || 5}/10
                    </span>
                  </div>
                  <Slider
                    value={[scoresBreakdown[criteria.key] || 5]}
                    onValueChange={(value) => handleScoreChange(criteria.key, value)}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            {/* Recommendation */}
            <div className="space-y-2">
              <Label htmlFor="recommendation">Recommendation *</Label>
              <Select
                value={recommendation || ""}
                onValueChange={(value) => setRecommendation(value as Interview["recommendation"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your recommendation" />
                </SelectTrigger>
                <SelectContent>
                  {recommendationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes & Observations</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share your observations, strengths, concerns, and any other relevant feedback..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={completeInterview.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={completeInterview.isPending || !recommendation}
            >
              {completeInterview.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default InterviewFeedbackDialog;
