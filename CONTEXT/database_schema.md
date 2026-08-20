# Database Schema: JD Connect

This document is the **authoritative source** for all database schemas — both JD Connect's Postgres (employee/attendance/HR data) and Zulip's Postgres (chat data, read-only reference). All migrations, repository queries, and type definitions must match this document. Any deviation must be recorded in `decision_log.md`. MongoDB has been removed entirely — see Decision 12.

---

## 1. Architecture: Two Postgres Databases, One Technology

```
POSTGRES - JD Connect Schema (owned by Backend API)
  users --------------------------------------------------------------+
    |                                                                  |
    +-- employees (auth_user_id FK)                                    |
          |                                                            |
          +-- attendance_records (employee_id FK)                      |
          |     +-- attendance_corrections (employee_id FK)            |
          |     +-- attendance_audit_logs (employee_id FK)             |
          |                                                            |
          +-- break_records (employee_id FK)                           |
          |     +-- break_requests (employee_id FK)                    |
          |     +-- break_audit_logs (employee_id FK)                  |
          |                                                            |
          +-- employee_sessions (user_id FK)                           |
                                                                       |
  roles ---------------------------------------------------------------+
  departments                                                          |
  centres                                                              |
  shifts                                                               |
  break_types                                                          |
  break_policies                                                       |
  audit_logs (actor_user_id FK) ---------------------------------------+

POSTGRES - Zulip Schema (owned by Zulip - never touched by Backend API directly)
  zerver_userprofile   <-- Zulip user identities
  zerver_stream        <-- Streams (channels), e.g. #attendance, #general
  zerver_message       <-- All messages
  zerver_subscription  <-- User-to-stream memberships
  (+ all other Zulip Django-managed tables)
  NOTE: MongoDB has been removed from the stack entirely. See Decision 12.

CROSS-SYSTEM BRIDGE:
  Postgres employees.zulip_user_id (INTEGER) = Zulip zerver_userprofile.id
```

---

## 2. Postgres Schema

### ENUMs

```sql
CREATE TYPE app_role AS ENUM (
  'super_admin', 'admin', 'manager', 'team_leader', 'employee'
);

CREATE TYPE employment_status AS ENUM (
  'active', 'suspended', 'resigned', 'terminated', 'absconded'
);

CREATE TYPE attendance_status AS ENUM (
  'present', 'half_day', 'absent', 'late', 'leave', 'weekly_off', 'holiday'
);

CREATE TYPE attendance_source AS ENUM (
  'auto', 'manual', 'correction'
);

CREATE TYPE break_status AS ENUM (
  'active', 'completed', 'exceeded', 'cancelled'
);

CREATE TYPE request_status AS ENUM (
  'pending', 'approved', 'rejected', 'cancelled'
);
```

---

### `users` Table

The auth identity table. Stores credentials. Separate from `employees` to allow the auth record to exist before or after an employee profile.

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,           -- bcrypt hash
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
```

---

### `roles` Table

```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         app_role UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Seeded values:** `super_admin`, `admin`, `manager`, `team_leader`, `employee`

---

### `permissions` Table

```sql
CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,   -- e.g. 'employees.manage'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `role_permissions` Table

```sql
CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

---

### `departments` Table

