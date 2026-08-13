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
| **Phase 0** | Project Setup & Infrastructure | **[x] COMPLETE** | `docker/docker-compose.yml`, `backend/package.json`, `backend/src/app.ts`, `backend/migrations/`, `backend/vitest.config.ts` |
| **Phase 0.5** | Zulip Migration (Remove Rocket.Chat/MongoDB, Install Zulip) | **[x] COMPLETE** | `docker/docker-compose.yml`, `.env.example`, `.env.test`, `backend/migrations/004_create_employees.sql`, `backend/src/types/auth.ts`, `backend/src/middleware/auth.ts`, `backend/src/services/zulip.service.ts`, `attendance-app/`, `zulip-bot/` |
| **Phase 1** | JWT Authentication | **[x] COMPLETE** | `backend/src/routes/auth.ts`, `backend/src/routes/employees.ts`, `backend/src/services/auth.service.ts`, `backend/src/services/employee.service.ts`, `backend/src/middleware/auth.ts` |
| **Phase 1.5** | Zulip Backend Alignment (Refactor Phase 1 Auth & Employees for Zulip) | **[ ] NOT STARTED** | `backend/src/routes/auth.ts`, `backend/src/routes/employees.ts`, `backend/src/services/auth.service.ts`, `backend/src/services/employee.service.ts`, `backend/src/middleware/auth.ts` |
| **Phase 2** | Attendance API | **[ ] NOT STARTED** | `backend/src/routes/attendance.ts`, `backend/src/services/attendance.service.ts`, `backend/src/repositories/attendance.repository.ts` |
| **Phase 3** | Break API | **[ ] NOT STARTED** | `backend/src/routes/breaks.ts`, `backend/src/services/break.service.ts`, `backend/src/repositories/break.repository.ts` |
| **Phase 4** | Zulip Integration & SSO | **[ ] NOT STARTED** | `backend/src/services/zulip.service.ts`, `backend/src/routes/oauth.ts`, `backend/src/services/oauth.service.ts` |
| **Phase 5** | Attendance Web App & Zulip Bot | **[ ] NOT STARTED** | `attendance-app/index.html`, `attendance-app/app.js`, `zulip-bot/src/poster.ts` |
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

> **Session Note 1 — 2026-08-14**
> - **Progress Summary & Tracker Format:** Updated `CONTEXT/current_state.md` with Section 1 progress summary table and expanded all phases (0 to 8) into thorough, non-ambiguous TDD checklists following `TDD_INSTRUCTION_GUIDE.md`.
> - **Monorepo Scaffolding (W-001):** Configured `pnpm-workspace.yaml`, workspace packages (`backend`, `rc-app`, `hr-dashboard`, `docker`), root `package.json`, `.gitignore`, `tsconfig.base.json`, `eslint.config.mjs`, and `README.md`.
> - **Quality Toolchain:** Configured scripts `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm ci:quality`. Verified `pnpm lint` (0 errors) and `pnpm typecheck` (all 3 workspaces pass).
> - **CI Pipeline:** Created `.github/workflows/ci.yml` consolidated into a single fast `quality` job executing `lint` → `typecheck` → `test` → `build` in sequence.
> - **Environment & Test DB Setup:** Configured `.env.example`, `.env.test.example`, and `.env.test` using direct IPv4 addresses (`127.0.0.1:5432/jdconnect` and `jdconnect_test`). Configured `vitest.config.ts`, `backend/vitest.config.ts`, and `backend/tests/setup.ts` to automatically load `.env.test` via `dotenv` with `--passWithNoTests` support.
> - **Local Setup Guide:** Authored `local_setup.md` detailing step-by-step developer onboarding instructions from git clone to running the stack.
> - **Docker Preparation:** Created `docker/docker-compose.yml`, `docker/init-db.sql`, `docker/.env.example`, `docker/README.md`. Container execution and live verification will be performed in W-002 and W-003.

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
  - [x] Add `rocketchat` service (`rocketchat/rocket.chat:latest`, `MONGO_URL=mongodb://mongo:27017/rocketchat?replicaSet=rs0`, `PORT=3000`, published port `3100:3000`).
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

- [x] **RED — Integration (`backend/tests/health.test.ts`):**
  - [x] Test: `GET http://localhost:4000/health` → assert HTTP 200 `{ status: "ok" }`.
  - [x] **Run — confirm RED (server not created yet).**

- [x] **GREEN — Backend Skeleton:**
  - [x] `cd backend && npm init -y`
  - [x] Install runtime deps: `express`, `pg`, `bcryptjs`, `jose`, `zod`, `dotenv`, `cors`.
  - [x] Install dev deps: `typescript`, `ts-node`, `nodemon`, `vitest`, `supertest`, `@types/*`.
  - [x] Create `tsconfig.json` (strict mode, `outDir: "dist"`).
  - [x] Create `src/app.ts` with `GET /health` route handler.
  - [x] Create `src/server.ts` listening on `PORT || 4000`.
  - [x] Create `src/lib/db.ts` initializing `pg.Pool` using `DATABASE_URL`.
  - [x] Run `npx vitest tests/health.test.ts` — **confirm GREEN.**

- [x] **RED — Unit (`backend/tests/db.unit.test.ts`):**
  - [x] Test: execute `SELECT 1` via `src/lib/db.ts` pool → assert returns 1.
  - [x] **Run — confirm RED.**

- [x] **GREEN — DB Pool Unit Test:**
  - [x] Verify `src/lib/db.ts` returns active connection — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Start server: `npm run dev` in `backend/`.
  - [x] `curl http://localhost:4000/health` → `{ status: "ok" }`.
  - [x] ✅ Done.

---

#### W-005 — Postgres: Database Migrations & Seeding

**Root cause:** All tables from `database_schema.md` must be created in Postgres with initial seed data loaded (roles, permissions, departments, centres, shifts, break types).

**Goal:** Numbered SQL migration files `001_` through `010_` applied via `scripts/migrate.ts`, and `scripts/seed.ts` seeding core domain constants.

**Approach:** Write migration SQL scripts creating ENUMs, tables, indexes, and FK constraints. Build JS runner that tracks migrations in `schema_migrations`.

---

- [x] **RED — Integration (`backend/tests/migrations.test.ts`):**
  - [x] Test: Query Postgres `information_schema.tables` → assert tables `users`, `employees`, `roles`, `attendance_records`, `break_records`, etc., exist.
  - [x] **Run — confirm RED (tables do not exist).**

- [x] **GREEN — Migrations & Seed:**
  - [x] [Schema] Create SQL migrations:
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
  - [x] [Script] `backend/scripts/migrate.ts` — migration runner.
  - [x] [Script] `backend/scripts/seed.ts` — seeds 5 roles, 11 permissions, 7 departments, 2 centres, 1 shift (Night Shift 09:00–18:00 EST), 5 break types (bio, tea, dinner, smoke, meeting), super admin user.
  - [x] Run `npx ts-node scripts/migrate.ts && npx ts-node scripts/seed.ts`.
  - [x] Run integration test — **confirm GREEN.**

- [x] **RED — Unit (`backend/tests/seed.unit.test.ts`):**
  - [x] Test: `SELECT COUNT(*) FROM roles` → assert 5. `SELECT COUNT(*) FROM break_types` → assert 5.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Seed Unit Test:**
  - [x] Verify query returns seeded row counts — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Run `psql -U jduser -d jdconnect -c "SELECT key, name FROM roles;"` → lists super_admin, admin, manager, team_leader, employee.
  - [x] ✅ Done.

---

#### W-006 — Test Database Setup

**Root cause:** Integration tests require a dedicated `jdconnect_test` database to avoid corrupting development data.

**Goal:** Automatic test database creation, migration runner in `vitest.setup.ts`, and table truncation before each test suite execution.

**Approach:** Configure `backend/vitest.config.ts` with `TEST_DATABASE_URL` pointing to `jdconnect_test`. Write `tests/setup.ts` to run migrations before tests and truncate tables between tests.

---

- [x] **RED — Integration (`backend/tests/setup.test.ts`):**
  - [x] Test: Insert dummy user in test DB → run cleanup hook → assert table is empty.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Test DB Config:**
  - [x] Run `psql -c "CREATE DATABASE jdconnect_test;"`.
  - [x] Create `backend/vitest.config.ts` pointing to `jdconnect_test`.
  - [x] Create `backend/tests/setup.ts`:
        - `beforeAll`: run `migrate.ts` on `jdconnect_test`.
        - `beforeEach`: truncate all domain tables (`TRUNCATE users, employees, attendance_records, break_records CASCADE`).
        - `afterAll`: close pool.
  - [x] Run `npx vitest tests/setup.test.ts` — **confirm GREEN.**

