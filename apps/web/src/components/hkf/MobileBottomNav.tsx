import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Page = "dashboard" | "people" | "programs" | "interviews" | "payments" | "events";

interface MobileBottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onMoreClick: () => void;
}

const primaryNavItems = [
  { icon: LayoutDashboard, label: "לוח", page: "dashboard" as Page },
  { icon: Users, label: "אנשים", page: "people" as Page },
  { icon: Calendar, label: "ראיונות", page: "interviews" as Page },
  { icon: CreditCard, label: "תשלומים", page: "payments" as Page },
];

export function MobileBottomNav({ currentPage, onNavigate, onMoreClick }: MobileBottomNavProps) {
  return (
    <nav
      role="navigation"
      aria-label="ניווט ראשי"
      className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border safe-area-bottom md:hidden"
    >
      <div className="flex items-center justify-around h-16">
        {primaryNavItems.map((item) => {
          const isActive = item.page === currentPage;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-[64px] touch-target",
                "transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={onMoreClick}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full min-w-[64px] touch-target",
            "transition-colors text-muted-foreground hover:text-foreground"
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-xs mt-1">עוד</span>
        </button>
      </div>
    </nav>
  );
}
