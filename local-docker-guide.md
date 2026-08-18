# Local Docker Image Test Guide
### Verifying all Docker images build and run correctly before going to the VPS

This guide runs the entire JD Connect stack as production Docker containers on your local Windows machine. You do **not** need to stop your dev servers — everything uses different ports so both can run at the same time.

> **Why do this before deploying to VPS?**
> Running `pnpm dev` and running a Docker container are completely different things. The dev server skips the TypeScript compilation step, doesn't use `node dist/index.js`, and runs directly on your Windows machine. A Docker container runs compiled code inside a Linux environment. Issues that only appear in production (wrong file paths, missing dependencies, broken build steps) are caught here — safely, on your machine — before they reach the VPS.

---

## What Runs Where

| Service | Dev Server (already running) | Local Docker Test (this guide) |
|---|---|---|
| Backend API | `http://localhost:4000` | `http://localhost:4001` |
| Attendance App | `http://localhost:3300` | `http://localhost:3301` |
| HR Dashboard | `http://localhost:3500` | `http://localhost:3502` |
| Postgres | `localhost:5432` (dev DB) | `localhost:5433` (test DB — isolated) |
| Zulip | `https://127.0.0.1:9991` | Still uses your existing local Zulip |

The Docker test has its own isolated Postgres volume (`pgdata_local_test`). Your dev database is never touched.

---

## Prerequisites

- **Docker Desktop** must be running on your Windows machine.
- Your **existing local Zulip** should be running (`https://127.0.0.1:9991`) — the Backend API container will call it.
- Your root **`.env`** must have `ZULIP_BOT_API_KEY` set (used by the Backend API container).

---

## Step 1: Start All Containers (First Time — Builds Everything)

Run from the **repo root**:

```powershell
docker compose -f docker/docker-compose.local-test.yml up -d --build
```

**What this does:**
- `--build` — compiles the TypeScript Backend API (multi-stage Docker build) and packages the Attendance App + HR Dashboard into nginx containers. This takes **3–8 minutes** on the first run because it downloads base images and compiles code.
- `-d` — runs in detached mode (containers run in the background)
- All four containers start: `jdconnect_test_postgres`, `jdconnect_test_api`, `jdconnect_test_attendance`, `jdconnect_test_hr`

Watch the build logs as it runs:
```powershell
docker compose -f docker/docker-compose.local-test.yml logs -f
```
Press `Ctrl+C` to stop following logs (containers keep running).

---

## Step 2: First-Time Database Setup

This is only done **once** when you first boot the test containers. The test Postgres starts empty — you need to create all tables and seed the initial data.

**Run database migrations** (creates all tables):
```powershell
docker compose -f docker/docker-compose.local-test.yml exec api tsx scripts/migrate.ts
```

Expected output:
```
Applying migration: 001_create_users.sql...
Successfully applied: 001_create_users.sql
Applying migration: 002_create_roles_permissions.sql...
...
All migrations up to date.
```

**Run seed data** (creates roles, permissions, departments, shifts, break types, and the initial `admin@company.com` super-admin account):
```powershell
docker compose -f docker/docker-compose.local-test.yml exec api tsx scripts/seed.ts
```

Expected output:
```
Seeding completed successfully.
```

> **Important:** Only run the seed script once. Running it again is safe (it uses `ON CONFLICT DO NOTHING`) but unnecessary.

---

## Step 3: Verify All Services Are Healthy

```powershell
# Check container status — all four should show "Up" or "healthy"
docker compose -f docker/docker-compose.local-test.yml ps
```

Expected output:
```
NAME                        STATUS          PORTS
jdconnect_test_postgres     Up (healthy)    0.0.0.0:5433->5432/tcp
jdconnect_test_api          Up              0.0.0.0:4001->4000/tcp
jdconnect_test_attendance   Up              0.0.0.0:3301->80/tcp
jdconnect_test_hr           Up              0.0.0.0:3502->80/tcp
```

**Check the Backend API health endpoint:**
```powershell
curl http://localhost:4001/health
```
Expected: `{"status":"ok"}`

**Check the Backend API root:**
```powershell
curl http://localhost:4001/
```
Expected: `{"name":"JD Connect Backend API","status":"ok"}`

---

## Step 4: Test Login End-to-End

**Test login via the API directly** (proves DB → API → JWT chain works):
```powershell
$body = '{"email":"admin@company.com","password":"AdminPassword123!"}'
Invoke-RestMethod -Uri http://localhost:4001/api/auth/login -Method POST -ContentType 'application/json' -Body $body
```

Expected output:
```
access_token : eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
token_type   : Bearer
expires_in   : 900
user         : @{id=...; email=admin@company.com; full_name=Super Admin}
```

