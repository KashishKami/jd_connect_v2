# Architecture & Design Decisions Log: JD Connect

This document records all significant design decisions, their rationale, and trade-offs for the JD Connect platform. Every architectural deviation or non-obvious choice must be logged here **before implementation begins**.

---

### Decision 1: Drop Supabase — Use Plain Postgres Container

**Date:** 2026-08-13
**Status:** Accepted

#### Context
The previous JD Connect application was built on Supabase (self-hosted Docker), which bundled ~10 containers: Studio, Kong, GoTrue, PostgREST, Realtime, Storage, pg-meta, Imgproxy, Postgres, and more. This is a significant RAM/CPU footprint, especially since we are now adding MongoDB + Rocket.Chat to the same VPS.

#### Decision
Replace the entire Supabase stack with a **single plain Postgres container**. All Supabase-specific constructs (`auth.users`, `auth.uid()`, `authenticated`/`anon` roles, `service_role`, Row Level Security policies using `auth.uid()`, Supabase Realtime publications) are dropped entirely.

Access control is enforced at the **application layer** (Backend API), not at the database layer.

#### Consequences
- VPS RAM/CPU freed up significantly — from ~10 containers to 1 (Postgres) + 2 (MongoDB replica set) + 1 (Rocket.Chat) + 1 (Backend API).
- All existing 75 migration files from the old JD Connect project are discarded. New clean migrations are written for the subset of tables we keep.
- Supabase Auth (`auth.users`, JWTs, sessions) is replaced by custom JWT auth in the Backend API (see Decision 2).
- Supabase Realtime (WebSocket push for chat messages) is replaced by Rocket.Chat's native WebSocket/push notification system.
- Supabase Storage (file uploads) is dropped — if file storage is needed in future, it becomes a separate decision.

---

### Decision 2: Custom JWT Auth in the Backend API (No Third-Party Auth Platform)

**Date:** 2026-08-13
**Status:** Accepted

#### Context
Supabase Auth provided password hashing, JWT issuance, session management, and refresh token rotation. Dropping Supabase means all of this must be rebuilt.

#### Decision
The Backend API owns all auth logic:
- **Password storage:** `bcrypt` hash in `users.password_hash` (plain Postgres table, not `auth.users`).
- **Token issuance:** RS256 JWTs signed with a private key held only by the Backend API. Asymmetric keys allow Rocket.Chat to verify tokens without sharing a secret.
- **Session tracking:** `employee_sessions` table in Postgres for single-active-session enforcement.
- **Password reset:** Admin-only endpoint — no self-service email flow. HR resets the password; the employee is told the new one directly.

#### Consequences
- There is no "forgot password" email link. This is intentional — the company operates in-person with an HR team.
- The Backend API must implement token refresh correctly (short-lived access tokens + longer-lived refresh tokens).
- The `employee_sessions` table must be kept clean — stale sessions must expire.

---

### Decision 3: Rocket.Chat as OAuth Client, Backend API as OAuth Server

**Date:** 2026-08-13
**Status:** Accepted

#### Context
The SSO requirement is: one login → one password → user lands directly in Rocket.Chat. This means Rocket.Chat must not maintain its own separate password — it must defer auth to our system.

#### Decision
Configure Rocket.Chat's **Custom OAuth** provider to point at the Backend API's OAuth 2.0 endpoints (`/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`). The Backend API becomes the identity provider. RC becomes the OAuth client.

Session cookies are scoped to the root domain (e.g., `.yourcompany.com`) so a login on any subdomain is recognized across the whole platform.

#### Consequences
- The Backend API must implement a minimal OAuth 2.0 authorization code flow — specifically the three endpoints Rocket.Chat's Custom OAuth requires.
- RC's native login page is configured to redirect immediately into the SSO flow — employees never see RC's own username/password form.
- HR and Admin dashboard pages check the same session cookie for authentication.

---

### Decision 4: MongoDB Is Read-Only from the Backend API's Perspective

**Date:** 2026-08-13
**Status:** Accepted

#### Context
Rocket.Chat uses MongoDB internally. There is a temptation to write directly to MongoDB to "speed things up" — e.g., bulk-importing chat history.

