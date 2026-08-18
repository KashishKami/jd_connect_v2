# JD Connect — Complete Big-Picture Overview

> **Who is this for?** Anyone who is confused about what this project actually is, what every folder does, and why it was built the way it was. Read this first before reading any technical doc.

---

## 1. What Is JD Connect? (The 30-Second Explanation)

JD Connect is an **internal HR platform** for a BPO (call-centre) company called JD. The company has employees who come to the office, clock in to start their shift, take breaks, and clock out at the end of the day. HR managers need to see all of this.

The platform does three things:
1. **Chat** — Employees talk to each other using a chat application called Zulip (like Slack, but self-hosted and completely free).
2. **Attendance Tracking** — Employees clock in and clock out of their shift using a simple web page. Break reasons (bio break, tea break, etc.) are also logged.
3. **HR Management** — HR admins see all employees, their attendance history, and manage accounts via an HR Dashboard web app.

**One login, one password** — an employee logs in once and can access all three parts.

---

## 2. The Four Components (The Big Picture)

The system is split into **four separate applications** that talk to each other via REST APIs. Think of them as four separate programs running on the same machine.

```
┌───────────────────────────────────────────────────────────────────────┐
│                         JD Connect Platform                            │
│                                                                       │
│  ┌─────────────────┐     ┌─────────────────────────────────────────┐ │
│  │  Component 1    │     │  Component 3: Backend API               │ │
│  │  Zulip Chat     │◄───►│  (Node.js + TypeScript, Port 4000)      │ │
│  │  Port 9991      │     │  - Issues JWTs on login                 │ │
│  └─────────────────┘     │  - Only writer to JD Connect Postgres   │ │
│                          │  - Only caller of Zulip REST API        │ │
│  ┌─────────────────┐     └─────────────────────────────────────────┘ │
│  │  Component 2    │                       ▲                          │
│  │  Attendance App │◄──────────────────────┤                          │
│  │  Port 3300      │                       │                          │
│  │  + Zulip Bot    │     ┌─────────────────┴───────────────────────┐ │
│  └─────────────────┘     │  Component 4: HR Dashboard              │ │
│                          │  (Web App, Port 3500)                   │ │
│                          │  - HR admins manage employees           │ │
│                          └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Component 1: Zulip Chat Platform

- **What it is:** A self-hosted chat application (like Slack). Employees use it to communicate in channels (called "streams").
- **Why Zulip, not Rocket.Chat?** The original plan used Rocket.Chat, but it paywalls key features beyond ~50 users. Zulip is 100% open-source with zero feature limits. See `CONTEXT/decision_log.md` — Decision 12.
- **What it stores:** Only chat messages, channels, and Zulip user identities. It has its own internal Postgres database. JD Connect never reads or writes to it directly.
- **Where it lives in the repo:** `docker/zulip/` — a clone of the official Zulip Docker repository (`github.com/zulip/docker-zulip`).

### Component 2: Attendance Web App + Zulip Bot

This is really **two sub-parts**:

**Sub-part A — Attendance Web App (`attendance-app/`)**
- A simple HTML/CSS/JavaScript web page served on port 3300.
- Employees open it to: Clock In, Start Break, End Break, Clock Out.
- It calls the **Backend API** for everything — it never touches the database directly.
- Key files: `attendance-app/index.html`, `attendance-app/app.js`

**Sub-part B — Zulip Bot (`zulip-bot/`)**
- A tiny Node.js script that runs every morning at 8:45 AM EST.
- It posts a single message to the `#attendance` Zulip channel with a link to the Attendance Web App.
- That is ALL it does. It is "stateless" — post and forget. It does not track attendance.
- Key file: `zulip-bot/src/poster.ts`

### Component 3: Backend API (`backend/`)