```sql
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Seeded values:** Sales, Backend, HR, Training, Management, Marketing, Logistics

---

### `centres` Table

```sql
CREATE TABLE centres (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Seeded values:** `DBP` (Doon Business Park), `ITP` (IT Park)

---

### `shifts` Table

```sql
CREATE TABLE shifts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT UNIQUE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  grace_minutes  INT NOT NULL DEFAULT 15,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Seeded values:** Night Shift (09:00–18:00 EST, 15 min grace)

---

### `employees` Table

The core HR record. Linked to `users` via `auth_user_id`, and to Zulip via `zulip_user_id`.

```sql
CREATE TABLE employees (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id          UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  zulip_user_id         INTEGER UNIQUE,         -- Zulip's internal user ID integer. THE cross-system bridge.
  zulip_provisioned     BOOLEAN NOT NULL DEFAULT false, -- true once Zulip account confirmed created
  employee_code         TEXT UNIQUE NOT NULL
                          DEFAULT ('JD' || lpad(nextval('employee_code_seq')::text, 4, '0')),
  full_name             TEXT NOT NULL,
  alias                 TEXT,                   -- Work/display name sent to Zulip (e.g. "Adam"). Added: Phase 9 W-901.
  email                 TEXT UNIQUE NOT NULL,
  mobile                TEXT,
  department_id         UUID REFERENCES departments(id),
  role_id               UUID REFERENCES roles(id),
  team_leader_id        UUID REFERENCES employees(id),
  manager_id            UUID REFERENCES employees(id),
  centre_id             UUID REFERENCES centres(id),
  shift_id              UUID REFERENCES shifts(id),
  designation           TEXT,
  joining_date          DATE,
  employment_status     employment_status NOT NULL DEFAULT 'active',
  profile_photo_url     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE employee_code_seq START 1;
CREATE INDEX idx_employees_auth_user ON employees(auth_user_id);
CREATE INDEX idx_employees_zulip_user ON employees(zulip_user_id);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_tl ON employees(team_leader_id);
```

**Migration:** `backend/scripts/migrations/009_add_alias_to_employees.ts` — `ALTER TABLE employees ADD COLUMN IF NOT EXISTS alias TEXT;`

---

### `employee_sessions` Table

Tracks active login sessions for single-active-session enforcement.

```sql
CREATE TABLE employee_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,             -- hashed token stored here
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON employee_sessions(user_id);
```

---

### `attendance_records` Table

One row per employee per work day. Clock-in and clock-out timestamps stored here. Never infer from Zulip presence.

```sql
CREATE TABLE attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  clock_in_at   TIMESTAMPTZ,
  clock_out_at  TIMESTAMPTZ,
  hours_worked  NUMERIC(5,2),           -- auto-computed on clock-out
  status        attendance_status NOT NULL DEFAULT 'absent',
  is_late       BOOLEAN NOT NULL DEFAULT false,
  source        attendance_source NOT NULL DEFAULT 'auto',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

CREATE INDEX idx_attendance_emp_date ON attendance_records(employee_id, work_date DESC);
CREATE INDEX idx_attendance_date ON attendance_records(work_date);
```

**Auto-compute on clock-out (service layer, not DB trigger):**
- `hours_worked = ROUND((clock_out_at - clock_in_at) / 3600, 2)`
- `status` and `is_late` are determined by two factors: **clock-in time (EST)** and **hours worked**:
  - Clock-in <= 09:15 AM EST **AND** hours_worked >= 6 -> `status = 'present'`, `is_late = false`
  - Clock-in between 09:15 AM and 09:30 AM EST **AND** hours_worked >= 6 -> `status = 'late'`, `is_late = true`
  - Clock-in after 09:30 AM EST **OR** hours_worked < 6 -> `status = 'half_day'`, `is_late = false`
  - No clock-in at all by end of day -> `status = 'absent'` (set by a nightly scheduler, not on clock-out)
- Shift start reference: **09:00 AM EST**. Grace window: +15 min = 09:15 AM EST. Late window: 09:15–09:30 AM EST. Half-day cutoff: after 09:30 AM EST.

---

### `attendance_corrections` Table

```sql
CREATE TABLE attendance_corrections (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id          UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  employee_id            UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date              DATE NOT NULL,
  requested_clock_in_at  TIMESTAMPTZ,
  requested_clock_out_at TIMESTAMPTZ,
  requested_status       attendance_status,
  reason                 TEXT NOT NULL,
  status                 request_status NOT NULL DEFAULT 'pending',
  requested_by           UUID NOT NULL REFERENCES employees(id),
  reviewed_by            UUID REFERENCES employees(id),
  reviewed_at            TIMESTAMPTZ,
  review_notes           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `attendance_audit_logs` Table

```sql
CREATE TABLE attendance_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id),
  action        TEXT NOT NULL,
  before_data   JSONB,
  after_data    JSONB,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_att_audit_emp ON attendance_audit_logs(employee_id, created_at DESC);
```

---

### `break_types` Table

```sql
CREATE TABLE break_types (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                    TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  description            TEXT,
  default_limit_minutes  INTEGER,         -- NULL = no limit
  tl_alert_minutes       INTEGER,         -- when to alert team leader
  manager_alert_minutes  INTEGER,         -- when to escalate to manager
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Seeded values:**

| key | name | limit | tl_alert | mgr_alert |
|---|---|---|---|---|
| `bio` | Bio Break | 10 | 10 | 20 |
| `tea` | Tea Break | 15 | 15 | 25 |
| `dinner` | Dinner Break | 30 | 30 | 45 |
| `smoke` | Smoke Break | 10 | 10 | 20 |
| `meeting` | Meeting Break | NULL | NULL | NULL |

---

### `break_policies` Table

Per-centre or per-department overrides for break time limits.

```sql
CREATE TABLE break_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  break_type_id         UUID NOT NULL REFERENCES break_types(id) ON DELETE CASCADE,
  centre_id             UUID REFERENCES centres(id) ON DELETE CASCADE,
  department_id         UUID REFERENCES departments(id) ON DELETE CASCADE,
  limit_minutes         INTEGER,
  tl_alert_minutes      INTEGER,
  manager_alert_minutes INTEGER,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (break_type_id, centre_id, department_id)
);
```

---

### `break_records` Table

One row per break event. Status auto-computed when break ends (service layer).

```sql
CREATE TABLE break_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  break_type_id     UUID NOT NULL REFERENCES break_types(id),
  department_id     UUID REFERENCES departments(id),
  centre_id         UUID REFERENCES centres(id),
  start_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at            TIMESTAMPTZ,
  duration_minutes  NUMERIC(8,2),
  status            break_status NOT NULL DEFAULT 'active',
  limit_minutes     INTEGER,             -- effective limit at time of break start
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_break_records_emp ON break_records(employee_id, start_at DESC);
CREATE INDEX idx_break_records_active ON break_records(status) WHERE status = 'active';
```

**Auto-compute on end (service layer):**
- `duration_minutes = ROUND((end_at - start_at) / 60, 2)`
- `status = 'exceeded'` if `duration_minutes > limit_minutes`, else `'completed'`

---

### `break_requests` Table

Extended break requests (employee requests longer than their limit).

```sql
CREATE TABLE break_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  break_type_id     UUID REFERENCES break_types(id),
  requested_minutes INTEGER NOT NULL,
  reason            TEXT NOT NULL,
  status            request_status NOT NULL DEFAULT 'pending',
  reviewer_id       UUID REFERENCES employees(id),
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  break_record_id   UUID REFERENCES break_records(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `break_audit_logs` Table

```sql
CREATE TABLE break_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  break_record_id UUID REFERENCES break_records(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES employees(id),
  actor_user_id   UUID REFERENCES users(id),
  action          TEXT NOT NULL,
  before_data     JSONB,
  after_data      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `audit_logs` Table (General)

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Zulip Postgres Schema (Read-Only Reference)

> **IMPORTANT:** The Backend API never queries Zulip's Postgres database directly. All interactions with Zulip data go through the **Zulip REST API**. This section is provided for reference only — so developers understand what lives where in Zulip's internal data model.

> Zulip uses Django ORM migrations. Do not write SQL migrations against Zulip's database. Its schema is managed entirely by Zulip's own codebase.

### Key Zulip Tables (Django model names)

| Django Model / Table | Purpose |
|---|---|
| `zerver_userprofile` | Zulip user identities. `id` (integer) here = `employees.zulip_user_id` in JD Connect Postgres. |
| `zerver_stream` | Streams (channels), e.g. `#attendance`, `#general`. |
| `zerver_message` | All messages. Contains `sender_id` (Zulip user ID integer). |
| `zerver_subscription` | User-to-stream membership and notification preferences. |

### Relevant Zulip User Shape (REST API response — for SSO mapping)

```json
{
  "user_id": 42,
  "email": "riya@company.com",
  "full_name": "Riya Sharma",
  "is_active": true,
  "is_bot": false,
  "role": 400
}
```

The `user_id` integer from this response is stored in `employees.zulip_user_id` in JD Connect's Postgres.

### Zulip Admin REST API Endpoints Used by Backend API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/users` | Create a new Zulip user (on employee creation) |
| `PATCH` | `/api/v1/users/{user_id}` | Update user details or deactivate account |
| `GET` | `/api/v1/users/{user_id}` | Fetch Zulip user details |
| `DELETE` | `/api/v1/users/{user_id}` | Deactivate a Zulip user |

Authentication: `Authorization: Basic base64(bot_email:bot_api_key)` using a dedicated Zulip admin bot account created via the Zulip admin panel.

---

## 4. Entity Relationship Summary

```
users (1) --------- (1) employees
                        |
                 +------+------+
                 |      |      |
            attendance  breaks  sessions
            records     records
                 |      |
            corrections requests
```

- `employees.auth_user_id` -> `users.id` (auth identity)
- `employees.zulip_user_id` -> Zulip `zerver_userprofile.id` (chat identity — integer)
- `employees.manager_id` -> `employees.id` (self-referential hierarchy)
- `employees.team_leader_id` -> `employees.id` (self-referential hierarchy)
- `attendance_records.employee_id` -> `employees.id`
- `break_records.employee_id` -> `employees.id`

---

## 5. Seed Data Plan

The first migration run must seed:

### Roles
```sql
INSERT INTO roles (key, name) VALUES
  ('super_admin', 'Super Admin'),
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('team_leader', 'Team Leader'),
  ('employee', 'Employee');
```

### Permissions
All keys from `project_data.md` Section 5 permission table.

### Departments
```sql
INSERT INTO departments (name) VALUES
  ('Sales'), ('Backend'), ('HR'), ('Training'),
  ('Management'), ('Marketing'), ('Logistics');
```

### Centres
```sql
INSERT INTO centres (code, name) VALUES
  ('DBP', 'Doon Business Park'),
  ('ITP', 'IT Park');
```

### Shifts
```sql
-- All times stored and evaluated in EST (America/New_York).
INSERT INTO shifts (name, start_time, end_time, grace_minutes) VALUES
  ('Night Shift', '09:00', '18:00', 15);
```

### Break Types
```sql
INSERT INTO break_types (key, name, default_limit_minutes, tl_alert_minutes, manager_alert_minutes) VALUES
  ('bio',     'Bio Break',     10,   10,   20),
  ('tea',     'Tea Break',     15,   15,   25),
  ('dinner',  'Dinner Break',  30,   30,   45),
  ('smoke',   'Smoke Break',   10,   10,   20),
  ('meeting', 'Meeting Break', NULL, NULL, NULL);
```

### Initial Super Admin User
Created via Backend API setup script (not hardcoded — password set via environment variable at first run).

---

## 6. Key Business Logic Constants

### Attendance Status Thresholds (Backend API `src/services/attendance.service.ts`)

All times are in **EST (America/New_York)**. The clock-in time is compared against the shift's `start_time` column (stored as EST).

```typescript
export const ATTENDANCE_THRESHOLDS = {
  // Minutes after shift start that are still counted as on-time (present).
  // Shift start 09:00 EST + 15 min buffer = present if clocked in by 09:15 EST.
  PRESENT_BUFFER_MINUTES: 15,

  // Minutes after shift start beyond which the employee is considered late.
  // Clocked in 09:15–09:30 EST = late. After 09:30 EST = half_day.
  LATE_CUTOFF_MINUTES: 30,

  // Minimum hours worked to avoid half_day classification.
  // Even if clocked in on time, working < 6 hours = half_day.
  MIN_HOURS_FOR_FULL_DAY: 6,
} as const;

// Status resolution — call this on clock-out:
// clockInAt: the actual clock-in TIMESTAMPTZ converted to EST
// shiftStart: today's shift start as a Date in EST (e.g., 09:00 AM)
// hoursWorked: computed from (clockOutAt - clockInAt) / 3600
export function computeAttendanceStatus(
  clockInAt: Date,     // in EST
  shiftStart: Date,    // in EST
  hoursWorked: number
): { status: AttendanceStatus; isLate: boolean } {
  const minutesLate = (clockInAt.getTime() - shiftStart.getTime()) / 60000;

  if (hoursWorked < ATTENDANCE_THRESHOLDS.MIN_HOURS_FOR_FULL_DAY) {
    return { status: 'half_day', isLate: false };
  }
  if (minutesLate > ATTENDANCE_THRESHOLDS.LATE_CUTOFF_MINUTES) {
    return { status: 'half_day', isLate: false };
  }
  if (minutesLate > ATTENDANCE_THRESHOLDS.PRESENT_BUFFER_MINUTES) {
    return { status: 'late', isLate: true };
  }
  return { status: 'present', isLate: false };
}
```

> **Rule:** `hours_worked < 6` takes priority — even if an employee clocks in before 09:15 AM, working fewer than 6 hours results in `half_day`. The `late` status is only possible when `hours_worked >= 6` AND clock-in was between 09:15–09:30 AM EST.

### Break Duration Computation (`src/services/break.service.ts`)

```typescript
export function computeBreakDuration(startAt: Date, endAt: Date): number {
  return Math.round(((endAt.getTime() - startAt.getTime()) / 1000 / 60) * 100) / 100;
}

export function computeBreakStatus(
  durationMinutes: number,
  limitMinutes: number | null
): 'completed' | 'exceeded' {
  if (limitMinutes === null) return 'completed'; // no limit = always completed
  return durationMinutes > limitMinutes ? 'exceeded' : 'completed';
}
```
