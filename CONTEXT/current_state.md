# Current State: JD Connect Implementation Tracker

This is the **source of truth** for what is done, what is in progress, and what is next. Update this file as work progresses. An AI assistant starting a new session should read this file first to identify the current phase before writing any code.

**Legend:**
- `[ ]` Not started
- `[/]` In progress
- `[x]` Complete

---

## Phase 0 — Project Setup & Infrastructure

> **Goal:** Have a working local development environment: plain Postgres container running, Backend API skeleton bootstrapped, RC Docker stack running with MongoDB replica set, and all secrets wired up. Nothing is built yet — this phase is purely infrastructure.

---

#### W-001 — Repository & Monorepo Structure

**Root cause:** Starting from scratch — no project directory exists yet.

**Goal:** A clean repository with four top-level workspaces: `backend/`, `rc-app/`, `hr-dashboard/`, `docker/`.

**Approach:**
Create a new project directory. Initialise git. Create the monorepo workspace layout. Add `.gitignore`, `.env.example`, and root `README.md`.

---

- [ ] **Setup — Repository**
  - [ ] Create project root directory (e.g., `jd-connect/`)
  - [ ] `git init`
  - [ ] Create `.gitignore` (Node, env files, dist, coverage)
  - [ ] Create root `README.md` with architecture overview diagram
  - [ ] Create workspace directories: `backend/`, `rc-app/`, `hr-dashboard/`, `docker/`
  - [ ] Create root `package.json` with workspaces config (if using npm/pnpm workspaces)

---

#### W-002 — Docker Infrastructure: Postgres Container

**Root cause:** The Backend API needs a Postgres database to connect to. This replaces the entire previous Supabase Docker stack with a single container.

**Goal:** A single `postgres:16` container running locally, accessible on port 5432, with a named volume for data persistence.

**Approach:**
Write `docker/docker-compose.yml` with a Postgres service, a named volume, and appropriate health check. Write `docker/.env.example`. Document startup commands.

---

- [ ] **Setup — Docker / Postgres**
  - [ ] Create `docker/docker-compose.yml` with:
    - `postgres` service: image `postgres:16-alpine`, port `5432:5432`, named volume `pgdata`, health check (`pg_isready`)
    - Environment: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` from `.env`
    - Network: `jdconnect_network` (shared with other services)
  - [ ] Create `docker/.env` (gitignored) and `docker/.env.example`
  - [ ] Verify: `docker compose up -d postgres` → container healthy → `psql` connects
  - [ ] Document startup commands in `docker/README.md`

---

#### W-003 — Docker Infrastructure: MongoDB Replica Set + Rocket.Chat

**Root cause:** Rocket.Chat 8.x requires MongoDB to run as a replica set (not standalone) — this is a hard requirement, not optional.

**Goal:** A MongoDB replica set (single-node replica set is fine for development/single-VPS) running in Docker, with a Rocket.Chat container connected to it.

**Approach:**
Add MongoDB and Rocket.Chat services to `docker-compose.yml`. Configure MongoDB with `--replSet rs0`. Add a one-time init container or entrypoint script that runs `rs.initiate()`. Expose RC on port 3000.

---

- [ ] **Setup — MongoDB Replica Set**
  - [ ] Add `mongo` service to `docker-compose.yml`:
    - Image: `mongo:7` (or latest compatible with RC 8.x — check RC release notes)
    - Command: `--replSet rs0 --bind_ip_all`
    - Named volume: `mongodata`
    - Port: `27017:27017` (internal only — do not expose publicly)
  - [ ] Add `mongo-init` one-shot service (or entrypoint script) that waits for Mongo to be ready then runs:
    ```js
    rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] })
    ```
  - [ ] Add `rocketchat` service:
    - Image: `rocket.chat:8` (latest 8.x)
    - Environment: `MONGO_URL=mongodb://mongo:27017/rocketchat?replicaSet=rs0`, `ROOT_URL`, `PORT=3000`
    - Port: `3100:3000` (map to 3100 on host to avoid conflicts)
    - Depends on: `mongo` healthy
  - [ ] Verify: RC starts, logs show "SERVER RUNNING" — navigate to `http://localhost:3100` → RC setup wizard visible
  - [ ] Complete RC initial setup wizard (admin credentials, org name, site URL)
  - [ ] Store RC admin credentials in `docker/.env`