- **The brain of the whole system.** Nothing else talks to the database except this.
- Written in **Node.js + TypeScript** using the Express framework.
- Handles: user login, JWT token generation, employee CRUD, clock-in/clock-out, break management, permission checks, Zulip account provisioning.
- **Port 4000** in development.
- Internal folder structure (three-layer architecture — see Decision 7 in `decision_log.md`):
  - `backend/src/routes/` — HTTP endpoints (the URLs it accepts)
  - `backend/src/services/` — Business logic (rules, calculations)
  - `backend/src/repositories/` — Raw SQL database queries
  - `backend/migrations/` — Numbered SQL migration files (`001_` through `011_`)
  - `backend/scripts/` — Utility scripts (`migrate.ts`, `seed.ts`)
  - `backend/tests/` — Vitest integration + unit tests

### Component 4: HR Dashboard (`hr-dashboard/`)

- A web application for HR and admin staff only.
- Shows: employee directory, attendance reports, break history, live workforce monitor.
- Has admin features: add employee, reset password, retry Zulip provisioning.
- Talks **only to the Backend API** — never to the database directly.
- **Port 3500** in development.

---

## 3. The Two Databases — One Technology

There are **two separate Postgres databases**. They use the same technology (Postgres) but are completely isolated from each other. They never communicate directly.

| Database | Who Owns It | What It Stores |
|---|---|---|
| **JD Connect Postgres** (port 5432) | Backend API (only) | Employees, users, roles, permissions, attendance records, break records, sessions |
| **Zulip Postgres** (inside Zulip Docker stack) | Zulip (only) | Chat messages, Zulip user identities, streams, subscriptions |

**The only bridge between them** is a single integer column called `employees.zulip_user_id`. When an employee is created in JD Connect, the Backend API also creates a user in Zulip via its REST API and stores the integer ID that Zulip returns.

```
JD Connect Postgres:  employees.zulip_user_id = 42
Zulip Postgres:       zerver_userprofile.id   = 42
```

That is the only link. **Never use email as a join key** — emails can change. The integer Zulip user ID is permanent and immutable.

---

## 4. Authentication — How Login Works

There is **no Supabase, no Firebase, no Auth0**. Authentication is 100% custom-built inside the Backend API.

- See `CONTEXT/decision_log.md` Decision 1 (why Supabase was dropped)
- See `CONTEXT/decision_log.md` Decision 2 (why custom JWT auth was chosen)

**Login flow, step by step:**

1. Employee opens the Attendance Web App or HR Dashboard.
2. They enter their email + password.
3. The app calls `POST /api/auth/login` on the Backend API.
4. Backend API looks up the `users` table in Postgres, verifies the password against the `bcrypt` hash.
5. If correct: the Backend API creates a **JWT (JSON Web Token)** signed with an RSA private key (RS256 asymmetric algorithm).
6. The JWT is returned to the browser and stored in `localStorage`.
7. Every future API request sends the JWT in the `Authorization: Bearer <token>` header.
8. The Backend API's `authenticateJwt` middleware verifies the JWT on every protected route.

**Contents of the JWT payload:**
```typescript
{
  sub: string;           // The user's row ID in Postgres users table
  employee_id: string;   // The employee's row ID in Postgres employees table
  zulip_user_id: number; // The cross-system key — links to Zulip user
  roles: string[];       // e.g. ['super_admin'] or ['employee']
  iat: number;           // Issued at (timestamp)
  exp: number;           // Expires at (timestamp)
}
```

**Password resets:** There is NO "Forgot Password" email flow. An HR admin resets passwords for employees via `POST /api/employees/:id/reset-password`. This is intentional — the company is in-person and HR handles resets directly.

---

## 5. Roles and Permissions

There are five roles. They are stored in Postgres and assigned per employee:

| Role | Who It Is | What They Can Do |
|---|---|---|
| `super_admin` | System owner | Full access — manage employees, roles, permissions, all data |
| `admin` | HR admin | Manage employees, reset passwords, view all attendance |
| `manager` | Department manager | View and manage their team's attendance/breaks |
| `team_leader` | Team lead | View their team's attendance and breaks |
| `employee` | Regular staff | Clock in/out, take breaks, view own history only |

