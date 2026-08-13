# Current State: JD Connect Implementation Tracker

This file is the **source of truth** for what is done, what is in progress, and what is next. Update this file as work progresses. An AI assistant starting a new session should read this file first to identify the current phase before writing any code.

**Legend:**
- `[ ]` Not started
- `[/]` In progress
- `[x]` Complete

---

## 1. Implementation Progress Summary

| Phase | Description | Status | Target Files |
|:---|:---|:---|:---|
| **Phase 0** | Project Setup & Infrastructure | **[/] IN PROGRESS** | `docker/docker-compose.yml`, `backend/package.json`, `backend/src/app.ts`, `backend/migrations/`, `backend/vitest.config.ts` |
| **Phase 1** | JWT Authentication | **[ ] NOT STARTED** | `backend/src/routes/auth.ts`, `backend/src/routes/employees.ts`, `backend/src/services/auth.service.ts`, `backend/src/services/employee.service.ts`, `backend/src/middleware/auth.ts` |
| **Phase 2** | Attendance API | **[ ] NOT STARTED** | `backend/src/routes/attendance.ts`, `backend/src/services/attendance.service.ts`, `backend/src/repositories/attendance.repository.ts` |
| **Phase 3** | Break API | **[ ] NOT STARTED** | `backend/src/routes/breaks.ts`, `backend/src/services/break.service.ts`, `backend/src/repositories/break.repository.ts` |
| **Phase 4** | Rocket.Chat Integration & SSO | **[ ] NOT STARTED** | `backend/src/services/rocketchat.service.ts`, `backend/src/routes/oauth.ts`, `backend/src/services/oauth.service.ts` |
| **Phase 5** | Rocket.Chat Attendance App (RC Apps-Engine) | **[ ] NOT STARTED** | `rc-app/app.json`, `rc-app/src/handlers/`, `rc-app/src/modals/`, `rc-app/src/types/` |
| **Phase 6** | HR Dashboard (Web App) | **[ ] NOT STARTED** | `hr-dashboard/src/app/`, `hr-dashboard/src/components/`, `hr-dashboard/src/lib/api.ts` |
| **Phase 7** | Data Migration (Old System → New) | **[ ] NOT STARTED** | `backend/scripts/migrate-employees.ts`, `backend/scripts/migrate-attendance.ts`, `backend/scripts/migrate-chat.ts` |
| **Phase 8** | Production Deployment | **[ ] NOT STARTED** | `docker/docker-compose.prod.yml`, `docker/nginx.conf`, backup scripts |

---

## 2. Phase-by-Phase Checklist (TDD Style)

---

### Phase 0 — Project Setup & Infrastructure

> **Goal:** Have a working local development environment: plain Postgres container running, Backend API skeleton bootstrapped, RC Docker stack running with MongoDB replica set, database migrations/seeders active, and test database configured.

---

#### W-001 — Repository & Monorepo Structure

**Root cause:** Starting from scratch — no workspace directory layout exists yet for the four system components.

**Goal:** A clean monorepo with top-level directories: `backend/`, `rc-app/`, `hr-dashboard/`, `docker/`, root `.gitignore`, `.env.example`, and root `package.json`.

**Approach:** Initialize git repository, configure `.gitignore` for Node/TypeScript/Docker environments, add workspace definitions in root `package.json`, and set up folder scaffolding.

---

- [x] **RED — Infrastructure Check:**
  - [x] Check workspace directories `backend/`, `rc-app/`, `hr-dashboard/`, `docker/`.
  - [x] **Run — confirm RED (directories do not exist yet).**

- [x] **GREEN — Monorepo Scaffolding:**
  - [x] [Schema/Files] Create root `.gitignore` (node_modules, dist, .env, coverage, logs).
  - [x] [Files] Create root `README.md` with architecture diagram.
  - [x] [Files] Create workspace folders: `backend/`, `rc-app/`, `hr-dashboard/`, `docker/`.
  - [x] [Files] Create root `package.json` with npm/pnpm workspace definitions.
  - [x] Run infrastructure check — **confirm GREEN.**

- [x] **RED — Unit Check:**
  - [x] Validate workspace package resolution.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Workspace Verification:**
  - [x] Run `pnpm install` at root — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `ls` at root → `backend/`, `rc-app/`, `hr-dashboard/`, `docker/` exist.
  - [x] `git status` → untracked files clean according to `.gitignore`.
  - [x] ✅ Done.

---

#### W-002 — Docker Infrastructure: Postgres Container

**Root cause:** The Backend API requires a plain Postgres 16 database, replacing the legacy multi-container Supabase stack.

**Goal:** A single `postgres:16-alpine` container running locally on port 5432 with a named volume `pgdata` and a healthy `pg_isready` check.

**Approach:** Write `docker/docker-compose.yml` defining the `postgres` service and network. Document credentials in `docker/.env.example`.

---

- [x] **RED — Integration:**
  - [x] Command: `docker compose -f docker/docker-compose.yml exec postgres psql -U postgres -c "\l"`
  - [x] **Run — confirm RED (container not running yet).**

- [x] **GREEN — Docker Postgres:**
  - [x] Create `docker/docker-compose.yml` with service `postgres`:
        - Image: `postgres:16-alpine`
        - Ports: `5432:5432`
        - Environment: `POSTGRES_DB=jdconnect`, `POSTGRES_USER=jduser`, `POSTGRES_PASSWORD=jdpassword`
        - Volume: `pgdata:/var/lib/postgresql/data`
        - Healthcheck: `pg_isready -U jduser -d jdconnect`
  - [x] Create `docker/.env.example` and `docker/.env`.
  - [x] Run `docker compose -f docker/docker-compose.yml up -d postgres`.
  - [x] Run integration check — **confirm GREEN.**

- [x] **RED — Unit Check:**
  - [x] Test DB connection script against `localhost:5432`.
  - [x] **Run — confirm RED (before DB container start).**

- [x] **GREEN — Connection Test:**
  - [x] Verify container is healthy via `docker ps` — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `docker compose ps` shows `postgres` status `healthy`.
  - [x] Connect via `psql -h localhost -U jduser -d jdconnect` → success.
  - [x] ✅ Done.

---

#### W-003 — Docker Infrastructure: MongoDB Replica Set + Rocket.Chat

**Root cause:** Rocket.Chat 8.x strictly requires MongoDB running as a replica set (`rs0`).

**Goal:** MongoDB container running with `--replSet rs0`, a single-node replica set initialized via `rs.initiate()`, and a Rocket.Chat 8.x container running on host port 3100.

**Approach:** Add `mongo`, `mongo-init`, and `rocketchat` services to `docker/docker-compose.yml`.

---

- [x] **RED — Integration:**
  - [x] Test: `curl http://localhost:3100/api/v1/info`
  - [x] **Run — confirm RED (Rocket.Chat container not running).**

- [x] **GREEN — Rocket.Chat Stack:**
  - [x] Add `mongo` service (`mongo:7`, `--replSet rs0 --bind_ip_all`, volume `mongodata`).
  - [x] Add `mongo-init` helper service running:
        `rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] })`.
  - [x] Add `rocketchat` service (`rocket.chat:8`, `MONGO_URL=mongodb://mongo:27017/rocketchat?replicaSet=rs0`, `PORT=3000`, published port `3100:3000`).
  - [x] Run `docker compose -f docker/docker-compose.yml up -d`.
  - [x] Run integration test (`curl http://localhost:3100/api/v1/info`) — **confirm GREEN.**

- [x] **RED — Unit Check:**
  - [x] Query Mongo replica set status `rs.status()` inside container.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Mongo Replica Set Verification:**
  - [x] Confirm `rs.status().ok === 1` in mongo container — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Open `http://localhost:3100` in browser → Rocket.Chat setup wizard appears.
  - [x] Complete initial setup wizard, create admin account.
  - [x] Store Admin credentials in `docker/.env`.
  - [x] ✅ Done.

---

#### W-004 — Backend API: Project Bootstrap

**Root cause:** The Backend API is the core middleman service and requires an Express/TypeScript project skeleton with health check, DB connection pool, and test framework.

**Goal:** Node.js/TypeScript Express project in `backend/` running on port 4000, exposing `GET /health` with Vitest configured.

**Approach:** Initialize `backend/package.json`, install dependencies (`express`, `pg`, `bcryptjs`, `jose`, `zod`, `vitest`), setup `tsconfig.json`, `src/app.ts`, `src/server.ts`, and `src/lib/db.ts`.

---

- [ ] **RED — Integration (`backend/tests/health.test.ts`):**
  - [ ] Test: `GET http://localhost:4000/health` → assert HTTP 200 `{ status: "ok" }`.
  - [ ] **Run — confirm RED (server not created yet).**

- [ ] **GREEN — Backend Skeleton:**
  - [ ] `cd backend && npm init -y`
  - [ ] Install runtime deps: `express`, `pg`, `bcryptjs`, `jose`, `zod`, `dotenv`, `cors`.
  - [ ] Install dev deps: `typescript`, `ts-node`, `nodemon`, `vitest`, `supertest`, `@types/*`.
  - [ ] Create `tsconfig.json` (strict mode, `outDir: "dist"`).
  - [ ] Create `src/app.ts` with `GET /health` route handler.
  - [ ] Create `src/server.ts` listening on `PORT || 4000`.
  - [ ] Create `src/lib/db.ts` initializing `pg.Pool` using `DATABASE_URL`.
  - [ ] Run `npx vitest tests/health.test.ts` — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/db.unit.test.ts`):**
  - [ ] Test: execute `SELECT 1` via `src/lib/db.ts` pool → assert returns 1.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — DB Pool Unit Test:**
  - [ ] Verify `src/lib/db.ts` returns active connection — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Start server: `npm run dev` in `backend/`.
  - [ ] `curl http://localhost:4000/health` → `{ status: "ok" }`.
  - [ ] ✅ Done.

---

#### W-005 — Postgres: Database Migrations & Seeding

