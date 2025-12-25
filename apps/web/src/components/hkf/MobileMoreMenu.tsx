import {
  GraduationCap,
  Mail,
  Settings,
  LogOut,
  Bot,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { HkfLogo } from "./HkfLogo";

type Page = "dashboard" | "people" | "programs" | "interviews" | "payments" | "events";

interface MobileMoreMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onOpenJarvis: () => void;
}

const moreMenuItems = [
  { icon: GraduationCap, label: "תוכניות", page: "programs" as Page },
  { icon: Mail, label: "הודעות", page: "events" as Page },
];

export function MobileMoreMenu({
  open,
  onOpenChange,
  currentPage,
  onNavigate,
  onOpenJarvis,
}: MobileMoreMenuProps) {
  const { signOut } = useAuth();

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <HkfLogo size="sm" />
            <SheetTitle className="text-right">הופמן קופמן</SheetTitle>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-1">
          {moreMenuItems.map((item) => (
            <Button
              key={item.page}
              variant={item.page === currentPage ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 h-12"
              onClick={() => handleNavigate(item.page)}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Button>
          ))}

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12"
            onClick={() => {
              onOpenJarvis();
              onOpenChange(false);
            }}
          >
            <Bot className="w-5 h-5" />
            <span>JARVIS AI</span>
          </Button>

          <div className="pt-4 border-t mt-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 opacity-50"
              disabled
            >
              <Settings className="w-5 h-5" />
              <span>הגדרות</span>
              <span className="text-xs text-muted-foreground mr-auto">בקרוב</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive"
              onClick={signOut}
            >
              <LogOut className="w-5 h-5" />
              <span>התנתק</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
