# HKF CRM Mobile Strategy - SuperClaude Framework

**Document Version**: 1.0
**Created**: December 25, 2025
**Framework**: SuperClaude v4.1.9
**Commands Used**: `/sc:design`, `/agents:frontend-architect`, `/sc:research`, `/sc:workflow`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [SuperClaude Workflow Overview](#superclaude-workflow-overview)
3. [Phase 1: Mobile-First CSS Redesign](#phase-1-mobile-first-css-redesign)
4. [Phase 2: PWA Implementation](#phase-2-pwa-implementation)
5. [Phase 3: Native Wrapper (Optional)](#phase-3-native-wrapper-optional)
6. [Implementation Commands](#implementation-commands)
7. [Component Specifications](#component-specifications)
8. [Validation Checklist](#validation-checklist)
9. [Research Sources](#research-sources)

---

## Executive Summary

This document was generated using the **SuperClaude Framework** following the systematic workflow:

```
/sc:design → /agents:frontend-architect → /sc:research → /sc:workflow → /sc:implement
```

### Recommended Approach

| Phase | SuperClaude Command | Duration | Deliverables |
|-------|---------------------|----------|--------------|
| 1 | `/sc:implement mobile-layout --type component --framework react` | 2-3 weeks | Responsive UI |
| 2 | `/sc:implement pwa-features --type feature --with-tests` | 1-2 weeks | Offline + Install |
| 3 | `/sc:implement capacitor-wrapper --safe` | 1-2 weeks | App Store (optional) |

---

## SuperClaude Workflow Overview

### Commands Executed

#### 1. `/sc:design mobile-friendly HKF CRM --type architecture --format spec`

**Purpose**: Analyze existing system and define mobile architecture approach.

**Behavioral Flow**:
1. **Analyze**: Examined target requirements and existing system context
2. **Plan**: Defined design approach based on architecture type
3. **Design**: Created specifications with industry best practices
4. **Validate**: Ensured design meets maintainability standards
5. **Document**: Generated clear design documentation

**Findings**:
- Current mobile readiness: 60%
- Existing `useIsMobile()` hook at 768px breakpoint
- Sidebar already uses Sheet component for mobile
- Missing: bottom navigation, card layouts, PWA service worker

#### 2. `/agents:frontend-architect`

**Purpose**: Apply frontend architecture expertise for accessibility and responsive design.

**Behavioral Mindset**: User-first decisions, accessibility as fundamental requirement.

**Focus Areas Applied**:
- **Accessibility**: WCAG 2.1 AA compliance for touch targets (44-48px)
- **Performance**: Core Web Vitals optimization
- **Responsive Design**: Mobile-first approach with flexible layouts
- **Component Architecture**: Reusable patterns with shadcn/ui

**Key Recommendations**:
- Touch targets: Minimum 44x44px (iOS) / 48x48dp (Android)
- Input height: 48px on mobile to prevent iOS zoom
- Font size: 16px minimum (prevents auto-zoom on focus)
- Bottom navigation: 4-5 primary items + "More" menu

#### 3. `/sc:research mobile PWA best practices 2025 React shadcn-ui responsive design`

**Purpose**: Gather current best practices and technology patterns.

**Research Depth**: Standard (2-3 hops)

**Key Findings**:

**PWA Best Practices (2025)**:
- Use `vite-plugin-pwa` for zero-config PWA setup
- `registerType: 'autoUpdate'` for automatic service worker updates
- Workbox for intelligent caching strategies
- `virtual:pwa-register/react` for React-specific hooks

**shadcn/ui Mobile Patterns**:
- Built with Tailwind CSS mobile-first utilities
- Adaptive components (dropdown → drawer on mobile)
- Sheet component for mobile overlays
- Touch-friendly by default (proper tap targets)

**CRM Dashboard Design (2025)**:
- Mobile-first philosophy is essential
- Touch targets: 48px minimum height
- Progressive disclosure for complex data
- Card-based layouts instead of tables on mobile
- Haptic feedback for critical actions

#### 4. `/sc:workflow HKF CRM mobile implementation --phases 3`

**Purpose**: Generate structured implementation workflow with dependency mapping.

**Strategy**: Systematic with parallel task coordination

---

## Phase 1: Mobile-First CSS Redesign

### Overview

| Attribute | Value |
|-----------|-------|
| Duration | 2-3 weeks |
| Cost | $2,000-4,000 |
| Code Reuse | 100% |
| SuperClaude Command | `/sc:implement mobile-layout --type component --framework react` |

### Week 1: Navigation & Layout

#### Task 1.1: Create MobileBottomNav Component

**File**: `apps/web/src/components/hkf/MobileBottomNav.tsx`

**SuperClaude Implementation**:
```bash
/sc:implement MobileBottomNav component with 5 navigation items for Hebrew RTL CRM --type component --framework react
```

**Specification**:
```typescript
interface MobileBottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onMoreClick: () => void;
}

// Navigation items (Hebrew RTL)
const primaryNavItems = [
  { icon: LayoutDashboard, label: "לוח", page: "dashboard" },
  { icon: Users, label: "אנשים", page: "people" },
  { icon: Calendar, label: "ראיונות", page: "interviews" },
  { icon: CreditCard, label: "תשלומים", page: "payments" },
];

// Design Requirements (from /agents:frontend-architect):
// - Height: 64px (safe area aware)
// - Touch targets: 48px minimum
// - Icons: 20x20px (w-5 h-5)
// - Labels: 12px (text-xs)
// - Active state: primary color
// - RTL: Auto-reversed by Tailwind
```

**Accessibility Requirements** (WCAG 2.1 AA):
- Role: `navigation`
- Aria-label: `"ניווט ראשי"` (Primary navigation)
- Current page: `aria-current="page"`
- Keyboard navigation: Tab through items

#### Task 1.2: Update AppLayout for Mobile

**File**: `apps/web/src/components/hkf/AppLayout.tsx`

**Changes Required**:

```typescript
// 1. Import mobile detection and new components
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBottomNav } from "./MobileBottomNav";

// 2. Change viewport height (prevents keyboard issues)
// Before: h-screen
// After: h-dvh (dynamic viewport height)

// 3. Add bottom padding for mobile nav
// main: pb-20 md:pb-6

// 4. Hide sidebar on mobile, show bottom nav
{!isMobile && <Sidebar ... />}
{isMobile && <MobileBottomNav ... />}

// 5. Hide search on mobile, show search icon
<div className="hidden sm:flex ...">  {/* Search input */}
{isMobile && <SearchButton />}        {/* Mobile search */}
```

#### Task 1.3: Add Safe Area CSS

**File**: `apps/web/src/index.css`

```css
/* Safe area for notched devices (iPhone X+, etc.) */
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

/* Prevent iOS zoom on input focus */
input, select, textarea {
  font-size: 16px;
}

@media (min-width: 640px) {
  input, select, textarea {
    font-size: 14px;
  }
}
```

#### Task 1.4: Update Viewport Meta

**File**: `apps/web/index.html`

```html
<!-- Before -->
<meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no" />

<!-- After (supports notched devices) -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### Week 2: Data Display Components

#### Task 2.1: Create MobilePersonCard Component

**File**: `apps/web/src/components/hkf/MobilePersonCard.tsx`

**SuperClaude Implementation**:
```bash
/sc:implement MobilePersonCard for CRM person display with Hebrew RTL support --type component --framework react
```

**Design Pattern** (from research):
- Card-based layout for mobile (not table)
- Progressive disclosure (key info visible, details on tap)
- Touch-friendly (entire card is tappable)
- Visual hierarchy with status badges

**Specification**:
```typescript
interface MobilePersonCardProps {
  person: PersonWithEnrollment;
  onClick: () => void;
}

// Layout:
// ┌────────────────────────────────────────────┐
// │ [Avatar]  Name                        [→]  │
// │           email@example.com                │
// │           [Status Badge] [Date]            │
// └────────────────────────────────────────────┘

// Touch target: Entire card (min 48px height)
// Padding: 16px (p-4)
// Gap between cards: 12px (space-y-3)
```

#### Task 2.2: Create Responsive List Wrapper

**File**: `apps/web/src/components/hkf/ResponsiveList.tsx`

**Purpose**: Switch between table (desktop) and cards (mobile)

```typescript
interface ResponsiveListProps<T> {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  renderTable: () => React.ReactNode;
}

export function ResponsiveList<T>({ items, renderCard, renderTable }: ResponsiveListProps<T>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map(renderCard)}
      </div>
    );
  }

  return renderTable();
}
```

#### Task 2.3: Update PersonDetail for Mobile

**File**: `apps/web/src/components/hkf/PersonDetail.tsx`

**Pattern**: Side panel (desktop) → Bottom sheet (mobile)

```typescript
// Use Sheet component on mobile
if (isMobile) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] p-0">
        {/* Detail content */}
      </SheetContent>
    </Sheet>
  );
}

// Desktop: existing side panel
return (
  <div className="w-[400px] bg-card border-l ...">
    {/* Detail content */}
  </div>
);
```

### Week 3: Forms & Testing

#### Task 3.1: Make Forms Responsive

**Pattern for all forms** (`PersonForm.tsx`, `ProgramForm.tsx`, `CohortForm.tsx`, `EventForm.tsx`):

```typescript
// Grid columns: Stack on mobile, 2 columns on desktop
// Before:
<div className="grid grid-cols-2 gap-4">

// After:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

// Input sizing: Larger on mobile
<Input className="h-12 sm:h-10 text-base sm:text-sm" />

// Button sizing: Full width on mobile
<Button className="w-full sm:w-auto h-12 sm:h-10">
```

#### Task 3.2: Device Testing Checklist

| Device | Screen Size | Test Focus |
|--------|-------------|------------|
| iPhone SE | 375x667 | Smallest common phone |
| iPhone 14 Pro | 393x852 | Standard iPhone with notch |
| iPhone 14 Pro Max | 430x932 | Large phone |
| Samsung Galaxy S23 | 360x780 | Popular Android |
| iPad Mini | 768x1024 | Tablet (breakpoint edge) |
| iPad Pro | 1024x1366 | Large tablet |

---

## Phase 2: PWA Implementation

### Overview

| Attribute | Value |
|-----------|-------|
| Duration | 1-2 weeks |
| Cost | $1,000-2,000 |
| Code Reuse | 100% |
| SuperClaude Command | `/sc:implement pwa-features --type feature --with-tests` |

### Week 4: Service Worker Setup

#### Task 2.1: Install Dependencies

```bash
npm install -D vite-plugin-pwa workbox-window
```

#### Task 2.2: Configure Vite PWA Plugin

**File**: `apps/web/vite.config.ts`

**SuperClaude Implementation**:
```bash
/sc:implement PWA configuration for Hebrew RTL CRM with Supabase caching --type feature --safe
```

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
        orientation: 'portrait-primary',
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
            // Cache Supabase API calls (Network First)
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
            // Cache fonts (Cache First)
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
      },
      devOptions: {
        enabled: true // Enable in development for testing
      }
    })
  ],
  // ... rest of existing config
});
```

#### Task 2.3: Update TypeScript Configuration

**File**: `apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "types": [
      "vite-plugin-pwa/react"
    ]
  }
}
```

#### Task 2.4: Register Service Worker

**File**: `apps/web/src/main.tsx`

```typescript
import { useRegisterSW } from 'virtual:pwa-register/react';

// In your App component or create a dedicated hook
function PWAReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <>
      {(offlineReady || needRefresh) && (
        <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:left-auto md:right-4 md:w-80 bg-card border rounded-lg shadow-lg p-4 z-50">
          {offlineReady && <span>האפליקציה מוכנה לעבודה במצב לא מקוון</span>}
          {needRefresh && <span>גרסה חדשה זמינה</span>}
          <div className="flex gap-2 mt-3">
            <Button variant="outline" onClick={close}>סגור</Button>
            {needRefresh && (
              <Button onClick={() => updateServiceWorker(true)}>עדכן</Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

### Week 5: Offline & Install Features

#### Task 2.5: Create Offline Indicator

**File**: `apps/web/src/components/hkf/OfflineIndicator.tsx`

```typescript
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

#### Task 2.6: Create Install Prompt

**File**: `apps/web/src/components/hkf/InstallPrompt.tsx`

```typescript
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
      // Show after 30 seconds of usage
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
        <div className="flex-1">
          <h3 className="font-medium">התקן את HKF CRM</h3>
          <p className="text-sm text-muted-foreground mt-1">
            הוסף למסך הבית לגישה מהירה
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setShowPrompt(false)}>
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

---

## Phase 3: Native Wrapper (Optional)

### Overview

| Attribute | Value |
|-----------|-------|
| Duration | 1-2 weeks |
| Cost | $2,000-5,000 |
| Code Reuse | 95% |
| SuperClaude Command | `/sc:implement capacitor-wrapper --safe` |
| Decision Criteria | >30% mobile users OR user requests for app store |

### Setup Capacitor

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "HKF CRM" "com.hkf.crm"

# Add platforms
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# Add plugins
npm install @capacitor/push-notifications
npm install @capacitor/splash-screen
npm install @capacitor/status-bar
```

### Configuration

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

### Build & Deploy

```bash
# Build web app
npm run build

# Copy to native projects
npx cap copy

# Open in IDE
npx cap open android  # Opens Android Studio
npx cap open ios      # Opens Xcode

# Live reload during development
npx cap run android --livereload --external
```

---

## Implementation Commands

### SuperClaude Command Sequence

Execute these commands in order for systematic implementation:

```bash
# Phase 1: Mobile-First CSS
/sc:implement MobileBottomNav --type component --framework react
/sc:implement MobilePersonCard --type component --framework react
/sc:implement ResponsiveList wrapper --type component --framework react
/sc:implement AppLayout mobile updates --type component --framework react
/sc:implement form responsiveness --type feature

# Phase 2: PWA
/sc:implement vite-plugin-pwa configuration --type feature --safe
/sc:implement OfflineIndicator --type component --framework react
/sc:implement InstallPrompt --type component --framework react
/sc:implement PWAReloadPrompt --type component --framework react

# Phase 3: Capacitor (Optional)
/sc:implement capacitor configuration --type feature --safe
/sc:implement native plugins --type feature

# Testing & Validation
/sc:test mobile responsive --coverage
/sc:analyze accessibility --type audit
```

### Validation Commands

```bash
# Run accessibility audit
/sc:analyze src/components/hkf --domain accessibility

# Run performance check
/sc:analyze src --domain performance

# Generate test plan
/sc:test mobile features --generate-plan

# Review implementation
/sc:reflect mobile implementation --validate
```

---

## Component Specifications

### New Components to Create

| Component | File | Purpose |
|-----------|------|---------|
| MobileBottomNav | `components/hkf/MobileBottomNav.tsx` | Bottom navigation for mobile |
| MobilePersonCard | `components/hkf/MobilePersonCard.tsx` | Person card for mobile lists |
| ResponsiveList | `components/hkf/ResponsiveList.tsx` | Table/card switcher |
| OfflineIndicator | `components/hkf/OfflineIndicator.tsx` | Offline status banner |
| InstallPrompt | `components/hkf/InstallPrompt.tsx` | PWA install prompt |
| PWAReloadPrompt | `components/hkf/PWAReloadPrompt.tsx` | Update notification |

### Components to Modify

| Component | Changes |
|-----------|---------|
| AppLayout.tsx | Add mobile detection, bottom nav, responsive header |
| PersonDetail.tsx | Add Sheet wrapper for mobile |
| PersonForm.tsx | Responsive grid, touch-friendly inputs |
| ProgramForm.tsx | Responsive grid, touch-friendly inputs |
| CohortForm.tsx | Responsive grid, touch-friendly inputs |
| EventForm.tsx | Responsive grid, touch-friendly inputs |
| People.tsx | Add ResponsiveList wrapper |
| Interviews.tsx | Add ResponsiveList wrapper |
| Payments.tsx | Add ResponsiveList wrapper |
| Events.tsx | Add ResponsiveList wrapper |

### Configuration Files to Modify

| File | Changes |
|------|---------|
| vite.config.ts | Add VitePWA plugin |
| index.html | Update viewport meta tag |
| index.css | Add safe area CSS |
| tsconfig.json | Add PWA types |
| manifest.json | Update with Hebrew RTL metadata |

---

## Validation Checklist

### Phase 1 Completion Criteria

- [ ] Bottom navigation visible on mobile (<768px)
- [ ] Sidebar hidden on mobile
- [ ] Cards display instead of tables on mobile
- [ ] Person detail opens as bottom sheet on mobile
- [ ] Forms stack to single column on mobile
- [ ] Touch targets are 44px+ on mobile
- [ ] No horizontal scroll on any page
- [ ] Safe area respected on notched devices
- [ ] RTL layout works correctly on mobile

### Phase 2 Completion Criteria

- [ ] PWA installable from browser
- [ ] Offline indicator shows when disconnected
- [ ] App works offline (cached data)
- [ ] Update prompt appears for new versions
- [ ] Manifest shows Hebrew metadata
- [ ] Icons display correctly on home screen
- [ ] Splash screen configured

### Phase 3 Completion Criteria (Optional)

- [ ] Android APK builds successfully
- [ ] iOS IPA builds successfully
- [ ] Push notifications configured
- [ ] App passes store review guidelines
- [ ] Native splash screen displays

---

## Research Sources

### PWA Best Practices
- [Getting Started | Vite PWA](https://vite-pwa-org.netlify.app/guide/)
- [React | Frameworks | Vite PWA](https://vite-pwa-org.netlify.app/frameworks/react)
- [Progressive Web App with Vite - DEV Community](https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf)
- [Vite-plugin-pwa Guide 2025 - Generalist Programmer](https://generalistprogrammer.com/tutorials/vite-plugin-pwa-npm-package-guide)
- [GitHub - vite-pwa/vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa)

### shadcn/ui Mobile Patterns
- [The Foundation for your Design System - shadcn/ui](https://ui.shadcn.com/)
- [ShadCN: The Future of UI Development - Zignuts](https://www.zignuts.com/blog/shadcn-future-of-ui-development)
- [Shadcn UI Kit Figma for Mobile Application](https://shadcnstudio.com/blog/shadcn-ui-kit-figma-for-mobile-application)
- [GitHub - awesome-shadcn-ui](https://github.com/birobirobiro/awesome-shadcn-ui)

### Mobile Dashboard Design
- [Intuitive Mobile Dashboard UI - Toptal](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)
- [20 Dashboard UI/UX Design Principles 2025 - Medium](https://medium.com/@allclonescript/20-best-dashboard-ui-ux-design-principles-you-need-in-2025-30b661f2f795)
- [Top Dashboard Design Trends 2025 - UITOP](https://uitop.design/blog/design/top-dashboard-design-trends/)
- [CRM UX Design Best Practices - Aufait UX](https://www.aufaitux.com/blog/crm-ux-design-best-practices/)

### Touch-Friendly Design
- [Top UI/UX Trends in Admin Dashboard Design 2025 - UILayouts](https://www.uilayouts.com/top-ui-ux-trends-in-admin-dashboard-design-for-2025/)
- [Dashboard Design Best Practices - Justinmind](https://www.justinmind.com/ui-design/dashboard-design-best-practices-ux)

---

## Decision Log

| Date | Decision | Rationale | SuperClaude Command |
|------|----------|-----------|---------------------|
| 2025-12-25 | Use PWA over React Native | 100% code reuse, lower cost | `/sc:design --type architecture` |
| 2025-12-25 | Bottom nav (not hamburger) | Better UX for 6 pages, thumb-friendly | `/agents:frontend-architect` |
| 2025-12-25 | Cards instead of tables | Better mobile readability | `/sc:research mobile CRM patterns` |
| 2025-12-25 | vite-plugin-pwa | Zero-config, well-maintained | `/sc:research PWA React 2025` |
| 2025-12-25 | Defer Capacitor to Phase 3 | Only if users request app store | `/sc:workflow --phases 3` |

---

## Notes

- This document was generated using SuperClaude Framework v4.1.9
- All commands can be executed in Claude Code with SuperClaude installed
- Update this document as implementation progresses
- Use `/sc:reflect` after each phase to validate and document learnings
