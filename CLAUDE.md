# HKF CRM - Production (Single-Tenant)

**Last Updated**: 2025-12-18
**Ticket**: #021 (HKF Client Config) + #022 (Audit Fixes)
**Architecture**: Single-Tenant (one Supabase per organization)

---

## SINGLE-TENANT ARCHITECTURE

This is a **SINGLE-TENANT** deployment for Hoffman Kofman Foundation only.

### What This Means:
- **One Supabase instance** dedicated exclusively to HKF
- **No cross-tenant data isolation required** - all authenticated users belong to the same organization
- **RLS policies use `USING (true)`** - this is intentional and secure for single-tenant
- **HKF_ORG_ID environment variable** - fixed organization ID, not extracted from JWT
- **No multi-tenant complexity** - simpler codebase, easier maintenance

### Security Implications:
- `USING (true)` in RLS is **appropriate** because there's no other tenant's data to protect against
- All authenticated users are HKF staff with legitimate access to all HKF data
- API authentication (JWT) ensures only authorized users can access the system
- Rate limiting and CORS are configured for production security

### For Multi-Tenant Version:
See `/Users/yaronkra/Jarvis/projects/generic-ai-crm/` for the multi-tenant template that includes:
- Organization-scoped RLS policies
- JWT-based organization extraction
- Cross-tenant isolation

---

## APPLICATION STATUS: FEATURE COMPLETE (MVP)

The HKF CRM is a **complete working application** with the full candidate lifecycle implemented.

### What's Working

1. **Authentication (Google OAuth)**
   - Login page with Google sign-in
   - Auth context for protected routes
   - Sign-out functionality in header
   - `hooks/useAuth.ts` - Auth state management

2. **Dashboard**
   - Real-time stats from Supabase (Total People, Pending Interviews, Accepted, Payments)
   - People table with status badges
   - Quick filters (All, Applied, Interviewing, Accepted)
   - "View all" link to People page

3. **People Management (COMPLETE)**
   - Full search by name, email, phone
   - Status filter dropdown (multi-select)
   - Sortable table with all person data
   - Click row to open detail panel
   - **Create Person** - `PersonForm.tsx` with first/last name, email, phone
   - **Edit Person** - Same form in edit mode
   - **Delete Person** - `useDeletePerson()` hook with confirmation
   - `pages/People.tsx`, `components/hkf/PersonForm.tsx`

4. **Person Detail Panel**
   - Slide-out panel with Overview, Timeline, Notes tabs
   - Contact info, Program info, Key dates
   - Edit and Delete buttons (fully wired)
   - `components/hkf/PersonDetail.tsx`

5. **Interview Workflow (COMPLETE)**
   - **Schedule Interview** - Calendar date picker, time input, notes
   - **Interview Feedback** - Overall score (1-10), 5 criteria breakdown, recommendation
   - **Recommendation options**: Strong Accept, Accept, Maybe, Reject, Strong Reject
   - `ScheduleInterviewDialog.tsx`, `InterviewFeedbackDialog.tsx`
   - `hooks/useInterviews.ts` - schedule, update, complete, cancel

6. **Decision Workflow (COMPLETE)**
   - **Accept/Reject Dialog** - Large action buttons, decision notes
   - **Email Notification** - Checkbox to send acceptance/rejection email
   - **Interview Summary** - Shows score and recommendation in dialog
   - `DecisionDialog.tsx`, `hooks/useEnrollments.ts`

7. **Email Templates (READY)**
   - 4 templates: acceptance, rejection, interview_scheduled, interview_reminder
   - `hooks/useNotifications.ts`
   - **Status**: Templates ready, logs to console (Brevo integration pending)

8. **Navigation**
   - Sidebar navigation between Dashboard and People
   - State-based routing in `HkfDemo.tsx`

9. **JARVIS AI Chat**
   - WebSocket connection to Claude API
   - Real-time messaging
   - Tool calls display
   - Clear history button

### Database (Supabase)
- **Status**: DEPLOYED & WORKING
- **Project**: txjyyvzyahqmjndfsnzx.supabase.co
- **Tables**: organizations, people, programs, cohorts, enrollments, interviews, payments, events, escalations, communications
- **Test data**: 1 org, 3 people, 1 program, enrollments, interviews

