import { useState, ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCircle,
  Globe,
  Calendar,
  CreditCard,
  Mail,
  Settings,
  Search,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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

type Page = "dashboard" | "people";

interface AppLayoutProps {
  children: ReactNode;
  currentPage?: Page;
  onNavigate?: (page: Page) => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

const navigationItems = {
  overview: [
    { label: "Dashboard", icon: LayoutDashboard, page: "dashboard" as Page },
    { label: "People", icon: Users, page: "people" as Page },
  ],
  programs: [
    { label: "Fellowship", icon: GraduationCap },
    { label: "Couples Program", icon: UserCircle },
    { label: "Birthright", icon: Globe },
  ],
  operations: [
    { label: "Interviews", icon: Calendar, badge: "3" },
    { label: "Payments", icon: CreditCard },
    { label: "Messages", icon: Mail },
  ],
};

export function AppLayout({ children, currentPage = "dashboard", onNavigate, onSearch, searchQuery = "" }: AppLayoutProps) {
  const [isJarvisOpen, setIsJarvisOpen] = useState(true);
  const { user, signOut } = useAuth();

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
      <div className="flex h-screen w-full overflow-hidden">
        {/* Sidebar */}
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
            <div className="flex items-center gap-3">
              <HkfLogo size="md" />
              <div>
                <div className="font-semibold text-sm text-primary">Hoffman Kofman</div>
                <div className="text-xs text-muted-foreground">Leadership Foundation</div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Overview</SidebarGroupLabel>
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
              <SidebarGroupLabel>Programs <span className="text-xs text-muted-foreground ml-1">(Coming Soon)</span></SidebarGroupLabel>
              <SidebarMenu>
                {navigationItems.programs.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton disabled className="opacity-50 cursor-not-allowed">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Operations <span className="text-xs text-muted-foreground ml-1">(Coming Soon)</span></SidebarGroupLabel>
              <SidebarMenu>
                {navigationItems.operations.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton disabled className="opacity-50 cursor-not-allowed">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge className="bg-muted text-muted-foreground">
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
                  <span>Settings</span>
                  <span className="text-xs text-muted-foreground ml-auto">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <SidebarInset className="flex flex-col flex-1">
          {/* Header */}
          <header className="h-14 border-b border-border flex items-center px-6 gap-4 bg-card">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search candidates, programs..."
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

            <div className="flex items-center gap-2 ml-auto">
              <JarvisButton onClick={() => setIsJarvisOpen(!isJarvisOpen)} />
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-muted text-xs">{getUserInitials()}</AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Content + JARVIS Panel */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-6 bg-muted/30">{children}</main>
            <JarvisPanel isOpen={isJarvisOpen} onClose={() => setIsJarvisOpen(false)} />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default AppLayout;
