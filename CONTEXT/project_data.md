# Project Data: JD Connect

This document is the **authoritative reference** for JD Connect's metadata, technical stack, architecture decisions, domain rules, permission codes, and business rules. Every implementation decision should be cross-checked against this file first.

---

## 1. Core Metadata

- **Project Name:** JD Connect
- **Company:** JD (internal platform for a BPO/call-centre operation)
- **Business Type:** Internal HR + Operations platform — employee management, attendance tracking, break logging, and team communication
- **Timezone:** EST (Eastern Standard Time, UTC−5) — all timestamps, attendance records, and shift calculations use EST
- **Architecture:** Four-component system (see Section 2)
- **Hosting Target:** Hostinger VPS (self-hosted Docker, single server)
- **Repository:** `c:\Users\Administrator\Desktop\JD Connect\` (new project — this CONTEXT folder)

---

## 2. Architecture Overview

The system is built as three deliberately isolated components so each can be upgraded independently. (Previously four components — `attendance-app/` and `hr-dashboard/` were merged into a single unified portal in Decision 14.)

### Component 1: Zulip (Chat Platform)
- Self-hosted via Docker Compose.
- Zulip uses its own PostgreSQL database (Zulip-internal schema — never touched by the Backend API directly).
- Handles: messages, streams (channels), topics, mentions, Zulip-native notifications and presence.
- **Zulip's Postgres database owns only chat data** — it is not used for HR, attendance, or employee data.
- Decision log reference: Decision 12.

### Component 2: Unified Portal + Zulip Bot
- Decision log reference: Decision 14.
- **Sub-component A — Unified Portal** (`portal/`): A single TypeScript web application (compiled by esbuild, served at `app.yourcompany.com`) that replaces both the old `attendance-app/` and `hr-dashboard/` apps. All employees use this one URL. After login, `GET /api/me/permissions` determines which pages and features the user can see. Employees see the Attendance Console only. HR/Admin/Managers additionally see Employee Management, Attendance Audit, Breaks Audit. Super Admins additionally see the Permissions Management page.
- **Sub-component B — Zulip Bot** (`zulip-bot/`): A small Node.js cron service. Every morning at 8:45 AM EST it posts a Markdown message into the `#attendance` Zulip stream with a link to the Unified Portal. Stateless — does not process attendance events.
- The portal is written in TypeScript. esbuild bundles `portal/src/main.ts` → `portal/dist/bundle.js`. No React, no webpack, no framework.
- Frontend role-gating is UX-only (hides nav items). The backend is the authoritative security layer — every API call is checked server-side via `requirePermission()` middleware.

### Component 3: Backend API
- Our own Node.js/TypeScript REST API service.
- The **only** process that writes to JD Connect's Postgres database.
- The **only** process that calls Zulip's Admin REST API.
- Handles: JWT auth, employee CRUD, attendance recording, break recording, granular permission enforcement (route-level, query-param-level, field-level, row-level), admin password reset, employee provisioning into Zulip, OIDC server endpoints for SSO, permissions management CRUD.
- Data flow: `Unified Portal → Backend API → Postgres` and `Unified Portal → Backend API → Postgres + Zulip Admin API`.

---

## 3. Database Architecture

### Two Postgres Databases, One Technology

| Database | Owner | Stores |
|---|---|---|
| **Postgres (JD Connect schema)** | Backend API (only) | Employees, users, roles, permissions, attendance, breaks, sessions |
| **Postgres (Zulip schema)** | Zulip (only) | Messages, streams, Zulip user identities |

**They never communicate directly.** The Backend API is the only middleman. MongoDB has been removed from the stack entirely (see Decision 12).

### The Cross-System Link

The `employees` table in Postgres has a `zulip_user_id` column (INTEGER, UNIQUE). This is Zulip's internal numeric user ID for that user. It is the **only bridge** between the two systems.

```
Postgres employees.zulip_user_id = Zulip users.user_id (integer)
```