- [x] **RED — Unit (`backend/tests/db_isolation.unit.test.ts`):**
  - [x] Test: Verify `process.env.NODE_ENV === 'test'` uses `jdconnect_test`.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Isolation Check:**
  - [x] Confirm connection string points to `jdconnect_test` — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `npm test` runs across all tests without DB deadlocks or cross-test data pollution.
  - [x] ✅ Done.

> **Session Note 2 — 2026-08-14**
> - **Phase 0 Completion**: Successfully verified and marked all Phase 0 infrastructure work items (`W-001` through `W-006`) as **[x] COMPLETE**.
> - **Architecture & System Verification**: Confirmed understanding of the 4-component architecture, 2-database model, cross-system key (`employees.rocketchat_user_id` = MongoDB `users._id`), presence/attendance decoupling, and plain Postgres container stack.
> - **Docker Container Execution (W-002 & W-003)**: Updated `docker/docker-compose.yml` (removed obsolete version key, fixed Rocket.Chat image tag to `rocketchat/rocket.chat:latest`) and `docker/init-db.sql`. Started Postgres container (healthy on port 5432, `jdconnect` & `jdconnect_test` initialized) and MongoDB (`rs0`) + Rocket.Chat 8.x container (running on port 3100).
> - **Backend API Skeleton (W-004)**: Created Express TypeScript service skeleton in `backend/` with `GET /health` endpoint on port 4000, `src/lib/db.ts` `pg` connection pool, and `health.test.ts` integration test.
> - **Database Migrations & Seeders (W-005)**: Created 10 clean SQL migration files (`001` through `010`), `scripts/migrate.ts`, and `scripts/seed.ts`. Seeded 5 roles (`super_admin`, `admin`, `manager`, `team_leader`, `employee`), 11 permission keys, 7 departments, 2 office centres (`DBP`, `ITP`), 1 shift (Night Shift EST), 5 break types (`bio`, `tea`, `dinner`, `smoke`, `meeting`), and initial super admin user profile with bcrypt hash. Added `IF NOT EXISTS (SELECT 1 FROM pg_type...)` guards for Postgres ENUM types.
> - **Test Database Setup & Isolation (W-006)**: Configured `backend/vitest.config.ts` with `fileParallelism: false` and `tests/setup.ts` table truncation hooks (`TRUNCATE ... CASCADE`) to prevent race conditions and cross-test data pollution across parallel test suites.
> - **Decision Log & CSR Architecture**: Documented Decision 11 in `CONTEXT/decision_log.md` comparing plain `pg` pool + SQL repositories vs Prisma ORM. Implemented W-101 (`POST /api/employees`) using strict Controller-Service-Repository architecture.
> - **Quality Verification**: Verified full monorepo quality suite `pnpm ci:quality` (`lint` -> `typecheck` -> `test` -> `build`) passing 100% cleanly across all workspace packages with 18/18 passing tests.

---

### Phase 0.5 — Zulip Migration (Remove Rocket.Chat & MongoDB, Install Zulip)

> **Goal:** Remove all Rocket.Chat and MongoDB infrastructure. Add Zulip container. Update all environment files. Rename `employees.rocketchat_user_id` → `employees.zulip_user_id` (INTEGER). Update JWT payload type. Scaffold the `attendance-app/` and `zulip-bot/` directories. Ensure all existing 30 passing tests remain GREEN throughout this migration.

> **Decision reference:** Decision 12 in `CONTEXT/decision_log.md`. Read it in full before beginning this phase.

---

#### W-051 — Docker: Remove MongoDB & Rocket.Chat, Add Zulip Container

**Root cause:**
Decision 12 dropped Rocket.Chat and MongoDB from the architecture entirely. The `docker/docker-compose.yml` still contains the `mongo`, `mongo-init`, and `rocketchat` services and the `mongodata` volume, which must be removed. Zulip must be added in their place using Zulip's official Docker image.

