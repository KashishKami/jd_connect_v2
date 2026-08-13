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

The system is built as four deliberately isolated components so each can be upgraded independently:

### Component 1: Rocket.Chat (Chat Platform)
- Self-hosted via Docker Compose (separate stack from Postgres)
- MongoDB replica set required (hard requirement for Rocket.Chat 8.x)
- Handles: messages, rooms, channels, threads, mentions, RC-native notifications
- **MongoDB owns only chat data** — it is not used for HR, attendance, or employee data

### Component 2: Rocket.Chat Attendance App (RC Apps-Engine)
- Private TypeScript/UIKit app installed into Rocket.Chat via Apps-Engine
- Adds a toolbar button (and/or slash command) for clock-in/clock-out and break selection
- NOT a fork of Rocket.Chat core — it is a sandboxed app; RC upgrades do not break it
- Calls the Backend API for all data operations

### Component 3: Backend API
- Our own Node.js/TypeScript REST API service
- The **only** process that writes to Postgres
- The **only** process that calls Rocket.Chat's Admin REST API
- Handles: JWT auth, employee CRUD, attendance recording, break recording, permission checks, admin password reset, employee provisioning into RC
- Data flow: `RC App → Backend API → Postgres` and `HR Dashboard → Backend API → Postgres + RC Admin API`

### Component 4: HR / Admin Dashboard (Web App)
- Separate web application served on its own subdomain (e.g., `hr.yourcompany.com`)
- Admin subdomain: permission management, user role assignment
- HR subdomain: employee CRUD, attendance history, break history, password reset
- Reads/writes Postgres exclusively via the Backend API — no direct DB access

---

## 3. Database Architecture

### Two Databases, One Ecosystem

| Database | Owner | Stores |
|---|---|---|
| **Postgres** | Backend API (only) | Employees, users, roles, permissions, attendance, breaks, sessions |
| **MongoDB** | Rocket.Chat (only) | Messages, rooms, channels, RC user identities |

**They never talk to each other directly.** The Backend API is the only middleman.

### The Cross-System Link

The `employees` table in Postgres has a `rocketchat_user_id` column (TEXT, UNIQUE). This is Rocket.Chat's internal `_id` for that user. It is the **only bridge** between the two databases.

```
Postgres employees.rocketchat_user_id = MongoDB users._id
```

- When an employee is created: Backend API inserts into Postgres, calls RC Admin API, stores the returned `_id` back on the Postgres row.
- When the RC attendance app sends a request: the JWT contains `rc_user_id`. Backend API uses that to look up the Postgres employee.
- Never use email as a join key — it can change. Always use `rocketchat_user_id`.

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
  sub: string;          // Postgres users.id
  employee_id: string;  // Postgres employees.id
  rc_user_id: string;   // Rocket.Chat users._id (the cross-system key)
  roles: string[];      // e.g. ['super_admin'] or ['employee']
  iat: number;
  exp: number;
}
```

### OAuth Endpoints (for Rocket.Chat SSO)
- `GET  /oauth/authorize` — authorization code flow entry
- `POST /oauth/token`     — exchange code for token
- `GET  /oauth/userinfo`  — return user identity to RC

---

## 5. Roles & Permissions

### App Roles (stored in Postgres, mapped to employees)

| Role | Description |
|---|---|
| `super_admin` | Full system access. Can manage all employees, roles, permissions. |
| `admin` | Administrative access. Can manage employees and view all data. |
| `manager` | Can view and manage their reporting employees' attendance/breaks. |
| `team_leader` | Can view their team's attendance and breaks. |
| `employee` | Standard access. Can clock in/out, take breaks, use chat. |

### Permission Keys (format: `resource:action`)

#### Resource: `employees`
| Key | Description | super_admin | admin | manager | team_leader | employee |
|---|---|---|---|---|---|---|
| `employees.view` | View employee directory | ✅ | ✅ | ✅ | ✅ | ✅ |
| `employees.manage` | Create/edit/suspend employees | ✅ | ✅ | ❌ | ❌ | ❌ |

#### Resource: `attendance`
| Key | Description | super_admin | admin | manager | team_leader | employee |
|---|---|---|---|---|---|---|
| `attendance.view_own` | View own attendance records | ✅ | ✅ | ✅ | ✅ | ✅ |
| `attendance.view_team` | View team attendance (scoped) | ✅ | ✅ | ✅ | ✅ | ❌ |
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
| `rocketchat_user_id` | TEXT UNIQUE | RC `_id` — the cross-system bridge key |
| `rc_provisioned` | BOOLEAN | `false` if RC account creation failed |
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

1. **MongoDB and Postgres never communicate directly.** The Backend API is the only bridge.
2. **RC presence ≠ attendance state.** Never couple them.
3. **`rocketchat_user_id` is the immutable cross-system key.** Never use email as a join key.
4. **All employee creation must provision RC atomically.** Failure is surfaced, not silently swallowed.
5. **Auth is entirely custom JWT.** No Supabase, no third-party auth platform.
6. **Password reset is admin-only.** No self-service email flow.
7. **The Backend API is the single writer to Postgres.** The HR dashboard never touches Postgres directly.
8. **Rocket.Chat's Admin REST API is called only by the Backend API.** The RC app calls the Backend API, not RC Admin API directly.