**Root cause:** All tables from `database_schema.md` must be created in Postgres with initial seed data loaded (roles, permissions, departments, centres, shifts, break types).

**Goal:** Numbered SQL migration files `001_` through `010_` applied via `scripts/migrate.ts`, and `scripts/seed.ts` seeding core domain constants.

**Approach:** Write migration SQL scripts creating ENUMs, tables, indexes, and FK constraints. Build JS runner that tracks migrations in `schema_migrations`.

---

- [ ] **RED — Integration (`backend/tests/migrations.test.ts`):**
  - [ ] Test: Query Postgres `information_schema.tables` → assert tables `users`, `employees`, `roles`, `attendance_records`, `break_records`, etc., exist.
  - [ ] **Run — confirm RED (tables do not exist).**

- [ ] **GREEN — Migrations & Seed:**
  - [ ] [Schema] Create SQL migrations:
    - `001_create_users.sql`
    - `002_create_roles_permissions.sql`
    - `003_create_departments_centres_shifts.sql`
    - `004_create_employees.sql`
    - `005_create_employee_sessions.sql`
    - `006_create_break_types_policies.sql`
    - `007_create_attendance_records.sql`
    - `008_create_break_records.sql`
    - `009_create_audit_logs.sql`
    - `010_create_indexes.sql`
  - [ ] [Script] `backend/scripts/migrate.ts` — migration runner.
  - [ ] [Script] `backend/scripts/seed.ts` — seeds 5 roles, 11 permissions, 7 departments, 2 centres, 1 shift (Night Shift 09:00–18:00 EST), 5 break types (bio, tea, dinner, smoke, meeting), super admin user.
  - [ ] Run `npx ts-node scripts/migrate.ts && npx ts-node scripts/seed.ts`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/seed.unit.test.ts`):**
  - [ ] Test: `SELECT COUNT(*) FROM roles` → assert 5. `SELECT COUNT(*) FROM break_types` → assert 5.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Seed Unit Test:**
  - [ ] Verify query returns seeded row counts — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Run `psql -U jduser -d jdconnect -c "SELECT key, name FROM roles;"` → lists super_admin, admin, manager, team_leader, employee.
  - [ ] ✅ Done.

---

#### W-006 — Test Database Setup

**Root cause:** Integration tests require a dedicated `jdconnect_test` database to avoid corrupting development data.

**Goal:** Automatic test database creation, migration runner in `vitest.setup.ts`, and table truncation before each test suite execution.

**Approach:** Configure `backend/vitest.config.ts` with `TEST_DATABASE_URL` pointing to `jdconnect_test`. Write `tests/setup.ts` to run migrations before tests and truncate tables between tests.

---

- [ ] **RED — Integration (`backend/tests/setup.test.ts`):**
  - [ ] Test: Insert dummy user in test DB → run cleanup hook → assert table is empty.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Test DB Config:**
  - [ ] Run `psql -c "CREATE DATABASE jdconnect_test;"`.
  - [ ] Create `backend/vitest.config.ts` pointing to `jdconnect_test`.
  - [ ] Create `backend/tests/setup.ts`:
        - `beforeAll`: run `migrate.ts` on `jdconnect_test`.
        - `beforeEach`: truncate all domain tables (`TRUNCATE users, employees, attendance_records, break_records CASCADE`).
        - `afterAll`: close pool.
  - [ ] Run `npx vitest tests/setup.test.ts` — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/db_isolation.unit.test.ts`):**
  - [ ] Test: Verify `process.env.NODE_ENV === 'test'` uses `jdconnect_test`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Isolation Check:**
  - [ ] Confirm connection string points to `jdconnect_test` — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] `npm test` runs across all tests without DB deadlocks or cross-test data pollution.
  - [ ] ✅ Done.

---

### Phase 1 — JWT Authentication

> **Goal:** The Backend API can register employees (creating user + employee records), issue asymmetric RS256 JWTs on login, enforce active single-session tracking, guard routes via auth middleware, and support HR-initiated password resets.

---

#### W-101 — User Registration / Employee Creation (No RC Provisioning Yet)

**Root cause:** No endpoint exists to create employee profiles and underlying auth user credentials in Postgres.

**Goal:** `POST /api/employees` creates a `users` record (`email`, `bcrypt` hash) and an `employees` record. Returns employee profile with `rc_provisioned: false`. Enforces `employees.manage` permission.

**Approach:** Repository layer handles Postgres insertion for `users` and `employees`. Service layer validates permission, checks email uniqueness, and hashes password using `bcrypt` (rounds = 12). Controller applies Zod schema and JWT guard.

---

- [ ] **RED — Integration (`backend/tests/employees.test.ts`):**
  - [ ] Test: `POST /api/employees` with `{ full_name, email, password, role_key, department_id }` as super_admin JWT → assert HTTP 201, body `{ id, employee_code, full_name, email, rc_provisioned: false }`, row in `users`, row in `employees`.
  - [ ] Test: `POST /api/employees` with existing email → assert HTTP 409 `{ error: "Email already exists" }`.
  - [ ] Test: `POST /api/employees` without JWT → assert HTTP 401.
  - [ ] Test: `POST /api/employees` with caller lacking `employees.manage` → assert HTTP 403.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed — `users` and `employees` exist per `database_schema.md`.
  - [ ] [Repository] `src/repositories/user.repository.ts`: `createUser({ email, passwordHash })`.
  - [ ] [Repository] `src/repositories/employee.repository.ts`: `createEmployee(data)`.
  - [ ] [Service] `src/services/employee.service.ts#createEmployee`:
        - Verify caller has `employees.manage` permission.
        - Check email uniqueness via `userRepository.findByEmail(email)`.
        - Hash password: `bcrypt.hash(password, 12)`.
        - Call `userRepository.createUser` then `employeeRepository.createEmployee`.
        - Return employee record with `rc_provisioned: false`.
  - [ ] [Controller] `src/routes/employees.ts` `POST /`:
        - Apply JWT auth middleware (`src/middleware/auth.ts`).
        - Zod schema validation: `{ full_name, email, password, role_key, department_id?, centre_id?, shift_id?, designation? }`.
        - Call `employeeService.createEmployee`.
        - Return HTTP 201.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/employee.service.unit.test.ts`):**
  - [ ] Mock `userRepository.findByEmail` → return null. Mock `userRepository.createUser` → fake user. Mock `employeeRepository.createEmployee` → fake employee. Call `employeeService.createEmployee` → assert bcrypt called, repositories called with correct arguments.
  - [ ] Mock `userRepository.findByEmail` → return existing user. Assert service throws `DuplicateEmailError`. Assert `createUser` NOT called.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Service Logic:**
  - [ ] [Type] `src/types/employee.ts` — export `CreateEmployeeInput`, `EmployeeResponse`.
  - [ ] Implement service methods — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] `POST /api/employees` with valid payload and super_admin JWT → 201 created response.
  - [ ] `psql` check `SELECT * FROM users WHERE email = 'test@company.com'` → row exists with bcrypt hash (`$2b$12$...`).
  - [ ] `psql` check `SELECT * FROM employees WHERE email = 'test@company.com'` → row exists, `rc_provisioned = false`.
  - [ ] ✅ Done.

---

#### W-102 — Login Endpoint (Issue JWT & Session Tracking)

**Root cause:** Without a login endpoint, users cannot obtain JWT tokens to authenticate subsequent requests.

**Goal:** `POST /api/auth/login` verifies credentials, enforces active status, generates RS256 JWT, writes session token hash to `employee_sessions`, and returns `{ access_token, token_type: "Bearer" }`.

**Approach:** `userRepository` queries user and linked employee details. `authService` verifies bcrypt password, checks `employment_status === 'active'`, constructs JWT payload (`sub`, `employee_id`, `rc_user_id`, `roles`), signs with RS256 private key, and logs session in `employee_sessions`.

---

- [ ] **RED — Integration (`backend/tests/auth.test.ts`):**
  - [ ] Test: `POST /api/auth/login` with valid `{ email, password }` → assert HTTP 200, body `{ access_token, token_type: "Bearer" }`, decoded JWT contains `employee_id` and `rc_user_id`.
  - [ ] Test: `POST /api/auth/login` with wrong password → assert HTTP 401.
  - [ ] Test: `POST /api/auth/login` with non-existent email → assert HTTP 401 (do NOT reveal email non-existence).
  - [ ] Test: `POST /api/auth/login` for suspended employee → assert HTTP 403 `{ error: "Account suspended" }`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed — `employee_sessions` exists per `database_schema.md`.
  - [ ] [Repository] `src/repositories/user.repository.ts#findAuthUserByEmail`: JOIN `users`, `employees`, `roles`.
  - [ ] [Repository] `src/repositories/session.repository.ts#createSession`: INSERT into `employee_sessions`.
  - [ ] [Service] `src/services/auth.service.ts#login`:
        - Find user by email.
        - Verify bcrypt: `bcrypt.compare(password, user.password_hash)`.
        - Check `employee.employment_status === 'active'`.
        - Payload: `{ sub: user.id, employee_id: employee.id, rc_user_id: employee.rocketchat_user_id, roles: [role.key] }`.
        - Sign JWT with RS256 private key (`jose` library, 15m expiration).
        - Save session token hash in `employee_sessions`.
        - Return `{ access_token, token_type: "Bearer" }`.
  - [ ] [Controller] `src/routes/auth.ts` `POST /login`:
        - Zod schema: `{ email: z.string().email(), password: z.string().min(1) }`.
        - Call `authService.login`.
        - Return HTTP 200.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/auth.service.unit.test.ts`):**
  - [ ] Mock user with invalid password → assert `login` throws `InvalidCredentialsError`.
  - [ ] Mock employee with status `'suspended'` → assert `login` throws `AccountSuspendedError`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Auth Logic:**
  - [ ] [Type] `src/types/auth.ts` — export `LoginInput`, `JwtPayload`, `AuthResponse`.
  - [ ] Implement service methods — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] `POST /api/auth/login` with valid email & password → HTTP 200 with JWT token.
  - [ ] Decode JWT at jwt.io → verify `sub`, `employee_id`, `rc_user_id`, `roles` payload.
  - [ ] Query Postgres `employee_sessions` table → session row present and active.
  - [ ] ✅ Done.

---

#### W-103 — JWT Auth Middleware & Role Scoping

**Root cause:** Protected routes require a central middleware to validate JWT Bearer tokens and attach employee context.

**Goal:** Middleware `src/middleware/auth.ts` extracts `Authorization: Bearer <token>`, verifies RS256 signature, decodes payload, attaches `req.employee`, and checks requested permission keys.

**Approach:** Use `jose` to verify JWT signature against public key. Query employee details if necessary. Expose helper `requirePermission(permissionKey)` middleware.

---

- [ ] **RED — Unit (`backend/tests/auth.middleware.unit.test.ts`):**
  - [ ] Test: valid JWT → calls `next()`, populates `req.employee` with `{ id, rc_user_id, roles, permissions }`.
  - [ ] Test: expired JWT → returns HTTP 401 `{ error: "Token expired" }`.
  - [ ] Test: malformed token → returns HTTP 401 `{ error: "Invalid token" }`.
  - [ ] Test: missing header → returns HTTP 401 `{ error: "No token provided" }`.
  - [ ] Test: user lacking permission → returns HTTP 403 `{ error: "Insufficient permissions" }`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Middleware:**
  - [ ] [Middleware] `src/middleware/auth.ts#authenticateJwt`:
        - Extract Bearer token from header.
        - Verify RS256 signature using `jose.jwtVerify`.
        - Attach `req.employee = { id: payload.employee_id, rc_user_id: payload.rc_user_id, roles: payload.roles }`.
        - Call `next()`.
  - [ ] [Middleware] `src/middleware/auth.ts#requirePermission(permissionKey)`:
        - Fetch active permissions for `req.employee.roles` from DB cache.
        - If permission key missing → return HTTP 403.
        - Else call `next()`.
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **RED — Integration (`backend/tests/protected_route.test.ts`):**
  - [ ] Test: Request protected route `/api/employees` without header → 401. With valid JWT → 200.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Route Integration:**
  - [ ] Wire middleware onto `/api/employees` routes — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Call protected endpoint with valid JWT → success.
  - [ ] Call protected endpoint with tampered JWT → HTTP 401.
  - [ ] ✅ Done.