Permissions are checked on every Backend API request via `requirePermission('permission.key')` middleware. Lacking the required permission → HTTP 403 Forbidden.

Full permission table: `CONTEXT/project_data.md` Section 5.

---

## 6. Attendance Logic — How Clock-In/Out Works

> **Golden rule:** Attendance state is NEVER derived from Zulip's online/away/offline status. Closing Zulip does NOT clock someone out. Attendance only changes when an employee explicitly clicks a button in the Attendance Web App.

**Clock-In:**
- Employee opens the Attendance Web App and clicks **Clock In**.
- App calls `POST /api/attendance/clock-in` with the JWT.
- Backend API creates a row in `attendance_records`: `clock_in_at = NOW()`, `work_date = today in EST`.
- If they already have an open record for today → HTTP 409 Conflict (double clock-in prevented).

**Clock-Out:**
- Employee clicks **Clock Out**.
- App calls `POST /api/attendance/clock-out`.
- Backend API finds the open record, sets `clock_out_at = NOW()`, then computes:
  - `hours_worked = (clock_out_at - clock_in_at) in hours`
  - `status` and `is_late` — based on the EST time rules below.

**Attendance Status Rules (always in EST — America/New_York):**

| Condition | Status | Is Late? |
|---|---|---|
| Clocked in by 09:15 AM EST AND hours_worked ≥ 6 | `present` | No |
| Clocked in 09:15–09:30 AM EST AND hours_worked ≥ 6 | `late` | Yes |
| Clocked in after 09:30 AM EST OR hours_worked < 6 | `half_day` | No |
| No clock-in recorded by end of day | `absent` | No |

> **Priority rule:** `hours_worked < 6` always overrides. Even a 09:00 AM clock-in = `half_day` if they leave after 4 hours.

**Breaks:**
- Employee selects a break type and clicks **Start Break** → `POST /api/breaks/start` → `break_records` row created with `status = 'active'`.
- Employee clicks **End Break** → `POST /api/breaks/end` → Backend calculates `duration_minutes`, sets `status = 'completed'` or `'exceeded'` (if over the time limit).

**Default break limits:**
| Break Type | Default Limit |
|---|---|
| Bio Break | 10 min |
| Tea Break | 15 min |
| Dinner Break | 30 min |
| Smoke Break | 10 min |
| Meeting Break | No limit |

---

## 7. Employee Creation — Dual-System Provisioning

When HR adds a new employee via the HR Dashboard:

1. HR fills the form (name, email, password, role, department, etc.) and clicks **Provision Employee**.
2. Dashboard sends `POST /api/employees` to the Backend API.
3. Backend API:
   - Creates a `users` row (bcrypt-hashed password, 12 rounds).
   - Creates an `employees` row (all HR details).
   - Calls Zulip Admin REST API `POST /api/v1/users` to create the Zulip chat account.
   - Stores the returned Zulip integer user ID in `employees.zulip_user_id`.
   - Sets `employees.zulip_provisioned = true`.
4. If Zulip is temporarily down: Postgres rows are kept, `zulip_provisioned = false`. HR Dashboard shows a "Retry Provisioning" button.

**Employee code format:** Auto-generated sequence: `JD0001`, `JD0002`, `JD0003`, etc.

---

## 8. Database Tables — Plain English Summary

Full SQL: `CONTEXT/database_schema.md`. Here is what each table does:

| Table | What It Stores |
|---|---|
| `users` | Login credentials: email + bcrypt hash. One row per person. |
| `employees` | HR profile: name, role, department, centre, shift, zulip_user_id. Linked to `users`. |
| `roles` | The five app roles (super_admin, admin, manager, team_leader, employee). |
| `permissions` | Permission keys like `employees.manage`, `attendance.view_all`. |
| `role_permissions` | Which roles have which permissions (junction table). |
| `departments` | Sales, Backend, HR, Training, Management, Marketing, Logistics. |
| `centres` | Office locations: `DBP` (Doon Business Park), `ITP` (IT Park). |
| `shifts` | Work shift definitions. Default: Night Shift 09:00–18:00 EST. |
| `employee_sessions` | Active login sessions for single-session enforcement. |
| `attendance_records` | One row per employee per day: clock-in, clock-out, hours worked, status. |
| `attendance_corrections` | HR-submitted corrections to attendance records (pending approval). |
| `break_types` | The 5 break categories and their default time limits. |
| `break_policies` | Per-centre or per-department overrides for break limits. |
| `break_records` | One row per break event: duration, status (completed/exceeded). |
| `audit_logs` | General audit trail for sensitive admin actions. |

---

## 9. Where Everything Lives in the Repository

```
jd_connect_v2/                     ← Monorepo root
├── CONTEXT/                       ← All planning docs — READ THESE FIRST
│   ├── project_data.md            ← Architecture, roles, permissions, business rules
│   ├── database_schema.md         ← All Postgres tables, ENUMs, indexes, seed data
│   ├── decision_log.md            ← Why every major choice was made (12 decisions)
│   ├── current_state.md           ← Phase-by-phase progress tracker (source of truth)
│   ├── TDD_INSTRUCTION_GUIDE.md   ← How all implementation checklists must be written
│   └── complete_overview.md       ← THIS FILE — the big picture guide
│
├── backend/                       ← Component 3: Backend API (Express + TypeScript)
│   ├── src/
│   │   ├── routes/                ← HTTP endpoints: auth.ts, employees.ts, attendance.ts, breaks.ts, oauth.ts
│   │   ├── services/              ← Business logic: auth.service.ts, attendance.service.ts, break.service.ts, zulip.service.ts
│   │   ├── repositories/          ← SQL queries: user.repository.ts, employee.repository.ts, attendance.repository.ts, break.repository.ts
│   │   ├── middleware/            ← JWT auth guard: auth.ts
│   │   ├── types/                 ← TypeScript type definitions: auth.ts, employee.ts, attendance.ts, break.ts
│   │   └── lib/                   ← db.ts (Postgres connection pool)
│   ├── migrations/                ← 001_ through 011_ SQL migration files
│   ├── scripts/                   ← migrate.ts (run migrations), seed.ts (seed data)
│   └── tests/                     ← Vitest test files (unit + integration)
│
├── attendance-app/                ← Component 2A: Employee clock-in/out web page
│   ├── index.html                 ← The UI: clock-in, break controls, history tabs
│   ├── app.js                     ← All frontend JS: login, API calls, timers, UI state
│   └── styles.css                 ← Styling
│
├── zulip-bot/                     ← Component 2B: Daily attendance prompt poster
│   └── src/poster.ts              ← Posts the attendance link message to #attendance at 8:45 AM
│
├── hr-dashboard/                  ← Component 4: HR web app (Next.js)
│   └── src/
│       ├── app/dashboard/         ← Pages: employees/, attendance/, breaks/, monitor/
│       ├── components/            ← Reusable React components
│       └── lib/                   ← api.ts (API client), auth.ts (permission helpers), date_formatter.ts
│
├── docker/
│   ├── docker-compose.yml         ← JD Connect Postgres ONLY (port 5432)
│   └── zulip/                     ← Cloned from github.com/zulip/docker-zulip (DO NOT commit this folder)
│       ├── compose.yaml           ← Official Zulip stack — DO NOT EDIT
│       ├── compose.override.yaml  ← JD Connect config overrides (SETTING_EXTERNAL_HOST, port, etc.)
│       └── .env                   ← Zulip secrets (ZULIP__POSTGRES_PASSWORD, ZULIP__SECRET_KEY, etc.)
│
├── DEV_GUIDE.md                   ← Quick reference: ports, credentials, how to run
├── local_setup.md                 ← Full step-by-step developer onboarding guide
├── .env                           ← Root env vars (DATABASE_URL, JWT keys, ZULIP_BOT_API_KEY, etc.)
├── .env.test                      ← Test environment (TEST_DATABASE_URL = jdconnect_test)
└── pnpm-workspace.yaml            ← Monorepo workspace config (backend, attendance-app, zulip-bot, hr-dashboard)
```