---

#### W-004 — Backend API: Project Bootstrap

**Root cause:** The Backend API is the central service — it needs a working skeleton before any feature can be built.

**Goal:** A Node.js/TypeScript Express (or Fastify or Hono — choose one) project running on port 4000, with environment config, a health check endpoint, Postgres connection pool, and Jest/Vitest wired up.

**Approach:**
Initialise Node project in `backend/`. Install dependencies. Set up TypeScript config. Create folder structure. Wire Postgres connection. Add test runner. Add the first passing integration test (`GET /health → 200`).

---

- [ ] **RED — Integration (`backend/tests/health.test.ts`):**
  - [ ] Test: `GET http://localhost:4000/health` → assert HTTP 200, body `{ status: "ok" }`
  - [ ] **Run — confirm RED (server doesn't exist yet).**

- [ ] **GREEN — Backend Skeleton:**
  - [ ] `cd backend && npm init -y`
  - [ ] Install runtime deps: `express` (or `fastify`/`hono`), `pg` (or `postgres`), `bcryptjs`, `jose` (JWT), `zod`, `dotenv`, `cors`
  - [ ] Install dev deps: `typescript`, `ts-node`, `nodemon`, `vitest` (or `jest`), `supertest`, `@types/*`
  - [ ] Create `tsconfig.json` (strict mode, `"module": "CommonJS"`, `"outDir": "dist"`)
  - [ ] Create folder structure:
    ```
    backend/
      src/
        routes/
        services/
        repositories/
        middleware/
        types/
        lib/
      tests/
      migrations/
    ```
  - [ ] Create `src/app.ts` — Express app with `GET /health` route
  - [ ] Create `src/server.ts` — starts server on `process.env.PORT || 4000`
  - [ ] Create `src/lib/db.ts` — Postgres connection pool (`pg.Pool`) using `DATABASE_URL` env var
  - [ ] Create `backend/.env.example` with all required env vars
  - [ ] Run integration test — **confirm GREEN.**

---

#### W-005 — Postgres: Database Migrations

**Root cause:** The database needs all tables created before any feature can be tested against it.

**Goal:** All tables from `database_schema.md` created in the correct order with all indexes and seed data loaded.

**Approach:**
Write numbered SQL migration files. Write a migration runner script (`scripts/migrate.ts`) that applies them in order and tracks applied migrations in a `schema_migrations` table. Write a seeder script (`scripts/seed.ts`) for lookup data.

---

- [ ] **Setup — Migrations**
  - [ ] Create `backend/migrations/001_create_users.sql`
  - [ ] Create `backend/migrations/002_create_roles_permissions.sql`
  - [ ] Create `backend/migrations/003_create_departments_centres_shifts.sql`
  - [ ] Create `backend/migrations/004_create_employees.sql`
  - [ ] Create `backend/migrations/005_create_employee_sessions.sql`
  - [ ] Create `backend/migrations/006_create_break_types_policies.sql`
  - [ ] Create `backend/migrations/007_create_attendance_records.sql`
  - [ ] Create `backend/migrations/008_create_break_records.sql`
  - [ ] Create `backend/migrations/009_create_audit_logs.sql`
  - [ ] Create `backend/migrations/010_create_indexes.sql`
  - [ ] Create `backend/scripts/migrate.ts` — schema_migrations table + ordered runner
  - [ ] Create `backend/scripts/seed.ts` — roles, permissions, role_permissions, departments, centres, shifts, break_types, initial super admin user
  - [ ] Run: `npx ts-node scripts/migrate.ts && npx ts-node scripts/seed.ts`
  - [ ] Verify: connect via `psql` → all tables exist → `SELECT * FROM roles` returns 5 rows

---

#### W-006 — Test Database Setup

**Root cause:** Integration tests must run against a real database, not mocks. A separate test database prevents tests from corrupting development data.

**Goal:** A `jdconnect_test` database in the same Postgres container, with a `vitest.setup.ts` that runs migrations + seed on each test run and truncates between tests.

---

- [ ] **Setup — Test DB**
  - [ ] Create `jdconnect_test` database: `CREATE DATABASE jdconnect_test;`
  - [ ] Create `backend/vitest.config.ts` — set `TEST_DATABASE_URL` env pointing to `jdconnect_test`
  - [ ] Create `backend/tests/setup.ts`:
    - Before all: run migrations on test DB
    - Before each: truncate all tables (in correct FK order)
    - After all: close DB pool
  - [ ] Verify: run `vitest` → setup runs without errors → health test still passes

---

## Phase 1 — JWT Authentication

> **Goal:** The Backend API can register an employee (create user + employee record), log them in (return JWT), and validate JWT on protected routes. No Rocket.Chat integration yet — pure Backend API auth.

---

#### W-101 — User Registration / Employee Creation (No RC Provisioning Yet)

**Root cause:**
There is no way to create an employee record or user credentials in the new system. Without this, there is nobody to log in.

**Goal:**
`POST /api/employees` creates a `users` row (email + bcrypt password hash) and an `employees` row. Returns the new employee's data. Validates for duplicate emails.

**Approach:**
Repository inserts into `users` then `employees`. Service handles bcrypt hashing. Controller validates input with Zod. RC provisioning is NOT done yet — `rc_provisioned = false` until Phase 4.

---

- [ ] **RED — Integration (`tests/employees.test.ts`):**
  - [ ] Test: POST `/api/employees` with `{ full_name, email, password, role_key, department_id }` (as super_admin JWT) → assert HTTP 201, body contains `{ employee_id, employee_code, full_name, email, rc_provisioned: false }`, row in `users` table with bcrypt hash, row in `employees` table.
  - [ ] Test: POST `/api/employees` with duplicate `email` → assert HTTP 409 `{ error: "Email already exists" }`.
  - [ ] Test: POST `/api/employees` with missing `full_name` → assert HTTP 400 (Zod validation error).
  - [ ] Test: POST `/api/employees` without JWT → assert HTTP 401.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Repository] `src/repositories/user.repository.ts`: `createUser({ email, passwordHash })` → insert into `users`, return user.
  - [ ] [Repository] `src/repositories/employee.repository.ts`: `createEmployee({ authUserId, fullName, email, roleId, ... })` → insert into `employees`, return employee.
  - [ ] [Service] `src/services/employee.service.ts#createEmployee(data, actorRole)`:
        - Validate actor has `employees.manage` permission.
        - Check email uniqueness: `userRepository.findByEmail(email)`.
        - Hash password: `bcrypt.hash(password, 12)`.
        - Call `userRepository.createUser(...)`.
        - Call `employeeRepository.createEmployee(...)`.
        - Return combined result with `rc_provisioned: false`.
  - [ ] [Controller] `src/routes/employees.ts` POST `/`:
        - JWT auth middleware.
        - Zod schema: `{ full_name, email, password, role_key, department_id?, centre_id?, shift_id?, joining_date?, designation? }`.
        - Call `employeeService.createEmployee(...)`.
        - Return HTTP 201.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **RED — Unit (`tests/employee.service.unit.test.ts`):**
  - [ ] Mock `userRepository.findByEmail` → return null. Mock `userRepository.createUser` → return fake user. Mock `employeeRepository.createEmployee` → return fake employee. Call `employeeService.createEmployee(validData, 'super_admin')` → assert bcrypt was called, both repositories called with correct args.
  - [ ] Mock `userRepository.findByEmail` → return existing user. Assert service throws duplicate email error. Assert `createUser` NOT called.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — (No frontend component yet — Phase 5 is HR dashboard.)**