---

#### W-104 — Admin Password Reset Endpoint

**Root cause:** Password resets are strictly admin/HR initiated — there is no self-service email flow.

**Goal:** `POST /api/employees/:id/reset-password` accepts `{ new_password }`, hashes it with bcrypt, and updates `users.password_hash`. Protected by `hr.reset_password` permission.

**Approach:** Controller checks `hr.reset_password` permission key. Service finds employee's `auth_user_id`, generates new bcrypt hash (rounds = 12), and calls `userRepository.updatePasswordHash`.

---

- [ ] **RED — Integration (`backend/tests/password_reset.test.ts`):**
  - [ ] Test: `POST /api/employees/:id/reset-password` with `{ new_password: "NewSecret123!" }` as admin (has `hr.reset_password`) → assert HTTP 200 `{ message: "Password updated successfully" }`. Target user logs in with new password.
  - [ ] Test: Same endpoint called by standard employee (lacks permission) → assert HTTP 403.
  - [ ] Test: Same endpoint for non-existent employee ID → assert HTTP 404.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed.
  - [ ] [Repository] `src/repositories/user.repository.ts#updatePasswordHash(userId, passwordHash)`.
  - [ ] [Service] `src/services/employee.service.ts#resetPassword`:
        - Verify caller has `hr.reset_password` permission.
        - Find employee by ID -> extract `auth_user_id`.
        - Hash new password using `bcrypt.hash(newPassword, 12)`.
        - Update password in Postgres `users` table.
  - [ ] [Controller] `src/routes/employees.ts` `POST /:id/reset-password`:
        - JWT guard + `requirePermission('hr.reset_password')`.
        - Zod schema: `{ new_password: z.string().min(8) }`.
        - Call `employeeService.resetPassword`.
        - Return HTTP 200.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/password_reset.unit.test.ts`):**
  - [ ] Mock service call without required permission → assert throws `ForbiddenError`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Reset Logic:**
  - [ ] Implement password reset service validation — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Admin sends `POST /api/employees/<emp-id>/reset-password` with `{ new_password: "ChangedPass123" }` → 200 OK.
  - [ ] Employee logs in with old password → 401 Unauthorized.
  - [ ] Employee logs in with `"ChangedPass123"` → 200 OK with valid JWT.
  - [ ] ✅ Done.

---

### Phase 2 — Attendance API

> **Goal:** Backend API handles clock-in, clock-out with automatic work hours computation and status classification in EST timezone, and provides scoped attendance history endpoints.

---

#### W-201 — Clock-In Endpoint

**Root cause:** No endpoint exists for employees to record shift start timestamps.

**Goal:** `POST /api/attendance/clock-in` creates an `attendance_records` row with `clock_in_at = NOW()`, `work_date = TODAY (EST)`. Prevents duplicate clock-ins for the same day (returns HTTP 409). Decoupled from RC presence.

**Approach:** Derive `rc_user_id` from verified JWT payload (`req.employee.rc_user_id`). Service looks up Postgres employee, checks for an existing open record (`clock_out_at IS NULL AND work_date = TODAY_EST`), and inserts a new record.

---

- [ ] **RED — Integration (`backend/tests/attendance.test.ts`):**
  - [ ] Test: `POST /api/attendance/clock-in` with valid Bearer JWT → assert HTTP 201, body `{ id, work_date, clock_in_at, status: "absent" }`, DB row created with `clock_out_at` null.
  - [ ] Test: `POST /api/attendance/clock-in` again on same day → assert HTTP 409 `{ error: "Already clocked in for today" }`. DB row count remains 1.
  - [ ] Test: `POST /api/attendance/clock-in` with no JWT → assert HTTP 401.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed — `attendance_records` exists per `database_schema.md`.
  - [ ] [Repository] `src/repositories/attendance.repository.ts`:
        - `findOpenRecord(employeeId, workDate)`: SELECT WHERE `employee_id = $1 AND work_date = $2 AND clock_out_at IS NULL`.
        - `createClockIn(employeeId, workDate, clockInAt)`: INSERT into `attendance_records`.
  - [ ] [Service] `src/services/attendance.service.ts#clockIn(rcUserId)`:
        - Resolve employee: `employeeRepository.findByRocketChatId(rcUserId)`.
        - Convert current time to EST date string (`YYYY-MM-DD`).
        - Check open record: if exists → throw `AlreadyClockedInError`.
        - Note: Write ONLY to Postgres. NEVER read/write Rocket.Chat presence.
        - Call `attendanceRepository.createClockIn`.
  - [ ] [Controller] `src/routes/attendance.ts` `POST /clock-in`:
        - Apply JWT auth middleware (`req.employee`).
        - Call `attendanceService.clockIn(req.employee.rc_user_id)`.
        - Return HTTP 201 with serialized record. Catch `AlreadyClockedInError` → HTTP 409.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/attendance.service.unit.test.ts`):**
  - [ ] Mock `findOpenRecord` returning active record → assert `clockIn` throws `AlreadyClockedInError`.
  - [ ] Mock `findOpenRecord` returning null → assert `createClockIn` called with employee ID and EST timestamp.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Clock-In Logic:**
  - [ ] [Type] `src/types/attendance.ts` — export `AttendanceRecord`, `ClockInResponse`.
  - [ ] Implement service methods — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Send `POST /api/attendance/clock-in` with employee JWT → 201 response.
  - [ ] Query Postgres `attendance_records` → row exists with `work_date = TODAY_EST` and `clock_out_at IS NULL`.
  - [ ] Send `POST /api/attendance/clock-in` again → 409 Conflict error response.
  - [ ] ✅ Done.

---

#### W-202 — Clock-Out Endpoint & Work Duration Calculation

**Root cause:** Clock-ins must be completed by clock-outs to calculate `hours_worked`, `status`, and `is_late` based on shift thresholds.

**Goal:** `POST /api/attendance/clock-out` updates the open `attendance_records` row with `clock_out_at = NOW()`, computes `hours_worked = ROUND((clock_out_at - clock_in_at)/3600, 2)`, and evaluates attendance `status` and `is_late` based on EST shift rules.

**Approach:** Service computes `hours_worked`. Evaluates rules:
- `hours_worked < 6` OR clock-in after 09:30 AM EST → `status = 'half_day'`, `is_late = false`.
- `hours_worked >= 6` AND clock-in between 09:15–09:30 AM EST → `status = 'late'`, `is_late = true`.
- `hours_worked >= 6` AND clock-in <= 09:15 AM EST → `status = 'present'`, `is_late = false`.

---

- [ ] **RED — Integration (`backend/tests/clock_out.test.ts`):**
  - [ ] Test: `POST /api/attendance/clock-out` with open clock-in (clocked in at 09:00 AM EST, clocking out at 06:00 PM EST = 9 hrs) → assert HTTP 200, `hours_worked = 9.00`, `status = "present"`, `is_late = false`.
  - [ ] Test: `POST /api/attendance/clock-out` with clock-in at 09:20 AM EST and 8 hrs worked → assert HTTP 200, `status = "late"`, `is_late = true`.
  - [ ] Test: `POST /api/attendance/clock-out` with clock-in at 09:00 AM EST but only 4 hrs worked → assert HTTP 200, `status = "half_day"`, `is_late = false` (hours < 6 priority rule).
  - [ ] Test: `POST /api/attendance/clock-out` when not clocked in → assert HTTP 400 `{ error: "No open clock-in record found for today" }`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed.
  - [ ] [Repository] `src/repositories/attendance.repository.ts#updateClockOut(id, clockOutAt, hoursWorked, status, isLate)`.
  - [ ] [Service] `src/services/attendance.service.ts#clockOut(rcUserId)`:
        - Resolve employee via `rcUserId`.
        - Find open attendance record for today (EST). If missing → throw `NoOpenClockInError`.
        - Compute `hours_worked`: `ROUND((clockOutAt.getTime() - clockInAt.getTime()) / 3600000, 2)`.
        - Evaluate `computeAttendanceStatus(clockInAtEST, shiftStartEST, hoursWorked)` using business constants from `database_schema.md` Section 6.
        - Note: Write ONLY to Postgres. NEVER alter Rocket.Chat presence status.
        - Call `attendanceRepository.updateClockOut`.
  - [ ] [Controller] `src/routes/attendance.ts` `POST /clock-out`:
        - Apply JWT middleware.
        - Call `attendanceService.clockOut(req.employee.rc_user_id)`.
        - Return HTTP 200 with updated record. Catch `NoOpenClockInError` → HTTP 400.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/attendance_status.unit.test.ts`):**
  - [ ] Test pure function `computeAttendanceStatus`:
        - 09:05 AM clock in, 8 hrs → `{ status: 'present', isLate: false }`.
        - 09:20 AM clock in, 8 hrs → `{ status: 'late', isLate: true }`.
        - 09:35 AM clock in, 8 hrs → `{ status: 'half_day', isLate: false }`.
        - 09:00 AM clock in, 5 hrs → `{ status: 'half_day', isLate: false }`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Status Logic:**
  - [ ] Implement `computeAttendanceStatus` function in `src/services/attendance.service.ts` — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Clock in employee → Clock out employee after simulation → 200 OK.
  - [ ] Query Postgres `attendance_records` → `clock_out_at`, `hours_worked`, `status`, and `is_late` correctly calculated.
  - [ ] ✅ Done.

---

#### W-203 — Attendance History & Scoped Query Endpoint

**Root cause:** Employees, managers, and HR need to view attendance logs filtered by date range and restricted by role permissions.

**Goal:** `GET /api/attendance?employee_id=X&from=YYYY-MM-DD&to=YYYY-MM-DD` returns array of attendance records. Enforces role scoping (`attendance.view_own`, `attendance.view_team`, `attendance.view_all`).

**Approach:** Middleware validates JWT and checks permissions. Service applies query scoping:
- `employee`: forced filter `employee_id = req.employee.id`.
- `manager` / `team_leader`: forced filter `employee_id IN (subordinates of req.employee.id)`.
- `admin` / `super_admin`: allowed to query any `employee_id` or all employees.

---

- [ ] **RED — Integration (`backend/tests/attendance_history.test.ts`):**
  - [ ] Test: Employee JWT requests `GET /api/attendance` → returns array containing ONLY own records.
  - [ ] Test: Employee JWT requests `GET /api/attendance?employee_id=<other-emp-id>` → returns HTTP 403.
  - [ ] Test: Manager JWT requests `GET /api/attendance` → returns records for direct reports.
  - [ ] Test: Admin JWT requests `GET /api/attendance?from=2026-08-01&to=2026-08-31` → returns all company attendance records.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed.
  - [ ] [Repository] `src/repositories/attendance.repository.ts#findAttendanceRecords({ employeeIds, fromDate, toDate })`.
  - [ ] [Service] `src/services/attendance.service.ts#getAttendanceHistory(actorEmployee, filters)`:
        - Determine allowed employee ID list based on `actorEmployee.roles` and permissions.
        - If `attendance.view_all` → allow requested `employee_id` filter or all.
        - Else if `attendance.view_team` → query team member IDs via `employeeRepository.findSubordinates(actorEmployee.id)`, intersect with requested filter.
        - Else (`attendance.view_own`) → restrict strictly to `[actorEmployee.id]`.
        - Call `attendanceRepository.findAttendanceRecords`.
  - [ ] [Controller] `src/routes/attendance.ts` `GET /`:
        - JWT middleware guard.
        - Parse query parameters: `employee_id`, `from`, `to`.
        - Call `attendanceService.getAttendanceHistory`.
        - Return HTTP 200 array.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/attendance_scoping.unit.test.ts`):**
  - [ ] Mock actor employee as `employee` role querying another ID → assert service throws `ForbiddenError`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Scoping Logic:**
  - [ ] Implement role permission scoping in service — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Log in as standard employee -> `GET /api/attendance` -> only own records returned.
  - [ ] Log in as admin -> `GET /api/attendance` -> full company records returned with summary counts.
  - [ ] ✅ Done.

---

### Phase 3 — Break API

> **Goal:** Backend API supports starting and ending breaks, computes break duration and overtime status (`completed` / `exceeded`) against break policy limits, and provides break monitoring history.

---

#### W-301 — Start Break Endpoint

**Root cause:** No endpoint exists to record when an employee begins a break (bio, tea, dinner, smoke, meeting).

**Goal:** `POST /api/breaks/start` with `{ break_type_key }` creates a `break_records` row with `status = 'active'`, `start_at = NOW()`. Requires caller to be currently clocked in. Prevents starting a break while another break is active. Decoupled from RC presence.

**Approach:** Resolve employee via `rc_user_id` from JWT. Verify employee has an active clock-in for today. Check for an existing break with `status = 'active'`. Fetch effective limit from `break_policies` (or default from `break_types`). Insert `break_records` row.

---

- [ ] **RED — Integration (`backend/tests/breaks.test.ts`):**
  - [ ] Test: Clocked-in employee calls `POST /api/breaks/start` with `{ break_type_key: "tea" }` → assert HTTP 201, body `{ id, break_type_key: "tea", status: "active", limit_minutes: 15 }`. DB row created in `break_records`.
  - [ ] Test: Employee not clocked in calls `POST /api/breaks/start` → assert HTTP 400 `{ error: "Must be clocked in to start a break" }`.
  - [ ] Test: Employee already on active break calls `POST /api/breaks/start` → assert HTTP 409 `{ error: "Already on an active break" }`.
  - [ ] Test: Invalid `break_type_key` → assert HTTP 400.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed — `break_types`, `break_policies`, `break_records` exist per `database_schema.md`.
  - [ ] [Repository] `src/repositories/break.repository.ts`:
        - `findActiveBreak(employeeId)`: SELECT WHERE `employee_id = $1 AND status = 'active'`.
        - `findBreakTypeByKey(key)`: SELECT from `break_types`.
        - `getEffectiveLimit(breakTypeId, centreId, departmentId)`: SELECT override from `break_policies` or default from `break_types`.
        - `createBreak(data)`: INSERT into `break_records`.
  - [ ] [Service] `src/services/break.service.ts#startBreak(rcUserId, breakTypeKey)`:
        - Resolve employee: `employeeRepository.findByRocketChatId(rcUserId)`.
        - Check clocked in: `attendanceRepository.findOpenRecord(employee.id, TODAY_EST)`. If null → throw `NotClockedInError`.
        - Check active break: `breakRepository.findActiveBreak(employee.id)`. If exists → throw `AlreadyOnBreakError`.
        - Lookup break type and effective limit minutes.
        - Note: Write ONLY to Postgres. NEVER alter Rocket.Chat presence.
        - Insert `break_records` row with `status = 'active'`.
  - [ ] [Controller] `src/routes/breaks.ts` `POST /start`:
        - Apply JWT middleware (`req.employee`).
        - Zod schema: `{ break_type_key: z.string() }`.
        - Call `breakService.startBreak(req.employee.rc_user_id, body.break_type_key)`.
        - Return HTTP 201. Catch `NotClockedInError` → 400, `AlreadyOnBreakError` → 409.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/break.service.unit.test.ts`):**
  - [ ] Mock employee not clocked in → assert `startBreak` throws `NotClockedInError`.
  - [ ] Mock employee already on active break → assert `startBreak` throws `AlreadyOnBreakError`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Break Start Logic:**
  - [ ] [Type] `src/types/break.ts` — export `BreakType`, `BreakRecord`, `StartBreakInput`.
  - [ ] Implement service methods — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Clock in employee → Send `POST /api/breaks/start` with `{ break_type_key: "bio" }` → 201 response.
  - [ ] Query Postgres `break_records` → row exists with `status = 'active'`, `end_at IS NULL`.
  - [ ] Attempt to start second break → 409 Conflict.
  - [ ] ✅ Done.

---

#### W-302 — End Break Endpoint & Overtime Computation

**Root cause:** Active breaks must be ended to compute duration in minutes and determine if the employee exceeded the allotted break limit.

**Goal:** `POST /api/breaks/end` updates the active `break_records` row with `end_at = NOW()`, computes `duration_minutes = ROUND((end_at - start_at)/60, 2)`, and sets `status = 'exceeded'` if `duration_minutes > limit_minutes`, else `'completed'`.

**Approach:** Resolve active break for employee. Calculate elapsed minutes using pure helper `computeBreakDuration(startAt, endAt)`. Determine status using `computeBreakStatus(durationMinutes, limitMinutes)`. Update Postgres row.

---

- [ ] **RED — Integration (`backend/tests/break_end.test.ts`):**
  - [ ] Test: Employee on 15-min tea break ends break after 10 mins → assert HTTP 200, `duration_minutes = 10.00`, `status = "completed"`.
  - [ ] Test: Employee on 15-min tea break ends break after 20 mins → assert HTTP 200, `duration_minutes = 20.00`, `status = "exceeded"`.
  - [ ] Test: Employee on unlimited meeting break ends break after 45 mins → assert HTTP 200, `duration_minutes = 45.00`, `status = "completed"`.
  - [ ] Test: Employee not on break calls `POST /api/breaks/end` → assert HTTP 400 `{ error: "No active break found to end" }`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed.
  - [ ] [Repository] `src/repositories/break.repository.ts#updateEndBreak(id, endAt, durationMinutes, status)`.
  - [ ] [Service] `src/services/break.service.ts#endBreak(rcUserId)`:
        - Resolve employee via `rcUserId`.
        - Find active break: `breakRepository.findActiveBreak(employee.id)`. If null → throw `NoActiveBreakError`.
        - Compute `duration_minutes`: `Math.round(((endAt.getTime() - startAt.getTime()) / 60000) * 100) / 100`.
        - Evaluate `status`: if `limit_minutes !== null` and `duration_minutes > limit_minutes` → `'exceeded'`, else `'completed'`.
        - Note: Write ONLY to Postgres. NEVER modify Rocket.Chat presence.
        - Call `breakRepository.updateEndBreak`.
  - [ ] [Controller] `src/routes/breaks.ts` `POST /end`:
        - Apply JWT middleware.
        - Call `breakService.endBreak(req.employee.rc_user_id)`.
        - Return HTTP 200 with updated record. Catch `NoActiveBreakError` → HTTP 400.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/break_duration.unit.test.ts`):**
  - [ ] Test pure helpers:
        - `computeBreakDuration(10:00, 10:15)` → 15.00.
        - `computeBreakStatus(12, 10)` → `'exceeded'`.
        - `computeBreakStatus(8, 10)` → `'completed'`.
        - `computeBreakStatus(45, null)` → `'completed'`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Duration Logic:**
  - [ ] Implement `computeBreakDuration` and `computeBreakStatus` functions in `src/services/break.service.ts` — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Start break -> End break after delay -> HTTP 200.
  - [ ] Query Postgres `break_records` -> `end_at`, `duration_minutes`, and `status` (`completed` or `exceeded`) correctly recorded.
  - [ ] ✅ Done.

---

#### W-303 — Break History & Active Breaks Monitoring Endpoint

**Root cause:** HR, managers, and the workforce monitor require APIs to view break history logs and active break statuses across teams.

**Goal:** `GET /api/breaks?employee_id=X&from=...&to=...&status=active` returns scoped break records. Supports permission guards (`breaks.view_own`, `breaks.view_team`, `breaks.view_all`). Also exposes `GET /api/break-types` for active break dropdowns.

**Approach:** Apply permission-based scoping on employee IDs. `GET /api/break-types` returns active break types from DB.

---

- [ ] **RED — Integration (`backend/tests/break_history.test.ts`):**
  - [ ] Test: `GET /api/break-types?is_active=true` → assert HTTP 200, array of 5 seeded break types (`bio`, `tea`, `dinner`, `smoke`, `meeting`).
  - [ ] Test: Employee JWT requests `GET /api/breaks` → returns array of own breaks.
  - [ ] Test: Manager JWT requests `GET /api/breaks?status=active` → returns active breaks for direct report team.
  - [ ] Test: Admin JWT requests `GET /api/breaks` → returns company-wide break history.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed.
  - [ ] [Repository] `src/repositories/break.repository.ts`:
        - `findBreakRecords({ employeeIds, status, fromDate, toDate })`.
        - `listBreakTypes(isActive)`: SELECT from `break_types`.
  - [ ] [Service] `src/services/break.service.ts#getBreakHistory(actorEmployee, filters)`:
        - Apply permission scoping (`breaks.view_all` vs `breaks.view_team` vs `breaks.view_own`).
        - Call `breakRepository.findBreakRecords`.
  - [ ] [Controller] `src/routes/breaks.ts` `GET /` and `src/routes/break_types.ts` `GET /`:
        - Wire JWT middleware and query parsing.
        - Return HTTP 200 response arrays.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/break_scoping.unit.test.ts`):**
  - [ ] Mock employee requesting unauthorized team break history → assert `ForbiddenError`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Scoping Logic:**
  - [ ] Implement scoping logic in break service — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] `GET /api/break-types` → returns bio, tea, dinner, smoke, meeting metadata.
  - [ ] `GET /api/breaks` with manager JWT → lists active team breaks.
  - [ ] ✅ Done.

---

### Phase 4 — Rocket.Chat Integration & SSO

> **Goal:** Synchronize employee creation with Rocket.Chat account provisioning via RC Admin REST API, store `rocketchat_user_id` atomically, and implement custom OAuth 2.0 Identity Provider endpoints for Rocket.Chat Single Sign-On (SSO).

---

#### W-401 — Rocket.Chat User Provisioning on Employee Creation

**Root cause:** Creating an employee in Postgres must automatically provision a corresponding user in Rocket.Chat so the user can log into chat and use the attendance app.

**Goal:** Extend `POST /api/employees` flow: after Postgres insertion, call RC Admin API `POST /api/v1/users.create`. Save returned `_id` to `employees.rocketchat_user_id` and set `rc_provisioned = true`. If RC fails, set `rc_provisioned = false` and expose `POST /api/employees/:id/retry-rc-provisioning`.

**Approach:** Build `src/services/rocketchat.service.ts` using `axios`/`fetch` to authenticate as RC Admin (`X-Auth-Token`, `X-User-Id`). On employee creation:
1. INSERT into Postgres `employees`.
2. Call `rocketchatService.createUser({ email, name, username, password })`.
3. On success: UPDATE Postgres set `rocketchat_user_id = rcUser._id`, `rc_provisioned = true`.
4. On failure: keep Postgres row, set `rc_provisioned = false`, log error, return 201 with warning metadata.

---

- [ ] **RED — Integration (`backend/tests/rc_provisioning.test.ts`):**
  - [ ] Test (with RC Admin API mocked): `POST /api/employees` → assert HTTP 201, `employees.rocketchat_user_id` populated with `"RC_mock_123"`, `rc_provisioned = true`.
  - [ ] Test (RC API returns 500 error): `POST /api/employees` → assert HTTP 201, `employees.rocketchat_user_id` is null, `rc_provisioned = false`, response contains `{ warning: "Rocket.Chat account creation failed" }`.
  - [ ] Test: `POST /api/employees/:id/retry-rc-provisioning` for employee with `rc_provisioned = false` → assert HTTP 200, RC user created, `rc_provisioned` updated to `true`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed — `rocketchat_user_id` and `rc_provisioned` exist on `employees`.
  - [ ] [Service] `src/services/rocketchat.service.ts#createUser`:
        - Call `POST ${RC_URL}/api/v1/users.create` with headers `X-Auth-Token` & `X-User-Id`.
        - Body: `{ email, name, username, password, verified: true, setRandomPassword: false }`.
        - Return `{ rcUserId: response.data.user._id }`.
  - [ ] [Service] `src/services/employee.service.ts#createEmployee`:
        - Execute Postgres write.
        - Try calling `rocketchatService.createUser`.
        - If success: update Postgres row `rocketchat_user_id` and `rc_provisioned = true`.
        - If failure: update Postgres row `rc_provisioned = false`. Return employee record with status.
  - [ ] [Controller] `src/routes/employees.ts`:
        - Update `POST /` to handle dual-system provisioning.
        - Add `POST /:id/retry-rc-provisioning` route.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/rc_service.unit.test.ts`):**
  - [ ] Mock RC API response shape `{ success: true, user: { _id: "RC_abc" } }` → assert returns `"RC_abc"`.
  - [ ] Mock RC API error shape `{ success: false, error: "Email in use" }` → assert service throws `RocketChatProvisioningError`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Dual Provisioning Logic:**
  - [ ] [Type] `src/types/rocketchat.ts` — export `RcCreateUserPayload`, `RcUserResponse`.
  - [ ] Implement RC service wrapper — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Create employee via `POST /api/employees`.
  - [ ] Open Rocket.Chat admin portal (`http://localhost:3100/admin/users`) -> verify newly created user appears in RC directory.
  - [ ] Query Postgres `employees` -> `rocketchat_user_id` matches RC user `_id`, `rc_provisioned = true`.
  - [ ] ✅ Done.