#### Decision
The Backend API **never writes to MongoDB directly**. All interactions with Rocket.Chat data go through the **Rocket.Chat Admin REST API**. This applies to user creation, room creation, message import, and everything else.

The single exception is the data migration script, which may use RC's REST API import endpoint — but even then, it does not write directly to MongoDB collections.

#### Consequences
- The data migration for chat history (conversations + messages from old Postgres → Rocket.Chat) will be slower than a direct MongoDB insert, but it is safe, re-runnable, and auditable.
- The Backend API only reads MongoDB indirectly — via Rocket.Chat API calls for analytics/reporting if needed.
- MongoDB schema changes (which happen on Rocket.Chat upgrades) never break the Backend API.

---

### Decision 5: `rocketchat_user_id` Is the Immutable Cross-System Key

**Date:** 2026-08-13
**Status:** Accepted

#### Context
There needs to be a stable way to link a Postgres `employees` row to a Rocket.Chat user. Candidates were: email, username, or RC's internal `_id`.

#### Decision
Store Rocket.Chat's internal `_id` (a string like `"RC_abc123"`) in `employees.rocketchat_user_id`. This is the **only** cross-system link. Email is NOT used as a join key.

#### Consequences
- RC `_id` is immutable — it never changes even if email or username changes.
- When an employee's email changes: update Postgres AND call RC Admin API to update the RC user — but the `rocketchat_user_id` link remains stable.
- When a Rocket.Chat JWT arrives at the Backend API's SSO endpoint, the `rc_user_id` in the payload is used to look up the Postgres employee directly.

---

### Decision 6: Attendance State Is Decoupled from Rocket.Chat Presence

**Date:** 2026-08-13
**Status:** Accepted

#### Context
Rocket.Chat has a native presence system: online/away/offline. It is tempting to treat "offline" as "clocked out."

#### Decision
Attendance (clock-in/clock-out) and break state are tracked **exclusively in Postgres**, via explicit button actions in the RC attendance app. Rocket.Chat's presence status is ignored entirely for attendance purposes.

#### Consequences
- Closing a laptop does NOT clock an employee out.
- Going on a break does NOT set the employee to "away" in RC.
- The two systems are operationally independent — an RC upgrade or outage does not corrupt attendance data.
- The Rocket.Chat attendance app button is the only way to change attendance state.

---

### Decision 7: Three-Layer Architecture in the Backend API

**Date:** 2026-08-13
**Status:** Accepted

#### Context
Backend APIs are frequently written as single-file route handlers with DB queries and business logic mixed together — this makes them untestable and hard to maintain.

#### Decision
The Backend API enforces a strict three-layer architecture:

1. **`src/repositories/`** — Raw database queries only (using `pg` / `postgres.js` / Prisma). Returns plain data objects. No business logic.
2. **`src/services/`** — Business logic only (duration computation, status transitions, permission checks, dual-system provisioning). Calls repositories. No HTTP objects.
3. **`src/routes/`** — HTTP layer only. Validates input (Zod), reads JWT, calls services, serializes responses. No direct DB access.

#### Consequences
- Business logic is unit-testable without a database (mock the repository, test the service).
- Integration tests can call repository functions directly against a test DB without HTTP overhead.
- New developers can understand the codebase one layer at a time.

---

### Decision 8: Break Dropdown Is Populated from `break_types` Table, Not Hardcoded

**Date:** 2026-08-13
**Status:** Accepted

#### Context
The RC attendance app needs to show a dropdown of break reasons. Hardcoding these in the app would require an app redeployment to change them.

#### Decision
The RC attendance app fetches active break types from the Backend API (`GET /api/break-types?active=true`) at app startup (cached). Admins can add/edit/deactivate break types via the HR dashboard without touching any code.

#### Consequences
- Adding a new break type requires only an HR dashboard action — no code changes or app redeployment.
- The RC app must gracefully handle the case where `break_types` returns empty (show a fallback message).

---

### Decision 9: Employee Creation Is Atomic — Failure to Provision RC Is Surfaced, Not Silently Dropped

**Date:** 2026-08-13
**Status:** Accepted

#### Context
Creating an employee requires two operations: write to Postgres, then call RC Admin API. The second step can fail (RC is down, rate limited, etc.).