- When an employee is created: Backend API inserts into Postgres, calls Zulip Admin REST API `POST /api/v1/users`, stores the returned `user_id` integer back on the Postgres row.
- When the attendance app sends a request: the JWT contains `zulip_user_id`. Backend API uses that to look up the Postgres employee.
- Never use email as a join key — it can change. Always use `zulip_user_id`.

---

## 4. Auth & Identity

### No Supabase Auth — Custom JWT Auth in the Backend API

Auth is entirely handled by the Backend API. There is no third-party auth platform.

| Concern | Solution |
|---|---|
| Password storage | `bcrypt` hash stored in `users.password_hash` in Postgres |
| Session issuance | Backend API issues JWTs (RS256, asymmetric) on login |
| Session validation | JWT middleware on every protected route |
| Password reset | HR-only admin action via `POST /api/employees/:id/reset-password` — no self-service email flow |
| Single login for all subdomains | Session cookie scoped to root domain (`.yourcompany.com`) |
| Rocket.Chat SSO | RC configured as Custom OAuth client pointing at Backend API's `/oauth/*` endpoints |

### JWT Payload Shape
```typescript
{
  sub: string;           // Postgres users.id
  employee_id: string;   // Postgres employees.id
  zulip_user_id: number; // Zulip user ID integer (the cross-system key)
  roles: string[];       // e.g. ['super_admin'] or ['employee']
  iat: number;
  exp: number;
}
```

### OIDC Endpoints (for Zulip SSO)
- `GET  /oauth/authorize` — authorization code flow entry (Zulip configured as OIDC client)
- `POST /oauth/token`     — exchange code for access token
- `GET  /oauth/userinfo`  — return user identity to Zulip

---

## 5. Roles & Permissions

> **Decision 14:** Permission system expanded from 6 coarse keys to a full fine-grained taxonomy. All permissions are enforced in the backend at route-level, query-param-level, field-level, and row-level. The frontend reads `GET /api/me/permissions` after login and uses the result only for UX (hiding nav items and buttons) — never for security decisions.

### App Roles (stored in Postgres, mapped to employees)

| Role | Description |
|---|---|
| `super_admin` | Full system access. Can manage all employees, roles, permissions. |
| `admin` | Administrative access. Can manage employees and view all data. |
| `manager` | Can view and manage their reporting employees' attendance/breaks. |
| `team_leader` | Can view their team's attendance and breaks. |
| `employee` | Standard access. Can clock in/out, take breaks, use chat. |

### Permission Keys — Complete Taxonomy

#### Portal Page Access
| Key | Description | super_admin | admin | manager | team_leader | employee |
|---|---|---|---|---|---|---|
| `portal.attendance` | Access the Attendance Console | ✅ | ✅ | ✅ | ✅ | ✅ |
| `portal.employees` | Access Employee Management page | ✅ | ✅ | ✅ | ❌ | ❌ |
| `portal.attendance_audit` | Access Attendance Audit page | ✅ | ✅ | ✅ | ✅ | ❌ |
| `portal.breaks_audit` | Access Breaks Audit page | ✅ | ✅ | ✅ | ✅ | ❌ |
| `portal.permissions` | Access Permissions Management page | ✅ | ❌ | ❌ | ❌ | ❌ |

#### Resource: `employees`
| Key | Description | super_admin | admin | manager | team_leader | employee |
|---|---|---|---|---|---|---|
| `employees.view` | View employee list and basic fields | ✅ | ✅ | ✅ | ❌ | ❌ |
| `employees.view.sensitive` | View sensitive fields (mobile, designation, joining date) | ✅ | ✅ | ❌ | ❌ | ❌ |
| `employees.create` | Create new employees | ✅ | ✅ | ❌ | ❌ | ❌ |
| `employees.edit` | Edit existing employee fields | ✅ | ✅ | ❌ | ❌ | ❌ |
| `employees.edit.role` | Change an employee's role | ✅ | ❌ | ❌ | ❌ | ❌ |
| `employees.edit.status` | Change employment status (suspend, terminate) | ✅ | ✅ | ❌ | ❌ | ❌ |
| `employees.delete` | Soft-delete / permanently terminate | ✅ | ❌ | ❌ | ❌ | ❌ |
| `employees.filter.by_role` | Use role filter on employees page | ✅ | ✅ | ❌ | ❌ | ❌ |
| `employees.filter.by_department` | Use department filter on employees page | ✅ | ✅ | ✅ | ❌ | ❌ |
| `employees.filter.by_status` | Use status filter on employees page | ✅ | ✅ | ❌ | ❌ | ❌ |