### API Server (Fastify)
- **Status**: RUNNING
- **Location**: `apps/api/`
- **Port**: 3001
- **Features**: REST + WebSocket + Claude AI (27 tools)

---

## REMAINING WORK

### Integrations (Feature Work)

1. **Brevo Email Integration** - Connect `useNotifications.ts` to Brevo API
2. **Meshulam Payment Integration** - Payment links and tracking (requires HKF credentials)
3. **Google Calendar Integration** - Sync interviews to calendar (stub exists)

### Configuration (Manual Steps)

4. **Configure Google OAuth in Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/txjyyvzyahqmjndfsnzx/auth/providers
   - Enable Google provider
   - Add Client ID: `80121446608-8trgt0vud70utrh7kr45u3rab2eq1k3k.apps.googleusercontent.com`
   - Add Client Secret from `.env`
   - Set redirect URL: `https://txjyyvzyahqmjndfsnzx.supabase.co/auth/v1/callback`

### Technical Debt (See Ticket #022)

5. **Security Fixes** - PHASE 1 COMPLETE
   - API authentication (JWT) - DONE
   - Rate limiting - DONE
   - CORS restriction - DONE
   - SQL injection fix - DONE
   - RLS policies - N/A for single-tenant (USING true is appropriate)
   - Credentials rotated - DONE

6. **Code Quality** - Remaining work
   - Test coverage (vitest setup needed)
   - Error boundaries
   - Logging cleanup

See `/Users/yaronkra/Jarvis/tickets/022-hkf-crm-audit-fixes/00-roadmap.html` for full details.

---

## ENVIRONMENT VARIABLES (.env)

All credentials are configured:
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, DATABASE_URL
- ANTHROPIC_API_KEY (Claude)
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
- BREVO_API_KEY

HKF-specific (to be provided later):
- MESHULAM_* (payments)
- NAAMA_BOT_* (WhatsApp)

---

## QUICK START

```bash
# Terminal 1 - API Server (required for JARVIS AI)
cd /Users/yaronkra/Jarvis/projects/hkf-crm/apps/api
npm run dev

# Terminal 2 - Web Frontend
cd /Users/yaronkra/Jarvis/projects/hkf-crm/apps/web
npm run dev

# Then open: http://localhost:5173/?demo=hkf
```

---

## PROJECT STRUCTURE

```
hkf-crm/
├── apps/
│   ├── api/               # Fastify API + JARVIS AI
│   │   └── src/
│   │       ├── ai/        # Claude integration
│   │       │   ├── agent.ts
│   │       │   ├── tools.ts
│   │       │   └── prompts.ts
│   │       └── index.ts   # Server entry
│   └── web/               # React frontend
│       └── src/
│           ├── components/
│           │   ├── jarvis/    # AI panel components
│           │   ├── hkf/       # HKF-specific components
│           │   │   ├── AppLayout.tsx
│           │   │   ├── HkfLogo.tsx
│           │   │   └── PersonDetail.tsx
│           │   └── ui/        # shadcn/ui components
│           ├── hooks/
│           │   ├── useAuth.ts
│           │   ├── usePeople.ts
│           │   ├── useDashboardStats.ts
│           │   └── useJarvis.ts
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   ├── People.tsx
│           │   └── Login.tsx
│           ├── lib/
│           │   └── supabase.ts
│           ├── themes/
│           │   └── hkf-theme.css
│           └── HkfDemo.tsx    # Main app entry with routing
├── packages/
│   └── db/                # Drizzle ORM schema
│       └── src/schema/    # Table definitions
├── supabase/
│   └── migrations/        # SQL migrations (already applied)
└── .env                   # All credentials
```

---

## REFERENCE DOCS

- Ticket #020 roadmap: `/Users/yaronkra/Jarvis/tickets/020-generic-ai-crm/00-roadmap.html`
- Ticket #021 config: `/Users/yaronkra/Jarvis/tickets/021-hkf-client-config/00-roadmap.html`
- AI tools spec: `03-ai-orchestration-spec.html` in ticket #020
- Data model: `02-data-model.html` in ticket #020

---

@AGENTS.md