#### Decision
- Write to Postgres first.
- Attempt RC provisioning.
- If RC provisioning fails: do NOT roll back the Postgres write. Instead, set `employees.rc_provisioned = false` and surface the failure in the HR dashboard with a "Retry RC Provisioning" action.
- If RC provisioning succeeds: update `employees.rocketchat_user_id` and `employees.rc_provisioned = true`.

#### Consequences
- HR dashboard needs a "Pending RC Provisioning" list — employees in Postgres but not yet in RC.
- The employee can still appear in the HR system (Postgres) without a chat account — the HR operator knows they need to retry.
- This avoids a full failure when RC is temporarily unavailable during an employee onboarding batch.

---

### Decision 10: No Direct Supabase Migration — New Clean Schema from Scratch

**Date:** 2026-08-13
**Status:** Accepted

#### Context
The old JD Connect had 75 SQL migration files, all written for Supabase with `auth.uid()`, `auth.users` foreign keys, `authenticated`/`service_role` grants, and Supabase Realtime publications. None of these are valid in a plain Postgres container.

#### Decision
Write new clean migrations from scratch for only the tables we keep:
- `users` (custom auth, not `auth.users`)
- `employees` + supporting lookup tables (roles, departments, centres, shifts)
- `attendance_records` + corrections + audit
- `break_records` + break_types + break_policies + audit

All Supabase-specific syntax is removed. All RLS policies are removed. Access control is at the application (Backend API) layer only.

#### Consequences
- Data from the old system must be migrated via an ETL script — old Supabase Postgres → new plain Postgres.
- The migration script must map `auth.users.id` to the new `users.id` and re-link `employees.auth_user_id` accordingly.
- Chat data (messages, conversations, channels) is migrated to Rocket.Chat via the RC Admin REST API separately.

---

### Decision 11: Use Plain `pg` Connection Pool + SQL Repositories over Prisma ORM

**Date:** 2026-08-14
**Status:** Accepted

#### Context
When designing the Backend API's database interface layer, using an ORM like Prisma was evaluated against plain SQL queries executed via the Node.js `pg` pool module.

#### Decision
Use the plain Node.js `pg` connection pool with pure SQL migrations and dedicated repository classes (`src/repositories/`), rejecting Prisma ORM.

#### Rationale
1. **Resource Efficiency:** Rocket.Chat, MongoDB, Postgres, and the Backend API run on a single Hostinger VPS. Prisma bundles Rust binaries (`query-engine`) that consume ~50MB+ RAM per instance, whereas `pg` has negligible RAM footprint.
2. **Native Postgres Precision:** The system relies on native Postgres capabilities (custom ENUM types with `IF NOT EXISTS` checks, sequences like `employee_code_seq` formatting `JD0001`, and `TIMESTAMPTZ` evaluated strictly in EST). Plain SQL gives full control without ORM abstraction limits.
3. **Build & Deployment Simplicity:** Avoids binary compilation steps (`npx prisma generate`) and native Rust engine target issues between Windows development hosts and Docker Linux Alpine containers.
4. **Alignment with Architecture:** Decision 7 enforces a strict 3-layer architecture (`repositories` → `services` → `routes`). Plain SQL repositories isolate all query logic cleanly without coupling models to an ORM schema generator.

#### Consequences
- SQL queries and migrations are written explicitly by hand and tracked in `backend/migrations/`.
- Repository methods handle raw SQL parameterization and return typed JavaScript objects.
- High query performance and zero ORM engine overhead on the hosting server.

---

### Decision 12: Replace Rocket.Chat with Zulip as the Team Communication Layer

**Date:** 2026-08-14
**Status:** Accepted

#### Context

The original architecture selected Rocket.Chat as the team communication layer (Component 1), with a bespoke Rocket.Chat Apps-Engine attendance app (Component 2). Rocket.Chat was chosen for its rich self-hosted feature set and Admin REST API.