---

## 10. How to Run Everything Locally

> Full instructions: `local_setup.md`. Quick reference: `DEV_GUIDE.md`.

**You need 3 terminal windows:**

**Terminal 1 — Postgres + Backend API:**
```bash
# From monorepo root
pnpm docker:dev:up      # Start JD Connect Postgres on port 5432
pnpm db:migrate         # Apply SQL migrations (001_ through 011_)
pnpm db:seed            # Seed roles, departments, centres, shifts, admin + test accounts
cd backend
pnpm dev                # Start Backend API on http://localhost:4000
```

**Terminal 2 — Attendance Web App:**
```bash
cd attendance-app
npx serve . -p 3300     # Attendance app at http://localhost:3300
```

**Terminal 3 — HR Dashboard:**
```bash
cd hr-dashboard
pnpm dev                # HR Dashboard at http://localhost:3500
```

**Zulip (separate Docker stack, run from docker/zulip/):**
```bash
cd docker/zulip
docker compose up zulip --wait
# Open: https://127.0.0.1:9991 (accept the self-signed certificate warning in your browser)
```

**Default Accounts:**

| App | Email | Password | Role |
|---|---|---|---|
| HR Dashboard + Attendance App | `admin@company.com` | `AdminPassword123!` | Super Admin |
| Zulip Chat | `admin@company.com` | `AdminPassword123!` | Zulip Realm Admin |
| Attendance App + HR Dashboard | `john.doe@jdconnect.com` | `Employee123!` | Employee |
| Attendance App + HR Dashboard | `jane.mgr@jdconnect.com` | `Manager123!` | Manager |

---

## 11. Implementation Phases — What Was Built When

All work is tracked phase-by-phase in `CONTEXT/current_state.md`:

| Phase | Description | Status |
|---|---|---|
| **0** | Project setup: monorepo, Postgres Docker, Backend skeleton, migrations, test DB | ✅ Complete |
| **0.5** | Zulip migration: removed Rocket.Chat + MongoDB, added Zulip, renamed `zulip_user_id`, scaffolded new directories | ✅ Complete |
| **0.6** | Fixed Zulip Docker: adopted official `docker-zulip` repo, fixed 7 config problems | ✅ Complete |
| **1** | JWT Auth: `POST /api/auth/login`, employee creation, JWT middleware, password reset | ✅ Complete |
| **1.5** | Alignment: updated all Phase 1 code from `rc_user_id` → `zulip_user_id` | ✅ Complete |
| **2** | Attendance API: clock-in, clock-out with EST status calculation, history | ✅ Complete |
| **3** | Break API: start break, end break with duration calculation, break history | ✅ Complete |
| **4** | Zulip Integration: employee creation auto-provisions Zulip accounts, OIDC endpoints | ✅ Complete |
| **5** | Attendance Web App UI + Zulip Bot poster | ✅ Complete |
| **6** | HR Dashboard: employee directory, attendance/break reports, live monitor, password reset UI | ✅ Complete |
| **6.5** | UI Polish: login overlay, Add Employee modal, test account seeding, DEV_GUIDE | ✅ Complete |
| **6.6** | Local Traefik + 3-network Docker infrastructure for SSO | ⚠️ In Progress |
| **7** | Data migration from old Supabase system | ⬜ Not Started |
| **8** | Production deployment to Hostinger VPS | ⬜ Not Started |

---

## 12. The 10 Architectural Constraints — Simplified

These are from `CONTEXT/project_data.md` Section 10. Never violate these:

1. **Zulip's database and JD Connect's database never talk to each other.** Only the Backend API bridges them via REST.
2. **Going offline in Zulip does NOT clock someone out.** Attendance is only changed by explicit actions in the Attendance Web App.
3. **`zulip_user_id` is the only link between the two systems.** Never use email as a join key — it can change.
4. **Creating an employee MUST attempt Zulip provisioning.** Failure → `zulip_provisioned = false` + surface to HR. Never silently fail.
5. **Auth is entirely custom JWT (RS256).** No Supabase, Firebase, Auth0, or any third-party auth.
6. **Password reset is admin-only.** No self-service email/link flow exists.
7. **Only the Backend API writes to JD Connect's Postgres.** The HR Dashboard reads/writes via Backend API only.
8. **Only the Backend API calls Zulip's Admin REST API.** The Attendance App and HR Dashboard never call Zulip directly.
9. **The Zulip Bot is stateless and posts-only.** It does not process attendance events or call the Backend API for HR data.
10. **The Attendance Web App works independently of Zulip.** If Zulip goes down, attendance tracking continues uninterrupted.

---

## 13. Troubleshooting Quick Reference

| Problem | Where to Look |
|---|---|
| Backend API won't start | Check `.env` (DATABASE_URL, JWT_PRIVATE_KEY), then `backend/src/app.ts` |
| Postgres won't connect | Run `pnpm docker:dev:up`, check `docker/docker-compose.yml` |
| Zulip won't load | Run `docker compose up zulip --wait` from `docker/zulip/`, check `compose.override.yaml` |
| Employee can't log in | Check `users` table has the email row; verify bcrypt hash format (`$2b$12$...`) |
| Attendance not saving | Verify JWT is valid + not expired; check `attendance_records` table; verify EST date is correct |
| Zulip not provisioned for new employee | Check `ZULIP_BOT_API_KEY` in `.env`; check `employees.zulip_provisioned` in Postgres |
| Tests failing | Run `pnpm test` from `backend/`; check `jdconnect_test` database exists (run `pnpm docker:dev:up`) |
| HTTP 403 Permission Denied | Check JWT `roles` payload; check `role_permissions` table in Postgres |
| Break not starting | Verify employee is clocked in today (open `attendance_records` row for today with `clock_out_at IS NULL`) |

---

## 14. Phase 6.6 — What It Is and Whether the Plan Will Work

Phase 6.6 is titled **"Local Traefik & 3-Network Docker Infrastructure for SSO"**.

### What Problem It Claims to Solve

The current local setup runs everything on plain HTTP with different ports:
- Backend API: `http://localhost:4000`
- Attendance App: `http://localhost:3300`
- Zulip: `https://127.0.0.1:9991` (HTTPS with self-signed cert)
- HR Dashboard: `http://localhost:3500`

The Phase 6.6 plan states that "modern browsers drop `Secure` HTTPS cookies across ports and origins" — breaking SSO cookie sharing across the apps.

### What the Plan Proposes

Add **Traefik** (a reverse proxy) in front of everything, terminating HTTPS on port 443, with three isolated Docker networks:
- `traefik-proxy` (public: Traefik + web services)
- `jdconnect-internal` (private: Backend API + JD Connect Postgres)
- `zulip-internal` (private: Zulip + its Postgres, Redis, Memcached, RabbitMQ)

All services would be accessed via custom `.jdconnect.local` hostnames over HTTPS.

### Critical Analysis

> **Is this the real root cause? Will it actually solve the SSO problem?**

**What SSO actually means here:** The project uses custom JWT auth stored in `localStorage`, not browser session cookies shared across subdomains. The Attendance Web App's `app.js` reads `localStorage.getItem('jdconnect_token')` — not a cookie. Zulip has its own `sessionid` cookie that is entirely separate and used only to authenticate with Zulip itself. These are two independent auth mechanisms.

**The actual SSO in use today:** Employees log into the Attendance App with email + password → get a JWT → JWT is stored in localStorage. There is no cross-subdomain cookie sharing happening or needed for the current JWT-based flow.