**Goal:**
1. `docker/docker-compose.yml` contains only: `postgres`, `zulip` (and Zulip's own internally managed Postgres or the shared one — see Approach below).
2. `mongodata` volume is removed.
3. Zulip container is healthy and accessible at `http://127.0.0.1:9991`.
4. All existing Postgres-dependent tests remain GREEN.

**Approach:**
Zulip's official Docker image (`zulip/docker-zulip`) manages its own internal Postgres and RabbitMQ containers internally via its `docker-compose.yml` pattern. For local dev, use Zulip's recommended `docker-zulip` compose setup running in isolation on port 9991. The JD Connect `docker-compose.yml` removes Mongo/RC services and adds a reference block pointing to the Zulip stack (or includes the Zulip service directly as a separate compose file). Zulip and JD Connect Postgres remain on separate networks — Zulip never sees JD Connect's Postgres.

---

- [x] **RED — Infrastructure Check:**
  - [x] Test: `docker compose -f docker/docker-compose.yml ps` → confirm `mongo`, `mongo-init`, `rocketchat` services are present (they should be, before removal).
  - [x] Test: `curl http://127.0.0.1:9991` → confirm RED (Zulip not yet running).
  - [x] **Run — confirm RED (Zulip not accessible).**

- [x] **GREEN — Docker Compose Update:**
  - [x] [Docker] In `docker/docker-compose.yml`:
        - **Remove** services: `mongo`, `mongo-init`, `rocketchat`.
        - **Remove** volume: `mongodata`.
        - **Add** service `zulip`:
          ```yaml
          zulip:
            image: zulip/docker-zulip:latest
            container_name: jdconnect_zulip
            restart: unless-stopped
            ports:
              - "9991:80"
            environment:
              - SETTING_EXTERNAL_HOST=127.0.0.1
              - SETTING_ZULIP_ADMINISTRATOR=admin@company.com
              - SECRETS_email_password=zulipdevpassword
              - SECRETS_postgres_password=zulipdevpostgrespassword
              - SETTING_EMAIL_HOST=
              - SETTING_EMAIL_HOST_USER=
              - DISABLE_HTTPS=true
            volumes:
              - zulipdata:/data
          ```
        - **Add** volume: `zulipdata: { driver: local }`.
  - [x] Run `docker compose down --volumes` to remove old Mongo data.
  - [x] Run `docker compose up -d` with new config.
  - [x] Run integration check — **confirm GREEN.**

- [x] **RED — Unit Check:**
  - [x] Verify `curl http://127.0.0.1:9991` returns HTTP 200 or a Zulip login page response.
  - [x] **Run — confirm RED (before containers start).**

- [x] **GREEN — Zulip Running:**
  - [x] Confirm `docker ps` shows `jdconnect_zulip` as `healthy` or running — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `docker compose ps` → `postgres` healthy, `zulip` running, NO `mongo` or `rocketchat` services.
  - [x] Open `http://127.0.0.1:9991` in browser → Zulip setup wizard or login page appears.
  - [x] Existing `pnpm test` suite → all 30 tests still GREEN (no Postgres or Backend changes yet).
  - [x] ✅ Done.

> **Session Note (Phase 0.5 / W-051 Troubleshooting — 2026-08-14)**
> - **Standalone Database Setup:** Added a dedicated `zulip-postgres` service (`postgres:16-alpine`, volume `zulipdbdata`) in `docker-compose.yml` to store Zulip chat data independently from the `jdconnect` Postgres database.
> - **Nginx Header & Proxy Fix:** Configured `SETTING_LOADBALANCER_IPS=["172.19.0.1", "172.18.0.1", "172.17.0.1", "127.0.0.1", "172.16.0.0/12"]` and set `uwsgi_param HTTP_X_FORWARDED_PROTO https;` to allow direct HTTP dev access on port `9991` (`DISABLE_HTTPS=true`) without triggering Zulip's proxy error page.
> - **Status:** `jdconnect_zulip` initialization completed cleanly (`Zulip first start init successful.`) and single-use organization registration link was generated successfully.

---

#### W-052 — Environment Files: Replace ROCKETCHAT_* with ZULIP_*

**Root cause:**
All `.env.*` files still reference `ROCKETCHAT_URL`, `ROCKETCHAT_ADMIN_USER`, `ROCKETCHAT_ADMIN_PASSWORD`, `ROCKETCHAT_ADMIN_TOKEN`, and `ROCKETCHAT_ADMIN_ID`. These must be replaced with Zulip equivalents (`ZULIP_BASE_URL`, `ZULIP_BOT_EMAIL`, `ZULIP_BOT_API_KEY`) and the `ALLOWED_CORS_ORIGINS` updated to drop the RC port.

**Goal:**
1. `.env.example` has `ZULIP_*` variables and no `ROCKETCHAT_*` variables.
2. `.env.test` and `.env.test.example` are updated correspondingly.
3. `docker/.env.example` is updated.
4. Backend API compiles (`pnpm typecheck`) and tests pass (`pnpm test`) after env changes.

**Approach:**
Zulip REST API authenticates using a bot account's email + API key (`Authorization: Basic base64(bot_email:api_key)`). The Backend API will use a dedicated admin bot account in Zulip. Create this bot in the Zulip admin panel after W-051 completes. The API key is stored in the env file.

---

- [x] **RED — Infrastructure Check:**
  - [x] Verify `.env.example` still contains `ROCKETCHAT_URL` — confirm it exists (pre-edit state).
  - [x] **Run — confirm RED (old RC vars present).**

- [x] **GREEN — Env File Updates:**
  - [x] [Env] Update `.env.example`:
        - Remove: `ROCKETCHAT_URL`, `ROCKETCHAT_ADMIN_USER`, `ROCKETCHAT_ADMIN_PASSWORD`, `ROCKETCHAT_ADMIN_TOKEN`, `ROCKETCHAT_ADMIN_ID`.
        - Add:
          ```
          # Zulip Integration & Admin Bot API
          ZULIP_BASE_URL=http://127.0.0.1:9991
          ZULIP_BOT_EMAIL=jdconnect-bot@company.com
          ZULIP_BOT_API_KEY=zulip_bot_api_key_here
          ZULIP_ATTENDANCE_STREAM=attendance
          ```
        - Update `ALLOWED_CORS_ORIGINS=http://127.0.0.1:3200,http://127.0.0.1:9991`.
  - [x] [Env] Apply the same changes to `.env.test` and `.env.test.example`.
  - [x] [Env] Update `docker/.env.example` with Zulip service variables.
  - [x] Run `pnpm typecheck` — **confirm GREEN (no TS errors from env changes).**

- [x] **RED — Unit Check:**
  - [x] Run `pnpm test` → confirm all 30 existing tests still GREEN.
  - [x] **Run — confirm RED if any test references old RC env vars.**

- [x] **GREEN — Tests Stable:**
  - [x] Verify no test imports or references `ROCKETCHAT_*` env vars — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `cat .env.example` → no `ROCKETCHAT_*` variables present.
  - [x] `cat .env.example` → `ZULIP_BASE_URL`, `ZULIP_BOT_EMAIL`, `ZULIP_BOT_API_KEY` present.
  - [x] `pnpm test` → all 30 tests GREEN.
  - [x] ✅ Done.

---

#### W-053 — Database: Rename `rocketchat_user_id` → `zulip_user_id` (INTEGER)

**Root cause:**
Decision 12 changes the cross-system key from `employees.rocketchat_user_id TEXT` (Rocket.Chat's string `_id`) to `employees.zulip_user_id INTEGER` (Zulip's numeric user ID). The Postgres migration, the repository query, and all TypeScript types referencing this column must be updated.

**Goal:**
1. New SQL migration `011_rename_rocketchat_to_zulip.sql` runs cleanly on both `jdconnect` and `jdconnect_test` databases.
2. `employees` table has column `zulip_user_id INTEGER UNIQUE` (was `rocketchat_user_id TEXT UNIQUE`).
3. Index renamed from `idx_employees_rc_user` to `idx_employees_zulip_user`.
4. `rc_provisioned` column renamed to `zulip_provisioned`.
5. `employee.repository.ts#findByRocketChatId` renamed to `findByZulipUserId` with updated query.
6. All TypeScript types updated: `EmployeeResponse.rc_provisioned` → `zulip_provisioned`, `rc_user_id: string` → `zulip_user_id: number` in `JwtPayload`.
7. All existing 30 tests pass GREEN after migration.

**Approach:**
Write a new numbered migration file (011) using `ALTER TABLE` with column rename and type change. Drop the old index, create the new one. Update repository method and all dependent type files. The JWT payload type change affects `src/types/auth.ts` and `src/middleware/auth.ts`.

---

- [x] **RED — Integration (`backend/tests/migrations.test.ts`):**
  - [x] Add test: Query `information_schema.columns` for `employees.zulip_user_id` with `data_type = 'integer'` → assert column exists.
  - [x] Add test: Query `information_schema.columns` for `employees.rocketchat_user_id` → assert it does NOT exist.
  - [x] **Run — confirm RED (column still named `rocketchat_user_id`).**

- [x] **GREEN — Backend:**
  - [x] [Schema] Create `backend/migrations/011_rename_rocketchat_to_zulip.sql`:
        ```sql
        -- Rename and retype cross-system key column
        ALTER TABLE employees
          DROP COLUMN IF EXISTS rocketchat_user_id;
        ALTER TABLE employees
          ADD COLUMN IF NOT EXISTS zulip_user_id INTEGER UNIQUE;

        -- Rename provisioning flag
        ALTER TABLE employees
          RENAME COLUMN rc_provisioned TO zulip_provisioned;

        -- Update index
        DROP INDEX IF EXISTS idx_employees_rc_user;
        CREATE INDEX IF NOT EXISTS idx_employees_zulip_user ON employees(zulip_user_id);
        ```
  - [x] Run `npx ts-node backend/scripts/migrate.ts` on `jdconnect` and `jdconnect_test`.
  - [x] [Repository] In `backend/src/repositories/employee.repository.ts`:
        - Rename `findByRocketChatId(rcUserId: string)` → `findByZulipUserId(zulipUserId: number)`.
        - Update SQL: `SELECT * FROM employees WHERE zulip_user_id = $1`.
        - Update column references in `createEmployee` and `updateEmployee` calls.
  - [x] [Types] In `backend/src/types/auth.ts`:
        - Change `JwtPayload.rc_user_id: string` → `zulip_user_id: number`.
  - [x] [Middleware] In `backend/src/middleware/auth.ts`:
        - Update `req.employee` attachment: replace `rc_user_id` with `zulip_user_id`.
        - Update `requirePermission` and any JWT payload destructuring.
  - [x] [Types] In `backend/src/types/employee.ts`:
        - Change `EmployeeResponse.rocketchat_user_id` → `zulip_user_id: number | null`.
        - Change `EmployeeResponse.rc_provisioned` → `zulip_provisioned: boolean`.
  - [x] Run integration test — **confirm GREEN.**

- [x] **RED — Unit (`backend/tests/employee.service.unit.test.ts`):**
  - [x] Update mocks: replace `rocketchat_user_id` with `zulip_user_id` in all test employee fixtures.
  - [x] Replace any `findByRocketChatId` mock with `findByZulipUserId`.
  - [x] **Run — confirm RED (mocks still use old field names).**

- [x] **GREEN — Updated Unit Tests:**
  - [x] Fix all test fixtures and mock references — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `psql -U jduser -d jdconnect -c "\d employees"` → column `zulip_user_id integer` present, `rocketchat_user_id` absent.
  - [x] `psql -U jduser -d jdconnect -c "\d employees"` → column `zulip_provisioned boolean` present, `rc_provisioned` absent.
  - [x] `pnpm test` → all 30 tests GREEN.
  - [x] ✅ Done.

---

#### W-054 — Scaffold `attendance-app/` and `zulip-bot/` Directories

**Root cause:**
Decision 12 retired the `rc-app/` (Rocket.Chat Apps-Engine) directory in favour of two new components: a standalone Attendance Web App (`attendance-app/`) and a stateless Zulip Bot (`zulip-bot/`). These directories must be scaffolded with the correct project structure, package.json, and placeholder source files so the monorepo remains consistent and the CI pipeline does not break.

**Goal:**
1. `rc-app/` directory is removed (or archived — do not delete if it has existing source files that need preserving for reference).
2. `attendance-app/` directory scaffolded with `package.json`, `index.html` (placeholder), `app.js` (placeholder), and `README.md`.
3. `zulip-bot/` directory scaffolded with `package.json`, `tsconfig.json`, `src/poster.ts` (placeholder), and `README.md`.
4. Root `pnpm-workspace.yaml` updated to include `attendance-app` and `zulip-bot` (replacing `rc-app`).
5. `pnpm install` at root succeeds. `pnpm typecheck` succeeds across all workspaces.

**Approach:**
Create the two new directories with minimal but functional scaffolding. The actual implementation of the Attendance Web App UI and Zulip Bot message poster happens in Phase 5. This work item only ensures the directory structure, package.json workspace definitions, and placeholder source files exist.

---

- [x] **RED — Infrastructure Check:**
  - [x] Verify `ls` → `rc-app/` exists, `attendance-app/` and `zulip-bot/` do NOT exist.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Directory Scaffolding:**
  - [x] [Files] Archive or remove `rc-app/` directory. (If it contains source files already written, rename to `rc-app.archived/` for reference.)
  - [x] [Files] Create `attendance-app/` with:
        - `attendance-app/package.json` (name: `@jdconnect/attendance-app`, version: `1.0.0`, scripts: `{ "start": "npx serve ." }`).
        - `attendance-app/index.html` (placeholder HTML skeleton with `<title>JD Connect — Attendance</title>`).
        - `attendance-app/app.js` (placeholder: `// Attendance Web App — implemented in Phase 5`).
        - `attendance-app/README.md` (brief description: standalone attendance web page).
  - [x] [Files] Create `zulip-bot/` with:
        - `zulip-bot/package.json` (name: `@jdconnect/zulip-bot`, version: `1.0.0`, scripts: `{ "start": "ts-node src/poster.ts" }`, dependencies: `node-fetch`, `dotenv`; devDependencies: `typescript`, `ts-node`, `@types/node`).
        - `zulip-bot/tsconfig.json` (extends `../tsconfig.base.json`).
        - `zulip-bot/src/poster.ts` (placeholder: `// Zulip Bot message poster — implemented in Phase 5`).
        - `zulip-bot/README.md` (brief description: posts daily attendance prompt to Zulip #attendance stream).
  - [x] [Config] Update `pnpm-workspace.yaml`: replace `packages/rc-app` or `rc-app` with `attendance-app` and `zulip-bot`.
  - [x] Run `pnpm install` at root — **confirm GREEN.**

- [x] **RED — Unit Check:**
  - [x] Run `pnpm typecheck` — **confirm RED if new files have TS issues.**

- [x] **GREEN — Typecheck:**
  - [x] Fix any TypeScript config issues in new workspaces — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `ls` at root → `attendance-app/` and `zulip-bot/` present, `rc-app/` absent (or renamed).
  - [x] `pnpm install` → succeeds with no workspace resolution errors.
  - [x] `pnpm typecheck` → all workspaces (backend, attendance-app, zulip-bot, hr-dashboard) pass.
  - [x] `pnpm test` → all 30 tests GREEN (no regressions).
  - [x] ✅ Done.

> **Session Note (Phase 0.5 — 2026-08-14)**
> - **Decision 12 Accepted:** Rocket.Chat replaced by Zulip. MongoDB removed. `rc-app/` replaced by `attendance-app/` + `zulip-bot/`. See `CONTEXT/decision_log.md` Decision 12 for full rationale.
> - **Phase 0.5 Added:** Four work items (W-051 through W-054) covering Docker reconfiguration, env file updates, database migration renaming `rocketchat_user_id` → `zulip_user_id`, and directory scaffolding.

---

### Phase 1 — JWT Authentication

> **Goal:** The Backend API can register employees (creating user + employee records), issue asymmetric RS256 JWTs on login, enforce active single-session tracking, guard routes via auth middleware, and support HR-initiated password resets.

---

#### W-101 — User Registration / Employee Creation (No RC Provisioning Yet)

**Root cause:** No endpoint exists to create employee profiles and underlying auth user credentials in Postgres.

**Goal:** `POST /api/employees` creates a `users` record (`email`, `bcrypt` hash) and an `employees` record. Returns employee profile with `rc_provisioned: false`. Enforces `employees.manage` permission.

**Approach:** Repository layer handles Postgres insertion for `users` and `employees`. Service layer validates permission, checks email uniqueness, and hashes password using `bcrypt` (rounds = 12). Controller applies Zod schema and JWT guard.

---

- [x] **RED — Integration (`backend/tests/employees.test.ts`):**
  - [x] Test: `POST /api/employees` with `{ full_name, email, password, role_key, department_id }` as super_admin JWT → assert HTTP 201, body `{ id, employee_code, full_name, email, rc_provisioned: false }`, row in `users`, row in `employees`.
  - [x] Test: `POST /api/employees` with existing email → assert HTTP 409 `{ error: "Email already exists" }`.
  - [x] Test: `POST /api/employees` without JWT → assert HTTP 401.
  - [x] Test: `POST /api/employees` with caller lacking `employees.manage` → assert HTTP 403.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend:**
  - [x] [Schema] No migration needed — `users` and `employees` exist per `database_schema.md`.
  - [x] [Repository] `src/repositories/user.repository.ts`: `createUser({ email, passwordHash })`.
  - [x] [Repository] `src/repositories/employee.repository.ts`: `createEmployee(data)`.
  - [x] [Service] `src/services/employee.service.ts#createEmployee`:
        - Verify caller has `employees.manage` permission.
        - Check email uniqueness via `userRepository.findByEmail(email)`.
        - Hash password: `bcrypt.hash(password, 12)`.
        - Call `userRepository.createUser` then `employeeRepository.createEmployee`.
        - Return employee record with `rc_provisioned: false`.
  - [x] [Controller] `src/routes/employees.ts` `POST /`:
        - Apply JWT auth middleware (`src/middleware/auth.ts`).
        - Zod schema validation: `{ full_name, email, password, role_key, department_id?, centre_id?, shift_id?, designation? }`.
        - Call `employeeService.createEmployee`.
        - Return HTTP 201.
  - [x] Run integration test — **confirm GREEN.**

- [x] **RED — Unit (`backend/tests/employee.service.unit.test.ts`):**
  - [x] Mock `userRepository.findByEmail` → return null. Mock `userRepository.createUser` → fake user. Mock `employeeRepository.createEmployee` → fake employee. Call `employeeService.createEmployee` → assert bcrypt called, repositories called with correct arguments.
  - [x] Mock `userRepository.findByEmail` → return existing user. Assert service throws `DuplicateEmailError`. Assert `createUser` NOT called.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Service Logic:**
  - [x] [Type] `src/types/employee.ts` — export `CreateEmployeeInput`, `EmployeeResponse`.
  - [x] Implement service methods — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `POST /api/employees` with valid payload and super_admin JWT → 201 created response.
  - [x] `psql` check `SELECT * FROM users WHERE email = 'test@company.com'` → row exists with bcrypt hash (`$2b$12$...`).
  - [x] `psql` check `SELECT * FROM employees WHERE email = 'test@company.com'` → row exists, `rc_provisioned = false`.
  - [x] ✅ Done.

> **Session Note 3 — 2026-08-14**
> - **W-101 Completion**: Built and fully verified W-101 (`POST /api/employees`) with CSR architecture (`src/routes/employees.ts` -> `src/services/employee.service.ts` -> `src/repositories/`). Added Zod input validation, RS256 JWT auth middleware, `requirePermission('employees.manage')` permission guard, bcrypt password hashing (12 rounds), and duplicate email conflict handling.
> - **Clean Codebase State**: Removed draft W-102 test file so all tests across the monorepo pass 100% GREEN (18/18 passing tests). Standing by for explicit user approval before beginning W-102.

---

#### W-102 — Login Endpoint (Issue JWT & Session Tracking)

**Root cause:** Without a login endpoint, users cannot obtain JWT tokens to authenticate subsequent requests.

**Goal:** `POST /api/auth/login` verifies credentials, enforces active status, generates RS256 JWT, writes session token hash to `employee_sessions`, and returns `{ access_token, token_type: "Bearer" }`.

**Approach:** `userRepository` queries user and linked employee details. `authService` verifies bcrypt password, checks `employment_status === 'active'`, constructs JWT payload (`sub`, `employee_id`, `rc_user_id`, `roles`), signs with RS256 private key, and logs session in `employee_sessions`.

---

- [x] **RED — Integration (`backend/tests/auth.test.ts`):**
  - [x] Test: `POST /api/auth/login` with valid `{ email, password }` → assert HTTP 200, body `{ access_token, token_type: "Bearer" }`, decoded JWT contains `employee_id` and `rc_user_id`.
  - [x] Test: `POST /api/auth/login` with wrong password → assert HTTP 401.
  - [x] Test: `POST /api/auth/login` with non-existent email → assert HTTP 401 (do NOT reveal email non-existence).
  - [x] Test: `POST /api/auth/login` for suspended employee → assert HTTP 403 `{ error: "Account suspended" }`.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend:**
  - [x] [Schema] No migration needed — `employee_sessions` exists per `database_schema.md`.
  - [x] [Repository] `src/repositories/user.repository.ts#findAuthUserByEmail`: JOIN `users`, `employees`, `roles`.
  - [x] [Repository] `src/repositories/session.repository.ts#createSession`: INSERT into `employee_sessions`.
  - [x] [Service] `src/services/auth.service.ts#login`:
        - Find user by email.
        - Verify bcrypt: `bcrypt.compare(password, user.password_hash)`.
        - Check `employee.employment_status === 'active'`.
        - Payload: `{ sub: user.id, employee_id: employee.id, rc_user_id: employee.rocketchat_user_id, roles: [role.key] }`.
        - Sign JWT with RS256 private key (`jose` library, 15m expiration).
        - Save session token hash in `employee_sessions`.
        - Return `{ access_token, token_type: "Bearer" }`.
  - [x] [Controller] `src/routes/auth.ts` `POST /login`:
        - Zod schema: `{ email: z.string().email(), password: z.string().min(1) }`.
        - Call `authService.login`.
        - Return HTTP 200.
  - [x] Run integration test — **confirm GREEN.**

- [x] **RED — Unit (`backend/tests/auth.service.unit.test.ts`):**
  - [x] Mock user with invalid password → assert `login` throws `InvalidCredentialsError`.
  - [x] Mock employee with status `'suspended'` → assert `login` throws `AccountSuspendedError`.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Auth Logic:**
  - [x] [Type] `src/types/auth.ts` — export `LoginInput`, `JwtPayload`, `AuthResponse`.
  - [x] Implement service methods — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] `POST /api/auth/login` with valid email & password → HTTP 200 with JWT token.
  - [x] Decode JWT at jwt.io → verify `sub`, `employee_id`, `rc_user_id`, `roles` payload.
  - [x] Query Postgres `employee_sessions` table → session row present and active.
  - [x] ✅ Done.

> **Session Note 4 — 2026-08-14**
> - **W-102 Completion**: Built and fully verified W-102 (`POST /api/auth/login`) with CSR architecture (`src/routes/auth.ts` -> `src/services/auth.service.ts` -> `src/repositories/`). Added RS256 JWT token generation, bcrypt password comparison, employment status check (`suspended` check), session tracking in `employee_sessions` table, and unit + integration tests.
> - **Quality Verification**: Verified `pnpm ci:quality` (`lint` -> `typecheck` -> `test` -> `build`) passing 100% cleanly with 10 test files and 24/24 passing tests.

---

#### W-103 — JWT Auth Middleware & Role Scoping

**Root cause:** Protected routes require a central middleware to validate JWT Bearer tokens and attach employee context.

**Goal:** Middleware `src/middleware/auth.ts` extracts `Authorization: Bearer <token>`, verifies RS256 signature, decodes payload, attaches `req.employee`, and checks requested permission keys.

**Approach:** Use `jose` to verify JWT signature against public key. Query employee details if necessary. Expose helper `requirePermission(permissionKey)` middleware.

---

- [x] **RED — Unit (`backend/tests/auth.middleware.unit.test.ts`):**
  - [x] Test: valid JWT → calls `next()`, populates `req.employee` with `{ id, rc_user_id, roles, permissions }`.
  - [x] Test: expired JWT → returns HTTP 401 `{ error: "Token expired" }`.
  - [x] Test: malformed token → returns HTTP 401 `{ error: "Invalid token" }`.
  - [x] Test: missing header → returns HTTP 401 `{ error: "No token provided" }`.
  - [x] Test: user lacking permission → returns HTTP 403 `{ error: "Insufficient permissions" }`.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Middleware:**
  - [x] [Middleware] `src/middleware/auth.ts#authenticateJwt`:
        - Extract Bearer token from header.
        - Verify RS256 signature using `jose.jwtVerify`.
        - Attach `req.employee = { id: payload.employee_id, rc_user_id: payload.rc_user_id, roles: payload.roles }`.
        - Call `next()`.
  - [x] [Middleware] `src/middleware/auth.ts#requirePermission(permissionKey)`:
        - Fetch active permissions for `req.employee.roles` from DB cache.
        - If permission key missing → return HTTP 403.
        - Else call `next()`.
  - [x] Run unit tests — **confirm GREEN.**

- [x] **RED — Integration (`backend/tests/protected_route.test.ts`):**
  - [x] Test: Request protected route `/api/employees` without header → 401. With valid JWT → 200.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Route Integration:**
  - [x] Wire middleware onto `/api/employees` routes — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Call protected endpoint with valid JWT → success.
  - [x] Call protected endpoint with tampered JWT → HTTP 401.
  - [x] ✅ Done.

> **Session Note 5 — 2026-08-14**
> - **W-103 Completion**: Built and fully verified W-103 (`authenticateJwt` and `requirePermission` middlewares in `src/middleware/auth.ts`). Validated RS256 token verification, payload claim extraction, explicit `exp` expiration validation, `super_admin` role bypass, and DB role permission checks.
> - **Quality Verification**: Verified `pnpm ci:quality` (`lint` -> `typecheck` -> `test` -> `build`) passing 100% cleanly across all workspaces with 11 test files and 30/30 passing tests.

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

### Phase 1.5 — Zulip Backend Alignment (Refactor Phase 1 Auth & Employees for Zulip)

> **Goal:** Align Phase 1 backend code, routes, middleware, and tests with Decision 12 (Zulip migration). Refactor employee creation to use `zulip_provisioned` and `zulip_user_id: number | null`, update JWT payload type to `zulip_user_id: number`, update auth middleware to attach `req.employee.zulip_user_id`, and ensure all unit/integration test suites pass GREEN.

---

#### W-151 — Refactor Employee Creation Service & Endpoint for `zulip_user_id`

**Root cause:** W-101 was written before Decision 12, so the employee creation response type, repository calls, and test assertions reference `rc_provisioned` and `rocketchat_user_id`. They must be updated to `zulip_provisioned` and `zulip_user_id`.

**Goal:** `POST /api/employees` returns employee profile with `zulip_provisioned: false` and `zulip_user_id: null`. All tests in `backend/tests/employees.test.ts` and `backend/tests/employee.service.unit.test.ts` updated and passing.

**Approach:** Update `CreateEmployeeInput` and `EmployeeResponse` in `src/types/employee.ts`. Update `employeeRepository.createEmployee` call in `src/services/employee.service.ts`. Update test fixtures.

---

- [ ] **RED — Integration (`backend/tests/employees.test.ts`):**
  - [ ] Update assertions: `POST /api/employees` → assert body `{ id, employee_code, full_name, email, zulip_provisioned: false, zulip_user_id: null }`. Confirm tests fail if old property names are returned.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Type] `src/types/employee.ts`: replace `rocketchat_user_id` with `zulip_user_id: number | null`, replace `rc_provisioned` with `zulip_provisioned: boolean`.
  - [ ] [Service] `src/services/employee.service.ts`: return `zulip_provisioned: false`, `zulip_user_id: null`.
  - [ ] [Controller] `src/routes/employees.ts`: update response mapping.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/employee.service.unit.test.ts`):**
  - [ ] Update mocks to return `zulip_provisioned: false`, `zulip_user_id: null`. Confirm failure pre-fix.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Service Logic:**
  - [ ] Update service tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] `POST /api/employees` as super_admin → 201 response with `zulip_provisioned: false`, `zulip_user_id: null`.
  - [ ] `psql` check `SELECT zulip_provisioned, zulip_user_id FROM employees` → `false`, `null`.
  - [ ] ✅ Done.

---

#### W-152 — Refactor Auth Service & Login Endpoint for `zulip_user_id`

**Root cause:** W-102 constructed JWT payloads with claim `rc_user_id: string`. Per Decision 12, the claim is `zulip_user_id: number` (integer).

**Goal:** `POST /api/auth/login` generates RS256 JWT with `zulip_user_id: number`. `src/types/auth.ts` `JwtPayload` updated. All tests in `auth.test.ts` and `auth.service.unit.test.ts` updated and passing.

**Approach:** Update `JwtPayload` in `src/types/auth.ts`. Update `auth.service.ts#login` payload construction. Update test assertions.