- [ ] **Verification chain:**
  - [ ] `POST /api/employees` with valid payload and super_admin JWT → 201 response.
  - [ ] `psql` → `SELECT * FROM users WHERE email = '...'` → row exists with hashed password.
  - [ ] `psql` → `SELECT * FROM employees WHERE email = '...'` → row exists, `rc_provisioned = false`.
  - [ ] ✅ Done.

---

#### W-102 — Login Endpoint (Issue JWT)

**Root cause:**
Without a login endpoint, no JWT can be obtained, and no protected routes can be called.

**Goal:**
`POST /api/auth/login` verifies email + password against Postgres, issues a signed JWT, and creates a session record.

**Approach:**
Repository finds user by email. Service compares bcrypt hash. If valid, generates RS256 JWT with `{ sub, employee_id, rc_user_id, roles }` payload. Writes session token hash to `employee_sessions`.

---

- [ ] **RED — Integration (`tests/auth.test.ts`):**
  - [ ] Test: POST `/api/auth/login` with valid `{ email, password }` → assert HTTP 200, body `{ access_token, token_type: "Bearer" }`, JWT decodes to correct `employee_id`.
  - [ ] Test: POST `/api/auth/login` with wrong password → assert HTTP 401.
  - [ ] Test: POST `/api/auth/login` with non-existent email → assert HTTP 401 (do NOT reveal whether email exists).
  - [ ] Test: POST `/api/auth/login` for suspended employee → assert HTTP 403.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Repository] `userRepository.findByEmail(email)` — SELECT from `users` JOIN `employees`.
  - [ ] [Service] `authService.login({ email, password })`:
        - Find user by email.
        - `bcrypt.compare(password, user.passwordHash)`.
        - Check `employee.employment_status === 'active'`.
        - Build JWT payload: `{ sub: user.id, employee_id, rc_user_id, roles: [role.key] }`.
        - Sign with RS256 private key, expiry 15min.
        - Hash token and insert into `employee_sessions`.
        - Return `{ access_token }`.
  - [ ] [Controller] `src/routes/auth.ts` POST `/login`:
        - No auth required.
        - Zod: `{ email: z.string().email(), password: z.string().min(1) }`.
        - Call `authService.login(...)`.
        - Return HTTP 200 with token.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] POST `/api/auth/login` with valid credentials → receive JWT.
  - [ ] Decode JWT at jwt.io → verify payload shape is correct.
  - [ ] `psql` → `SELECT * FROM employee_sessions` → session row exists.
  - [ ] POST `/api/auth/login` with wrong password → 401.
  - [ ] ✅ Done.