#### Resource: `attendance`
| Key | Description | super_admin | admin | manager | team_leader | employee |
|---|---|---|---|---|---|---|
| `attendance.view_own` | View own attendance records | ✅ | ✅ | ✅ | ✅ | ✅ |
| `attendance.view_team` | View team attendance (scoped to managed employees) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `attendance.view_all` | View all employees' attendance | ✅ | ✅ | ❌ | ❌ | ❌ |
| `attendance.correct` | Submit attendance corrections | ✅ | ✅ | ✅ | ❌ | ❌ |

#### Resource: `breaks`
| Key | Description | super_admin | admin | manager | team_leader | employee |
|---|---|---|---|---|---|---|
| `breaks.view_own` | View own break records | ✅ | ✅ | ✅ | ✅ | ✅ |
| `breaks.view_team` | View team break records (scoped) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `breaks.view_all` | View all employees' breaks | ✅ | ✅ | ❌ | ❌ | ❌ |

#### Resource: `hr`
| Key | Description | super_admin | admin | manager | team_leader | employee |
|---|---|---|---|---|---|---|
| `hr.reset_password` | Reset any employee's password | ✅ | ✅ | ❌ | ❌ | ❌ |
| `hr.manage_roles` | Assign/change employee roles | ✅ | ❌ | ❌ | ❌ | ❌ |

#### Resource: `permissions`
| Key | Description | super_admin | admin | manager | team_leader | employee |
|---|---|---|---|---|---|---|
| `permissions.view` | View the permissions matrix | ✅ | ❌ | ❌ | ❌ | ❌ |
| `permissions.manage` | Edit role-permission assignments | ✅ | ❌ | ❌ | ❌ | ❌ |

### Permission Enforcement Layers (all backend-enforced)

| Layer | Mechanism | Example |
|---|---|---|
| **Route-level** | `requirePermission(key)` middleware → HTTP 403 if missing | `GET /api/employees` → requires `employees.view` |
| **Query-param-level** | Service ignores filter param if caller lacks permission | No `employees.filter.by_role` → `role_key` query param is silently ignored |
| **Field-level** | Service strips fields from response objects | No `employees.view.sensitive` → `mobile`, `designation` omitted from every row |
| **Row-level** | Service appends `WHERE` scoping clause | `attendance.view_team` → only returns records where `manager_id` or `team_leader_id` matches caller |

---

## 6. Employee Fields (Postgres `employees` table)

These are the fields carried over from the existing system:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `employee_code` | TEXT UNIQUE | Format: `JD####` (auto-generated sequence) |
| `full_name` | TEXT | Required |
| `email` | TEXT UNIQUE | Required — used for login |
| `mobile` | TEXT | Optional |
| `department_id` | UUID FK | References `departments` |
| `role_id` | UUID FK | References `roles` |
| `team_leader_id` | UUID FK | Self-referential to employees |
| `manager_id` | UUID FK | Self-referential to employees |
| `centre_id` | UUID FK | References `centres` (office location) |
| `shift_id` | UUID FK | References `shifts` |
| `designation` | TEXT | Job title |
| `joining_date` | DATE | |
| `employment_status` | ENUM | `active`, `suspended`, `resigned`, `terminated` |
| `profile_photo_url` | TEXT | Optional |
| `zulip_user_id` | INTEGER UNIQUE | Zulip numeric user ID — the cross-system bridge key |
| `zulip_provisioned` | BOOLEAN | `false` if Zulip account creation failed |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

## 7. Break Types (Seeded Data)