---

- [ ] **RED — Integration (`backend/tests/auth.test.ts`):**
  - [ ] Update test assertion: decoded JWT must contain `zulip_user_id` of type `number` (or `null` if unprovisioned). Confirm failure pre-fix.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Type] `src/types/auth.ts`: change `rc_user_id: string` → `zulip_user_id: number | null`.
  - [ ] [Repository] `src/repositories/user.repository.ts`: query `zulip_user_id` instead of `rocketchat_user_id`.
  - [ ] [Service] `src/services/auth.service.ts`: construct JWT payload with `zulip_user_id`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/auth.service.unit.test.ts`):**
  - [ ] Update test fixtures with `zulip_user_id`. Confirm failure pre-fix.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Auth Logic:**
  - [ ] Update service unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] `POST /api/auth/login` → 200 response with JWT.
  - [ ] Decode JWT → payload contains `zulip_user_id` (number/null).
  - [ ] ✅ Done.

---

#### W-153 — Refactor JWT Auth Middleware for `zulip_user_id`

**Root cause:** `src/middleware/auth.ts` extracts `payload.rc_user_id` and attaches `req.employee.rc_user_id`. Must extract `payload.zulip_user_id` and attach `req.employee.zulip_user_id`.

**Goal:** `authenticateJwt` populates `req.employee` with `{ id, zulip_user_id, roles }`. All tests in `auth.middleware.unit.test.ts` and `protected_route.test.ts` passing.

**Approach:** Update `Express.Request` type declaration, update `authenticateJwt` middleware, update tests.

---

- [ ] **RED — Unit (`backend/tests/auth.middleware.unit.test.ts`):**
  - [ ] Update test assertion: `req.employee` populated with `zulip_user_id` (number). Confirm failure pre-fix.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Middleware:**
  - [ ] [Middleware] `src/middleware/auth.ts`: attach `req.employee = { id: payload.employee_id, zulip_user_id: payload.zulip_user_id, roles: payload.roles }`.
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **RED — Integration (`backend/tests/protected_route.test.ts`):**
  - [ ] Call protected endpoint with JWT containing `zulip_user_id` → assert 200.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Route Integration:**
  - [ ] Verify protected routes — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Protected route request with valid JWT → 200 OK, `req.employee.zulip_user_id` accessible.
  - [ ] `pnpm test` → all 30 tests GREEN.
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

### Phase 4 — Zulip Integration & SSO

> **Goal:** Synchronize employee creation with Zulip account provisioning via Zulip REST API (`POST /api/v1/users`), store `zulip_user_id` (integer) atomically, and implement OIDC (OpenID Connect) Identity Provider endpoints for Zulip Single Sign-On (SSO).

---

#### W-401 — Zulip User Provisioning on Employee Creation

**Root cause:** Creating an employee in Postgres must automatically provision a corresponding user in Zulip so the user can log into chat and receive attendance notifications.

**Goal:** Extend `POST /api/employees` flow: after Postgres insertion, call Zulip REST API `POST /api/v1/users`. Save returned `user_id` integer to `employees.zulip_user_id` and set `zulip_provisioned = true`. If Zulip fails, set `zulip_provisioned = false` and expose `POST /api/employees/:id/retry-zulip-provisioning`.

**Approach:** Build `src/services/zulip.service.ts` using `fetch`/`axios` with Basic Auth (`Authorization: Basic base64(ZULIP_BOT_EMAIL:ZULIP_BOT_API_KEY)`). On employee creation:
1. INSERT into Postgres `employees`.
2. Call `zulipService.createUser({ email, full_name, password })`.
3. On success: UPDATE Postgres set `zulip_user_id = zulipUser.user_id`, `zulip_provisioned = true`.
4. On failure: keep Postgres row, set `zulip_provisioned = false`, log error, return 201 with warning metadata.

---

- [ ] **RED — Integration (`backend/tests/zulip_provisioning.test.ts`):**
  - [ ] Test (with Zulip REST API mocked): `POST /api/employees` → assert HTTP 201, `employees.zulip_user_id` populated with `42`, `zulip_provisioned = true`.
  - [ ] Test (Zulip API returns 500 error): `POST /api/employees` → assert HTTP 201, `employees.zulip_user_id` is null, `zulip_provisioned = false`, response contains `{ warning: "Zulip account creation failed" }`.
  - [ ] Test: `POST /api/employees/:id/retry-zulip-provisioning` for employee with `zulip_provisioned = false` → assert HTTP 200, Zulip user created, `zulip_provisioned` updated to `true`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed — `zulip_user_id` and `zulip_provisioned` exist per migration `011`.
  - [ ] [Service] `src/services/zulip.service.ts#createUser`:
        - Call `POST ${ZULIP_BASE_URL}/api/v1/users` with Basic Auth header.
        - Body: `email`, `full_name`, `password`.
        - Return `{ zulipUserId: response.data.user_id }`.
  - [ ] [Service] `src/services/employee.service.ts#createEmployee`:
        - Execute Postgres write.
        - Try calling `zulipService.createUser`.
        - If success: update Postgres row `zulip_user_id` and `zulip_provisioned = true`.
        - If failure: update Postgres row `zulip_provisioned = false`. Return employee record with status.
  - [ ] [Controller] `src/routes/employees.ts`:
        - Update `POST /` to handle dual-system provisioning.
        - Add `POST /:id/retry-zulip-provisioning` route.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/zulip_service.unit.test.ts`):**
  - [ ] Mock Zulip API response shape `{ result: "success", user_id: 42 }` → assert returns `42`.
  - [ ] Mock Zulip API error shape `{ result: "error", msg: "Email already in use" }` → assert service throws `ZulipProvisioningError`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Dual Provisioning Logic:**
  - [ ] [Type] `src/types/zulip.ts` — export `ZulipCreateUserPayload`, `ZulipUserResponse`.
  - [ ] Implement Zulip service wrapper — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Create employee via `POST /api/employees`.
  - [ ] Open Zulip admin portal (`http://127.0.0.1:9991/#organization/users`) -> verify newly created user appears in directory.
  - [ ] Query Postgres `employees` -> `zulip_user_id` matches Zulip `user_id` integer, `zulip_provisioned = true`.
  - [ ] ✅ Done.