---

#### W-402 — Custom OAuth Server Endpoints (for RC SSO)

**Root cause:** Rocket.Chat must defer user authentication to the Backend API via Custom OAuth 2.0 so employees log in once and land directly in Rocket.Chat.

**Goal:** Implement OAuth 2.0 identity provider endpoints in Backend API:
- `GET /oauth/authorize`: Validates client, generates auth code.
- `POST /oauth/token`: Exchanges auth code for access token.
- `GET /oauth/userinfo`: Returns identity matching RC payload (`{ id, username, name, email }`).

**Approach:** Implement `src/services/oauth.service.ts` managing authorization codes in memory/Redis/Postgres with short TTL (5 mins). `GET /oauth/userinfo` extracts `rc_user_id` from Bearer token and returns employee details.

---

- [ ] **RED — Integration (`backend/tests/oauth.test.ts`):**
  - [ ] Test: `GET /oauth/authorize?client_id=rc_app&response_type=code&redirect_uri=...` with valid session → redirects to `redirect_uri?code=<auth_code>`.
  - [ ] Test: `POST /oauth/token` with valid `{ code, grant_type: "authorization_code" }` → returns HTTP 200 `{ access_token, token_type: "Bearer" }`.
  - [ ] Test: `GET /oauth/userinfo` with Bearer token → returns HTTP 200 `{ id, username, name, email, roles }` matching `employees.rocketchat_user_id`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed.
  - [ ] [Service] `src/services/oauth.service.ts`:
        - `generateAuthCode(userId, clientId, redirectUri)`.
        - `exchangeCodeForToken(code)` -> returns JWT access token.
        - `getUserInfo(rcUserId)` -> queries `employeeRepository.findByRocketChatId(rcUserId)`.
  - [ ] [Controller] `src/routes/oauth.ts`:
        - `GET /authorize`
        - `POST /token`
        - `GET /userinfo`
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/oauth.service.unit.test.ts`):**
  - [ ] Test invalid/expired authorization code exchange → assert throws `InvalidGrantError`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — OAuth Server Logic:**
  - [ ] Implement OAuth server methods — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Configure Rocket.Chat Admin -> OAuth -> Custom OAuth -> set URLs to `http://localhost:4000/oauth/*`.
  - [ ] Open Rocket.Chat login page -> click Custom OAuth button -> redirected to Backend API SSO -> authenticated -> returned to RC chat as logged-in user.
  - [ ] ✅ Done.

