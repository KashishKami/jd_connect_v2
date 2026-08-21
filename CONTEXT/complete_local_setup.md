# JD Connect — Complete Local Setup & Docker Guide

This is the single authoritative reference for setting up JD Connect locally. It covers everything:
- Getting the dev environment running from scratch on a new machine
- Running the Docker image test stack
- Running all data migrations in the correct order

---

## Table of Contents

1. [Current Machine Status](#1-current-machine-status)
2. [Prerequisites for a New Machine](#2-prerequisites-for-a-new-machine)
3. [Part A — Dev Environment Setup](#part-a--dev-environment-setup)
4. [Part B — Docker Image Test Stack](#part-b--docker-image-test-stack)
5. [Part C — Data Migration Runbook](#part-c--data-migration-runbook)
6. [Verification Commands](#verification-commands)
7. [Common Issues & Fixes](#common-issues--fixes)

---

## 1. Current Machine Status

> [!NOTE]
> **Everything is ALREADY fully configured and running on this machine.**
> - **JD Connect Postgres**: Running on port `5432` (`jdconnect_postgres` container, project `jdconnect-dev`). All 14 migrations and seed data applied (including `014_expand_permissions.sql` — 26-key permission taxonomy).
> - **Zulip Chat Platform**: Running on `https://127.0.0.1:9991` (`docker/zulip/` compose stack).
> - **Zulip Admin Account**: `admin@company.com` / `AdminPassword123!` (Role: Organization Administrator).
> - **Zulip Bot Account**: `jdconnect-bot@company.com` / API Key stored in root `.env` as `ZULIP_BOT_API_KEY`.
> - **Test Suite**: All backend unit & integration tests passing cleanly.
> - **Employees**: All production employees migrated. Temporary passwords in `migration_passwords.csv`.
> - **Unified Portal**: `portal/` replaces the old `attendance-app/` and `hr-dashboard/`. Built with esbuild TypeScript pipeline.

---

## 2. Prerequisites for a New Machine

Before starting, ensure the target machine has:
- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher (`npm install -g pnpm`)
- **Docker Desktop**: Installed and running

---

## Part A — Dev Environment Setup

This section gets the full local dev environment running from scratch. End result:
- Backend API → `http://127.0.0.1:4000`
- Unified Portal → `http://localhost:3200`
- Zulip → `https://127.0.0.1:9991`

---

### Step 1: Clone & Install Monorepo Dependencies

```bash
git clone <repository-url> jd_connect_v2
cd jd_connect_v2

# Install all workspace dependencies and approve built scripts
pnpm install
pnpm approve-builds --all
```

---

### Step 2: Configure Environment Files

```bash
cp .env.example .env
cp .env.test.example .env.test
```

Generate a secure secret (minimum 32 characters) for `JWT_SECRET` in `.env`:
```bash
# Using OpenSSL:
openssl rand -base64 32

# Or using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated string and set `JWT_SECRET=<generated_value>` in your `.env`.

---

### Step 3: Start Dev Postgres Container & Run Database Setup

> [!IMPORTANT]
> **Always use `pnpm docker:dev:up` — never call `docker compose` directly for the dev stack.**
>
> **Why?** Both `docker/docker-compose.yml` (dev stack) and `docker/docker-compose.local-test.yml` (Docker image test stack) live in the same `docker/` directory. Docker Compose derives its internal project name from the compose file's parent directory — so without an explicit flag, both default to the project name `docker`. When two stacks share a project name AND both define a service called `postgres`, Docker Compose treats them as the **same service**. Running the test stack will stop and replace your dev Postgres container — wiping your database.
>
> The `pnpm docker:dev:up` script includes `--project-name jdconnect-dev` automatically. This is the only safe way to start the dev Postgres.

```bash
# Start JD Connect Postgres on port 5432 (project name jdconnect-dev)
pnpm docker:dev:up

# Run SQL database migrations (creates all tables)
pnpm db:migrate

# Seed core domain constants (roles, permissions, departments, shifts, break types, admin account)
pnpm db:seed
```

After seeding, the super-admin account exists:
- **Email:** `admin@company.com`
- **Password:** `AdminPassword123!`

---

### Step 4: Clone & Configure the Zulip Stack

```bash
cd docker
git clone https://github.com/zulip/docker-zulip.git zulip
cd zulip
```

Create `docker/zulip/compose.override.yaml`:
```yaml
---
secrets:
  zulip__postgres_password:
    environment: "ZULIP__POSTGRES_PASSWORD"
  zulip__memcached_password:
    environment: "ZULIP__MEMCACHED_PASSWORD"
  zulip__rabbitmq_password:
    environment: "ZULIP__RABBITMQ_PASSWORD"
  zulip__redis_password:
    environment: "ZULIP__REDIS_PASSWORD"
  zulip__secret_key:
    environment: "ZULIP__SECRET_KEY"
  zulip__email_password:
    environment: "ZULIP__EMAIL_PASSWORD"

services:
  zulip:
    ports:
      - "9991:443"
    environment:
      SETTING_EXTERNAL_HOST: "127.0.0.1:9991"
      SETTING_ZULIP_ADMINISTRATOR: "admin@company.com"
      SETTING_FAKE_EMAIL_DOMAIN: "localhost"
      CERTIFICATES: "self-signed"
      SETTING_EXTRA_CUSTOM_CSS: "/static/custom.css"
    volumes:
      - ./zulip-notion-theme.css:/home/zulip/prod-static/custom.css:ro
      - ./nginx-custom-theme.conf:/etc/nginx/zulip-include/app.d/custom-theme.conf:ro
```

Copy the custom theme and Nginx sub-filter configuration files into `docker/zulip/`:
```bash
# Copy theme configuration files from templates into docker/zulip/
cp docker/zulip-theme-templates/zulip-notion-theme.css docker/zulip/zulip-notion-theme.css
cp docker/zulip-theme-templates/nginx-custom-theme.conf docker/zulip/nginx-custom-theme.conf
```

> [!NOTE]
> **Custom Theme, Floating Portal Button & Zero Container Modifications:**
> We never modify any files directly inside the Zulip Docker container. The custom Outfit font, Dual Notion themes, and floating Portal navigation button are applied 100% declaratively via volume mounts and Nginx `sub_filter` in `compose.override.yaml`.
> 
> **Important:** In `docker/zulip/nginx-custom-theme.conf`, make sure `href="..."` points to your environment's Portal URL (`http://localhost:3201` for local development).

Create `docker/zulip/.env`:
```dotenv
ZULIP__POSTGRES_PASSWORD=zulipdevpostgrespassword
ZULIP__MEMCACHED_PASSWORD=zulipdevmemcachedpassword
ZULIP__RABBITMQ_PASSWORD=zulipdevrabbitmqpassword
ZULIP__REDIS_PASSWORD=zulipdevredispassword
ZULIP__SECRET_KEY=zulipdevsecretkey32charsminimumXXX
ZULIP__EMAIL_PASSWORD=
```

---

### Step 5: Boot the Zulip Container Stack

From inside `docker/zulip/`:
```bash
# Pull official images
docker compose pull

# Initialize Zulip internal database schema and secrets
# Must complete with: === End Initial Configuration Phase ===
docker compose run --rm zulip app:init

# Start Zulip stack and wait for healthy
docker compose up zulip --wait
```

---

### Step 6: Create Admin, Bot Accounts & Attendance Channel

> [!NOTE]
> **Windows (Git Bash) Users:** Before running `./manage.py` commands, run `export MSYS_NO_PATHCONV=1` in your terminal session. This prevents Git Bash from converting Linux container paths to Windows paths, which breaks the commands with an OCI exec error.

From inside `docker/zulip/`:
```bash
# Required for Git Bash on Windows only:
export MSYS_NO_PATHCONV=1

./manage.py shell -c "
from zerver.models import Realm, UserProfile
from zerver.actions.create_user import do_create_user
from zerver.actions.create_realm import do_create_realm, ensure_stream

realm = Realm.objects.filter(string_id='').first()
if not realm:
    realm = do_create_realm(string_id='', name='JD Connect')

# Create the attendance channel
ensure_stream(realm, 'attendance', acting_user=None)
print('ATTENDANCE_CHANNEL_READY')

# Create or verify Admin user
admin = UserProfile.objects.filter(delivery_email='admin@company.com', realm=realm).first()
if not admin:
    admin = do_create_user(
        email='admin@company.com',
        password='AdminPassword123!',
        realm=realm,
        full_name='JD Connect Admin',
        role=UserProfile.ROLE_REALM_ADMINISTRATOR,
        acting_user=None,
    )
    print('ADMIN_CREATED')
else:
    print('ADMIN_EXISTS')

# Create or verify Bot account
bot = UserProfile.objects.filter(delivery_email='jdconnect-bot@company.com', realm=realm).first()
if not bot:
    bot = do_create_user(
        email='jdconnect-bot@company.com',
        password=None,
        realm=realm,
        full_name='JD Connect Bot',
        bot_type=UserProfile.DEFAULT_BOT,
        role=UserProfile.ROLE_REALM_ADMINISTRATOR,
        acting_user=None,
    )
    print('BOT_CREATED')
else:
    print('BOT_EXISTS')

print('BOT_API_KEY:', bot.api_key)
"

# Grant Bot user-provisioning permissions (required for the Employee Creation API)
./manage.py change_user_role -r '' jdconnect-bot@company.com admin || true
./manage.py change_user_role -r '' jdconnect-bot@company.com can_create_users
```

Copy the printed `BOT_API_KEY` and update the root `.env`:
```dotenv
ZULIP_BASE_URL=https://127.0.0.1:9991
ZULIP_BOT_EMAIL=jdconnect-bot@company.com
ZULIP_BOT_API_KEY=<paste_bot_api_key_here>
```

---

### Step 7: Start Development Servers

Once `.env` has `ZULIP_BOT_API_KEY` set, start each service in its own terminal:

**Terminal 1 — Backend API:**
```bash
cd backend
pnpm dev
# Accessible at http://127.0.0.1:4000
```

**Terminal 2 — Unified Portal:**
```bash
cd portal
pnpm dev
# Accessible at http://localhost:3200
# Serves the esbuild-compiled portal (login, attendance console, dashboard, employees, audit pages)
```

**Optional — Post daily attendance prompt to Zulip `#attendance` channel:**
```bash
# From the monorepo root:
pnpm --filter @jdconnect/zulip-bot start
```

**Access Zulip:** Open `https://127.0.0.1:9991` → login with `admin@company.com` / `AdminPassword123!`.

> [!NOTE]
> The old `attendance-app/` and `hr-dashboard/` directories have been replaced by the unified `portal/`. They are archived as `attendance-app.archived/` and `hr-dashboard.archived/` for reference only.

---

### How Employee Accounts Are Created (Standard Operations)

When an employee joins, account creation follows a strict dual-system flow managed by the Backend API:

1. **HR Action** — HR fills employee details in the **Unified Portal** (`full_name`, `email`, `password`, `role_key`, `department_id`, `centre_id`, `shift_id`) via the Employees Management page (requires `employees.create` permission).
2. **API Request** — Portal sends `POST /api/employees`.
3. **Database Write** — API hashes the password (`bcrypt`, 12 rounds) and creates rows in `users` and `employees` tables.
4. **Zulip Provisioning** — API calls Zulip Admin REST API (`POST /api/v1/users`) using the Bot API Key to create the Zulip account automatically.
5. **Cross-System Link** — The returned Zulip `user_id` is saved to `employees.zulip_user_id`.
6. **Password Resets** — Admin/HR-initiated only via `POST /api/employees/:id/reset-password`. No self-service reset links.

---

## Part B — Docker Image Test Stack

This section runs the full JD Connect application as production Docker containers on your local machine. Use this to verify Docker images build and run correctly **before pushing to the VPS**.

> **Why do this before deploying?**
> `pnpm dev` and running a Docker container are completely different. The dev server skips TypeScript compilation and runs natively on Windows. A Docker container runs compiled code inside Linux. Broken file paths, missing dependencies, or broken build steps only surface inside containers — catch them here safely before they reach production.

---

### What Runs Where

| Service | Dev Server | Docker Test Stack |
|---|---|---|
| Backend API | `http://localhost:4000` | `http://localhost:4001` |
| Unified Portal | `http://localhost:3200` | `http://localhost:3201` |
| Postgres | `localhost:5432` (dev DB) | Shared — see below |
| Zulip | `https://127.0.0.1:9991` | Same — shared |

You do **not** need to stop your dev servers. All Docker test ports are different.

---

### ⚠️ Critical: Always Use `--project-name` Flags

> [!CAUTION]
> **Never run either Docker Compose stack without its explicit `--project-name` flag.**
>
> Both `docker/docker-compose.yml` and `docker/docker-compose.local-test.yml` live in the `docker/` directory. Without an explicit flag, Docker Compose assigns both the same project name (`docker`), derived from the directory name. Both files define a service called `postgres`. When two stacks share a project name and a service name, Docker Compose treats them as the **same service** — running one will **stop and replace the other's Postgres container**, wiping your database.
>
> **This has caused data loss in this project before.** The permanent fix is always passing `--project-name`:
>
> | Stack | `--project-name` flag | Container | Port |
> |---|---|---|---|
> | Dev Postgres | `jdconnect-dev` | `jdconnect_postgres` | `5432` |
> | Docker test stack | `jdconnect-test` | *(uses dev Postgres via `host.docker.internal`)* | `5432` |
>
> The `pnpm docker:dev:up` / `pnpm docker:dev:down` scripts already include `--project-name jdconnect-dev`. Always use those scripts for the dev stack.

---


> [!IMPORTANT]
> **The Docker test stack has no Postgres container of its own.**
>
> The `jdconnect_test_api` container (port 4001) connects directly to your dev Postgres (`jdconnect_postgres`) running on your Windows host via `host.docker.internal:5432`. This is intentional — it means the test stack runs against your real migrated data without needing a separate migration step.
>
> **Consequence:** Your dev Postgres (`pnpm docker:dev:up`) **must always be running** before starting the Docker test stack. If it is down, every API call will fail with a 500 error.

---

### Prerequisites Before Starting the Docker Test Stack

1. Dev Postgres must be running:
   ```powershell
   pnpm docker:dev:up
   ```
2. Zulip must be running at `https://127.0.0.1:9991` (admin, bot, and attendance channel already created).
3. Root `.env` must have `ZULIP_BOT_API_KEY` set.

---

### Step B1: Start All Containers

Run from the **repo root**:

```powershell
# REQUIRED: Both flags are mandatory every time.
# --project-name jdconnect-test: Isolates this stack from the dev stack. NEVER omit this.
# --env-file .env: Injects ZULIP_BOT_API_KEY from your root .env into the container.
docker compose --project-name jdconnect-test --env-file .env -f docker/docker-compose.local-test.yml up -d --build
```

- `--build` compiles TypeScript and builds nginx images. Takes 3–8 minutes on first run.
- `-d` runs in detached (background) mode.

Watch build logs:
```powershell
docker compose --project-name jdconnect-test -f docker/docker-compose.local-test.yml logs -f
```
Press `Ctrl+C` to stop watching — containers keep running.

No database setup inside containers is needed — the API uses your dev Postgres.

---

### Step B2: Verify All Services Are Healthy

```powershell
docker compose --project-name jdconnect-test -f docker/docker-compose.local-test.yml ps
```

Expected:
```
NAME                        STATUS          PORTS
jdconnect_test_api          Up              0.0.0.0:4001->4000/tcp
jdconnect_test_portal       Up              0.0.0.0:3201->80/tcp
```

Check API health:
```powershell
curl http://localhost:4001/health
# Expected: {"status":"ok"}
```

Test login (PowerShell):
```powershell
$body = '{"email":"admin@company.com","password":"AdminPassword123!"}'
Invoke-RestMethod -Uri http://localhost:4001/api/auth/login -Method POST -ContentType 'application/json' -Body $body
# Expected: response with access_token field
```

- Unified Portal: `http://localhost:3201` → login → Dashboard or Attendance Console loads ✅

---

### Step B3: Running the Zulip Bot in Docker Test Mode

The Zulip bot runs on the host machine (not in a container). Because the Docker test API is on port `4001` and the portal is on `3201`, override both URLs:

> [!NOTE]
> The bot uses `CLOCK_APP_URL` for the link it posts in the daily Zulip message (the link employees click to open the portal). Even though we now call it the portal, the env var name in the bot code is still `CLOCK_APP_URL`.

**PowerShell:**
```powershell
$env:BACKEND_URL="http://localhost:4001"; $env:CLOCK_APP_URL="http://localhost:3201"; pnpm --filter @jdconnect/zulip-bot start
```

**Git Bash / Linux:**
```bash
BACKEND_URL=http://localhost:4001 CLOCK_APP_URL=http://localhost:3201 pnpm --filter @jdconnect/zulip-bot start
```

---

### Subsequent Runs, Stopping & Cleanup

**Start without rebuilding** (fast — uses existing built images):
```powershell
docker compose --project-name jdconnect-test -f docker/docker-compose.local-test.yml up -d
```

**Start and rebuild** (after code changes):
```powershell
docker compose --project-name jdconnect-test --env-file .env -f docker/docker-compose.local-test.yml up -d --build
```

**Rebuild only the API** (faster):
```powershell
docker compose --project-name jdconnect-test --env-file .env -f docker/docker-compose.local-test.yml up -d --build --no-deps api
```

**Stop all test containers** (data volumes preserved):
```powershell
docker compose --project-name jdconnect-test -f docker/docker-compose.local-test.yml down
```

**Stop and wipe test Postgres volume** (dev Postgres is unaffected):
```powershell
docker compose --project-name jdconnect-test -f docker/docker-compose.local-test.yml down -v
```

**View container logs:**
```powershell
docker logs jdconnect_test_api -f --tail=50
docker logs jdconnect_test_portal -f --tail=20
docker logs jdconnect_test_postgres -f --tail=20
```

---

### What the Docker Test Proves ✅

- [x] `backend/Dockerfile` — multi-stage TypeScript build works, `dist/index.js` boots correctly
- [x] `portal/Dockerfile` — esbuild compiles `portal/src/index.ts` → `dist/bundle.js`, nginx serves `dist/` correctly
- [x] Database connectivity — API reaches Postgres via `host.docker.internal:5432`
- [x] JWT authentication — full login → token → authenticated request chain works in container
- [x] Permissions — `GET /api/me/permissions` returns correct scoped permission keys per role
- [x] CORS — browser on `localhost:3201` can call API on `localhost:4001`
- [x] Zulip API calls — API reaches local Zulip via `host.docker.internal:9991`

**Not tested here (VPS only):**
- [ ] Traefik routing and label configuration
- [ ] HTTPS / TLS certificate issuance
- [ ] Zulip OIDC SSO (`Sign in with Zulip` button)
- [ ] Production domain routing

---

## Part C — Data Migration Runbook

This section documents all data migration scripts, in the order they must be run. These scripts migrate production data from the legacy system (Rocket.Chat / legacy Postgres dump) into JD Connect.

> [!IMPORTANT]
> **All migration scripts run on the host machine, not inside Docker containers.**
> They connect via `DATABASE_URL` from the root `.env` — i.e., the dev Postgres at `127.0.0.1:5432`.
> The dev Postgres must be running (`pnpm docker:dev:up`) before running any migration.
> The legacy SQL dump file must exist at: `C:\Users\Administrator\Desktop\jdconnect_public_data.sql`

---

### Migration Step 1 — Schema (SQL Migrations)

**Run first. Always. Creates all database tables and expands the permission taxonomy.**

```powershell
# From repo root:
pnpm db:migrate
```

Expected output:
```
Applying migration: 001_create_users.sql... Successfully applied.
Applying migration: 002_create_roles_permissions.sql... Successfully applied.
...
Applying migration: 013_add_alias_to_employees.sql... Successfully applied.
Applying migration: 014_expand_permissions.sql... Successfully applied.
All migrations up to date.
```

Idempotent — tracks applied migrations in `schema_migrations` table. Safe to re-run; skips already-applied files.

> [!NOTE]
> `014_expand_permissions.sql` expands the permission taxonomy from 6 coarse keys to 26 fine-grained keys and re-seeds `role_permissions` for all 5 roles. If you already have an older database, this migration runs idempotently — new keys are inserted with `ON CONFLICT DO NOTHING`, the obsolete `employees.manage` key is removed, and `role_permissions` is reseeded.

---

### Migration Step 2 — Seed Core Domain Data

**Run after migrations. Creates roles, permissions, departments, shifts, break types, and the `admin@company.com` super-admin account.**

```powershell
# From repo root:
pnpm db:seed
```

Expected output:
```
Seeding completed successfully.
```

Idempotent — uses `ON CONFLICT DO UPDATE` / `DO NOTHING`. Safe to re-run.

After seeding, the super-admin account exists in JD Connect:
- **Email:** `admin@company.com`
- **Password:** `AdminPassword123!`

---

### Migration Step 3 — Employees

**Migrates all production employees from the legacy SQL dump into JD Connect Postgres and provisions their Zulip accounts.**

Prerequisites:
- Schema migrations + seed must be complete (Steps 1 & 2)
- Zulip must be running at `https://127.0.0.1:9991`
- Bot account must have `can_create_users` permission
- `ZULIP_BOT_API_KEY` must be set in root `.env`
- Legacy dump at `C:\Users\Administrator\Desktop\jdconnect_public_data.sql`

```powershell
cd backend
npx tsx scripts/migrate-employees.ts
```

What this script does:
- Reads employee records from the legacy SQL dump
- Creates `users` + `employees` rows in JD Connect Postgres for each employee
- Calls Zulip Admin API to provision each employee's Zulip account
- Generates a random temporary password for each employee
- Writes all temporary passwords to `migration_passwords.csv` in the repo root
- Cleans up the two sample seed employees (`john.doe@jdconnect.com`, `jane.mgr@jdconnect.com`) to avoid conflicts
- Sets the admin employee code to `SYS-0001`

Expected output:
```
Starting employee migration from: C:\Users\Administrator\Desktop\jdconnect_public_data.sql
Wrote temporary passwords to migration_passwords.csv
Employee migration completed successfully.
```

> [!CAUTION]
> **`migration_passwords.csv` contains all employee temporary passwords in plain text.** Keep this file secure. It is in `.gitignore` and must never be committed. Distribute passwords to employees individually and delete the file once done.

---

### Migration Step 4 — Attendance Records

**Migrates historical clock-in/out records and break records from the legacy system.**

Prerequisites:
- Employee migration must be complete (Step 3) — the script maps old UUIDs to new ones by email
- Legacy dump at `C:\Users\Administrator\Desktop\jdconnect_public_data.sql`

```powershell
cd backend
npx tsx scripts/migrate-attendance.ts
```

What this script does:
- Reads `attendance_records` and `break_records` from the legacy dump
- Maps legacy employee UUIDs → new JD Connect employee UUIDs by email address
- Maps legacy break type keys → new break type IDs
- Computes `attendance_status` for each record using current business logic
- Inserts all records into `attendance_records` and `break_records` tables
- Uses `ON CONFLICT DO NOTHING` — safe to re-run

Expected output:
```
Starting attendance migration from: C:\Users\Administrator\Desktop\jdconnect_public_data.sql
Attendance migration completed successfully.
Attendance records migrated: <count>
Break records migrated: <count>
```

---

### Migration Step 5 — Chat Messages (Rocket.Chat → Zulip)

**Migrates historical Rocket.Chat messages into Zulip streams, preserving timestamps.**

Prerequisites:
- Employee migration must be complete (Step 3) — the script maps Rocket.Chat user IDs to Zulip user IDs
- Zulip must be running at `https://127.0.0.1:9991`
- `ZULIP_BOT_API_KEY` must be set in root `.env`
- Legacy dump at `C:\Users\Administrator\Desktop\jdconnect_public_data.sql`

```powershell
cd backend
npx tsx scripts/migrate-chat.ts
```

What this script does:
- Reads Rocket.Chat room and message data from the legacy dump
- Maps Rocket.Chat rooms → Zulip streams (creates streams in Zulip if they don't exist)
- Maps Rocket.Chat user IDs → Zulip user IDs
- Posts each historical message to the appropriate Zulip stream via the Zulip API
- Preserves original timestamps, formatted in Eastern Standard Time (EST)

Expected output:
```
Starting chat migration...
Streams created: <count>
Messages migrated: <count>
Chat migration completed successfully.
```

---

### Full Migration Sequence — All Steps in Order

Run this when setting up a fresh database from scratch (new machine or after wiping the Postgres volume):

```powershell
# 1. From repo root — ensure dev Postgres is running
pnpm docker:dev:up

# 2. From repo root — create all tables
pnpm db:migrate

# 3. From repo root — seed roles, permissions, departments, admin account
pnpm db:seed

# 4. From backend/ — migrate production employees & provision Zulip accounts
cd backend
npx tsx scripts/migrate-employees.ts

# 5. From backend/ — migrate historical attendance & break records
npx tsx scripts/migrate-attendance.ts

# 6. From backend/ — migrate Rocket.Chat messages into Zulip streams
npx tsx scripts/migrate-chat.ts
```

---

### If the Database Was Accidentally Wiped

If the dev Postgres volume was recreated (e.g., due to the `--project-name` conflict bug or an accidental `docker compose down -v`), all data is lost from that volume.

> [!NOTE]
> Docker named volumes are **not** permanently deleted by `docker compose down`. They are only deleted with `docker volume rm <name>` or `docker compose down -v`. The old volume and its data still exist on disk unless explicitly removed. You can reconnect to the old volume if needed — but re-running migrations is faster.

Recovery sequence:
```powershell
# Confirm dev Postgres is running (creates new volume if needed)
pnpm docker:dev:up

# Re-run full migration sequence from repo root
pnpm db:migrate
pnpm db:seed
cd backend
npx tsx scripts/migrate-employees.ts
npx tsx scripts/migrate-attendance.ts
npx tsx scripts/migrate-chat.ts
```

---

## Verification Commands

```bash
# Lint check
pnpm lint

# TypeScript compilation check
pnpm typecheck

# Unit and integration tests
pnpm test

# Full CI quality check (lint + typecheck + test + build)
pnpm ci:quality
```

---

## Common Issues & Fixes

### 500 Internal Server Error on login

The API returns 500 when it cannot reach the database. The most common cause is `jdconnect_postgres` not running.

```powershell
pnpm docker:dev:up
```

Retry login immediately — no rebuild needed.

### Dev Postgres was replaced by the Docker test stack

This happens when the Docker test stack is started without `--project-name`. Both stacks share the project name `docker` and Docker Compose treats the `postgres` service as the same container — killing the dev one.

Recovery:
1. `pnpm docker:dev:up` — restarts dev Postgres (creates new empty volume)
2. Re-run the full migration sequence from Part C above

### Conflict error when starting Docker test stack: "container name already in use"

Orphaned containers from a previous broken run still exist. Force-remove them:

```powershell
docker rm -f jdconnect_test_portal jdconnect_test_api jdconnect_test_postgres
```

Then re-run the test stack command.

### `ZULIP_BOT_API_KEY not set` or Zulip API calls failing

Always include `--env-file .env` when starting the test stack. To restart just the API container after updating the key:

```powershell
docker compose --project-name jdconnect-test --env-file .env -f docker/docker-compose.local-test.yml up -d --build --no-deps api
```

### TypeScript compilation error during Docker build

Fix the error in source code, then rebuild only the API image:

```powershell
docker compose --project-name jdconnect-test --env-file .env -f docker/docker-compose.local-test.yml up -d --build --no-deps api
```

`--no-deps` rebuilds only the API without restarting Postgres.

### `connection refused` when Portal calls the API

The `BACKEND_URL` is baked into the portal's Docker image at build time as `http://localhost:4001`. The browser accesses this from your Windows machine. Ensure the API container is running and port 4001 is not blocked by firewall.

### Port already in use

```powershell
netstat -ano | findstr :4001
taskkill /PID <PID_NUMBER> /F
```

Replace `:4001` with whichever port is conflicting (`3200`, `3201`, etc.).

### `Cannot connect to database` error in API container logs

The API waits for Postgres to be healthy before starting (`depends_on: condition: service_healthy`). If Postgres is slow:

```powershell
docker inspect jdconnect_test_postgres --format "{{.State.Health.Status}}"
# Wait until it shows: healthy
```

This prevents Git Bash from prepending Windows file system paths to Linux container paths.

---

## Step 7: Set Zulip Channel Descriptions (Run After Docker Containers Are Up)

> **What this does:** Sets a permanent link in the `#attendance` and `#Breaks` Zulip channel descriptions so employees always have a visible shortcut to the Unified Portal. The description shows at the top of the channel when viewing all topics.
>
> **When to run:** After the Docker test stack is up (`docker compose ... up -d`) and Zulip is running at `https://127.0.0.1:9991`.
>
> **Port used:** `3201` — the Unified Portal docker container port in the local test stack.

> [!IMPORTANT]
> Run all commands from the `docker/zulip/` directory. On **Windows Git Bash**, `MSYS_NO_PATHCONV=1` is required to prevent path conversion errors. On PowerShell or Linux, omit it.

**Set description on `#attendance` channel:**

```bash
# From docker/zulip/ directory
MSYS_NO_PATHCONV=1 docker compose exec -u zulip zulip \
  /home/zulip/deployments/current/manage.py shell -c "
from zerver.models import Realm, Stream, UserProfile
from zerver.actions.streams import do_change_stream_description
realm = Realm.objects.get(string_id='')
acting_user = UserProfile.objects.get(delivery_email='admin@company.com', realm=realm)
stream = Stream.objects.get(name='attendance', realm=realm)
do_change_stream_description(stream, 'Clock in / Clock out: http://localhost:3201', acting_user=acting_user)
print('Done:', stream.description)
"
```

**Set description on `#Breaks` channel:**

```bash
# From docker/zulip/ directory
MSYS_NO_PATHCONV=1 docker compose exec -u zulip zulip \
  /home/zulip/deployments/current/manage.py shell -c "
from zerver.models import Realm, Stream, UserProfile
from zerver.actions.streams import do_change_stream_description
realm = Realm.objects.get(string_id='')
acting_user = UserProfile.objects.get(delivery_email='admin@company.com', realm=realm)
stream = Stream.objects.get(name='Breaks', realm=realm)
do_change_stream_description(stream, 'Log your break here: http://localhost:3201', acting_user=acting_user)
print('Done:', stream.description)
"
```

Expected output for each:
```
85 objects imported automatically (use -v 2 for details).
Done: Clock in / Clock out: http://localhost:3201
```

**To verify:** Open `https://127.0.0.1:9991` → click `# attendance` in the sidebar (not a topic inside it, the channel itself) → the description with the link appears at the top.

> **On the VPS (Phase 2):** Same commands, but replace `http://localhost:3201` with your production portal URL. The `MSYS_NO_PATHCONV=1` prefix is not needed on Linux.

