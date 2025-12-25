import { useState, useEffect, ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  CreditCard,
  Mail,
  Settings,
  Search,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { HkfLogo } from "./HkfLogo";
import { JarvisPanel, JarvisButton } from "@/components/jarvis";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileMoreMenu } from "./MobileMoreMenu";
import { OfflineIndicator } from "./OfflineIndicator";
import { InstallPrompt } from "./InstallPrompt";
import { PWAReloadPrompt } from "./PWAReloadPrompt";

type Page = "dashboard" | "people" | "programs" | "interviews" | "payments" | "events";

interface AppLayoutProps {
  children: ReactNode;
  currentPage?: Page;
  onNavigate?: (page: Page) => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

const navigationItems = {
  overview: [
    { label: "לוח בקרה", icon: LayoutDashboard, page: "dashboard" as Page },
    { label: "אנשים", icon: Users, page: "people" as Page },
    { label: "תוכניות", icon: GraduationCap, page: "programs" as Page },
  ],
  operations: [
    { label: "ראיונות", icon: Calendar, page: "interviews" as Page, badge: "3" },
    { label: "תשלומים", icon: CreditCard, page: "payments" as Page },
    { label: "הודעות", icon: Mail, page: "events" as Page },
  ],
};

export function AppLayout({ children, currentPage = "dashboard", onNavigate, onSearch, searchQuery = "" }: AppLayoutProps) {
  const isMobile = useIsMobile();
  // Start closed, only open on desktop after we confirm screen size
  const [isJarvisOpen, setIsJarvisOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  // Auto-open JARVIS on desktop only - check actual window width
  useEffect(() => {
    // Only run once on mount, check actual screen width
    const isDesktop = window.innerWidth >= 768;
    if (isDesktop) {
      setIsJarvisOpen(true);
    }
  }, []); // Empty deps - only run once on mount

  // Get initials from user email or name
  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(" ");
      return names.map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full overflow-hidden">
        {/* Sidebar - Right side (hidden on mobile) */}
        {!isMobile && (
          <Sidebar side="right" className="border-r-0 border-l">
            <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
              <div className="flex items-center gap-3">
                <HkfLogo size="md" />
                <div>
                  <div className="font-semibold text-sm text-primary">הופמן קופמן</div>
                  <div className="text-xs text-muted-foreground">קרן למנהיגות</div>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>סקירה</SidebarGroupLabel>
                <SidebarMenu>
                  {navigationItems.overview.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={item.page === currentPage}
                        onClick={() => item.page && onNavigate?.(item.page)}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel>תפעול</SidebarGroupLabel>
                <SidebarMenu>
                  {navigationItems.operations.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={item.page === currentPage}
                        onClick={() => item.page && onNavigate?.(item.page)}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge && (
                        <SidebarMenuBadge className="bg-primary/10 text-primary">
                          {item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton disabled className="opacity-50 cursor-not-allowed">
                    <Settings className="w-4 h-4" />
                    <span>הגדרות</span>
                    <span className="text-xs text-muted-foreground mr-auto">בקרוב</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
        )}

        {/* Main Content - Center */}
        <div className="flex flex-col flex-1">
          {/* Header */}
          <header className="h-14 border-b border-border flex items-center px-4 md:px-6 gap-4 bg-card safe-area-top">
            {/* Mobile: Logo */}
            {isMobile && (
              <div className="flex items-center gap-2">
                <HkfLogo size="sm" />
              </div>
            )}

            {/* Search - full on desktop, icon on mobile */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isMobile ? "חיפוש..." : "חפש מועמדים, תוכניות..."}
                className="border-none shadow-none focus-visible:ring-0 bg-transparent"
                value={searchQuery}
                onChange={(e) => onSearch?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery && currentPage !== "people") {
                    onNavigate?.("people");
                  }
                }}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* JARVIS button - always visible */}
              <JarvisButton onClick={() => setIsJarvisOpen(!isJarvisOpen)} />
              {/* Avatar - visible on all screens */}
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-muted text-xs">{getUserInitials()}</AvatarFallback>
              </Avatar>
              {/* Logout button - hidden on mobile (available in More menu) */}
              {!isMobile && (
                <Button variant="ghost" size="icon" onClick={signOut} title="התנתק">
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </div>
          </header>

          {/* Main content area - add bottom padding on mobile for nav */}
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-20 md:pb-6 bg-muted/30">{children}</main>
        </div>

        {/* JARVIS Panel - Left side (last in flex = left in RTL) */}
        <JarvisPanel isOpen={isJarvisOpen} onClose={() => setIsJarvisOpen(false)} />

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <MobileBottomNav
            currentPage={currentPage}
            onNavigate={(page) => onNavigate?.(page)}
            onMoreClick={() => setIsMoreMenuOpen(true)}
          />
        )}

        {/* Mobile More Menu */}
        <MobileMoreMenu
          open={isMoreMenuOpen}
          onOpenChange={setIsMoreMenuOpen}
          currentPage={currentPage}
          onNavigate={(page) => onNavigate?.(page)}
          onOpenJarvis={() => setIsJarvisOpen(true)}
        />

        {/* PWA Components */}
        <OfflineIndicator />
        <InstallPrompt />
        <PWAReloadPrompt />
      </div>
    </SidebarProvider>
  );
}

export default AppLayout;