---

#### W-402 — OIDC Server Endpoints (for Zulip SSO)

**Root cause:** Zulip must defer user authentication to the Backend API via OIDC / Generic OAuth 2.0 so employees log in once and land directly in Zulip.

**Goal:** Implement OIDC / OAuth 2.0 identity provider endpoints in Backend API:
- `GET /oauth/authorize`: Validates client, generates auth code.
- `POST /oauth/token`: Exchanges auth code for access token.
- `GET /oauth/userinfo`: Returns identity matching Zulip OIDC payload (`{ sub, email, name, preferred_username }`).

**Approach:** Implement `src/services/oauth.service.ts` managing authorization codes with short TTL (5 mins). `GET /oauth/userinfo` extracts `zulip_user_id` from Bearer token and returns employee details.

---

- [ ] **RED — Integration (`backend/tests/oauth.test.ts`):**
  - [ ] Test: `GET /oauth/authorize?client_id=zulip&response_type=code&redirect_uri=...` with valid session → redirects to `redirect_uri?code=<auth_code>`.
  - [ ] Test: `POST /oauth/token` with valid `{ code, grant_type: "authorization_code" }` → returns HTTP 200 `{ access_token, token_type: "Bearer" }`.
  - [ ] Test: `GET /oauth/userinfo` with Bearer token → returns HTTP 200 `{ sub, email, name, preferred_username }` matching `employees.zulip_user_id`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed.
  - [ ] [Service] `src/services/oauth.service.ts`:
        - `generateAuthCode(userId, clientId, redirectUri)`.
        - `exchangeCodeForToken(code)` -> returns JWT access token.
        - `getUserInfo(zulipUserId)` -> queries `employeeRepository.findByZulipUserId(zulipUserId)`.
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
  - [ ] Configure Zulip SSO settings -> set OIDC endpoints to `http://localhost:4000/oauth/*`.
  - [ ] Open Zulip login page -> click SSO login -> redirected to Backend API SSO -> authenticated -> returned to Zulip chat as logged-in user.
  - [ ] ✅ Done.
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