---

#### W-103 — JWT Auth Middleware

**Root cause:**
Without a reusable auth middleware, every route would have to re-implement token validation — error-prone and inconsistent.

**Goal:**
A middleware function that validates the Bearer JWT, looks up the employee, and attaches `req.employee` to the request. Returns 401 on any invalid token.

---

- [ ] **RED — Unit (`tests/auth.middleware.unit.test.ts`):**
  - [ ] Test: valid JWT → middleware calls `next()`, `req.employee` is populated with `{ id, rc_user_id, role }`.
  - [ ] Test: expired JWT → middleware returns HTTP 401 `{ error: "Token expired" }`.
  - [ ] Test: malformed token → HTTP 401 `{ error: "Invalid token" }`.
  - [ ] Test: no Authorization header → HTTP 401 `{ error: "No token provided" }`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN:**
  - [ ] `src/middleware/auth.ts`: extract `Authorization: Bearer {token}`, verify RS256 signature, decode payload, attach to `req.employee`, call `next()`.
  - [ ] Wire middleware into all protected routes.
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Call any protected endpoint with valid JWT → 200 (or route-appropriate response).
  - [ ] Call with expired/missing JWT → 401.
  - [ ] ✅ Done.

---

#### W-104 — Admin Password Reset

**Root cause:**
There is no self-service password reset. HR must be able to reset any employee's password from the dashboard.

**Goal:**
`POST /api/employees/:id/reset-password` accepts a new password, bcrypt-hashes it, and updates `users.password_hash`. Requires `hr.reset_password` permission.

---

- [ ] **RED — Integration (`tests/employees.test.ts`):**
  - [ ] Test: POST `/api/employees/:id/reset-password` with admin JWT + `{ new_password }` → assert HTTP 200, employee can now log in with new password.
  - [ ] Test: same endpoint without `hr.reset_password` permission → HTTP 403.
  - [ ] Test: non-existent employee id → HTTP 404.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Repository] `userRepository.updatePasswordHash(userId, newHash)`.
  - [ ] [Service] `employeeService.resetPassword(targetEmployeeId, newPassword, actorEmployee)`:
        - Check actor has `hr.reset_password` permission.
        - Find target employee → get `auth_user_id`.
        - `bcrypt.hash(newPassword, 12)`.
        - Call `userRepository.updatePasswordHash(...)`.
  - [ ] [Controller] POST `/api/employees/:id/reset-password`: JWT middleware + service call.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Admin PATCHes password for employee → 200.
  - [ ] Employee logs in with old password → 401.
  - [ ] Employee logs in with new password → 200, receives JWT.
  - [ ] ✅ Done.