**What the Traefik plan would add:** HTTPS everywhere + hostname-based routing. This is genuinely useful for production but adds significant complexity (Traefik config, custom DNS, self-signed certs, 3 networks) for a local development environment.

**The simpler alternative:** For **local development**, the current multi-port HTTP setup works perfectly. SSO via JWT in localStorage already works across ports because it is not cookie-based. The real cookie-based Zulip SSO (OIDC) can be tested once deployed to a real domain — it does not need Traefik locally.

**When Phase 6.6 IS the right thing to do:** If the team is implementing full Zulip OIDC SSO (where Zulip acts as the OAuth client and the Backend API is the OIDC provider), then yes — browser cookies for the OIDC authorization code flow do require HTTPS and same-domain or explicitly allowed cross-domain policies. In that case, a proper local HTTPS setup is necessary. But this only matters if OIDC SSO via Zulip is being tested.

**Verdict:** Phase 6.6 is **valid for production-readiness preparation** and is the correct path if you want to test full Zulip OIDC SSO locally. However, if the immediate goal is just getting attendance tracking and HR management working, it is not a blocker — those features work on plain HTTP with JWT in localStorage. The plan as written is not wrong, but it may be premature if the OIDC SSO flow itself has not been fully implemented and tested.

---

## 15. Phase 7 — Data Migration Plan

### What Phase 7 Is

A **one-time migration** that moves all data from the old JD Connect platform (Supabase + custom messaging) into the new JD Connect v2 system (Postgres + Zulip). It runs **after** Phase 3 (VPS fully live with real domain and Zulip running). It is executed as a single TypeScript script: `backend/scripts/migrate-phase7.ts`.

The source data is a `pg_dump` export (`jdconnect_public_data.sql`, ~49MB) from the old system's Supabase Postgres `public` schema. It is already saved at `C:\Users\Administrator\Desktop\jdconnect_public_data.sql`.

---

### What Gets Migrated

| Data | Destination | Notes |
|---|---|---|
| Departments, Centres, Shifts | Postgres | Reference data — migrated first |
| Employees (profile data) | Postgres + Zulip | Dual write — same as normal employee creation |
| Attendance history | Postgres | Historical session records |
| Break history | Postgres | Historical break records |
| Channels | Zulip (streams) | `department` type → public, `custom` type → private |
| Channel messages (text only) | Zulip (stream messages) | Sender attribution header in each message |
| Direct messages (text only) | Zulip (DMs) | Sender attribution header in each message |
| File / image attachments | ❌ Skipped | Old files not migrated — new Zulip stores files natively from day 1 |

**Confirmed from dump inspection:** There are 15+ real channels (Backend: 99+ msgs, Breaks: 99+, PO-&-Invoice: 99+, Logistics: 51, etc.) and multiple DM conversations between employees. This is live production data, not test data.

---

### Migration Sequence (Order Is Critical)

```
Step 1  Load old dump into a queryable temporary Postgres container
Step 2  Migrate reference data (departments, centres, shifts)
Step 3  Migrate employees → Postgres users/employees tables + Zulip accounts
        ↳ Builds mapping: old UUID → new Zulip user_id
Step 4  Migrate attendance and break history → Postgres
Step 5  Migrate channels → Zulip streams
        ↳ Builds mapping: old channel UUID → Zulip stream name
Step 6  Migrate channel messages → Zulip stream messages (text only)
Step 7  Migrate direct messages → Zulip DMs (text only)
Step 8  Verify counts, zulip_user_id completeness, spot-check streams
Step 9  Cleanup: remove temp container, delete dump from VPS
```

Steps 3 and 5 must run before Steps 6 and 7 because the message migration needs both mappings.

---

### Step 1: Load Old Dump Into Temp Postgres

The dump is loaded into a temporary container so the migration script can query it with SQL — far cleaner than parsing the `.sql` file line by line.