---

### Phase 5 — Rocket.Chat Attendance App (RC Apps-Engine)

> **Goal:** Build and deploy a TypeScript app using Rocket.Chat Apps-Engine (`@rocket.chat/apps-cli`) that renders a clock-in/out button and break dropdown in the RC UI and communicates with the Backend API.

---

#### W-501 — RC Attendance App Scaffold & Deployment Configuration

**Root cause:** The RC attendance app requires a standalone project layout in `rc-app/` configured with RC Apps-Engine manifest and build toolchain.

**Goal:** Scaffold `@rocket.chat/apps-cli` project in `rc-app/`, write `app.json`, implement `BackendClient` HTTP helper, and deploy to local Rocket.Chat instance (`http://localhost:3100`).

**Approach:** Use `rc-apps create` or manual structure in `rc-app/`. Configure permissions (`server-setting:read`, `http:outbound`). Build app package (`.zip`) and deploy via REST API / CLI.

---

- [ ] **RED — Integration:**
  - [ ] Command: `rc-apps list --url http://localhost:3100 --username admin --password <pass>`
  - [ ] **Run — confirm RED (app not installed in Rocket.Chat).**

- [ ] **GREEN — App Scaffold & Deployment:**
  - [ ] Create `rc-app/app.json`:
        ```json
        {
          "id": "jdconnect-attendance",
          "nameSlug": "jd-connect-attendance",
          "name": "JD Connect Attendance",
          "version": "1.0.0",
          "description": "Clock-in/out and break management app for JD Connect",
          "requiredApiVersion": "^1.19.0"
        }
        ```
  - [ ] Create `rc-app/src/lib/BackendClient.ts`: HTTP wrapper calling Backend API (`http://host.docker.internal:4000/api`).
  - [ ] Build app package using `@rocket.chat/apps-cli`.
  - [ ] Deploy app to local RC: `rc-apps deploy --url http://localhost:3100 --username admin --password <pass>`.
  - [ ] Run integration check — **confirm GREEN.**