During investigation prior to building Phase 4 (RC Integration & SSO) and Phase 5 (RC Attendance App), a critical licensing constraint was discovered: **Rocket.Chat's Community Edition (open-source) is subject to "open core" feature gating beyond ~50 users.** Features required for a BPO operation at scale — advanced admin roles, granular permission sets, certain OAuth/SSO capabilities, and audit logs — are locked behind Rocket.Chat's Enterprise license (~$7–9/seat/month). This makes Rocket.Chat commercially unviable for JD Connect's scale without significant ongoing cost.

Additionally, Rocket.Chat requires a MongoDB replica set (3+ containers), significantly increasing VPS RAM/CPU footprint on the single Hostinger server.

#### Investigation: Zulip as Replacement

Zulip was investigated as a drop-in replacement. Key findings:

**Licensing:**
- Zulip is **100% open source (Apache 2.0)**. The self-hosted version is completely free with **no user limits and no feature paywalls**.
- All features — SAML, OIDC, LDAP, advanced admin controls, full REST API — are available in the free self-hosted tier.
- The only paid component: mobile push notifications via Zulip's central relay service (free for ≤10 users; ~$1/user/month for larger teams). Since JD Connect is a desktop-first BPO operation, this is a non-issue.

**Database:**
- Zulip uses **PostgreSQL natively** (managed via Django ORM). This eliminates MongoDB entirely.
- The project transitions from a **two-database model** (Postgres + MongoDB) to a **single-database-technology model** (both JD Connect's Backend API and Zulip use Postgres, though in completely isolated schemas — they still never communicate directly).

**REST API:**
- Zulip provides a full, well-documented REST API: `POST /api/v1/users` (create user), `PATCH /api/v1/users/{user_id}` (update/deactivate), `GET /api/v1/users` (list), and more.
- This is functionally equivalent to the RC Admin REST API that Backend API was already planning to use.

**SSO:**
- Zulip supports **OIDC (OpenID Connect)** and **SAML** natively on self-hosted instances.
- The Backend API becomes an OIDC provider (replacing the custom RC OAuth server from Decision 3). The OAuth 2.0 endpoints (`/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`) remain but are now consumed by Zulip rather than Rocket.Chat.

**Attendance App (Component 2 — the biggest change):**
- Rocket.Chat had Apps-Engine: a sandboxed TypeScript runtime capable of injecting a persistent **toolbar button** and **UIKit modal** directly inside the RC interface.
- Zulip has **no equivalent Apps-Engine**. Zulip's bot/widget system is limited to: outgoing webhooks (text responses only), and a narrow internal widget system (polls/todo lists) that is not a public API for custom integrations.
- **Decision:** The RC Attendance App (Component 2) is redesigned as a **standalone lightweight Attendance Web App** (served from the Backend API or a separate subdomain, e.g., `clock.yourcompany.com`).
- A **Zulip Bot** posts a daily pinned message into a dedicated `#attendance` stream at shift-start time (e.g., 8:45 AM EST) containing Markdown links to the attendance web page. Employees click the link, perform clock-in/break actions in the web app (which calls the Backend API), and return to Zulip.
- This is a **cleaner separation of concerns** than the RC Apps-Engine approach: the attendance UI is a standalone, fully-testable web page, not a sandboxed app living inside the chat platform.

#### Decision

**Replace Rocket.Chat with Zulip as the team communication layer (Component 1). Retire the Rocket.Chat Apps-Engine attendance app (Component 2). Introduce a standalone Attendance Web App (Component 2, redesigned).**

Specifically:
- Remove all Rocket.Chat and MongoDB containers from `docker/docker-compose.yml`.
- Add Zulip container (official Docker image) connecting to the same Postgres server (isolated Zulip database schema).
- The cross-system key changes from `employees.rocketchat_user_id` (TEXT) to `employees.zulip_user_id` (INTEGER — Zulip user IDs are integers).
- All references to `rocketchat_user_id` in code, migrations, repositories, services, JWT payloads, and types are renamed to `zulip_user_id`.
- All references to `rc_provisioned` remain functionally identical but now refer to Zulip account provisioning.
- Backend API's `src/services/rocketchat.service.ts` is renamed and rewritten as `src/services/zulip.service.ts`.
- The OAuth server endpoints (`/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`) remain in place — now acting as OIDC provider for Zulip instead of Custom OAuth provider for Rocket.Chat.
- The `rc-app/` directory is removed. A new `attendance-app/` directory is introduced for the standalone attendance web app (lightweight HTML/JS/CSS page served separately).
- The Zulip bot (outgoing webhook bot) is configured inside Zulip and posts the daily attendance prompt. It is a simple Node.js/TypeScript service in `zulip-bot/`.

#### New Four-Component Architecture

The system continues to be built as four deliberately isolated components:

**Component 1: Zulip (Chat Platform)**
- Self-hosted via Docker Compose.
- Zulip uses its own PostgreSQL database (Zulip-internal schema — never touched by the Backend API directly).
- Handles: messages, streams (channels), topics, mentions, Zulip-native notifications and presence.
- **Zulip's Postgres database owns only chat data** — it is not used for HR, attendance, or employee data.

**Component 2: Attendance Web App + Zulip Bot**
- Replaces the Rocket.Chat Apps-Engine attendance app entirely.
- Sub-component A — **Attendance Web App** (`attendance-app/`): A standalone lightweight web application served at `clock.yourcompany.com`. Employees navigate to this page to clock in/out and manage breaks. Authenticates via the same JWT session cookie (SSO). Calls the Backend API for all data operations.
- Sub-component B — **Zulip Bot** (`zulip-bot/`): A small Node.js service running as a scheduled cron task. Every morning at shift-start time (e.g., 8:45 AM EST), it posts a Markdown message into the `#attendance` Zulip stream containing a link to the Attendance Web App. It is a stateless fire-and-forget poster — it does not receive attendance events, does not maintain state, and does not call the Backend API for HR data.

**Component 3: Backend API**
- Unchanged in architecture and responsibility.
- The only process that writes to JD Connect's Postgres database.
- The only process that calls Zulip's Admin REST API (to provision users on employee creation).
- Handles: JWT auth, employee CRUD, attendance recording, break recording, permission checks, admin password reset, employee provisioning into Zulip, OIDC server endpoints for SSO.
- Data flow: `Attendance Web App → Backend API → Postgres` and `HR Dashboard → Backend API → Postgres + Zulip Admin API`.

**Component 4: HR / Admin Dashboard (Web App)**
- No change. Still a separate web application at `hr.yourcompany.com`.
- Reads/writes JD Connect's Postgres exclusively via the Backend API.
- Now shows `zulip_provisioned` instead of `rc_provisioned` for chat account status.

#### The Cross-System Key (Updated)

The `employees` table in Postgres now has a `zulip_user_id` column (INTEGER, UNIQUE). This is Zulip's internal numeric user ID for that user. It is the **only bridge** between the JD Connect Postgres database and the Zulip system.

```
Postgres employees.zulip_user_id = Zulip users.user_id (integer)
```

- When an employee is created: Backend API inserts into Postgres, calls Zulip Admin REST API `POST /api/v1/users`, stores the returned `user_id` integer back on the Postgres row.
- When the attendance app sends a request: the JWT contains `zulip_user_id`. Backend API uses that to look up the Postgres employee.
- Never use email as a join key — it can change. Always use `zulip_user_id`.

#### Updated JWT Payload Shape

```typescript
{
  sub: string;           // Postgres users.id
  employee_id: string;   // Postgres employees.id
  zulip_user_id: number; // Zulip user ID (integer) — the cross-system key
  roles: string[];       // e.g. ['super_admin'] or ['employee']
  iat: number;
  exp: number;
}
```

#### Single-Database-Technology Model

| Database | Owner | Stores |
|---|---|---|
| **Postgres (JD Connect schema)** | Backend API (only) | Employees, users, roles, permissions, attendance, breaks, sessions |
| **Postgres (Zulip schema)** | Zulip (only) | Messages, streams, Zulip user identities |

Both databases use Postgres technology but are **completely isolated schemas/databases**. The Backend API never queries Zulip's Postgres database. Zulip never queries the JD Connect Postgres database. The Backend API communicates with Zulip exclusively via the Zulip REST API.

MongoDB is **removed entirely** from the stack. The `mongo` and `mongo-init` services in `docker/docker-compose.yml` are deleted. The `mongodata` volume is removed.

#### White Labelling

Zulip's built-in organization settings allow:
- Custom organization name (appears in browser tab, login page, notifications)
- Custom logo (replaces Zulip logo in top-left corner)
- Custom domain (`chat.yourcompany.com`)
- Custom login page description

This is sufficient for an internal BPO platform. Full mobile app white-labelling is not required.

#### Consequences

**What changes:**
1. `docker/docker-compose.yml`: Remove `mongo`, `mongo-init`, `rocketchat` services and `mongodata` volume. Add `zulip` service.
2. `employees` table: Rename `rocketchat_user_id TEXT` → `zulip_user_id INTEGER`. Update all indexes, repositories, services, and types.
3. JWT payload: Replace `rc_user_id` with `zulip_user_id` (number type).
4. `backend/src/services/rocketchat.service.ts` → renamed and rewritten as `backend/src/services/zulip.service.ts`.
5. `rc-app/` directory: Removed. Replaced by `attendance-app/` (standalone web page) and `zulip-bot/` (daily message poster).
6. `.env.example` and all `.env.*` files: Replace `ROCKETCHAT_*` variables with `ZULIP_*` variables.
7. Phase 4 in `current_state.md` retitled: "Zulip Integration & SSO" (was "Rocket.Chat Integration & SSO").
8. Phase 5 in `current_state.md` retitled: "Attendance Web App & Zulip Bot" (was "Rocket.Chat Attendance App").
9. `database_schema.md` MongoDB section replaced with Zulip Postgres schema reference.
10. All TDD checklist items referencing `rocketchat_user_id`, `rc_user_id`, `RocketChat`, `rc_provisioned` updated to Zulip equivalents.

**What does NOT change:**
- The Backend API's three-layer architecture (repositories → services → routes). Decision 7 stands.
- Plain `pg` pool + SQL repositories. Decision 11 stands.
- Custom JWT auth (RS256 asymmetric). Decision 2 stands.
- OIDC/OAuth server endpoints on the Backend API (now used by Zulip instead of RC). Decision 3 pattern stands.
- Attendance decoupled from chat presence. Decision 6 stands and is even more enforceable — Zulip's presence system is now even further removed from attendance logic.
- All Postgres table schemas for HR/attendance/break data (no structural changes, only `rocketchat_user_id` column rename).
- Admin-only password reset (no self-service email). Decision 2 consequence stands.
- The Backend API is the sole writer to JD Connect's Postgres. Decision 7 stands.
- All business logic constants (attendance thresholds, break duration computation, EST timezone). Unchanged.
- HR Dashboard architecture. Unchanged.

#### Architectural Constraint Updates

The 10 key architectural constraints in `project_data.md` Section 10 are updated as follows:
- Constraint 3: "`rocketchat_user_id` is the immutable cross-system key" → "`zulip_user_id` is the immutable cross-system key."
- Constraint 4: "All employee creation must provision RC atomically" → "All employee creation must provision Zulip atomically."
- Constraint 8: "Rocket.Chat's Admin REST API is called only by the Backend API" → "Zulip's Admin REST API is called only by the Backend API."
- All other constraints remain unchanged.

---

### Decision 13: Phase 9 — UI Overhaul, Employee Alias, and Dashboard Architecture

**Date:** 2026-08-20
**Status:** Accepted

#### Context
Phase 9 overhauled both the HR Dashboard and Attendance App to become production-ready interfaces, introduced the `alias` field to the employee schema, and added several new backend endpoints. Multiple non-obvious design decisions were made during this phase that deviate from earlier patterns or establish new ones.

#### Decision 1: Add `alias` column to `employees`; use alias as Zulip display name

The old `migrate-employees.ts` script sent `alias_name` to Zulip as the display name but did not persist it in the new schema. This meant the work names shown in Zulip (e.g. "Adam") were lost from the JD Connect database, making search-by-alias impossible.

**Decision:** Add `alias TEXT` (nullable) to `employees`. Both the migration script and the `createEmployee` service are updated to: (a) persist alias, and (b) send `alias || full_name` as the Zulip `full_name` during provisioning. This ensures Zulip shows the agent's work alias, not their legal name.

**Consequence:** `full_name` = legal name (for HR records); `alias` = Zulip display name / work name. Callers must treat these as independent fields. The `createEmployeeSchema` accepts `alias` as optional — if omitted, `full_name` is the Zulip fallback.

#### Decision 2: Consolidate `reset-password` into `PATCH /api/employees/:id`

The standalone `POST /api/employees/:id/reset-password` route is not removed but the new `PATCH /api/employees/:id` endpoint also handles `new_password` if provided. The Edit Employee modal in the HR Dashboard uses PATCH exclusively, keeping a single round-trip for all employee edits including optional password reset.

**Consequence:** HR admins use one modal to edit any combination of employee fields. The old `reset-password` route remains active for backward compatibility but is not surfaced in the UI.

#### Decision 3: Server-side filtering for employees, attendance, and breaks (no client-side filtering)

All search and filter operations pass query parameters to the backend (`search`, `department_id`, `role_key`, `status`, `from`, `to`) rather than fetching all records and filtering client-side. This keeps payloads small as employee and record counts grow.

**Exception:** Pagination is client-side (slice of the fetched page). The backend returns up to a reasonable maximum per request; the frontend slices into 20-row pages (10 for the attendance app history). This avoids implementing cursor/offset pagination in the backend for Phase 9 (deferred to a future phase when record volumes justify it).

#### Decision 4: `window._pendingFilter` pattern for dashboard card deep-links

Dashboard metric cards need to switch the active tab AND pre-apply filters (status + today's EST date) atomically. Since both apps are single-page vanilla JS without a router, a shared mutable object `window._pendingFilter = { status, date }` is set before switching tabs. The target tab's load function reads and clears it on entry before building the query string.

**Consequence:** This is a simple, zero-dependency pattern appropriate for vanilla JS SPAs. If the apps ever migrate to a framework with routing (Vue Router, React Router), this pattern is replaced by query-string-based navigation. The pattern is documented here so future maintainers understand the intent.

#### Decision 5: Notion light/dark theme ported to all three apps using identical CSS variables

To ensure consistent branding across Zulip, the HR Dashboard, and the Attendance App, all three apps share the same CSS variable naming convention (`--bg-primary`, `--bg-secondary`, `--text-main`, `--border-color`, `--accent-indigo`, etc.) and the same `html.dark-theme` class toggle pattern. Theme preference is stored in `localStorage` under the key `'jd_theme'` and defaults to light mode.

**Consequence:** The Notion theme CSS is not a shared file imported from a CDN — each app maintains its own copy of the variables in its own `styles.css`. This is intentional: it avoids cross-app CSS coupling and allows per-app overrides without affecting the others.

#### Decision 6: HR Dashboard top navbar replaces sidebar; hamburger drawer for mobile

The sidebar (`<aside>`) is replaced with a `<nav class="top-navbar">` for all screen sizes ≥768px. On narrower screens a `☰` button opens a side drawer. This matches standard SaaS dashboard conventions and is consistent with the Attendance App's header layout.

**Consequence:** All JS tab-switching logic is updated to use `.nav-tab-btn` selectors instead of `.nav-item`. The sidebar-specific CSS classes are fully removed.

#### Decision 7: `GET /api/attendance/summary/today` replaces `GET /api/attendance/monitor`

The existing `/monitor` endpoint returns `working_count`, `on_break_count`, `total_clocked_in`. The new `/summary/today` endpoint returns these plus `absent`, `late`, `half_day`, and `total_employees`. The `/monitor` endpoint is NOT removed (backward compatibility) but it is no longer used by the HR Dashboard frontend.

**Consequence:** The "Live Workforce Monitor" tab is removed from the HR Dashboard. All its metrics are now surfaced on the Dashboard home page with drill-down navigation.

#### What Does NOT Change
- The three-layer backend architecture (repositories → services → routes). Decision 7 stands.
- Plain `pg` pool + raw SQL repositories. Decision 11 stands.
- Custom JWT auth (RS256). Decision 2 stands.
- Attendance logic decoupled from Zulip presence. Decision 6 stands.
- Admin-only password reset (no self-service email). Decision 2 consequence stands.
- Backend API is the sole writer to JD Connect's Postgres. Decision 7 stands.