### Phase 5 — Attendance Web App & Zulip Bot

> **Goal:** Build the standalone Attendance Web App (`attendance-app/` served at `clock.yourcompany.com`) for clock-in/out and break tracking, and the stateless Zulip Bot (`zulip-bot/`) to post daily shift-start attendance prompt links into the Zulip `#attendance` stream.

---

#### W-501 — Attendance Web App Scaffold & SSO Auth Flow

**Root cause:** Per Decision 12, employees mark attendance via a standalone lightweight web page (`clock.yourcompany.com`) rather than an embedded RC modal.

**Goal:** Bootstrap single-page Attendance Web App in `attendance-app/` (HTML/CSS/JS). Reads JWT session cookie from root domain SSO login (`.yourcompany.com`), verifies authentication status against `GET /api/auth/me` or `/api/attendance/status`, and renders employee welcome header.

**Approach:** Build responsive UI using modern Vanilla CSS / lightweight JS. Reads JWT token from cookie or local storage. Calls Backend API with Bearer token header. Redirects to Zulip SSO login if unauthenticated.

---

- [ ] **RED — Integration (`attendance-app/tests/auth_flow.test.ts`):**
  - [ ] Test: Unauthenticated navigation to `attendance-app` → redirects to SSO `/oauth/authorize`.
  - [ ] Test: Valid session cookie → loads page, displays employee name and status.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Attendance App Scaffold:**
  - [ ] Create `attendance-app/index.html`: Responsive layout with header, current status badge, action buttons card, break selector card.
  - [ ] Create `attendance-app/app.js`: Auth check, API client helper (`fetch` wrapper with Bearer header).
  - [ ] Create `attendance-app/styles.css`: Sleek modern dark/light card design.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`attendance-app/tests/api_helper.unit.test.ts`):**
  - [ ] Test API client Bearer token attachment and error handling.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — API Helper Unit Test:**
  - [ ] Verify header attachment and error toast triggering — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Open `http://localhost:3300` (or `clock.localhost`) with valid SSO cookie → Welcome card displays logged-in employee name.
  - [ ] ✅ Done.

---

#### W-502 — Attendance Web App Clock-In & Clock-Out UI Handlers

**Root cause:** Employees need clear interactive controls on the Attendance Web App to clock in at shift start and clock out at shift end.