- [ ] **RED — Unit (`rc-app/tests/backend_client.unit.test.ts`):**
  - [ ] Test `BackendClient` request header construction with JWT token.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Client Wrapper Unit Test:**
  - [ ] Verify header construction — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Open Rocket.Chat Admin -> Apps -> `JD Connect Attendance` appears as Installed & Enabled.
  - [ ] ✅ Done.

---

#### W-502 — Clock-In / Clock-Out Toolbar Button & Modal Flow

**Root cause:** Employees need an interactive UIKit action button in Rocket.Chat to clock in and clock out without leaving the chat interface.

**Goal:** Register a UI Action Button in Rocket.Chat header/slash command `/attendance`. Clicking opens a UIKit modal displaying current attendance status and a primary button ("Clock In" or "Clock Out"). Submitting calls Backend API endpoints (`POST /api/attendance/clock-in` or `/clock-out`).

**Approach:** Implement `IUIActionButtonHandler` and `IUIKitInteractionHandler` in `rc-app/`. On click: call `GET /api/attendance/status` using user's JWT. Render UIKit modal with dynamic button context. On submit: execute API call, display contextual notification toast.

---

- [ ] **RED — Integration (`rc-app/tests/clock_in_action.test.ts`):**
  - [ ] Test Action Handler: User clicks "Clock In" in modal → sends `POST /api/attendance/clock-in` with `Authorization: Bearer <jwt>` → receives 201 → returns UIKit success message "You're clocked in ✅".
  - [ ] Test Action Handler (already clocked in): API returns 409 → returns UIKit error message "You're already clocked in today."
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — RC App UIKit:**
  - [ ] [Type] `rc-app/src/types/attendance.ts` — mirror `AttendanceRecord` API response type.
  - [ ] [RC App] `rc-app/src/handlers/ActionButtonHandler.ts`: Register top header action button.
  - [ ] [RC App] `rc-app/src/modals/AttendanceModal.ts`: Build UIKit Modal View:
        - Header: "Attendance Management"
        - Body: Current status ("Clocked Out" or "Clocked In since 09:00 AM EST")
        - Action Button: "Clock In" (green) or "Clock Out" (red)
  - [ ] [RC App] `rc-app/src/handlers/BlockActionHandler.ts`:
        - On "Clock In" click -> call `BackendClient.post('/attendance/clock-in')`.
        - On "Clock Out" click -> call `BackendClient.post('/attendance/clock-out')`.
        - Surface response via `sendNotification` or modal update.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`rc-app/tests/modal_builder.unit.test.ts`):**
  - [ ] Test `AttendanceModal` builder output shape for clocked-out vs clocked-in state.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Modal Builder Unit Test:**
  - [ ] Verify UIKit JSON view block structure — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Log into Rocket.Chat as employee.
  - [ ] Click "Attendance" toolbar button -> Modal opens showing "Clocked Out".
  - [ ] Click "Clock In" -> Success notification "You're clocked in ✅" appears.
  - [ ] Check HR Dashboard / Postgres DB -> `attendance_records` row created.
  - [ ] Click "Attendance" button again -> Modal shows "Clocked In since..." with "Clock Out" button.
  - [ ] Click "Clock Out" -> Success notification "Clocked out" appears.
  - [ ] ✅ Done.

---

#### W-503 — Dynamic Break Dropdown & Break Action Handlers

**Root cause:** Employees need to select a break reason (bio, tea, dinner, smoke, meeting) from a dropdown populated dynamically from the Backend API and toggle break states.

**Goal:** RC Attendance App fetches active break types from `GET /api/break-types?is_active=true` on modal open. Renders dropdown list. Selecting a type and clicking "Start Break" calls `POST /api/breaks/start`. When on break, modal displays active break type & duration, with an "End Break" button calling `POST /api/breaks/end`.

**Approach:** On modal open: fetch break types via `BackendClient`. Render `StaticSelectElement` dropdown. On "Start Break": call `POST /api/breaks/start` with selected `break_type_key`. On "End Break": call `POST /api/breaks/end`.

---

- [ ] **RED — Integration (`rc-app/tests/break_action.test.ts`):**
  - [ ] Test Modal Open: Fetches break types from Backend API → populates dropdown with options (`bio`, `tea`, `dinner`, `smoke`, `meeting`).
  - [ ] Test Break Start: User selects "Tea Break" and submits → sends `POST /api/breaks/start` with `{ break_type_key: "tea" }` → receives 201 → modal updates to "On Tea Break".
  - [ ] Test Break End: User clicks "End Break" → sends `POST /api/breaks/end` → receives 200 → modal returns to normal clocked-in state.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — RC App Break Handler:**
  - [ ] [Type] `rc-app/src/types/break.ts` — mirror `BreakType` and `BreakRecord` types.
  - [ ] [RC App] `rc-app/src/modals/BreakModal.ts`:
        - Fetch break types dynamically from Backend API.
        - Construct UIKit `StaticSelectElement` dropdown options.
        - Render "Start Break" button.
        - If active break exists: render active break status badge and "End Break" button.
  - [ ] [RC App] `rc-app/src/handlers/BreakBlockActionHandler.ts`:
        - Handle `start_break` action -> call `BackendClient.post('/breaks/start')`.
        - Handle `end_break` action -> call `BackendClient.post('/breaks/end')`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`rc-app/tests/break_dropdown.unit.test.ts`):**
  - [ ] Mock empty `break_types` API response -> verify fallback error message in modal.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Dropdown Unit Test:**
  - [ ] Verify dropdown builder handling — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Clocked-in employee opens Attendance modal in Rocket.Chat.
  - [ ] Selects "Tea Break (15 min)" from dropdown -> clicks "Start Break".
  - [ ] Modal updates: shows "On Tea Break (started at...)".
  - [ ] Click "End Break" -> Toast "Break ended (duration: 12 mins) ✅".
  - [ ] Postgres check `break_records` -> `duration_minutes = 12.00`, `status = 'completed'`.
  - [ ] ✅ Done.

---

### Phase 6 — HR Dashboard (Web App)

> **Goal:** A separate web application (Next.js/React) for HR administrators to manage employees, handle RC provisioning retries, inspect attendance/break audit logs, monitor workforce live status, and trigger password resets.

---

#### W-601 — HR Dashboard Scaffold & Authentication Routing

**Root cause:** HR administrators need a standalone web application served on a separate subdomain (`hr.yourcompany.com`) with authentication guards.

**Goal:** Bootstrap Next.js web application in `hr-dashboard/`, configure base layout, set up root-domain cookie storage for JWT, implement login page (`POST /api/auth/login`), and protect routes via client-side/middleware auth guards.

**Approach:** Create Next.js app in `hr-dashboard/`. Configure `src/lib/api.ts` Axios/Fetch client using `NEXT_PUBLIC_API_URL`. Store JWT session cookie scoped to root domain (`.yourcompany.com`). Redirect unauthenticated requests to `/login`.

---

- [ ] **RED — Integration (`hr-dashboard/tests/auth_flow.test.ts`):**
  - [ ] Test: Unauthenticated user navigates to `/dashboard` → redirected to `/login`.
  - [ ] Test: Valid login submission on `/login` → calls `POST /api/auth/login` → sets session cookie → redirects to `/dashboard`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Web App Scaffold:**
  - [ ] Bootstrap `hr-dashboard/` (Next.js 14+ App Router, Tailwind CSS, TypeScript).
  - [ ] Create `src/lib/api.ts` — API client configured with Base URL and Authorization Bearer interceptor.
  - [ ] Create `src/app/login/page.tsx` — Login form (Email & Password).
  - [ ] Create `src/middleware.ts` — Next.js middleware checking JWT cookie before serving `/dashboard/*` routes.
  - [ ] Create `src/app/dashboard/layout.tsx` — Responsive navigation sidebar & header.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`hr-dashboard/tests/api_client.unit.test.ts`):**
  - [ ] Test `api.ts` interceptor attaching token from cookie.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — API Client Unit Test:**
  - [ ] Verify header attachment logic — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Open `http://localhost:3000` (or `hr.localhost`) -> redirected to `/login`.
  - [ ] Submit valid HR credentials -> redirected to `/dashboard` home page.
  - [ ] Cookie inspection -> session cookie present with domain scoping.
  - [ ] ✅ Done.

