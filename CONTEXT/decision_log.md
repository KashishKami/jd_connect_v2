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