**Open the Attendance App in your browser:**
```
http://localhost:3301
```
You should see the full JD Connect Attendance Portal UI. Log in with `admin@company.com` / `AdminPassword123!` — it should authenticate successfully against the containerised API on port 4001.

**Open the HR Dashboard in your browser:**
```
http://localhost:3502
```
Log in with the same credentials — you should see the employee list load.

---

## Step 5: Check Container Logs (If Something Doesn't Work)

**Backend API logs:**
```powershell
docker logs jdconnect_test_api -f --tail=50
```

**Attendance App logs (nginx):**
```powershell
docker logs jdconnect_test_attendance -f --tail=20
```

**HR Dashboard logs (nginx):**
```powershell
docker logs jdconnect_test_hr -f --tail=20
```

**Postgres logs:**
```powershell
docker logs jdconnect_test_postgres -f --tail=20
```

---

## Subsequent Runs (After the First Time)

Once you have run Step 2 once, subsequent starts are much faster (no rebuild unless code changed):

**Start without rebuilding** (fast — just starts existing containers):
```powershell
docker compose -f docker/docker-compose.local-test.yml up -d
```

**Start AND rebuild** (when you've made code changes and want to test the new build):
```powershell
docker compose -f docker/docker-compose.local-test.yml up -d --build
```

> After a rebuild, migrations run automatically in the CI/CD pipeline, but locally you do **not** need to re-run them — the data volume persists and the migration script is idempotent (checks `schema_migrations` table and skips already-applied files).

---

## Stopping & Cleaning Up

**Stop all containers** (data volume is preserved — you can start again without re-seeding):
```powershell
docker compose -f docker/docker-compose.local-test.yml down
```

**Stop AND delete all test data** (full clean slate — you'll need to re-run Step 2):
```powershell
docker compose -f docker/docker-compose.local-test.yml down -v
```

**Remove just the built images** (forces a full rebuild on next `up --build`):
```powershell
docker rmi $(docker images -q --filter "reference=*jdconnect*local*")
```

---

## What This Test Proves ✅

Once all steps above pass, you have confirmed:

- [x] `backend/Dockerfile` — multi-stage TypeScript build works, `dist/index.js` boots correctly
- [x] `attendance-app/Dockerfile` — nginx serves files, `config.js` with correct `BACKEND_URL` is injected
- [x] `hr-dashboard/Dockerfile` — same as attendance app
- [x] Database connectivity — Backend API reaches Postgres via Docker internal network
- [x] Migrations — all SQL migration files apply cleanly
- [x] Seed data — roles, permissions, admin account created correctly
- [x] JWT authentication — login flow works end-to-end through Docker
- [x] CORS — browser on `localhost:3301` can call API on `localhost:4001`
- [x] Zulip API calls — Backend API reaches local Zulip via `host.docker.internal:9991`

**What is NOT tested here** (tested only in Phase 2/3 on the VPS):
- [ ] Traefik routing and label configuration
- [ ] HTTPS / TLS certificate issuance
- [ ] Zulip OIDC SSO (`Sign in with Zulip` button)
- [ ] Production domain routing

---

## Common Issues & Fixes

### `connection refused` when calling API from Attendance App
The Attendance App's `BACKEND_URL` is baked into the image at build time as `http://localhost:4001`. The browser (running on your Windows machine) accesses this URL directly. Make sure:
- The API container is running on port 4001 (`docker compose ... ps`)
- Your firewall isn't blocking `localhost:4001`

### `Cannot connect to database` error in API logs
The API container waits for Postgres to be healthy before starting (`depends_on: condition: service_healthy`). If Postgres is slow to start:
```powershell
# Check Postgres health
docker inspect jdconnect_test_postgres --format "{{.State.Health.Status}}"
# Wait until it shows: healthy
```

### `ZULIP_BOT_API_KEY not set` or Zulip API calls failing
The compose file reads `ZULIP_BOT_API_KEY` from your root `.env` via `${ZULIP_BOT_API_KEY}`. Make sure your root `.env` has this value set correctly. After editing `.env`, restart the API container:
```powershell
docker compose -f docker/docker-compose.local-test.yml restart api
```

### TypeScript compilation error during build
If the backend build fails, you'll see a TypeScript error in the build output. Fix the error in the source code, then rebuild:
```powershell
docker compose -f docker/docker-compose.local-test.yml up -d --build --no-deps api
```
`--no-deps` rebuilds only the API image without restarting Postgres.

### Port already in use
If another process is using 4001, 3301, or 3502, find and stop it:
```powershell
netstat -ano | findstr :4001
taskkill /PID <PID_NUMBER> /F
```
