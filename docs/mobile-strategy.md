# HKF CRM Mobile Strategy

**Document Version**: 1.0
**Created**: December 25, 2025
**Status**: Planning Phase
**Project**: HKF CRM (`~/Projects/aitheroad/hkf-crm/`)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Approach Comparison](#approach-comparison)
4. [Recommended Strategy](#recommended-strategy)
5. [Phase 1: Mobile-First CSS Redesign](#phase-1-mobile-first-css-redesign)
6. [Phase 2: PWA Implementation](#phase-2-pwa-implementation)
7. [Phase 3: Capacitor (Optional)](#phase-3-capacitor-optional)
8. [Mobile UI Patterns](#mobile-ui-patterns)
9. [Hebrew RTL Considerations](#hebrew-rtl-considerations)
10. [File Reference](#file-reference)
11. [Implementation Checklist](#implementation-checklist)
12. [Cost & Timeline Summary](#cost--timeline-summary)
13. [Resources & Documentation](#resources--documentation)

---

## Executive Summary

### Goal
Make HKF CRM fully usable on mobile devices for field users who need to:
- View and manage people/candidates
- Check interview schedules
- Track payments
- Access dashboard stats

### Recommended Approach
**Phased implementation** starting with Mobile-First CSS, then PWA features:

| Phase | Approach | Time | Cost | Outcome |
|-------|----------|------|------|---------|
| 1 | Mobile-First CSS | 2-3 weeks | $2-4k | Beautiful mobile UX |
| 2 | PWA | 1-2 weeks | $1-2k | Offline + Installable |
| 3 | Capacitor (optional) | 1-2 weeks | $2-5k | App Store presence |

**Total for Phases 1+2**: 3-5 weeks, $3-6k, 100% code reuse

### Why Not React Native?
- 2-4 months development time
- $20-40k cost
- Only 30% code reuse (UI must be rewritten)
- High maintenance burden (two codebases)
- Unnecessary for CRM use case

---

## Current State Analysis

### Mobile Readiness Score: 60%

#### What's Already Working

| Feature | Status | File |
|---------|--------|------|
| Viewport meta tags | ✅ Ready | `apps/web/index.html` |
| PWA manifest | ✅ Ready | `apps/web/public/manifest.json` |
| Mobile detection hook | ✅ Ready | `apps/web/src/hooks/use-mobile.ts` (768px breakpoint) |
| Responsive sidebar | ✅ Ready | `apps/web/src/components/ui/sidebar.tsx` |
| Dialog responsiveness | ✅ Ready | `sm:max-w-[425px]` pattern |
| Touch-friendly buttons | ✅ Ready | 36px+ height |
| Table horizontal scroll | ✅ Ready | `apps/web/src/components/ui/table.tsx` |
| Hebrew RTL support | ✅ Ready | `side="right"`, `flex-row-reverse` |
| Dark mode | ✅ Ready | `apps/web/src/themes/hkf-theme.css` |

#### What Needs Work

| Issue | Current | Recommended | File |
|-------|---------|-------------|------|
| PersonDetail width | `w-[400px]` fixed | `w-full md:w-[400px]` | `PersonDetail.tsx` |
| Form grid columns | `grid-cols-2` always | `grid-cols-1 sm:grid-cols-2` | `PersonForm.tsx`, etc. |
| Viewport height | `h-screen` (100vh) | `h-dvh` (dynamic) | `AppLayout.tsx` |
| Service worker | Missing | Implement with vite-plugin-pwa | New file |
| Mobile navigation | Desktop sidebar only | Add bottom navigation | New component |
| Search input | Always visible | Hide on mobile | `AppLayout.tsx` |
| Safe area insets | Not handled | Add for notched phones | `index.css` |

### Mobile Breakpoint Configuration
```typescript
// apps/web/src/hooks/use-mobile.ts
const MOBILE_BREAKPOINT = 768 // md breakpoint
```

### Current Viewport Configuration
```html
<!-- apps/web/index.html -->
<meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no" />
<meta name="theme-color" content="#000000" />
```

---

## Approach Comparison

### Option 1: Progressive Web App (PWA)

**What it is**: Convert existing React app to installable, offline-capable app.

| Aspect | Details |
|--------|---------|
| Development Time | 1-2 weeks |
| Cost | $1-2k |
| Code Reuse | 100% |
| App Store | No (direct install from browser) |
| Offline | Yes (service worker) |
| Push Notifications | Android: Yes, iOS: Partial (16.4+) |
| Native Features | Limited |

**Pros**:
- Zero app store friction
- Instant updates (no review process)
- Same codebase
- Cost-effective

**Cons**:
- Limited iOS push notification support
- No app store discoverability
- Limited native device access

### Option 2: React Native / Expo

**What it is**: Rebuild app with React Native for true native experience.

| Aspect | Details |
|--------|---------|
| Development Time | 2-4 months |
| Cost | $20-40k |
| Code Reuse | 30% (business logic only) |
| App Store | Yes |
| Offline | Excellent |
| Push Notifications | Full support |
| Native Features | Full access |

**Pros**:
- Native performance
- Full device access
- App store presence

**Cons**:
- High cost and time
- Two codebases to maintain
- UI must be completely rewritten
- Team needs React Native expertise

**Not recommended** for HKF CRM.

### Option 3: Capacitor (Hybrid)

**What it is**: Wrap existing web app in native container for app stores.

| Aspect | Details |
|--------|---------|
| Development Time | 1-2 weeks |
| Cost | $2-5k |
| Code Reuse | 95% |
| App Store | Yes |
| Offline | Yes (via PWA) |
| Push Notifications | Full support |
| Native Features | Good (via plugins) |

**Pros**:
- Maximum code reuse
- App store distribution
- Quick migration
- Web developer friendly

**Cons**:
- WebView performance (acceptable for CRM)
- Larger app size (~10-20MB)

**Recommended** as Phase 3 if app store presence needed.

### Option 4: Mobile-First CSS Redesign

**What it is**: Optimize existing web app with responsive design patterns.

| Aspect | Details |
|--------|---------|
| Development Time | 2-3 weeks |
| Cost | $2-4k |
| Code Reuse | 100% |
| App Store | No |
| Offline | No (needs PWA) |
| Push Notifications | No (needs PWA) |
| Native Features | None |

**Pros**:
- Immediate value
- Foundation for all other approaches
- Low risk
- No new tech stack

**Cons**:
- No offline without PWA
- No push notifications without PWA

**Recommended** as Phase 1 - required foundation.

---

## Recommended Strategy

### Phase 1: Mobile-First CSS Redesign (Weeks 1-3)

**Goal**: Make the app fully usable on mobile browsers.

**Deliverables**:
1. Bottom navigation component for mobile
2. Card-based lists (replace tables on mobile)
3. Touch-friendly forms (48px inputs)
4. Full-screen detail panels on mobile
5. Responsive dashboard stats

### Phase 2: PWA Implementation (Weeks 4-5)

**Goal**: Add offline capability and installability.

**Deliverables**:
1. Service worker with Supabase caching
2. Updated manifest with Hebrew metadata
3. "Add to Home Screen" prompt
4. Offline indicator UI
5. Push notification subscription (optional)

### Phase 3: Capacitor (Optional, Weeks 6-7)

**Goal**: App store distribution.

**Decision criteria** (implement only if):
- >30% of users access via mobile
- Users request app store version
- Need full iOS push notifications

**Deliverables**:
1. Capacitor configuration
2. Android/iOS projects
3. Native plugins (Camera, Push)
4. App store submission

---

## Phase 1: Mobile-First CSS Redesign

### 1.1 Bottom Navigation Component

**File**: `apps/web/src/components/hkf/MobileBottomNav.tsx`

```tsx
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  MoreHorizontal,
} from "lucide-react";

type Page = "dashboard" | "people" | "programs" | "interviews" | "payments" | "events";

const primaryNavItems = [
  { icon: LayoutDashboard, label: "לוח", page: "dashboard" as Page },
  { icon: Users, label: "אנשים", page: "people" as Page },
  { icon: Calendar, label: "ראיונות", page: "interviews" as Page },
  { icon: CreditCard, label: "תשלומים", page: "payments" as Page },
];

interface MobileBottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onMoreClick: () => void;
}

export function MobileBottomNav({
  currentPage,
  onNavigate,
  onMoreClick
}: MobileBottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {primaryNavItems.map((item) => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
              "active:bg-muted",
              currentPage === item.page
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}

        {/* More button for Programs, Events */}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-muted-foreground active:bg-muted"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-xs">עוד</span>
        </button>
      </div>
    </nav>
  );
}
```

### 1.2 Mobile Person Card Component

**File**: `apps/web/src/components/hkf/MobilePersonCard.tsx`

```tsx
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Mail, Phone } from "lucide-react";
import type { PersonWithEnrollment } from "@/hooks/usePeople";

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

function getStatusVariant(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    new: "default",
    in_progress: "secondary",
    accepted: "default",
    rejected: "destructive",
  };
  return variants[status] || "outline";
}

const statusLabels: Record<string, string> = {
  new: "חדש",
  in_progress: "בתהליך",
  accepted: "התקבל",
  rejected: "נדחה",
};

interface MobilePersonCardProps {
  person: PersonWithEnrollment;
  onClick: () => void;
}

export function MobilePersonCard({ person, onClick }: MobilePersonCardProps) {
  return (
    <Card className="mb-3 active:bg-muted/50 transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="text-sm">
              {getInitials(person.first_name, person.last_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-base">
              {person.first_name} {person.last_name}
            </div>

            {person.email && (
              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{person.email}</span>
              </div>
            )}

            {person.phone && (
              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                <Phone className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{person.phone}</span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              {person.enrollment_status && (
                <Badge variant={getStatusVariant(person.enrollment_status)}>
                  {statusLabels[person.enrollment_status] || person.enrollment_status}
                </Badge>
              )}
            </div>
          </div>

          <ChevronLeft className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-4" />
        </div>
      </CardContent>
    </Card>
  );
}
```

### 1.3 AppLayout Updates

**File**: `apps/web/src/components/hkf/AppLayout.tsx`

Key changes needed:

```tsx
// Add imports
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBottomNav } from "./MobileBottomNav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppLayout({ children, currentPage, onNavigate, onSearch, searchQuery }) {
  const isMobile = useIsMobile();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    // Change h-screen to h-dvh for dynamic viewport
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar - hidden on mobile */}
      {!isMobile && (
        <Sidebar>
          {/* existing sidebar content */}
        </Sidebar>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b flex items-center px-4 gap-4">
          {/* Mobile menu button */}
          {isMobile && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                {/* Mobile menu content */}
              </SheetContent>
            </Sheet>
          )}

          {/* Search - hidden on mobile, show icon instead */}
          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>

          {/* Mobile search button */}
          {isMobile && (
            <Button variant="ghost" size="icon" className="sm:hidden">
              <Search className="w-5 h-5" />
            </Button>
          )}
        </header>

        {/* Main content with bottom padding for mobile nav */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <MobileBottomNav
          currentPage={currentPage}
          onNavigate={onNavigate}
          onMoreClick={() => setMoreMenuOpen(true)}
        />
      )}

      {/* More menu sheet for Programs, Events */}
      <Sheet open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <SheetContent side="bottom" className="h-auto">
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => { onNavigate("programs"); setMoreMenuOpen(false); }}
            >
              <GraduationCap className="w-6 h-6" />
              <span>תוכניות</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => { onNavigate("events"); setMoreMenuOpen(false); }}
            >
              <CalendarDays className="w-6 h-6" />
              <span>אירועים</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

### 1.4 PersonDetail Mobile Adaptation

**File**: `apps/web/src/components/hkf/PersonDetail.tsx`

```tsx
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function PersonDetail({ person, onClose, ...props }) {
  const isMobile = useIsMobile();

  const content = (
    <div className="h-full overflow-y-auto">
      {/* Header with close button */}
      <div className="sticky top-0 bg-card z-10 p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg">
          {person.first_name} {person.last_name}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Existing detail content */}
      <div className="p-4">
        {/* ... rest of detail content ... */}
      </div>
    </div>
  );

  // Mobile: Full-screen bottom sheet
  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Side panel (existing behavior)
  return (
    <div className="w-[400px] bg-card border-l border-border flex flex-col shrink-0">
      {content}
    </div>
  );
}
```

### 1.5 Form Responsiveness

**Pattern for all forms** (`PersonForm.tsx`, `ProgramForm.tsx`, etc.):

```tsx
// Before
<div className="grid grid-cols-2 gap-4">

// After - stack on mobile
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

**Input sizing for mobile**:

```tsx
// Larger inputs on mobile to prevent iOS zoom
<Input
  className="h-12 sm:h-10 text-base sm:text-sm"
  // text-base (16px) prevents iOS auto-zoom on focus
/>

// Full-width buttons on mobile
<Button className="w-full sm:w-auto h-12 sm:h-10">
  שמור
</Button>
```

### 1.6 Safe Area CSS

**File**: `apps/web/src/index.css`

Add to existing CSS:

```css
/* Safe area for notched devices */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px);
}

/* Dynamic viewport height fallback */
@supports not (height: 100dvh) {
  .h-dvh {
    height: 100vh;
  }
}
```

**Update index.html viewport**:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

---

## Phase 2: PWA Implementation

### 2.1 Install Dependencies

```bash
npm install -D vite-plugin-pwa workbox-window
```

### 2.2 Vite Configuration

**File**: `apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo192.png', 'logo512.png'],
      manifest: {
        name: 'HKF CRM - קרן הופמן קופמן',
        short_name: 'HKF CRM',
        description: 'מערכת ניהול מועמדים',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        dir: 'rtl',
        lang: 'he',
        start_url: '/',
        icons: [
          {
            src: 'logo192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Supabase API calls
            urlPattern: /^https:\/\/txjyyvzyahqmjndfsnzx\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ],
  // ... rest of config
});
```

### 2.3 Update Manifest

**File**: `apps/web/public/manifest.json`

```json
{
  "name": "HKF CRM - קרן הופמן קופמן",
  "short_name": "HKF CRM",
  "description": "מערכת ניהול מועמדים",
  "start_url": "/",
  "display": "standalone",
  "dir": "rtl",
  "lang": "he",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "logo192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "logo512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "screenshot-mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### 2.4 Offline Indicator Component

**File**: `apps/web/src/components/hkf/OfflineIndicator.tsx`

```tsx
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 inset-x-0 bg-yellow-500 text-yellow-950 py-2 px-4 text-center text-sm z-50 safe-area-top">
      <WifiOff className="w-4 h-4 inline-block ml-2" />
      אתה במצב לא מקוון. חלק מהנתונים עשויים להיות לא מעודכנים.
    </div>
  );
}
```

### 2.5 Install Prompt Component

**File**: `apps/web/src/components/hkf/InstallPrompt.tsx`

```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after 30 seconds of usage
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:left-auto md:right-4 md:w-80 bg-card border rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium">התקן את HKF CRM</h3>
          <p className="text-sm text-muted-foreground mt-1">
            הוסף למסך הבית לגישה מהירה
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={() => setShowPrompt(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="outline" className="flex-1" onClick={() => setShowPrompt(false)}>
          לא עכשיו
        </Button>
        <Button className="flex-1" onClick={handleInstall}>
          התקן
        </Button>
      </div>
    </div>
  );
}
```

### 2.6 Register Service Worker

**File**: `apps/web/src/main.tsx`

```typescript
import { registerSW } from 'virtual:pwa-register';

// Register service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // Show update notification
    if (confirm('גרסה חדשה זמינה. לעדכן?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});
```

---

## Phase 3: Capacitor (Optional)

### 3.1 Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "HKF CRM" "com.hkf.crm"
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios
```

### 3.2 Capacitor Configuration

**File**: `capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hkf.crm',
  appName: 'HKF CRM',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
```

### 3.3 Native Plugins

```bash
npm install @capacitor/push-notifications
npm install @capacitor/camera
npm install @capacitor/splash-screen
npm install @capacitor/status-bar
```

### 3.4 Build & Deploy

```bash
# Build web app
npm run build

# Copy to native projects
npx cap copy

# Open in IDE
npx cap open android  # Opens Android Studio
npx cap open ios      # Opens Xcode
```

---

## Mobile UI Patterns

### Navigation: Bottom Tabs + More Menu

For 6 pages, use:
- **Bottom nav (4 items)**: Dashboard, People, Interviews, Payments
- **"More" menu**: Programs, Events

This follows iOS/Android conventions (max 5 bottom tabs).

### Tables → Cards on Mobile

| Screen Size | Display |
|-------------|---------|
| Desktop (768px+) | DataTable with columns |
| Mobile (<768px) | Card list with key info |

### Touch Targets

| Element | Minimum Size |
|---------|--------------|
| Buttons | 44x44px (iOS), 48x48dp (Android) |
| Inputs | 48px height |
| List items | 48px height |
| Icons | 24x24px with 44px tap area |

### Form Patterns

| Desktop | Mobile |
|---------|--------|
| 2-column grid | Single column |
| 36px inputs | 48px inputs |
| Inline buttons | Full-width buttons |
| Side dialogs | Bottom sheets |

### Data Display

| Pattern | Use Case |
|---------|----------|
| Cards | People list, programs list |
| Stats grid | Dashboard (2-col on mobile) |
| Bottom sheet | Detail views, forms |
| Infinite scroll | Long lists |

---

## Hebrew RTL Considerations

### No Special Work Required

All approaches inherit existing RTL support:
- Tailwind CSS RTL utilities work automatically
- Capacitor renders web app as-is
- PWA inherits all styles

### Patterns That Auto-Flip

| Element | LTR | RTL |
|---------|-----|-----|
| Chevron icons | → | ← |
| Text alignment | left | right |
| Flex direction | row | row-reverse |
| Margins/Padding | ml-* | mr-* |

### Manifest RTL

```json
{
  "dir": "rtl",
  "lang": "he"
}
```

---

## File Reference

### Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/components/hkf/AppLayout.tsx` | Add bottom nav, responsive layout |
| `apps/web/src/components/hkf/PersonDetail.tsx` | Mobile bottom sheet |
| `apps/web/src/components/hkf/PersonForm.tsx` | Responsive grid |
| `apps/web/src/components/hkf/ProgramForm.tsx` | Responsive grid |
| `apps/web/src/components/hkf/CohortForm.tsx` | Responsive grid |
| `apps/web/src/components/hkf/EventForm.tsx` | Responsive grid |
| `apps/web/src/pages/People.tsx` | Card view on mobile |
| `apps/web/src/pages/Interviews.tsx` | Card view on mobile |
| `apps/web/src/pages/Payments.tsx` | Card view on mobile |
| `apps/web/src/pages/Events.tsx` | Card view on mobile |
| `apps/web/src/index.css` | Safe area CSS |
| `apps/web/index.html` | Viewport update |
| `apps/web/vite.config.ts` | PWA plugin |
| `apps/web/public/manifest.json` | PWA manifest |

### Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/components/hkf/MobileBottomNav.tsx` | Bottom navigation |
| `apps/web/src/components/hkf/MobilePersonCard.tsx` | Person card for mobile |
| `apps/web/src/components/hkf/OfflineIndicator.tsx` | Offline status |
| `apps/web/src/components/hkf/InstallPrompt.tsx` | PWA install prompt |

---

## Implementation Checklist

### Phase 1: Mobile-First CSS (Weeks 1-3)

#### Week 1: Navigation & Layout
- [ ] Create `MobileBottomNav` component
- [ ] Update `AppLayout` with mobile detection
- [ ] Hide desktop sidebar on mobile
- [ ] Add bottom padding for nav (`pb-20 md:pb-0`)
- [ ] Create "More" menu sheet
- [ ] Update viewport to use `h-dvh`
- [ ] Add safe area CSS

#### Week 2: Data Display
- [ ] Create `MobilePersonCard` component
- [ ] Update `People.tsx` with responsive list
- [ ] Create mobile card variants for other lists
- [ ] Update `PersonDetail` to use Sheet on mobile
- [ ] Update dashboard stats grid (`grid-cols-2 lg:grid-cols-4`)

#### Week 3: Forms & Testing
- [ ] Update all forms with responsive grids
- [ ] Increase input heights on mobile (48px)
- [ ] Add `text-base` to inputs (prevents zoom)
- [ ] Make buttons full-width on mobile
- [ ] Test on real devices (iPhone, Android)
- [ ] Fix any RTL issues

### Phase 2: PWA (Weeks 4-5)

#### Week 4: Service Worker
- [ ] Install `vite-plugin-pwa`
- [ ] Configure workbox caching
- [ ] Update manifest with Hebrew metadata
- [ ] Create `OfflineIndicator` component
- [ ] Test offline functionality

#### Week 5: Installability
- [ ] Create `InstallPrompt` component
- [ ] Register service worker in main.tsx
- [ ] Test "Add to Home Screen" on iOS/Android
- [ ] Add app icons (192px, 512px)
- [ ] Test PWA installation flow

### Phase 3: Capacitor (Optional)

- [ ] Install Capacitor dependencies
- [ ] Configure capacitor.config.ts
- [ ] Add Android platform
- [ ] Add iOS platform
- [ ] Install native plugins
- [ ] Create app icons and splash screens
- [ ] Build and test on physical devices
- [ ] Submit to App Store / Play Store

---

## Cost & Timeline Summary

| Phase | Duration | Cost Estimate | Deliverables |
|-------|----------|---------------|--------------|
| Phase 1 | 2-3 weeks | $2,000-4,000 | Mobile-optimized UI |
| Phase 2 | 1-2 weeks | $1,000-2,000 | PWA + Offline |
| Phase 3 | 1-2 weeks | $2,000-5,000 | App Store apps |
| **Total (1+2)** | **3-5 weeks** | **$3,000-6,000** | **Full mobile PWA** |
| **Total (1+2+3)** | **5-7 weeks** | **$5,000-11,000** | **+ App Store** |

### Comparison: React Native Alternative

| Approach | Duration | Cost | Code Reuse |
|----------|----------|------|------------|
| PWA + CSS (recommended) | 3-5 weeks | $3-6k | 100% |
| React Native | 2-4 months | $20-40k | 30% |

---

## Resources & Documentation

### Implementation Guides
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/guide/)
- [Capacitor React Setup](https://capacitorjs.com/solution/react)
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [shadcn/ui Components](https://ui.shadcn.com/)

### Mobile UX
- [Mobile Navigation Patterns - Smashing Magazine](https://www.smashingmagazine.com/2017/05/basic-patterns-mobile-navigation/)
- [Mobile Tables - Nielsen Norman Group](https://www.nngroup.com/articles/mobile-tables/)
- [Touch Targets - Material Design](https://m3.material.io/foundations/interaction/touch-targets)

### PWA
- [Web App Manifest - MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Workers - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox](https://developer.chrome.com/docs/workbox/)

### Hebrew RTL
- [RTL Styling - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
- [Tailwind RTL](https://tailwindcss.com/docs/hover-focus-and-other-states#rtl-support)

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-25 | Prioritize PWA over React Native | 100% code reuse, lower cost, faster delivery |
| 2025-12-25 | Use bottom navigation (not hamburger) | Better UX for 6 pages, thumb-friendly |
| 2025-12-25 | Cards instead of tables on mobile | Better readability, touch-friendly |
| 2025-12-25 | Defer Capacitor to Phase 3 | Only needed if users request app store version |

---

## Notes

- This document should be updated as implementation progresses
- All code examples are starting points; adjust based on actual component APIs
- Test on real devices, not just browser emulators
- Consider analytics to track mobile usage before/after implementation