---

## Phase 2 — Attendance API

> **Goal:** Backend API can record clock-in, clock-out, and retrieve attendance history. No RC app yet — test via `curl`/Postman.

---

#### W-201 — Clock-In Endpoint

**Root cause:** No endpoint exists to record when an employee starts their shift.

- [ ] **RED — Integration (`tests/attendance.test.ts`):**
  - [ ] POST `/api/attendance/clock-in` with valid JWT → HTTP 201, DB row created.
  - [ ] POST again (already clocked in) → HTTP 409.
  - [ ] No token → HTTP 401.
  - [ ] **Run — confirm RED.**
- [ ] **GREEN:** Repository (`findOpenRecord`, `createClockIn`) → Service (`clockIn(rc_user_id)`) → Controller (JWT middleware, route).
- [ ] **RED — Unit:** Service unit tests with mocked repositories.
- [ ] **GREEN:** Service implementation.
- [ ] **Verification chain:** POST clock-in → 201 → DB row exists with `clock_out_at = null`.

---

#### W-202 — Clock-Out Endpoint

**Root cause:** Clock-in without clock-out is incomplete — hours_worked and status cannot be computed.

- [ ] **RED — Integration:** POST `/api/attendance/clock-out` → HTTP 200, `clock_out_at` set, `hours_worked` computed, `status` set correctly (present/half_day/absent based on thresholds).
- [ ] Test: no open session → HTTP 400.
- [ ] **GREEN:** Repository (`findOpenRecord`, `updateClockOut`) → Service (`clockOut(rc_user_id)`) → Controller.
- [ ] **Verification chain:** Clock in → clock out → DB row complete with computed fields.

---

#### W-203 — Attendance History Endpoint

**Root cause:** HR dashboard and the employee themselves need to see past attendance.

- [ ] **RED — Integration:** GET `/api/attendance?employee_id=X&from=YYYY-MM-DD&to=YYYY-MM-DD` → HTTP 200, returns array of records scoped by permission.
- [ ] Test: employee JWT → sees only own records. Manager JWT → sees team records. Admin JWT → sees all.
- [ ] **GREEN:** Repository (`listAttendance(filters)`) → Service (`getAttendance(actorEmployee, filters)`) → Controller.
- [ ] **Verification chain:** Admin queries attendance for any employee → correct records returned.

---

## Phase 3 — Break API

> **Goal:** Backend API can start and end breaks, with duration auto-computation and break type validation.

---

#### W-301 — Start Break Endpoint

- [ ] **RED — Integration:** POST `/api/breaks/start` with `{ break_type_key }` → HTTP 201, break record created with `status = 'active'`.
- [ ] Test: employee not clocked in → HTTP 400 "Must be clocked in to start a break."
- [ ] Test: employee already on break → HTTP 409 "Already on a break."
- [ ] Test: invalid `break_type_key` → HTTP 400.
- [ ] **GREEN:** Break type lookup → effective limit lookup → insert `break_records`.
- [ ] **Verification chain:** Clocked-in employee starts break → record in DB → `status = 'active'`.

---

#### W-302 — End Break Endpoint

- [ ] **RED — Integration:** POST `/api/breaks/end` → HTTP 200, `end_at` set, `duration_minutes` computed, `status` = `'completed'` or `'exceeded'`.
- [ ] Test: no active break → HTTP 400.
- [ ] **GREEN:** Find active break → compute duration + status → update record.
- [ ] **Verification chain:** Break started → ended → DB row has duration and correct status.

---

#### W-303 — Break History Endpoint