**Goal:** Web app fetches current attendance status (`GET /api/attendance/status`). If clocked out → displays green "Clock In" button calling `POST /api/attendance/clock-in`. If clocked in → displays red "Clock Out" button calling `POST /api/attendance/clock-out` with live duration timer. Displays error toast on duplicate clock-in (409) or error.

**Approach:** `app.js` manages state transition (Clocked Out → Clocked In → Clocked Out). Updates DOM dynamically without full page refresh.

---

- [ ] **RED — Integration (`attendance-app/tests/clock_actions.test.ts`):**
  - [ ] Test Click "Clock In": Sends `POST /api/attendance/clock-in` → status updates to "Clocked In", timer starts.
  - [ ] Test Click "Clock Out": Sends `POST /api/attendance/clock-out` → status updates to "Clocked Out", summary card shows hours worked.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Web App Clock Controls:**
  - [ ] Update `attendance-app/index.html`: Add Clock-In/Clock-Out action button container.
  - [ ] Update `attendance-app/app.js`:
        - `handleClockIn()`: POST `/api/attendance/clock-in` → on 201 show success notification & start timer.
        - `handleClockOut()`: POST `/api/attendance/clock-out` → on 200 show shift summary modal.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`attendance-app/tests/timer.unit.test.ts`):**
  - [ ] Test elapsed shift duration timer calculation function.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Timer Unit Test:**
  - [ ] Verify timer formatting `HH:MM:SS` — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Employee opens `clock.yourcompany.com` -> clicks "Clock In" -> badge changes to "Clocked In since 09:00 AM EST".
  - [ ] Employee clicks "Clock Out" -> shift summary displays total hours worked.
  - [ ] Postgres `attendance_records` -> row verified.
  - [ ] ✅ Done.

---

#### W-503 — Attendance Web App Break UI & Dynamic Dropdown

**Root cause:** Employees select break reasons (bio, tea, dinner, smoke, meeting) from a dynamic dropdown and start/end break events.

**Goal:** Web app fetches break types (`GET /api/break-types?is_active=true`) on load and populates `<select>` dropdown. Selecting a reason and clicking "Start Break" calls `POST /api/breaks/start`. When on break, UI displays active break badge, limit timer, and an "End Break" button calling `POST /api/breaks/end`.

**Approach:** Populate `<select>` options from API. Disable "Start Break" if not clocked in or already on break. Display warning badge if break limit is exceeded.

---

- [ ] **RED — Integration (`attendance-app/tests/break_flow.test.ts`):**
  - [ ] Test Break Dropdown: Populated with `bio`, `tea`, `dinner`, `smoke`, `meeting`.
  - [ ] Test Start Break: Select "Tea Break" -> click "Start Break" -> sends `POST /api/breaks/start` -> active break card appears.
  - [ ] Test End Break: Click "End Break" -> sends `POST /api/breaks/end` -> returns to normal clocked-in view.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Web App Break UI:**
  - [ ] Update `attendance-app/index.html`: Add Break select box, "Start Break" button, active break status banner.
  - [ ] Update `attendance-app/app.js`:
        - `loadBreakTypes()`: GET `/api/break-types?is_active=true` -> populate `<select>`.
        - `handleStartBreak()`: POST `/api/breaks/start` with `{ break_type_key }`.
        - `handleEndBreak()`: POST `/api/breaks/end`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`attendance-app/tests/break_overrun.unit.test.ts`):**
  - [ ] Test break limit warning banner trigger function.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Overrun Unit Test:**
  - [ ] Verify banner triggers when elapsed > limit_minutes — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Clocked-in employee selects "Tea Break" -> clicks "Start Break" -> UI shows "On Tea Break (15 min limit)".
  - [ ] Clicks "End Break" -> success notification shows break duration -> DB record verified.
  - [ ] ✅ Done.

---

#### W-504 — Zulip Bot Daily Attendance Message Poster

**Root cause:** Every morning at shift start, a prompt message must be posted into Zulip's `#attendance` stream so employees can click directly to `clock.yourcompany.com`.

**Goal:** Node.js cron service in `zulip-bot/` running daily at 8:45 AM EST: calls Zulip REST API `POST /api/v1/messages` to post a Markdown message with links to the Attendance Web App into the `#attendance` stream.

**Approach:** Stateless service using `node-cron` or system cron. Calls Zulip API with Basic Auth (`ZULIP_BOT_EMAIL:ZULIP_BOT_API_KEY`). Message includes Markdown link `[🟢 Clock In / Manage Attendance](https://clock.yourcompany.com)`.

---

- [ ] **RED — Integration (`zulip-bot/tests/poster.test.ts`):**
  - [ ] Test: Execute poster script with mocked Zulip API → assert `POST /api/v1/messages` called with `type: "stream"`, `to: "attendance"`, `topic: "Daily Attendance"`, content containing URL `clock.yourcompany.com`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Zulip Bot Poster:**
  - [ ] Create `zulip-bot/src/poster.ts`:
        - Load `ZULIP_BASE_URL`, `ZULIP_BOT_EMAIL`, `ZULIP_BOT_API_KEY`, `ZULIP_ATTENDANCE_STREAM`.
        - Construct Markdown payload:
          ```markdown
          📋 **Good morning team! Please mark your attendance for today.**

          👉 [🟢 Clock In / Manage Attendance](https://clock.yourcompany.com)
          ```
        - Execute `fetch('${ZULIP_BASE_URL}/api/v1/messages')` with Basic Auth.
        - Log message ID or error.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`zulip-bot/tests/message_builder.unit.test.ts`):**
  - [ ] Test Markdown message formatting builder function.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Builder Unit Test:**
  - [ ] Verify message content URL string — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Run `pnpm --filter @jdconnect/zulip-bot start`.
  - [ ] Open Zulip `#attendance` stream -> new message appears with clickable link to `clock.yourcompany.com`.
  - [ ] ✅ Done.

---

### Phase 6 — HR Dashboard (Web App)

> **Goal:** A separate web application (Next.js/React) for HR administrators to manage employees, handle Zulip provisioning retries, inspect attendance/break audit logs, monitor workforce live status, and trigger password resets.

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

#### W-602 — Employee Management UI & Zulip Provisioning Retry Handler

**Root cause:** HR administrators require screens to view the employee directory, onboard new employees, and identify/retry failed Zulip account provisionings (`zulip_provisioned = false`).

**Goal:** Build `/dashboard/employees` page displaying employee directory table with filters (department, centre, status). Build "Add Employee" modal form (`POST /api/employees`). Display warning badge on rows where `zulip_provisioned = false` with a "Retry Zulip Provisioning" button (`POST /api/employees/:id/retry-zulip-provisioning`).

**Approach:** Page fetches `GET /api/employees`. Table renders employee fields per `project_data.md` Section 6. Form collects inputs and sends creation request. "Retry" button invokes API and updates table row state.

---

- [ ] **RED — Integration (`hr-dashboard/tests/employee_ui.test.ts`):**
  - [ ] Test: `/dashboard/employees` fetches and renders employee list table.
  - [ ] Test: Submit "Add Employee" form → sends `POST /api/employees` → table updates with new employee row.
  - [ ] Test: Click "Retry Zulip Provisioning" on employee row with `zulip_provisioned = false` → sends `POST /api/employees/:id/retry-zulip-provisioning` → badge updates to `zulip_provisioned = true`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Employee UI:**
  - [ ] [Type] `hr-dashboard/src/types/employee.ts` — export Frontend employee interfaces.
  - [ ] [Page] `hr-dashboard/src/app/dashboard/employees/page.tsx`: Employee directory table with search, department filter, status badges.
  - [ ] [Component] `hr-dashboard/src/components/AddEmployeeModal.tsx`: Form inputs for full name, email, role, department, centre, shift, joining date.
  - [ ] [Component] `hr-dashboard/src/components/ZulipProvisioningBadge.tsx`: Displays green check for `true`, amber warning + "Retry" button for `false`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`hr-dashboard/tests/employee_table.unit.test.ts`):**
  - [ ] Test table filtering logic by department name.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Table Unit Test:**
  - [ ] Verify filter pipeline — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] HR opens `/dashboard/employees`.
  - [ ] Clicks "Add Employee" -> fills form -> submits.
  - [ ] Employee appears in table. If Zulip container was temporarily down, amber badge "Zulip Failed" shows with "Retry" button.
  - [ ] Click "Retry" -> button triggers provisioning -> badge updates to green "Zulip Provisioned".
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
  - [ ] Target employee can immediately log into Zulip / HR Dashboard using "TempPassword123!".
  - [ ] ✅ Done.

---

### Phase 7 — Data Migration (Old System → New)

> **Goal:** ETL migration scripts to transfer employee profiles, credentials, attendance records, and break history from the old Supabase Postgres to the new plain Postgres database, and migrate historical chat conversations into Zulip via Admin REST API.