---

#### W-602 — Employee Management UI & RC Provisioning Retry Handler

**Root cause:** HR administrators require screens to view the employee directory, onboard new employees, and identify/retry failed Rocket.Chat account provisionings (`rc_provisioned = false`).

**Goal:** Build `/dashboard/employees` page displaying employee directory table with filters (department, centre, status). Build "Add Employee" modal form (`POST /api/employees`). Display warning badge on rows where `rc_provisioned = false` with a "Retry RC Provisioning" button (`POST /api/employees/:id/retry-rc-provisioning`).

**Approach:** Page fetches `GET /api/employees`. Table renders employee fields per `project_data.md` Section 6. Form collects inputs and sends creation request. "Retry" button invokes API and updates table row state.

---

- [ ] **RED — Integration (`hr-dashboard/tests/employee_ui.test.ts`):**
  - [ ] Test: `/dashboard/employees` fetches and renders employee list table.
  - [ ] Test: Submit "Add Employee" form → sends `POST /api/employees` → table updates with new employee row.
  - [ ] Test: Click "Retry RC Provisioning" on employee row with `rc_provisioned = false` → sends `POST /api/employees/:id/retry-rc-provisioning` → badge updates to `rc_provisioned = true`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Employee UI:**
  - [ ] [Type] `hr-dashboard/src/types/employee.ts` — export Frontend employee interfaces.
  - [ ] [Page] `hr-dashboard/src/app/dashboard/employees/page.tsx`: Employee directory table with search, department filter, status badges.
  - [ ] [Component] `hr-dashboard/src/components/AddEmployeeModal.tsx`: Form inputs for full name, email, role, department, centre, shift, joining date.
  - [ ] [Component] `hr-dashboard/src/components/RcProvisioningBadge.tsx`: Displays green check for `true`, amber warning + "Retry" button for `false`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`hr-dashboard/tests/employee_table.unit.test.ts`):**
  - [ ] Test table filtering logic by department name.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Table Unit Test:**
  - [ ] Verify filter pipeline — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] HR opens `/dashboard/employees`.
  - [ ] Clicks "Add Employee" -> fills form -> submits.
  - [ ] Employee appears in table. If Rocket.Chat container was temporarily down, amber badge "RC Failed" shows with "Retry" button.
  - [ ] Click "Retry" -> button triggers provisioning -> badge updates to green "RC Provisioned".
  - [ ] ✅ Done.

---

#### W-603 — Attendance & Break Audit Views with Scoped Filters

**Root cause:** HR and managers need comprehensive reporting views to monitor daily attendance, identify late arrivals/half-days, review break duration overages, and view live workforce state.

**Goal:** Build `/dashboard/attendance` (date range filter, employee filter, status badges `present`, `late`, `half_day`, `absent`), `/dashboard/breaks` (break type filter, duration exceeding highlights), and `/dashboard/monitor` (live summary cards: Working / On Break / Off Duty).

**Approach:** Fetch data from Backend API endpoints `GET /api/attendance`, `GET /api/breaks`, and `GET /api/attendance/monitor`. Format EST dates and display visual tags.

---

- [ ] **RED — Integration (`hr-dashboard/tests/reports_ui.test.ts`):**
  - [ ] Test: `/dashboard/attendance` renders attendance records table filtered by EST date picker.
  - [ ] Test: `/dashboard/breaks` highlights rows where `status === 'exceeded'` in red.
  - [ ] Test: `/dashboard/monitor` displays live employee count cards matching Backend API summary.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Reports UI:**
  - [ ] [Page] `hr-dashboard/src/app/dashboard/attendance/page.tsx`: Table displaying Work Date (EST), Clock In (EST), Clock Out (EST), Hours Worked, Status, Is Late flag.
  - [ ] [Page] `hr-dashboard/src/app/dashboard/breaks/page.tsx`: Table displaying Employee, Break Type, Start Time, End Time, Duration (min), Limit (min), Status.
  - [ ] [Page] `hr-dashboard/src/app/dashboard/monitor/page.tsx`: Live workforce monitor widget displaying metric cards (Total Active, On Break, Available, Clocked Out).
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`hr-dashboard/tests/date_formatter.unit.test.ts`):**
  - [ ] Test EST timestamp formatting utility function.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Formatter Unit Test:**
  - [ ] Verify EST date strings — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] HR opens `/dashboard/attendance` -> views employee records for today.
  - [ ] HR opens `/dashboard/breaks` -> sees exceeded breaks flagged with amber/red warnings.
  - [ ] HR opens `/dashboard/monitor` -> live numbers update to reflect active workforce.
  - [ ] ✅ Done.

---

#### W-604 — HR Password Reset UI & Modal Component

**Root cause:** HR administrators need a secure UI control in the web dashboard to trigger an instant password reset for any employee.

**Goal:** Add a "Reset Password" action button on each employee row in `/dashboard/employees` (visible only if logged-in user possesses `hr.reset_password` permission key). Opens modal to enter new password and submits `POST /api/employees/:id/reset-password`.

**Approach:** Check logged-in user permissions. Render "Reset Password" button. Modal validates password strength (min 8 chars) and calls Backend API endpoint.

---

- [ ] **RED — Integration (`hr-dashboard/tests/password_reset_ui.test.ts`):**
  - [ ] Test: Admin user sees "Reset Password" button on employee row.
  - [ ] Test: Standard manager user does NOT see "Reset Password" button.
  - [ ] Test: Submit reset modal with new password → calls `POST /api/employees/:id/reset-password` → displays success toast.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Reset UI:**
  - [ ] [Component] `hr-dashboard/src/components/ResetPasswordModal.tsx`:
        - Input: New Password, Confirm New Password.
        - Validation: Minimum 8 characters.
        - Action: Submit button calling API client.
  - [ ] [Component] `hr-dashboard/src/app/dashboard/employees/page.tsx`:
        - Conditionally render "Reset Password" button based on `user.permissions.includes('hr.reset_password')`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`hr-dashboard/tests/password_validation.unit.test.ts`):**
  - [ ] Test password match validation rule in modal form.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Validation Unit Test:**
  - [ ] Verify client-side form validation — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] HR Admin opens `/dashboard/employees` -> clicks "Reset Password" on employee row.
  - [ ] Enters new password "TempPassword123!" -> submits.
  - [ ] Success toast "Password reset successfully" appears.
  - [ ] Target employee can immediately log into RocketChat / HR Dashboard using "TempPassword123!".
  - [ ] ✅ Done.

---

### Phase 7 — Data Migration (Old System → New)

> **Goal:** ETL migration scripts to transfer employee profiles, credentials, attendance records, and break history from the old Supabase Postgres to the new plain Postgres database, and migrate historical chat conversations into Rocket.Chat via Admin REST API.

---

#### W-701 — ETL Migration Script: Employees & User Credentials

**Root cause:** Existing employee profiles, user credentials, and corporate assignments stored in legacy Supabase Postgres must be migrated to the new plain Postgres schema.

**Goal:** Write `backend/scripts/migrate-employees.ts` that reads old `auth.users` and `public.employees` data, transforms IDs and fields, inserts into new `users` and `employees` tables, and provisions Rocket.Chat accounts for all active employees.

**Approach:** Connect to old DB via read-only connection string `OLD_DATABASE_URL`. Read records in batches. Map `auth.users.id` -> `users.id`, preserve `employee_code`. Execute dual-system write to new Postgres and call RC Admin API to set `employees.rocketchat_user_id`.

---

- [ ] **RED — Integration (`backend/tests/migration_employees.test.ts`):**
  - [ ] Test: Execute `migrate-employees.ts` against old staging database → assert row count in new `users` and `employees` matches old active employee count. All active employees have non-null `rocketchat_user_id`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Employee Migration Script:**
  - [ ] [Script] Create `backend/scripts/migrate-employees.ts`:
        - Connect to `OLD_DATABASE_URL` and `DATABASE_URL`.
        - SELECT active users and employees from old schema.
        - Transform data: map roles, department names -> department UUIDs, centre codes -> centre UUIDs.
        - INSERT into new `users` and `employees` tables in transaction.
        - Invoke `rocketchatService.createUser` for each employee -> update `rocketchat_user_id` and `rc_provisioned = true`.
        - Log migration summary (migrated count, failed RC count).
  - [ ] Run `npx ts-node backend/scripts/migrate-employees.ts`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/employee_transformer.unit.test.ts`):**
  - [ ] Test legacy employee data row transformation logic.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Transformer Unit Test:**
  - [ ] Verify field mapping correctness — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Run `npx ts-node backend/scripts/migrate-employees.ts`.
  - [ ] Check new Postgres `SELECT COUNT(*) FROM employees` -> matches old DB count.
  - [ ] Check Rocket.Chat user directory -> all migrated employees appear in RC.
  - [ ] ✅ Done.

---

#### W-702 — ETL Migration Script: Attendance & Break Records

**Root cause:** Historical attendance logs and break records from the legacy system must be preserved for HR compliance and reporting.

**Goal:** Write `backend/scripts/migrate-attendance.ts` and `migrate-breaks.ts` to transfer historical `attendance_records` and `break_records` into the new Postgres database with FK references mapped to new `employee.id` UUIDs.

**Approach:** Read legacy attendance and break tables. Re-link foreign keys using `employee_code` lookup map. Transform timestamps into EST work dates and compute missing `hours_worked` or `duration_minutes`. Bulk insert into new Postgres tables.

---

- [ ] **RED — Integration (`backend/tests/migration_attendance.test.ts`):**
  - [ ] Test: Execute `migrate-attendance.ts` and `migrate-breaks.ts` → assert row counts in new `attendance_records` and `break_records` match legacy database totals. No orphaned FK errors.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Attendance & Break Migration Scripts:**
  - [ ] [Script] `backend/scripts/migrate-attendance.ts`:
        - Map old employee IDs to new `employees.id` via `employee_code`.
        - Transform legacy clock-in/out timestamps. Re-calculate status using `computeAttendanceStatus`.
        - Bulk insert into new `attendance_records`.
  - [ ] [Script] `backend/scripts/migrate-breaks.ts`:
        - Map legacy break records to new break types (`bio`, `tea`, `dinner`, `smoke`, `meeting`).
        - Re-calculate `duration_minutes` and `status` (`completed` / `exceeded`).
        - Bulk insert into new `break_records`.
  - [ ] Run `npx ts-node backend/scripts/migrate-attendance.ts && npx ts-node backend/scripts/migrate-breaks.ts`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/attendance_transformer.unit.test.ts`):**
  - [ ] Test legacy attendance record transformer with null clock-out times.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Attendance Transformer Unit Test:**
  - [ ] Verify transformation handling — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Execute migration scripts -> check row counts.
  - [ ] Open HR Dashboard `/dashboard/attendance` -> historical attendance logs display accurately.
  - [ ] ✅ Done.

