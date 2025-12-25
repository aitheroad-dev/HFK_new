import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/components/hkf";
import { Dashboard } from "@/pages/Dashboard";
import { People } from "@/pages/People";
import { Programs } from "@/pages/Programs";
import { Interviews } from "@/pages/Interviews";
import { Payments } from "@/pages/Payments";
import { Events } from "@/pages/Events";
import { Login } from "@/pages/Login";
import { PersonDetail } from "@/components/hkf/PersonDetail";
import { PersonForm } from "@/components/hkf/PersonForm";
import { ScheduleInterviewDialog } from "@/components/hkf/ScheduleInterviewDialog";
import { InterviewFeedbackDialog } from "@/components/hkf/InterviewFeedbackDialog";
import { DecisionDialog } from "@/components/hkf/DecisionDialog";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";
import { useDeletePerson } from "@/hooks/usePeople";
import { usePersonInterviews } from "@/hooks/useInterviews";
import { Layers } from "lucide-react";
import type { PersonWithEnrollment, Person } from "@/hooks/usePeople";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

type Page = "dashboard" | "people" | "programs" | "interviews" | "payments" | "events";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 jarvis-gradient rounded-lg flex items-center justify-center text-white animate-pulse">
          <Layers className="w-6 h-6" />
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

interface AuthenticatedAppProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  selectedPerson: PersonWithEnrollment | null;
  onSelectPerson: (person: PersonWithEnrollment | null) => void;
  editingPerson: Person | null;
  onEditPerson: (person: Person | null) => void;
  isAddFormOpen: boolean;
  onSetAddFormOpen: (open: boolean) => void;
  globalSearch: string;
  onGlobalSearchChange: (query: string) => void;
}

function AuthenticatedApp({ currentPage, onNavigate, selectedPerson, onSelectPerson, editingPerson, onEditPerson, isAddFormOpen, onSetAddFormOpen, globalSearch, onGlobalSearchChange }: AuthenticatedAppProps) {
  const deletePerson = useDeletePerson();
  const [schedulingPerson, setSchedulingPerson] = useState<PersonWithEnrollment | null>(null);
  const [feedbackPerson, setFeedbackPerson] = useState<PersonWithEnrollment | null>(null);
  const [decisionPerson, setDecisionPerson] = useState<PersonWithEnrollment | null>(null);

  // Fetch interviews for the person we're working with (feedback or decision)
  const interviewPersonId = feedbackPerson?.id || decisionPerson?.id;
  const { data: personInterviews } = usePersonInterviews(interviewPersonId);
  const latestInterview = personInterviews?.find(i => i.status === "scheduled") || personInterviews?.[0];

  const handleDeletePerson = (personId: string) => {
    deletePerson.mutate(personId, {
      onSuccess: () => {
        onSelectPerson(null);
      },
    });
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={onNavigate} onSearch={onGlobalSearchChange} searchQuery={globalSearch}>
      <div className="flex h-full -m-6">
        <div className="flex-1 overflow-y-auto p-6">
          {currentPage === "dashboard" && (
            <Dashboard
              onViewPeople={() => onNavigate("people")}
              onAddPerson={() => onSetAddFormOpen(true)}
              onSelectPerson={onSelectPerson}
            />
          )}
          {currentPage === "people" && <People onSelectPerson={onSelectPerson} initialSearch={globalSearch} />}
          {currentPage === "programs" && <Programs />}
          {currentPage === "interviews" && <Interviews />}
          {currentPage === "payments" && <Payments />}
          {currentPage === "events" && <Events />}
        </div>
        {selectedPerson && (
          <PersonDetail
            person={selectedPerson}
            onClose={() => onSelectPerson(null)}
            onEdit={(person) => onEditPerson(person)}
            onDelete={handleDeletePerson}
            onScheduleInterview={(person) => setSchedulingPerson(person)}
            onSubmitFeedback={(person) => setFeedbackPerson(person)}
            onMakeDecision={(person) => setDecisionPerson(person)}
            isDeleting={deletePerson.isPending}
          />
        )}
      </div>

      {/* Edit Person Dialog */}
      <PersonForm
        open={!!editingPerson}
        onOpenChange={(open) => !open && onEditPerson(null)}
        person={editingPerson}
      />

      {/* Add Person Dialog (from Dashboard) */}
      <PersonForm
        open={isAddFormOpen}
        onOpenChange={onSetAddFormOpen}
      />

      {/* Schedule Interview Dialog */}
      {schedulingPerson && (
        <ScheduleInterviewDialog
          open={!!schedulingPerson}
          onOpenChange={(open) => !open && setSchedulingPerson(null)}
          person={schedulingPerson}
        />
      )}

      {/* Interview Feedback Dialog */}
      {feedbackPerson && latestInterview && (
        <InterviewFeedbackDialog
          open={!!feedbackPerson}
          onOpenChange={(open) => !open && setFeedbackPerson(null)}
          person={feedbackPerson}
          interview={latestInterview}
        />
      )}

      {/* Decision Dialog */}
      {decisionPerson && (
        <DecisionDialog
          open={!!decisionPerson}
          onOpenChange={(open) => !open && setDecisionPerson(null)}
          person={decisionPerson}
          interview={latestInterview}
        />
      )}
    </AppLayout>
  );
}

// Dev-only: bypass auth for mobile UI testing
// Add ?bypass-auth to URL to skip login (only works in development)
const shouldBypassAuth = () => {
  if (import.meta.env.PROD) return false;
  return new URLSearchParams(window.location.search).has("bypass-auth");
};

function AppContent() {
  const auth = useAuthProvider();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [selectedPerson, setSelectedPerson] = useState<PersonWithEnrollment | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  const bypassAuth = shouldBypassAuth();

  if (auth.isLoading && !bypassAuth) {
    return <LoadingScreen />;
  }

  // Create a mock auth context for bypass mode
  const mockAuth = bypassAuth ? {
    user: { id: "dev-user", email: "dev@test.com", user_metadata: { full_name: "Dev User" } } as any,
    session: null,
    isLoading: false,
    isAuthenticated: true,
    signInWithGoogle: async () => {},
    signOut: async () => { window.location.search = ""; },
  } : auth;

  return (
    <AuthContext.Provider value={bypassAuth ? mockAuth : auth}>
      {(bypassAuth || auth.isAuthenticated) ? (
        <AuthenticatedApp
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          selectedPerson={selectedPerson}
          onSelectPerson={setSelectedPerson}
          editingPerson={editingPerson}
          onEditPerson={setEditingPerson}
          isAddFormOpen={isAddFormOpen}
          onSetAddFormOpen={setIsAddFormOpen}
          globalSearch={globalSearch}
          onGlobalSearchChange={setGlobalSearch}
        />
      ) : (
        <Login />
      )}
    </AuthContext.Provider>
  );
}

/**
 * HKF CRM Application
 *
 * Production-ready AI-CRM interface with:
 * - HKF brand colors and logo
 * - Google OAuth authentication
 * - JARVIS AI assistant (connected to Claude API)
 * - Real data from Supabase database
 * - Dashboard with live stats and candidates table
 * - People list with search and filters
 * - Person detail view
 */
export function HkfDemo() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default HkfDemo;