- [ ] **RED — Integration:** GET `/api/breaks?employee_id=X&from=...&to=...` → HTTP 200, returns records scoped by permission.
- [ ] **GREEN:** Repository + scoping service + controller.

---

## Phase 4 — Rocket.Chat Integration

> **Goal:** When an employee is created in the Backend API, their Rocket.Chat account is also provisioned. SSO OAuth flow implemented so users can log in via RC and land in the chat.

---

#### W-401 — RC User Provisioning on Employee Create

- [ ] **RED — Integration:** POST `/api/employees` (with RC mock server running) → HTTP 201 → `employees.rocketchat_user_id` is populated → `employees.rc_provisioned = true`.
- [ ] Test: RC API call fails → employee still created, `rc_provisioned = false`, error surfaced in response.
- [ ] **GREEN:** After Postgres write, call RC Admin API `POST /api/v1/users.create`, store returned `_id`, update employee row.
- [ ] **Verification chain:** Create employee → navigate to RC admin panel → user exists with matching username/email.

---

#### W-402 — OAuth Server Endpoints (for RC SSO)

- [ ] **RED — Integration:** Test the full OAuth authorization code flow: `GET /oauth/authorize` redirects correctly, `POST /oauth/token` exchanges code for token, `GET /oauth/userinfo` returns correct shape for RC to map the user.
- [ ] **GREEN:** Implement all three endpoints following RC Custom OAuth spec.
- [ ] **Verification chain:** Configure RC Custom OAuth → employee navigates to RC login → SSO redirect → logs in → lands in RC chat without seeing RC's native login form.

---

## Phase 5 — Rocket.Chat Attendance App (RC Apps-Engine)

> **Goal:** A toolbar button in Rocket.Chat opens a clock-in/clock-out modal and a break dropdown. Actions call the Backend API.

---

#### W-501 — RC App Scaffold & Deployment

- [ ] Bootstrap a new RC Apps-Engine TypeScript project in `rc-app/`.
- [ ] Install RC Apps CLI: `npm install -g @rocket.chat/apps-cli`.
- [ ] Scaffold: `rc-apps create`.
- [ ] Configure `app.json` with name, version, required permissions.
- [ ] Deploy to local RC: `rc-apps deploy --url http://localhost:3100 --username admin --password ...`.
- [ ] **Verification chain:** Navigate to RC admin → Apps → see `JD Connect Attendance` app installed.

---

#### W-502 — Clock-In / Clock-Out Toolbar Button

- [ ] Implement toolbar action that calls `POST /api/attendance/clock-in` or `clock-out` on the Backend API.
- [ ] Display UIKit success/error notification.
- [ ] Handle already-clocked-in (409) gracefully.
- [ ] **Verification chain:** Employee clicks button → clocked in → clicks again → clocked out → HR dashboard reflects both events.

---

#### W-503 — Break Dropdown & Start/End Flow

- [ ] Fetch break types from Backend API on app load.
- [ ] On "Start Break" → show UIKit modal with break type dropdown (populated from API).
- [ ] On submit → call `POST /api/breaks/start`.
- [ ] On "End Break" → call `POST /api/breaks/end`.
- [ ] Display duration of active break in the toolbar button label.
- [ ] **Verification chain:** Employee selects "Bio Break" → break starts → duration ticks up → employee ends break → record in DB with correct type and duration.

---

## Phase 6 — HR Dashboard (Web App)

> **Goal:** HR can view employees, manage attendance, reset passwords, and see a workforce monitor — all via the separate HR web app.

---

#### W-601 — HR Dashboard Scaffold

- [ ] Bootstrap Next.js (or Vite React) project in `hr-dashboard/`.
- [ ] Set up routing, auth guard (check JWT cookie), API client (axios/fetch wrapper with base URL from env).
- [ ] Implement login page: POST to `/api/auth/login`, store JWT cookie on `.domain.com`.
- [ ] **Verification chain:** Navigate to HR dashboard → redirected to login → log in → see dashboard home.

---

#### W-602 — Employee List & Create

- [ ] Employee list page: GET `/api/employees` → table with search/filter.
- [ ] Create employee form: POST `/api/employees` → shows RC provisioning status.
- [ ] "Retry RC Provisioning" button for `rc_provisioned = false` employees.
- [ ] **Verification chain:** HR creates employee → appears in list → if RC failed → retry button visible → on retry → `rc_provisioned` becomes `true`.