| Key | Name | Default Limit | TL Alert | Manager Alert |
|---|---|---|---|---|
| `bio` | Bio Break | 10 min | 10 min | 20 min |
| `tea` | Tea Break | 15 min | 15 min | 25 min |
| `dinner` | Dinner Break | 30 min | 30 min | 45 min |
| `smoke` | Smoke Break | 10 min | 10 min | 20 min |
| `meeting` | Meeting Break | No limit | — | — |

These are configurable by admins. The dropdown in the RC attendance app is populated from `break_types` where `is_active = true`.

---

## 8. Attendance Logic

All time comparisons are in **EST (America/New_York)**.

- **Clock-in** creates an `attendance_records` row with `clock_in_at = NOW()`, `work_date = TODAY` (EST date).
- **Clock-out** updates the same row with `clock_out_at = NOW()`, then the service computes `hours_worked` and resolves `status` and `is_late` based on two factors:

| Condition | Status | is_late |
|---|---|---|
| Clocked in by 09:15 AM EST **AND** hours ≥ 6 | `present` | `false` |
| Clocked in 09:15–09:30 AM EST **AND** hours ≥ 6 | `late` | `true` |
| Clocked in after 09:30 AM EST **OR** hours < 6 | `half_day` | `false` |
| No clock-in recorded for the day | `absent` | `false` |

**Shift reference point:** 09:00 AM EST (shift start).
- Grace window: first 15 minutes after shift start (09:00–09:15 AM EST) → employee is still `present`.
- Late window: 09:15–09:30 AM EST → `late`.
- Half-day cutoff: after 09:30 AM EST, OR any clock-out that results in < 6 hours worked.

> **Priority rule:** `hours_worked < 6` always wins. An employee who clocks in by 09:00 AM but leaves after 4 hours is `half_day`, not `present`.

- **Attendance status is NEVER inferred from Rocket.Chat presence.** An employee going offline in RC does NOT clock them out. These systems are decoupled.
- Double clock-in protection: if an open record exists for today (`clock_out_at IS NULL`), the Backend API returns HTTP 409.

---

## 9. Centres (Office Locations)

Seeded locations:

| Code | Name |
|---|---|
| `DBP` | Doon Business Park |
| `ITP` | IT Park |

---

## 10. Key Architectural Constraints (Always Keep in Mind)

1. **Zulip's Postgres schema and JD Connect's Postgres schema never communicate directly.** The Backend API is the only bridge. MongoDB has been removed entirely.
2. **Zulip presence ≠ attendance state.** Never couple them. Attendance is tracked exclusively via explicit clock-in/clock-out actions in the Unified Portal.
3. **`zulip_user_id` is the immutable cross-system key.** Never use email as a join key between Zulip and JD Connect Postgres.
4. **All employee creation must provision Zulip atomically.** Failure sets `zulip_provisioned = false` and is surfaced to HR — never silently swallowed.
5. **Auth is entirely custom JWT.** No Supabase, no third-party auth platform.
6. **Password reset is admin-only.** No self-service email flow.
7. **The Backend API is the single writer to JD Connect's Postgres.** The Unified Portal never touches Postgres directly.
8. **Zulip's Admin REST API is called only by the Backend API.** The Unified Portal calls the Backend API, not Zulip Admin API directly.
9. **The Zulip Bot (`zulip-bot/`) is stateless and posts-only.** It never processes attendance events or calls the Backend API for HR data.
10. **The Unified Portal (`portal/`) is fully independent of Zulip.** It is a standalone TypeScript web app (compiled via esbuild) that calls the Backend API. If Zulip is down, attendance tracking continues uninterrupted.
11. **All permissions are enforced in the backend.** Frontend permission checks are UX-only (hiding nav items). The backend must enforce every permission at route-level, query-param-level, field-level, and row-level. There is no security guarantee from the frontend.
12. **`GET /api/me/permissions` is the permission source of truth for the frontend.** Called once after login, cached in `sessionStorage`. Never hardcode role-to-permission mappings in the frontend — always read from this endpoint.