---

#### W-703 — Chat History Import via Rocket.Chat REST API

**Root cause:** Historical group channel conversations and direct messages from the old platform need to be imported into Rocket.Chat.

**Goal:** Write `backend/scripts/migrate-chat.ts` that reads legacy conversation threads, maps user accounts via `employees.rocketchat_user_id`, and uses Rocket.Chat Admin REST API (`POST /api/v1/channels.create`, `POST /api/v1/chat.postMessage`) to populate chat channels.

**Approach:** Read legacy chat messages sorted by timestamp. Map sender IDs to RC user IDs. Call Rocket.Chat REST API import endpoints or post messages programmatically preserving original timestamps and sender identities.

---

- [ ] **RED — Integration (`backend/tests/migration_chat.test.ts`):**
  - [ ] Test: Execute `migrate-chat.ts` against test Rocket.Chat instance → assert target channels exist and messages are visible with correct sender attribution.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Chat Migration Script:**
  - [ ] [Script] Create `backend/scripts/migrate-chat.ts`:
        - Read legacy channels and message history.
        - Map legacy sender IDs to `employees.rocketchat_user_id`.
        - Call RC REST API `POST /api/v1/channels.create` for missing rooms.
        - Post historical messages in chronological order via RC REST API.
        - Log import statistics (channels created, messages imported, missing user skips).
  - [ ] Run `npx ts-node backend/scripts/migrate-chat.ts`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/chat_transformer.unit.test.ts`):**
  - [ ] Test chat message payload transformer formatting for RocketChat REST API.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Chat Transformer Unit Test:**
  - [ ] Verify message payload structure — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Run migration script -> open Rocket.Chat app.
  - [ ] Navigate to imported channels -> verify historical messages and timestamps are intact.
  - [ ] ✅ Done.

---

### Phase 8 — Production Deployment

> **Goal:** Deploy all four JD Connect components (Postgres, Mongo Replica Set, Rocket.Chat, Backend API, HR Dashboard) to Hostinger VPS using Docker Compose, Nginx reverse proxy with HTTPS TLS certificates, production secrets, and automated daily backups.

---

#### W-801 — VPS Production Docker Compose & Reverse Proxy Setup

**Root cause:** All components must run reliably on a single Hostinger VPS with proper resource constraints, container restart policies, and SSL reverse proxy routing.

**Goal:** Write `docker/docker-compose.prod.yml` and `docker/nginx.conf`. Configure Nginx reverse proxy with Let's Encrypt TLS certificates for subdomains (`chat.yourcompany.com`, `hr.yourcompany.com`, `api.yourcompany.com`).

**Approach:** Configure production Docker Compose stack with container health checks, named persistent volumes, logging limits, and Nginx container handling SSL termination and proxy passes to internal ports (RC: 3000, API: 4000, HR Dashboard: 3000).

---

- [ ] **RED — Production Deployment Check:**
  - [ ] Test: `curl https://api.yourcompany.com/health` and `curl https://chat.yourcompany.com`
  - [ ] **Run — confirm RED (production server not deployed yet).**

- [ ] **GREEN — Production Infrastructure:**
  - [ ] [Docker] Create `docker/docker-compose.prod.yml`:
        - Services: `postgres`, `mongo`, `rocketchat`, `backend-api`, `hr-dashboard`, `nginx`.
        - Set `restart: always` on all services.
        - Define production network and volume mounts (`pgdata`, `mongodata`, `rc_uploads`).
  - [ ] [Nginx] Create `docker/nginx.conf`:
        - Upstream proxies for Backend API (4000), Rocket.Chat (3000), HR Dashboard (3000).
        - SSL configuration using Let's Encrypt certificates (`/etc/letsencrypt/live/...`).
        - WebSocket support for Rocket.Chat (`Upgrade`, `Connection` headers).
  - [ ] SSH to Hostinger VPS -> clone repository -> run `docker compose -f docker/docker-compose.prod.yml up -d`.
  - [ ] Run production integration check — **confirm GREEN.**

- [ ] **RED — Unit Check (`docker/tests/nginx_config.unit.test.ts`):**
  - [ ] Test Nginx config syntax check: `nginx -t -c /path/to/nginx.conf`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Nginx Syntax Verification:**
  - [ ] Confirm Nginx syntax is valid — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Open `https://chat.yourcompany.com` -> Rocket.Chat loads over HTTPS with valid SSL certificate.
  - [ ] Open `https://hr.yourcompany.com` -> HR Dashboard loads over HTTPS.
  - [ ] Open `https://api.yourcompany.com/health` -> returns `{ status: "ok" }`.
  - [ ] ✅ Done.

---

#### W-802 — Secrets & Environment Hardening

**Root cause:** Production instances require strict environment variable segregation, production RS256 RSA key pair generation, and proper CORS/OAuth domain configuration.

**Goal:** Secure all secrets in production `.env`, generate 2048-bit RS256 RSA key pair for JWT signing, configure root-domain session cookie scoping (`.yourcompany.com`), and lock down CORS origins on Backend API.

**Approach:** Generate RSA key pair using `openssl genpkey`. Set production `.env` variables (`DATABASE_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `RC_ADMIN_TOKEN`, `NODE_ENV=production`). Restrict CORS in `src/app.ts` strictly to company subdomains.

---

- [ ] **RED — Security Audit:**
  - [ ] Test: `curl -I -H "Origin: http://malicious-site.com" https://api.yourcompany.com/health` → assert CORS header `Access-Control-Allow-Origin` does NOT reflect malicious site.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Security Hardening:**
  - [ ] Generate RS256 key pair:
        `openssl genpkey -algorithm RSA -out jwt_private.pem -pkeyopt rsa_keygen_bits:2048`
        `openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem`
  - [ ] Save keys securely into VPS production environment variables.
  - [ ] Update `backend/src/app.ts` to configure strict CORS policy allowing only `https://*.yourcompany.com`.
  - [ ] Configure `employee_sessions` cookie domain attribute to `.yourcompany.com; Secure; HttpOnly; SameSite=Lax`.
  - [ ] Run security audit check — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/cors.unit.test.ts`):**
  - [ ] Test CORS origin whitelist validator function.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — CORS Unit Test:**
  - [ ] Verify whitelist checking — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Verify production JWT tokens are signed with RS256 private key.
  - [ ] Perform SSO login flow on production domain -> cookies set with `.yourcompany.com` domain scope -> user authenticated across all subdomains.
  - [ ] ✅ Done.

---

#### W-803 — Automated Postgres & MongoDB Backup Pipeline

**Root cause:** Production data (HR records, attendance logs, break audits, chat history) requires automated daily backups with retention enforcement and recovery validation drills.

**Goal:** Automated backup shell script `scripts/backup.sh` executed daily via cron: performs `pg_dump` for Postgres and `mongodump` for MongoDB replica set, compresses archives (`.tar.gz`), maintains a 30-day rolling retention window, and logs execution status.

**Approach:** Write POSIX shell script `docker/scripts/backup.sh`. Configure cron job on host VPS (`0 2 * * * /app/docker/scripts/backup.sh`). Implement restoration verification script `scripts/restore_test.sh` to validate backup archives against a temporary test container.

---

- [ ] **RED — Integration (`docker/tests/backup.test.ts`):**
  - [ ] Test: Run `backup.sh` → assert valid `.tar.gz` backup archive created containing Postgres dump and Mongo BSON dump.
  - [ ] Test: Run `restore_test.sh` using created archive → assert database successfully restored into test container.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Automated Backup Pipeline:**
  - [ ] [Script] Create `docker/scripts/backup.sh`:
        - Target directory: `/var/backups/jdconnect/$(date +%Y%m%d_%H%M%S)`.
        - Execute `docker exec postgres pg_dump -U jduser jdconnect > postgres.sql`.
        - Execute `docker exec mongo mongodump --out /backup/mongo`.
        - Compress archive: `tar -czf backup.tar.gz postgres.sql mongo/`.
        - Delete backup archives older than 30 days: `find /var/backups/jdconnect/ -type f -mtime +30 -delete`.
  - [ ] [Script] Create `docker/scripts/restore_test.sh`:
        - Test script verifying archive uncompression and SQL/BSON restoration integrity.
  - [ ] Add host cron job: `0 2 * * * /app/docker/scripts/backup.sh >> /var/log/jdconnect_backup.log 2>&1`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`docker/tests/backup_retention.unit.test.ts`):**
  - [ ] Test backup retention pruning logic for 30-day cutoff.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Retention Unit Test:**
  - [ ] Verify 30-day cutoff evaluation — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Trigger manual execution of `/app/docker/scripts/backup.sh`.
  - [ ] Verify output directory `/var/backups/jdconnect/` contains compressed archive.
  - [ ] Run `/app/docker/scripts/restore_test.sh` -> restore test passes without errors.
  - [ ] ✅ Done.