```bash
docker run -d --name jdc_migration_source \
  -e POSTGRES_DB=jdc_old \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=migrationpassword \
  -p 5454:5432 \
  postgres:16-alpine

sleep 5

docker exec -i jdc_migration_source psql -U postgres -d jdc_old \
  < /path/to/jdconnect_public_data.sql
```

The migration script connects to two databases simultaneously:
- `DATABASE_URL_OLD=postgresql://postgres:migrationpassword@localhost:5454/jdc_old`
- `DATABASE_URL=postgresql://...` (the new JD Connect v2 Postgres)

---

### Step 3: Employee Migration — Field Mapping

For each employee, the script:
1. Inserts into `users` (hashed temp password) + `employees` (with FK lookups for dept/centre/shift by name)
2. Calls Zulip Bot API → creates Zulip account → stores returned `zulip_user_id`

| Old field | New table.field | Notes |
|---|---|---|
| `email` | `users.email` | Direct |
| `full_name` | `users.full_name` | Direct |
| *(none)* | `users.password_hash` | `bcrypt("TempPass@{last4ofOldUUID}!")` |
| `role` (enum) | `users.role_key` | Direct map — same enum values |
| `department_id` (UUID) | `employees.department_id` (int) | Looked up by department name |
| `centre_id` (UUID) | `employees.centre_id` (int) | Looked up by centre name |
| `shift_id` (UUID) | `employees.shift_id` (int) | Looked up by shift name |
| `employment_status` | `employees.employment_status` | Direct |
| `employee_code` | `employees.employee_code` | Direct |
| `phone` | `employees.phone` | Direct |
| `joined_at` | `employees.joined_at` | Direct |
| *(Zulip API response)* | `employees.zulip_user_id` | Integer from `POST /api/v1/users` |

**Password strategy:** Passwords cannot be extracted from Supabase auth. Every employee gets a temporary password: `TempPass@{last4charsOfOldUUID}!`. The script prints a full list of temp passwords. HR distributes them and forces resets on day one.

---

### Steps 5–7: Zulip Channel & Message Migration

**Channels → Zulip Streams:**
- `department` type channels → public streams
- `custom` type channels → private streams
- The script creates the stream and builds a `{ oldChannelUUID → zulipStreamName }` map

**Channel messages → Zulip stream messages:**
Each message is posted by the bot with an attribution header:
```
> **John Doe** · 24 Jun 2026, 11:06pm

Original message text here
```
All historical messages go into a single topic called **"Migrated History"** within each stream, keeping them separate from new day-one conversations.

**Direct messages → Zulip DMs:**
Same attribution format, posted to the DM thread between the two participants via the bot.

**Rate limiting:** Zulip allows ~100 API requests/minute. The script adds a 650ms delay between message posts for large volumes.

---

### Post-Migration Verification

```sql
-- All employees should have a zulip_user_id
SELECT COUNT(*) FROM employees WHERE zulip_user_id IS NULL;  -- Must be 0

-- Employee count should match old system
SELECT COUNT(*) FROM employees;
```

From the Zulip admin UI: verify stream count, spot-check message history in a few streams.

---

### Cleanup After Verification

```bash
docker stop jdc_migration_source && docker rm jdc_migration_source
rm /tmp/jdconnect_public_data.sql   # Remove sensitive dump from VPS
```

---

### Important Notes

- The script is **idempotent** — safe to re-run. Uses `ON CONFLICT DO NOTHING` / existence checks.
- The local test run (against local Docker Postgres + local Zulip) validates the script logic. The actual production run happens on the VPS with the real domain.
- After migration, both the old system's Zulip user IDs (from local test) and new ones (from VPS run) exist. Only the VPS run produces the real `zulip_user_id` values that are kept in production.

---

*This document references: `CONTEXT/project_data.md`, `CONTEXT/database_schema.md`, `CONTEXT/decision_log.md`, `CONTEXT/current_state.md`, `CONTEXT/TDD_INSTRUCTION_GUIDE.md`, `DEV_GUIDE.md`, `local_setup.md`, `vps_deployment_guide.md`, `local-docker-guide.md`*