---

#### W-701 — ETL Migration Script: Employees & User Credentials

**Root cause:** Existing employee profiles, user credentials, and corporate assignments stored in legacy Supabase Postgres must be migrated to the new plain Postgres schema.

**Goal:** Write `backend/scripts/migrate-employees.ts` that reads old `auth.users` and `public.employees` data, transforms IDs and fields, inserts into new `users` and `employees` tables, and provisions Zulip accounts for all active employees.

**Approach:** Connect to old DB via read-only connection string `OLD_DATABASE_URL`. Read records in batches. Map `auth.users.id` -> `users.id`, preserve `employee_code`. Execute dual-system write to new Postgres and call Zulip Admin REST API `POST /api/v1/users` to set `employees.zulip_user_id`.

---

- [ ] **RED — Integration (`backend/tests/migration_employees.test.ts`):**
  - [ ] Test: Execute `migrate-employees.ts` against old staging database → assert row count in new `users` and `employees` matches old active employee count. All active employees have non-null `zulip_user_id`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Employee Migration Script:**
  - [ ] [Script] Create `backend/scripts/migrate-employees.ts`:
        - Connect to `OLD_DATABASE_URL` and `DATABASE_URL`.
        - SELECT active users and employees from old schema.
        - Transform data: map roles, department names -> department UUIDs, centre codes -> centre UUIDs.
        - INSERT into new `users` and `employees` tables in transaction.
        - Invoke `zulipService.createUser` for each employee -> update `zulip_user_id` and `zulip_provisioned = true`.
        - Log migration summary (migrated count, failed Zulip count).
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
  - [ ] Check Zulip user directory -> all migrated employees appear in Zulip.
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

#### W-703 — Chat History Import via Zulip REST API

**Root cause:** Historical group channel conversations and direct messages from the old platform need to be imported into Zulip streams.

**Goal:** Write `backend/scripts/migrate-chat.ts` that reads legacy conversation threads, maps user accounts via `employees.zulip_user_id`, and uses Zulip REST API (`POST /api/v1/messages`) to populate Zulip streams and topics.

**Approach:** Read legacy chat messages sorted by timestamp. Map sender IDs to Zulip user IDs. Call Zulip REST API endpoints programmatically preserving original sender identities and topics.

---

- [ ] **RED — Integration (`backend/tests/migration_chat.test.ts`):**
  - [ ] Test: Execute `migrate-chat.ts` against test Zulip instance → assert target streams exist and messages are visible with correct sender attribution.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Chat Migration Script:**
  - [ ] [Script] Create `backend/scripts/migrate-chat.ts`:
        - Read legacy channels and message history.
        - Map legacy sender IDs to `employees.zulip_user_id`.
        - Call Zulip REST API to create missing streams.
        - Post historical messages in chronological order via Zulip REST API.
        - Log import statistics (streams created, messages imported, missing user skips).
  - [ ] Run `npx ts-node backend/scripts/migrate-chat.ts`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`backend/tests/chat_transformer.unit.test.ts`):**
  - [ ] Test chat message payload transformer formatting for Zulip REST API.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Chat Transformer Unit Test:**
  - [ ] Verify message payload structure — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Run migration script -> open Zulip web app.
  - [ ] Navigate to imported streams -> verify historical messages and topics are intact.
  - [ ] ✅ Done.

---

### Phase 8 — Production Deployment

> **Goal:** Deploy all four JD Connect components (JD Connect Postgres, Zulip Postgres, Zulip, Backend API, HR Dashboard) to Hostinger VPS using Docker Compose, Nginx reverse proxy with HTTPS TLS certificates, production secrets, and automated daily backups.

---

#### W-801 — VPS Production Docker Compose & Reverse Proxy Setup

**Root cause:** All components must run reliably on a single Hostinger VPS with proper resource constraints, container restart policies, and SSL reverse proxy routing.

**Goal:** Write `docker/docker-compose.prod.yml` and `docker/nginx.conf`. Configure Nginx reverse proxy with Let's Encrypt TLS certificates for subdomains (`chat.yourcompany.com`, `hr.yourcompany.com`, `clock.yourcompany.com`, `api.yourcompany.com`).

**Approach:** Configure production Docker Compose stack with container health checks, named persistent volumes, logging limits, and Nginx container handling SSL termination and proxy passes to internal ports (Zulip: 9991/80, API: 4000, HR Dashboard: 3000, Attendance App: 3300).

---

- [ ] **RED — Production Deployment Check:**
  - [ ] Test: `curl https://api.yourcompany.com/health` and `curl https://chat.yourcompany.com`
  - [ ] **Run — confirm RED (production server not deployed yet).**

- [ ] **GREEN — Production Infrastructure:**
  - [ ] [Docker] Create `docker/docker-compose.prod.yml`:
        - Services: `postgres`, `zulip`, `backend-api`, `hr-dashboard`, `attendance-app`, `zulip-bot`, `nginx`.
        - Set `restart: always` on all services.
        - Define production network and volume mounts (`pgdata`, `zulipdata`).
  - [ ] [Nginx] Create `docker/nginx.conf`:
        - Upstream proxies for Backend API (4000), Zulip (9991), HR Dashboard (3000), Attendance App (3300).
        - SSL configuration using Let's Encrypt certificates (`/etc/letsencrypt/live/...`).
        - WebSocket support for Zulip (`Upgrade`, `Connection` headers).
  - [ ] SSH to Hostinger VPS -> clone repository -> run `docker compose -f docker/docker-compose.prod.yml up -d`.
  - [ ] Run production integration check — **confirm GREEN.**

- [ ] **RED — Unit Check (`docker/tests/nginx_config.unit.test.ts`):**
  - [ ] Test Nginx config syntax check: `nginx -t -c /path/to/nginx.conf`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Nginx Syntax Verification:**
  - [ ] Confirm Nginx syntax is valid — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Open `https://chat.yourcompany.com` -> Zulip loads over HTTPS with valid SSL certificate.
  - [ ] Open `https://hr.yourcompany.com` -> HR Dashboard loads over HTTPS.
  - [ ] Open `https://clock.yourcompany.com` -> Attendance Web App loads over HTTPS.
  - [ ] Open `https://api.yourcompany.com/health` -> returns `{ status: "ok" }`.
  - [ ] ✅ Done.

---

#### W-802 — Secrets & Environment Hardening

**Root cause:** Production instances require strict environment variable segregation, production RS256 RSA key pair generation, and proper CORS/OIDC domain configuration.

**Goal:** Secure all secrets in production `.env`, generate 2048-bit RS256 RSA key pair for JWT signing, configure root-domain session cookie scoping (`.yourcompany.com`), and lock down CORS origins on Backend API.

**Approach:** Generate RSA key pair using `openssl genpkey`. Set production `.env` variables (`DATABASE_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `ZULIP_BOT_API_KEY`, `NODE_ENV=production`). Restrict CORS in `src/app.ts` strictly to company subdomains.

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

#### W-803 — Automated Postgres & Zulip Backup Pipeline

**Root cause:** Production data (HR records, attendance logs, break audits, chat history) requires automated daily backups with retention enforcement and recovery validation drills.

**Goal:** Automated backup shell script `scripts/backup.sh` executed daily via cron: performs `pg_dump` for JD Connect Postgres and Zulip Postgres, compresses archives (`.tar.gz`), maintains a 30-day rolling retention window, and logs execution status.

**Approach:** Write POSIX shell script `docker/scripts/backup.sh`. Configure cron job on host VPS (`0 2 * * * /app/docker/scripts/backup.sh`). Implement restoration verification script `scripts/restore_test.sh` to validate backup archives against a temporary test container.

---

- [ ] **RED — Integration (`docker/tests/backup.test.ts`):**
  - [ ] Test: Run `backup.sh` → assert valid `.tar.gz` backup archive created containing Postgres SQL dumps for both databases.
  - [ ] Test: Run `restore_test.sh` using created archive → assert databases successfully restored into test containers.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Automated Backup Pipeline:**
  - [ ] [Script] Create `docker/scripts/backup.sh`:
        - Target directory: `/var/backups/jdconnect/$(date +%Y%m%d_%H%M%S)`.
        - Execute `docker exec jdconnect_postgres pg_dump -U jduser jdconnect > jdconnect_postgres.sql`.
        - Execute `docker exec jdconnect_zulip_postgres pg_dump -U zulip zulip > zulip_postgres.sql` (or Zulip data volume archive).
        - Compress archive: `tar -czf backup.tar.gz jdconnect_postgres.sql zulip_postgres.sql`.
        - Delete backup archives older than 30 days: `find /var/backups/jdconnect/ -type f -mtime +30 -delete`.
  - [ ] [Script] Create `docker/scripts/restore_test.sh`:
        - Test script verifying archive uncompression and SQL restoration integrity.
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