---

#### W-603 — Attendance & Break History Views

- [ ] Attendance page: GET `/api/attendance?employee_id=X` → table with date range filter.
- [ ] Break history page: GET `/api/breaks?employee_id=X` → table with break type filter.
- [ ] Workforce monitor: GET `/api/workforce-monitor` → live count of logged-in / on-break / available.
- [ ] **Verification chain:** HR views any employee's attendance → correct records shown → workforce monitor reflects live state.

---

#### W-604 — Password Reset UI

- [ ] Employee detail page has "Reset Password" button (visible only to `hr.reset_password` role).
- [ ] Opens modal: new password input → POST `/api/employees/:id/reset-password`.
- [ ] **Verification chain:** HR resets password → employee logs in with new password → works.

---

## Phase 7 — Data Migration (Old System → New)

> **Goal:** Migrate employee and attendance data from the old Supabase Postgres to the new plain Postgres. Migrate chat history to Rocket.Chat via RC Admin API.

---

#### W-701 — ETL Script: Employees & Users

- [ ] Write `scripts/migrate-employees.ts`: reads from old DB → transforms → inserts into new `users` + `employees` tables.
- [ ] Map old `auth.users.id` → new `users.id`. Map old `employees.auth_user_id`.
- [ ] Skip non-HR tables (sales, documents, notes, reviews, etc.).
- [ ] Run against staging new DB first. Validate row counts.
- [ ] **Verification chain:** Row counts match between old and new. Employee codes preserved. All active employees have corresponding `users` rows.

---

#### W-702 — ETL Script: Attendance & Breaks

- [ ] Write `scripts/migrate-attendance.ts`: reads old `attendance_records` → insert into new `attendance_records`.
- [ ] Write `scripts/migrate-breaks.ts`: reads old `break_records` → insert into new `break_records`.
- [ ] Validate data integrity (no orphaned employee_id FKs).
- [ ] **Verification chain:** Attendance history visible in HR dashboard matches old system export.

---

#### W-703 — Chat Migration via RC REST API

- [ ] Write `scripts/migrate-chat.ts`: reads old `conversations`, `conversation_participants`, and `messages` → calls RC Admin REST API to create rooms and import messages.
- [ ] Map old `employees.id` → `employees.rocketchat_user_id` (RC user) for sender attribution.
- [ ] Run against staging RC first. Validate message counts.
- [ ] **Verification chain:** Key historical conversations visible in RC with correct senders and timestamps.

---

## Phase 8 — Production Deployment

> **Goal:** All four components running on Hostinger VPS with HTTPS, reverse proxy, proper secrets management, and monitoring.

---

#### W-801 — VPS Resource Check & Docker Production Compose

- [ ] SSH to VPS. Verify available RAM (MongoDB + Postgres + RC + Backend API + HR dashboard = check headroom).
- [ ] Write `docker/docker-compose.prod.yml` with all production services.
- [ ] Set up Traefik (or nginx) as reverse proxy with Let's Encrypt TLS.
- [ ] Configure subdomains: `chat.`, `hr.`, `api.` (or equivalent agreed subdomains).
- [ ] **Verification chain:** `https://chat.yourcompany.com` → Rocket.Chat. `https://hr.yourcompany.com` → HR dashboard. `https://api.yourcompany.com/health` → `{ status: "ok" }`.

---

#### W-802 — Secrets & Environment Hardening

- [ ] Move all secrets to environment variables (never committed).
- [ ] Generate production RS256 key pair for JWT signing.
- [ ] Set RC `ROOT_URL` and OAuth callback URLs to production domains.
- [ ] **Verification chain:** SSO login flow works on production domains end-to-end.

---

#### W-803 — Backup Strategy

- [ ] Automated daily Postgres dump (pg_dump → compressed → stored off-VPS or on mounted volume).
- [ ] MongoDB backup (mongodump → same strategy).
- [ ] Document recovery procedure.
- [ ] **Verification chain:** Run a restore drill on staging. Confirm data integrity post-restore.
