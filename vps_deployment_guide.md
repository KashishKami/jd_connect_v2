# JD Connect v2 — VPS Deployment Guide
### A complete, beginner-friendly guide to running JD Connect in production

This guide follows the same four-phase approach used by other JD projects:

| Phase | What | When |
|---|---|---|
| **Phase 0** | Local Docker image test (this is the gate) | **Must pass before touching VPS** |
| **Phase 1** | Local development | Already done |
| **Phase 2** | VPS deploy, accessed via raw VPS IP address | Prove the stack works on the server |
| **Phase 3** | Point your real domain + enable HTTPS via Traefik | Final production-ready state |

> **Key principle:** The VPS never holds your source code. Your code runs inside Docker images stored in GitHub Container Registry (GHCR). The VPS only has a `docker-compose.prod.yml` file and a `.env` file. Everything else is automated.

> [!IMPORTANT]
> **Do not proceed to Phase 2 until Phase 0 passes completely.** Phase 0 builds the exact same Docker images that will run on the VPS. If images don't build or boot locally, they won't work on the VPS either. Catching this locally saves you hours of VPS debugging.

---

## Table of Contents

1. [Concept: How This Stack Works](#1-concept-how-this-stack-works)
2. [Prerequisites](#2-prerequisites)
3. [Phase 0 — Local Docker Image Test (Required Gate)](#phase-0--local-docker-image-test-required-gate)
4. [Phase 2 — VPS Setup & Testing via IP](#phase-2--vps-setup--testing-via-ip)
   - [Step 1: Generate SSH Keys](#step-1-generate-ssh-keys-on-windows)
   - [Step 2: Add SSH Key to Hostinger](#step-2-add-ssh-key-to-hostinger)
   - [Step 3: Connect & Install Docker](#step-3-connect-to-vps--install-docker)
   - [Step 4: Create Project Directory](#step-4-create-the-project-directory)
   - [Step 5: Create the Internal Network](#step-5-create-the-internal-network)
   - [Step 6: Set Up Zulip on VPS](#step-6-set-up-zulip-on-the-vps)
   - [Step 7: Configure GitHub Secrets & First Deploy](#step-7-configure-github-secrets--trigger-first-deploy)
   - [Step 8: Run First-Time DB Setup](#step-8-run-first-time-database-setup)
   - [Step 9: Verify Everything Works](#step-9-verify-everything-works-via-ip)
5. [Phase 3 — DNS & HTTPS via Traefik](#phase-3--dns--https-via-traefik)
   - [Step 10: Add DNS Records](#step-10-add-dns-records-in-hostinger)
   - [Step 11: Switch to Production Compose](#step-11-switch-to-production-compose)
   - [Step 12: Add Scoped `insecureSkipVerify` for Zulip](#step-12-add-scoped-insecureskipverify-for-zulip)
   - [Step 13: Switch Zulip to Production Override](#step-13-switch-zulip-to-production-override)
   - [Step 14: Update GitHub Secrets & Deploy](#step-14-update-github-secrets--redeploy)
   - [Step 15: Verify HTTPS & SSL Certs](#step-15-verify-https--ssl-certs)
6. [GitHub Secrets Reference](#5-github-secrets-reference)
7. [Maintenance & Operations](#6-maintenance--operations)
8. [FAQ](#7-faq)

---

## 1. Concept: How This Stack Works

### Two separate Docker stacks on the VPS

JD Connect runs as two isolated Docker Compose stacks, exactly like your local setup:

```
VPS
├── /opt/jdconnect_v2/            ← Managed by GitHub Actions (CI/CD)
│   ├── docker-compose.vps-test.yml  (SCP'd by pipeline — Phase 2)
│   │   └── [switched to docker-compose.prod.yml for Phase 3]
│   └── .env                         (Written by pipeline from GitHub Secrets)
│   
│   Containers:
│   ├── jdconnect_postgres         (Postgres — internal only)
│   ├── jdconnect_api              (Backend API — image from GHCR)
│   ├── jdconnect_attendance       (Attendance App — image from GHCR)
│   └── jdconnect_hr               (HR Dashboard — image from GHCR)
│
└── /opt/jdconnect_v2/zulip/      ← Set up manually ONCE, never touched by CI/CD
    ├── compose.yaml              (Official Zulip — cloned from GitHub)
    ├── compose.override.yaml     (Your override — IP-based for Phase 2, domain for Phase 3)
    └── .env                      (Zulip secrets)
    
    Containers:
    ├── zulip                      (Main Zulip app)
    ├── zulip-database             (Zulip's internal Postgres — NOT shared)
    ├── zulip-cache                (Memcached)
    ├── zulip-queue                (RabbitMQ)
    └── zulip-redis                (Redis)
```

### How every code push becomes a production deploy

```
git push origin main
    │
    ▼
GitHub Actions:
  1. Quality check (lint, typecheck, test, build)
  2. Build Docker image for backend → push to GHCR
  3. Build Docker image for attendance-app → push to GHCR  
  4. Build Docker image for hr-dashboard → push to GHCR
  5. SCP docker-compose.prod.yml → VPS /opt/jdconnect/
  6. SSH into VPS:
       - Write .env from GitHub Secrets
       - Pull new images from GHCR
       - Restart app containers (Postgres is NOT touched)
       - Run migrations inside the API container
       - Prune old images
```

### What exists on the VPS (and what doesn't)

| Item | On VPS? | Who manages it? |
|---|---|---|
| Source code (`.ts`, `.html`, etc.) | ❌ Never | N/A |
| Docker images | ✅ Pulled from GHCR | GitHub Actions |
| `docker-compose.vps-test.yml` (Phase 2) / `docker-compose.prod.yml` (Phase 3) | ✅ | GitHub Actions (SCP) |
| `.env` | ✅ | GitHub Actions (SSH write) |
| Postgres data (`pgdata` volume) | ✅ | Docker volume — persistent |
| Zulip stack (`/opt/jdconnect/zulip/`) | ✅ | You — manual setup once |
| Zulip data (messages, users) | ✅ | Docker volume — persistent |

---

## 2. Prerequisites

Before starting Phase 2, confirm:

- [ ] Your **Hostinger VPS** is provisioned (any Ubuntu 22.04 LTS plan)
- [ ] You have the **VPS IP address** from Hostinger panel
- [ ] Your **GitHub repository** is set up and code is pushed to `main`
- [ ] **Docker Desktop** is running on your Windows machine (for SSH key generation)

---

---

## Phase 2 — VPS Setup & Testing via IP

---

### Step 1: Generate SSH Keys on Windows

SSH keys are used both for you to log into the VPS manually, and for GitHub Actions to deploy automatically.

1. Open **PowerShell** on your Windows machine.
2. Generate a new key pair:
   ```powershell
   ssh-keygen -t ed25519 -C "jdconnect-deploy"
   # Press Enter to accept default path, skip passphrase
   ```
3. View and copy your **public key**:
   ```powershell
   Get-Content ~\.ssh\id_ed25519.pub
   ```
   Copy the entire output line (starts with `ssh-ed25519 AAAA...`).

---

### Step 2: Add SSH Key to Hostinger

1. Log into **Hostinger hPanel** → **VPS** → select your server.
2. Left sidebar → **Settings** → **SSH Keys** → **Add SSH Key**.
3. Name: `JDConnect-Deploy`, paste the public key → **Save**.

Hostinger automatically adds this key to the server's `authorized_keys`.

---

### Step 3: Connect to VPS & Install Docker

Replace `<VPS_IP>` with your actual VPS IP from Hostinger.

```powershell
# Connect to your VPS
ssh root@<VPS_IP>
```

Once inside the VPS SSH terminal:
```bash
# Update packages and install Docker
apt-get update && apt-get upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Verify
docker --version
docker compose version
```

---

### Step 4: Create the Project Directory

```bash
mkdir -p /opt/jdconnect_v2
```

That's it. GitHub Actions will populate this directory on your first push.

---

### Step 5: Create the Internal Network

The JD Connect v2 containers need an internal network to communicate (API ↔ Postgres). This is intentionally named `jdconnect_v2_net` (not `jdconnect_net`) to be completely separate from the old v1 stack's network, which may still exist on the VPS.

Run once:

```bash
docker network create jdconnect_v2_net
```

> **Note:** If the old v1 `jdconnect_net` already exists on the VPS, that is fine — ignore it. v2 never touches it.

Verify `root_default` (Traefik's network) already exists:
```bash
docker network ls | grep root_default
# Should show: ... root_default   bridge   local
```

---

### Step 6: Set Up Zulip on the VPS

Zulip is set up manually once. It is never managed by the CI/CD pipeline.

```bash
# Create Zulip directory inside the project folder
mkdir -p /opt/jdconnect_v2/zulip
cd /opt/jdconnect_v2/zulip

# Clone the official Zulip Docker stack (exactly as in local_setup.md)
git clone https://github.com/zulip/docker-zulip.git .
```

**Which fields need a password:**

| Variable | Generate? | Notes |
|---|---|---|
| `ZULIP__POSTGRES_PASSWORD` | ✅ Yes | Zulip's internal database |
| `ZULIP__MEMCACHED_PASSWORD` | ✅ Yes | Memcached SASL auth |
| `ZULIP__RABBITMQ_PASSWORD` | ✅ Yes | RabbitMQ message queue |
| `ZULIP__REDIS_PASSWORD` | ✅ Yes | Redis auth |
| `ZULIP__SECRET_KEY` | ✅ Yes | Django secret key (min 32 chars) |
| `ZULIP__EMAIL_PASSWORD` | ❌ **Leave blank** | JD Connect has no SMTP — email disabled. HR resets passwords via API. |

Generate all 5 values at once:
```bash
for i in 1 2 3 4 5; do openssl rand -hex 20; done
```

Copy the 5 output lines. Then create the `.env` file replacing the placeholders:
```bash
cat > /opt/jdconnect_v2/zulip/.env << 'EOF'
ZULIP__POSTGRES_PASSWORD=<line-1>
ZULIP__MEMCACHED_PASSWORD=<line-2>
ZULIP__RABBITMQ_PASSWORD=<line-3>
ZULIP__REDIS_PASSWORD=<line-4>
ZULIP__SECRET_KEY=<line-5>
ZULIP__EMAIL_PASSWORD=
EOF
```

> [!CAUTION]
> Save these 5 values in a password manager. If you ever lose the `.env` file and the Zulip Docker volume is intact, you will need these exact values to restart Zulip.

**For Phase 2 (VPS IP access):** Create the override with the VPS IP:

> [!IMPORTANT]
> **Two values to replace in this block before running:**
>
> | Placeholder | Replace with | Example |
> |---|---|---|
> | `<VPS_IP>` | Your actual VPS IP address | `82.29.165.21` |
> | `admin@company.com` | Your real Zulip admin email | `admin@jdfusion.in` |
>
> Everything else (`localhost`, `self-signed`, `9991`, all `ZULIP__*` keys) — **leave exactly as written**.

```bash
cat > /opt/jdconnect_v2/zulip/compose.override.yaml << EOF
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
      SETTING_EXTERNAL_HOST: "<VPS_IP>:9991"             # ← REPLACE: your VPS IP
      SETTING_ZULIP_ADMINISTRATOR: "admin@company.com"   # ← REPLACE: your real admin email
      SETTING_FAKE_EMAIL_DOMAIN: "localhost"             # ← leave as-is
      CERTIFICATES: "self-signed"                        # ← leave as-is (Phase 2 only)
      SETTING_EXTRA_CUSTOM_CSS: "/static/custom.css"     # ← leave as-is
    volumes:
      - ./zulip-notion-theme.css:/home/zulip/prod-static/custom.css:ro
      - ./nginx-custom-theme.conf:/etc/nginx/zulip-include/app.d/custom-theme.conf:ro
EOF
```

**SCP the custom theme files from your Windows machine to the VPS:**

> [!IMPORTANT]
> Run these from your **Windows machine** (PowerShell), not the VPS SSH session. The theme files live in `docker/zulip-theme-templates/` in your local repo.

```powershell
# From your Windows machine — in your project root directory
scp docker\zulip-theme-templates\zulip-notion-theme.css root@<VPS_IP>:/opt/jdconnect_v2/zulip/zulip-notion-theme.css
scp docker\zulip-theme-templates\nginx-custom-theme.conf root@<VPS_IP>:/opt/jdconnect_v2/zulip/nginx-custom-theme.conf
```

Verify both files arrived on the VPS:
```bash
ls -lh /opt/jdconnect_v2/zulip/zulip-notion-theme.css /opt/jdconnect_v2/zulip/nginx-custom-theme.conf
# Both should show file sizes > 0
```

**Initialize and start Zulip** (one-time — takes ~5 minutes):
```bash
cd /opt/jdconnect_v2/zulip

# Pull all Zulip images
docker compose pull
```

**One-time fix: Remove default ports from the base `compose.yaml` (do this right after pull, before starting)**

> **Why this is needed:** The official `compose.yaml` base file declares three ports for the Zulip service: `25` (smtp), `80` (http), and `443` (https). Docker Compose **merges** port arrays when combining a base file with an override — it does not replace them. This means your override's `9991:443` gets added ON TOP of the base's `80:80` and `443:443`. Since Traefik already owns ports 80 and 443 on this VPS, Docker fails to start the container.
>
> **Why removing them is safe:**
>
> | Port | Why safe to remove |
> |---|---|
> | **25 (smtp)** | Email is disabled in JD Connect. `ZULIP__EMAIL_PASSWORD` is blank. Nothing uses this. |
> | **80 (http)** | Phase 2: you access Zulip on `9991` directly. Phase 3: Traefik handles HTTP→HTTPS, not Zulip. |
> | **443 (https)** | Phase 2: remapped to `9991:443` by your override. Phase 3: Traefik reaches Zulip's port 443 through the **internal Docker network** — no host-level port binding needed. |
>
> `ports:` only controls external (host-level) access. Zulip **still listens on port 443 inside the container** — that internal port is what Traefik connects to in Phase 3. This is not a destructive change.

```bash
# Remove the three default port bindings from the base compose.yaml
sed -i '71,83d' /opt/jdconnect_v2/zulip/compose.yaml

# Verify: line after 'build: context: .' should now be 'secrets:' (no ports in between)
sed -n '69,75p' /opt/jdconnect_v2/zulip/compose.yaml
```

Expected output (no `ports:` block):
```yaml
    build:
      context: .
    secrets:
      - zulip__postgres_password
      - zulip__memcached_password
```

> [!IMPORTANT]
> If you ever run `git pull` inside `/opt/jdconnect_v2/zulip/` to update the Zulip Docker stack, `compose.yaml` will be restored with the ports. Re-run the `sed` command above before restarting Zulip.

```bash
# Run one-time initialization (MUST complete with "=== End Initial Configuration Phase ===")
# ⚠ DO NOT re-run this if it already completed successfully — it writes to the Zulip volume.
# Re-running on an already-initialized volume can corrupt data.
docker compose run --rm zulip app:init

# Start Zulip stack and wait until healthy
docker compose up zulip --wait
```

**Create admin, bot accounts and attendance channel:**

> [!IMPORTANT]
> **Values to customise in this script before running:**
>
> | Value | Replace with | Appears where |
> |---|---|---|
> | `admin@company.com` | Your real admin email (same as `SETTING_ZULIP_ADMINISTRATOR` above) | **2 places in admin block:** (1) `delivery_email=` in the filter line, (2) `email=` in `do_create_user` — **both must be the same value** |
> | `AdminPassword123!` | A strong admin password — **write this down**, you'll use it to log into Zulip | `password=` in `do_create_user` |
> | `jdconnect-bot@company.com` | Can stay as-is — internal bot, never receives real email | Filter line + `email=` in bot block + both `change_user_role` commands |
>
> **`delivery_email` and `email=` are the same field** — `delivery_email` is what Zulip calls it internally, `email=` is the parameter name in `do_create_user`. They must always match.
>
> **What to leave unchanged:** `string_id=''`, `name='JD Connect'`, `'attendance'`, `full_name='JD Connect Admin'`, `full_name='JD Connect Bot'`, all role constants, and the `change_user_role` commands structure.

```bash
cd /opt/jdconnect_v2/zulip

./manage.py shell -c "
from zerver.models import Realm, UserProfile
from zerver.actions.create_user import do_create_user
from zerver.actions.create_realm import do_create_realm, ensure_stream

realm = Realm.objects.filter(string_id='').first()
if not realm:
    realm = do_create_realm(string_id='', name='JD Connect')

ensure_stream(realm, 'attendance', acting_user=None)
print('ATTENDANCE_CHANNEL_READY')

# ── Admin account ── REPLACE email in BOTH lines below ──────────────────────
admin = UserProfile.objects.filter(delivery_email='admin@company.com', realm=realm).first()  # ← REPLACE (same email as below)
if not admin:
    admin = do_create_user(
        email='admin@company.com',        # ← REPLACE with your real admin email
        password='AdminPassword123!',      # ← REPLACE with a strong password
        realm=realm,
        full_name='JD Connect Admin',      # ← leave as-is
        role=UserProfile.ROLE_REALM_ADMINISTRATOR,
        acting_user=None,
    )
    print('ADMIN_CREATED')
else:
    print('ADMIN_EXISTS')

# ── Bot account ── email can stay as-is (internal bot, no real email needed) ─
bot = UserProfile.objects.filter(delivery_email='jdconnect-bot@company.com', realm=realm).first()
if not bot:
    bot = do_create_user(
        email='jdconnect-bot@company.com', # ← leave as-is (or change to match your domain)
        password=None,
        realm=realm,
        full_name='JD Connect Bot',         # ← leave as-is
        bot_type=UserProfile.DEFAULT_BOT,
        role=UserProfile.ROLE_REALM_ADMINISTRATOR,
        acting_user=None,
    )
    print('BOT_CREATED')
else:
    print('BOT_EXISTS')

print('BOT_API_KEY:', bot.api_key)
"

# ── Grant bot admin + user-creation rights (leave these commands unchanged) ──
./manage.py change_user_role -r '' jdconnect-bot@company.com admin || true
./manage.py change_user_role -r '' jdconnect-bot@company.com can_create_users
```

**Save the `BOT_API_KEY` output** — you will need it in GitHub Secrets (next step).

**Set permanent links in Zulip channel descriptions:**

> **What this does:** Adds a permanent link to the Attendance App in the description of the `#attendance` and `#Breaks` channels. The description is always visible at the top of the channel — it doesn't scroll away like messages do.
>
> **URL to use — depends on which phase you are in:**
>
> | Phase | Attendance App URL to use |
> |---|---|
> | **Phase 2** (current) | `http://<VPS_IP>:3300` |
> | **Phase 3** (after domain + HTTPS) | `https://clock.jdfusion.in` (or your actual domain) |
>
> Replace `http://<VPS_IP>:3300` in the commands below with the correct URL for your phase.

```bash
cd /opt/jdconnect_v2/zulip

# Set description on #attendance channel
./manage.py shell -c "
from zerver.models import Realm, Stream, UserProfile
from zerver.actions.streams import do_change_stream_description
realm = Realm.objects.get(string_id='')
acting_user = UserProfile.objects.get(delivery_email='admin@company.com', realm=realm)
stream = Stream.objects.get(name='attendance', realm=realm)
do_change_stream_description(stream, 'Clock in / Clock out: http://<VPS_IP>:3300', acting_user=acting_user)
print('Done:', stream.description)
"

# Set description on #Breaks channel (note: capital B)
./manage.py shell -c "
from zerver.models import Realm, Stream, UserProfile
from zerver.actions.streams import do_change_stream_description
realm = Realm.objects.get(string_id='')
acting_user = UserProfile.objects.get(delivery_email='admin@company.com', realm=realm)
stream = Stream.objects.get(name='Breaks', realm=realm)
do_change_stream_description(stream, 'Log your break here: http://<VPS_IP>:3300', acting_user=acting_user)
print('Done:', stream.description)
"
```

> [!NOTE]
> Replace `admin@company.com` with your real admin email (same as `SETTING_ZULIP_ADMINISTRATOR`).
> The `#Breaks` channel name has a capital B — the query is case-sensitive.
> If `#Breaks` does not exist yet, create it in the Zulip UI first (as admin), then run the command.
>
> **To verify:** Open Zulip → click `# attendance` in the sidebar (not a topic inside it, the channel itself) → the description with the link appears at the top.
>
> **When switching to Phase 3:** Re-run both commands with `https://clock.jdfusion.in` (or your domain) to update the descriptions.

Verify Zulip is accessible:
```bash
# From your Windows machine
curl -k https://<VPS_IP>:9991/api/v1/server_settings
# Should return JSON with {"result":"success", ...}
```

---

### Step 7: Configure GitHub Secrets & Trigger First Deploy

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Add all secrets from the table in [Section 5](#5-github-secrets-reference).

**Trigger the first deployment:**
```powershell
# From your Windows machine, in the project directory
git add .
git commit -m "deploy: add CI/CD pipeline and Dockerfiles"
git push origin main
```

The pipeline will:
1. Run quality checks
2. Build three Docker images (takes ~5 minutes on first build, faster after)
3. SCP the compose file to `/opt/jdconnect/`
4. SSH in, write `.env`, pull images, start containers

Watch the pipeline run in **GitHub → Actions** tab.

---

### Step 8: Run First-Time Database Setup

After the first deploy completes, run migrations and seed data. SSH into your VPS:

```bash
# Run database migrations (creates all tables)
docker exec jdconnect_api tsx scripts/migrate.ts

# Run seed data (creates roles, permissions, departments, initial admin user)
docker exec jdconnect_api tsx scripts/seed.ts
```

> After the first time, migrations run **automatically** on every subsequent deploy (inside the pipeline's SSH script). The seed script is only needed once — never run it again unless resetting.

> [!IMPORTANT]
> After seed completes, the database has the schema and a default admin account, but **no real employees yet**. To migrate your existing employee records from the old system, complete Phase 2 verification first (Step 9), then follow **Step 9.5** below.

---

### Step 9: Verify Everything Works via IP

From your Windows machine:

```powershell
# Backend API health check
curl http://<VPS_IP>:4000/health
# Expected: {"status":"ok"}

# Attendance App (open in browser)
# http://<VPS_IP>:3300

# HR Dashboard (open in browser)
# http://<VPS_IP>:3500

# Zulip (open in browser — accept the self-signed cert warning)
# https://<VPS_IP>:9991
```

Log into the HR Dashboard with `admin@company.com` / `AdminPassword123!` — you should see the employee list load.
Log into Zulip with the same credentials.

**If Phase 2 is working: proceed to Step 9.5 to migrate employee data, then Phase 3 begins.**

---

### Step 9.5: Migrate Existing Employee Data (Go-Live Day)

> [!IMPORTANT]
> **Do NOT use the local test dump file for this step.** The local file (`jdconnect_public_data.sql` on your Windows machine) was used only during development. On actual go-live day, you generate a **fresh dump from the live old system** so it contains all data up to that exact moment. The commands below do exactly that.

> [!NOTE]
> The old `jd-connect` (Supabase stack) and the new `jdconnect_v2` stack **run on the same VPS**. There is no file transfer between servers. Everything in this step happens in a single SSH session on `82.29.165.21`.

This step imports all your real employee records from the old `jd-connect` Supabase database into the new JD Connect v2 Postgres database. The migration script talks **directly to Postgres** — it does not go through the HTTP API — so it must run inside the `jdconnect_api` container, which has database access.

You can run all of these commands **from any directory** on the VPS — `docker exec` and `docker cp` reference containers by name, not by path. Just SSH in and run them.

---

**1. Dump the live database from the old Supabase container**

```bash
# Step 1a: Run pg_dump inside the supabase-db container — writes to /tmp inside the container
docker exec supabase-db pg_dump \
  -U postgres \
  -d postgres \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  -f /tmp/jdconnect_public_data.sql

# Step 1b: Copy the dump out of the supabase-db container onto the VPS host filesystem
docker cp supabase-db:/tmp/jdconnect_public_data.sql /tmp/jdconnect_public_data.sql
```

The file is now at `/tmp/jdconnect_public_data.sql` on the VPS host.

---

**2. Copy the dump file into the new API container**

```bash
docker cp /tmp/jdconnect_public_data.sql jdconnect_api:/app/jdconnect_public_data.sql
```

---

**3. Run the migration script**

```bash
# Pass the file path explicitly as an argument — required on the VPS
docker exec jdconnect_api tsx scripts/migrate-employees.ts /app/jdconnect_public_data.sql
```

> [!IMPORTANT]
> You **must** include `/app/jdconnect_public_data.sql` as the argument. Without it, the script falls back to a hardcoded Windows path (`C:\Users\Administrator\Desktop\...`) which does not exist inside the Linux container and will crash immediately.

---

**4. Run the migration script**

> **Where to run this:** On the **new VPS**, from any directory.

```bash
# Pass the file path explicitly as an argument — required on the VPS
docker exec jdconnect_api tsx scripts/migrate-employees.ts /app/jdconnect_public_data.sql
```

> [!IMPORTANT]
> You **must** include `/app/jdconnect_public_data.sql` as the argument. Without it, the script falls back to a hardcoded Windows path (`C:\Users\Administrator\Desktop\...`) which does not exist inside the Linux container and will crash immediately.

The script will:
- Read the SQL dump from `/app/jdconnect_public_data.sql` inside the container
- Map old department/centre/shift/role IDs to the new schema
- Create a `users` row and an `employees` row for each employee
- Provision each employee in Zulip (sets `zulip_provisioned = true` if successful)
- Write a `migration_passwords.csv` file inside the container with each employee's temporary password

---

**5. Copy the passwords CSV back to your machine**

```bash
# On new VPS — copy out of container first
docker cp jdconnect_api:/app/migration_passwords.csv /opt/jdconnect_v2/migration_passwords.csv
```

```powershell
# On Windows — SCP it down
scp root@<NEW_VPS_IP>:/opt/jdconnect_v2/migration_passwords.csv C:\Users\Administrator\Desktop\vps_migration_passwords.csv
```

> [!CAUTION]
> `migration_passwords.csv` contains plaintext temporary passwords. Delete it from the VPS after safely downloading it:
> ```bash
> rm /opt/jdconnect_v2/migration_passwords.csv
> ```

> [!NOTE]
> The migration script is idempotent — if an employee already exists (matched by employee code or email), it is skipped. Safe to re-run if it was interrupted.

---

**6. Verify employees loaded**

> **Where to run this:** New VPS, any directory.

```bash
# Quick count check
docker exec jdconnect_postgres psql -U <POSTGRES_USER> -d jdconnect -c "SELECT COUNT(*) FROM employees;"
```

Log into the HR Dashboard at `http://<VPS_IP>:3500` — the employee list should show all migrated records.

---
---

## Phase 3 — DNS & HTTPS via Traefik

Your VPS already runs Traefik (network: `root_default`, certresolver: `mytlschallenge`). You do NOT install a new Traefik — you just attach your containers to the one already running.

---

### Step 10: Add DNS Records in Hostinger

Log into **Hostinger hPanel** → **Domains** → your domain → **DNS / Nameservers**.

Add these `A` records (set TTL to `300` while testing — raise to `3600` after confirming):

| Subdomain | Type | Value | TTL |
|---|---|---|---|
| `api` | A | `<VPS_IP>` | 300 |
| `clock` | A | `<VPS_IP>` | 300 |
| `hr` | A | `<VPS_IP>` | 300 |
| `chat` | A | `<VPS_IP>` | 300 |

Example: if your domain is `jdfusion.in`, your subdomains will be:
- `api.jdfusion.in` → Backend API
- `clock.jdfusion.in` → Attendance App
- `hr.jdfusion.in` → HR Dashboard
- `chat.jdfusion.in` → Zulip

Verify DNS is propagating (repeat until you see your VPS IP):
```powershell
nslookup api.jdfusion.in
nslookup chat.jdfusion.in
```

---

### Step 11: Switch to Production Compose

> [!IMPORTANT]
> **You must edit `deploy.yml` in your repository before deploying Phase 3.** The pipeline currently deploys `docker-compose.vps-test.yml` (Phase 2). For Phase 3 it must deploy `docker-compose.prod.yml` instead, which contains the Traefik labels that route traffic via your real domain and HTTPS.

**In `.github/workflows/deploy.yml`, make two changes:**

**Change 1 — SCP step** (the `source:` line, around line 200):
```yaml
# Before (Phase 2):
source: "docker/docker-compose.vps-test.yml"

# After (Phase 3):
source: "docker/docker-compose.prod.yml"
```

**Change 2 — SSH script** (the `docker compose` restart line, around line 240):
```bash
# Before (Phase 2):
docker compose -f docker-compose.vps-test.yml up -d --no-deps api attendance-app hr-dashboard

# After (Phase 3):
docker compose -f docker-compose.prod.yml up -d --no-deps api attendance-app hr-dashboard
```

**Why two separate compose files?**
- `docker-compose.vps-test.yml` exposes ports directly (`4000:4000`, `3300:80`, `3500:80`). Browsers connect straight to the VPS IP + port. No Traefik involved.
- `docker-compose.prod.yml` exposes **no ports** — Traefik reads the `Host()` labels and routes traffic based on your domain name. If there is no domain pointed at the VPS, the services are completely unreachable.

You cannot use `docker-compose.prod.yml` in Phase 2 (raw IP access would be blocked), and you cannot use `docker-compose.vps-test.yml` in Phase 3 (Traefik labels are absent, so your domain subdomains won't route). They are structurally different files.

After making these two changes, commit and push — the pipeline will deploy the production compose file with Traefik labels. The Traefik labels use `${DOMAIN}` which is written to `.env` from the `PROD_DOMAIN` secret.

---

### Step 12: Add Scoped `insecureSkipVerify` for Zulip

> **Why this is needed:** In Phase 3, Traefik routes `chat.YOURDOMAIN.com` → Zulip's internal nginx, which only speaks HTTPS on port 443 using a **self-signed certificate**. Traefik refuses to connect to a backend with an untrusted cert by default. We must tell it to skip cert verification for this one backend connection.

> [!IMPORTANT]
> **This only affects the Traefik → Zulip internal connection (container-to-container).** External HTTPS (browser ↔ Traefik) always uses valid Let's Encrypt certs and is unaffected.
>
> We do this in a **scoped** way — only Zulip gets the exception. Every other service behind this Traefik instance (e.g., n8n) retains full TLS verification. Do NOT use a global `insecureSkipVerify: true` flag.

#### File 1 of 2 — `/root/traefik-tls.yml` (define the named transport)

> **What this file is:** This is Traefik's **file provider** config, mounted read-only into the Traefik container at `/etc/traefik/tls.yml`. It is watched dynamically — changes are picked up without restarting Traefik.
>
> **What to change:** Add the `http.serversTransports` block shown below.
>
> **What NOT to change:** Leave the existing `tls.options.default` cipher/version block exactly as it is.

SSH into your VPS and append the named transport definition:

```bash
cat >> /root/traefik-tls.yml << 'EOF'

http:
  serversTransports:
    zulip-internal:
      insecureSkipVerify: true
EOF
```

Verify the file now looks like this (the `tls:` block stays unchanged above it):

```bash
cat /root/traefik-tls.yml
```

Expected output:
```yaml
tls:
  options:
    default:
      minVersion: VersionTLS12
      cipherSuites:
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
        - TLS_AES_256_GCM_SHA384
        - TLS_AES_128_GCM_SHA256
        - TLS_CHACHA20_POLY1305_SHA256

http:
  serversTransports:
    zulip-internal:
      insecureSkipVerify: true
```

No Traefik restart needed — the file provider picks up changes automatically.

#### File 2 of 2 — `/opt/jdconnect_v2/zulip/compose.override.yaml` (reference the named transport)

This is handled in **Step 13** below — the production Zulip override template already includes the correct label that references `zulip-internal`. You do not need to do anything extra here.

---

### Step 13: Switch Zulip to Production Override

> **Note:** The production override template below includes the label `traefik.http.services.zulip.loadbalancer.serversTransport=zulip-internal`. This references the named transport you defined in Step 12 File 1. This is what scopes the `insecureSkipVerify` exception to Zulip only.

SSH into your VPS:

```bash
cd /opt/jdconnect_v2/zulip

# Stop Zulip
docker compose down
```

Replace the override file with the production version. The production override template is committed in your git repo at `docker/zulip-prod.override.yaml`.

```bash
# Copy the prod override template from your git repo's committed file
# (You can also SCP it or paste it manually)
cat > /opt/jdconnect_v2/zulip/compose.override.yaml << 'EOF'
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
    environment:
      SETTING_EXTERNAL_HOST: "chat.YOURDOMAIN.com"
      SETTING_ZULIP_ADMINISTRATOR: "admin@company.com"
      SETTING_FAKE_EMAIL_DOMAIN: "localhost"
      CERTIFICATES: "self-signed"
      SETTING_EXTRA_CUSTOM_CSS: "/static/custom.css"
    volumes:
      - ./zulip-notion-theme.css:/home/zulip/prod-static/custom.css:ro
      - ./nginx-custom-theme.conf:/etc/nginx/zulip-include/app.d/custom-theme.conf:ro
    networks:
      - default
      - root_default
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=root_default"
      - "traefik.http.routers.zulip.rule=Host(`chat.YOURDOMAIN.com`)"
      - "traefik.http.routers.zulip.entrypoints=websecure"
      - "traefik.http.routers.zulip.tls.certresolver=mytlschallenge"
      - "traefik.http.services.zulip.loadbalancer.server.port=443"
      - "traefik.http.services.zulip.loadbalancer.server.scheme=https"
      # This references the named serversTransport defined in /root/traefik-tls.yml (Step 12).
      # It scopes insecureSkipVerify to ONLY the Traefik → Zulip backend connection.
      - "traefik.http.services.zulip.loadbalancer.serversTransport=zulip-internal"
      - "traefik.http.routers.zulip-http.rule=Host(`chat.YOURDOMAIN.com`)"
      - "traefik.http.routers.zulip-http.entrypoints=web"
      - "traefik.http.routers.zulip-http.middlewares=redirect-to-https@docker"

networks:
  default: {}
  root_default:
    external: true
EOF
```

> [!NOTE]
> The theme files (`zulip-notion-theme.css` and `nginx-custom-theme.conf`) were already SCP'd to `/opt/jdconnect_v2/zulip/` in Step 6. The volume mounts here reference those files — no additional SCP is needed.

> **Replace `YOURDOMAIN.com` with your actual domain** (e.g., `jdfusion.in`).

Start Zulip with the production override:
```bash
docker compose up -d
```

Traefik will automatically detect the new labels and begin requesting a Let's Encrypt certificate for `chat.YOURDOMAIN.com` (takes 1-2 minutes).

---

### Step 14: Update GitHub Secrets & Redeploy

Update these secrets in GitHub → **Settings** → **Secrets and variables** → **Actions**:

| Secret | New value for Phase 3 |
|---|---|
| `PROD_DOMAIN` | `jdfusion.in` (your actual domain, no subdomain prefix) |
| `PROD_BACKEND_URL` | `https://api.jdfusion.in` |
| `HR_DASHBOARD_URL` | `https://hr.jdfusion.in` |
| `CLOCK_APP_URL` | `https://clock.jdfusion.in` |
| `ZULIP_BASE_URL` | `https://chat.jdfusion.in` |
| `ALLOWED_CORS_ORIGINS` | `https://clock.jdfusion.in,https://hr.jdfusion.in,https://chat.jdfusion.in` |

Trigger a redeploy by pushing a commit:
```powershell
git commit --allow-empty -m "deploy: switch to Phase 3 production domains"
git push origin main
```

> The pipeline will rebuild the attendance-app and hr-dashboard images with the new `BACKEND_URL` baked in, and redeploy all containers with the production `.env` written from the updated secrets.

---

### Step 15: Verify HTTPS & SSL Certs

```bash
# On the VPS — check Traefik logs for Let's Encrypt activity
docker logs $(docker ps --filter "name=traefik" --format "{{.Names}}" | head -1) 2>&1 \
  | grep -i "certificate\|acme\|jdfusion"

# Test HTTPS endpoints
curl -I https://api.jdfusion.in/health
curl -I https://clock.jdfusion.in
curl -I https://hr.jdfusion.in
curl -I https://chat.jdfusion.in
```

All should return `HTTP/2 200` with `server: Traefik` in headers.

Open the apps in your browser — you should see the green padlock 🔒 on all subdomains.

**Phase 3 complete. JD Connect is in production.**

---
---

## 5. GitHub Secrets Reference

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** and add ALL of the following:

### Auth Secrets (generate once, never change)
| Secret Name | Description | How to generate |
|---|---|---|
| `VPS_HOST` | VPS IP address | From Hostinger panel |
| `VPS_USER` | VPS SSH username | `root` |
| `VPS_SSH_KEY` | Private SSH key content | `Get-Content ~\.ssh\id_ed25519` (PowerShell) |
| `GHCR_TOKEN` | GitHub PAT with `write:packages` + `repo` scope | GitHub → Settings → Developer settings → Tokens |

### Database Secrets
| Secret Name | Description | Example |
|---|---|---|
| `POSTGRES_USER` | JD Connect Postgres username | `jduser` |
| `POSTGRES_PASSWORD` | JD Connect Postgres password | `openssl rand -hex 20` |

### JWT Secret
| Secret Name | Description | How to generate |
|---|---|---|
| `JWT_SECRET` | RS256 JWT signing secret (min 32 chars) | `openssl rand -base64 32` |

### Domain Secrets (update when switching phases)
| Secret Name | Phase 2 value | Phase 3 value |
|---|---|---|
| `PROD_DOMAIN` | `<VPS_IP>` (e.g. `82.29.165.21`) | `jdfusion.in` |
| `PROD_BACKEND_URL` | `http://<VPS_IP>:4000` | `https://api.jdfusion.in` |
| `HR_DASHBOARD_URL` | `http://<VPS_IP>:3500` | `https://hr.jdfusion.in` |
| `CLOCK_APP_URL` | `http://<VPS_IP>:3300` | `https://clock.jdfusion.in` |
| `ALLOWED_CORS_ORIGINS` | `http://<VPS_IP>:3300,http://<VPS_IP>:3500,https://<VPS_IP>:9991` | `https://clock.jdfusion.in,https://hr.jdfusion.in,https://chat.jdfusion.in` |

> [!NOTE]
> `VPS_IP` is **not a separate GitHub Secret**. The pipeline automatically writes `VPS_IP=${{ secrets.VPS_HOST }}` into the `.env` file on the VPS — so the value comes from `VPS_HOST` (which already holds the raw IP). No extra secret needed.

### Zulip Secrets (get these from Zulip setup — Step 7)
| Secret Name | Description | Where to find |
|---|---|---|
| `ZULIP_BASE_URL` | Zulip's public URL | Phase 2: `https://<VPS_IP>:9991` / Phase 3: `https://chat.jdfusion.in` |
| `ZULIP_BOT_EMAIL` | Bot account email | `jdconnect-bot@company.com` |
| `ZULIP_BOT_API_KEY` | Bot API key | Output of Step 7's `BOT_API_KEY:` line |

### How to Generate `GHCR_TOKEN`
1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)**
3. Name: `JDConnect-VPS-Deploy`, expiration: No expiration
4. Scopes: ✅ `repo`, ✅ `write:packages`
5. **Generate token** → copy immediately (starts with `ghp_...`)

---

## 6. Maintenance & Operations

### Deploy a new version
Just push to `main`. The pipeline handles everything automatically.

### Roll back to a previous version
```bash
# On the VPS — pull a specific image tag (if you've set up versioned tags)
# Or: roll back by reverting the git commit and pushing
git revert HEAD && git push origin main
```

### Manual migration run (emergency)
```bash
docker exec jdconnect_api tsx scripts/migrate.ts
```

### Employee data migration (one-time, post-Phase 2)
See **Step 10.5** in the Phase 2 section above for the full procedure.
Short version:
```bash
# On VPS — after SCP'ing the SQL file there and docker cp'ing into container:
docker exec jdconnect_api tsx scripts/migrate-employees.ts
docker cp jdconnect_api:/app/migration_passwords.csv /opt/jdconnect_v2/migration_passwords.csv
```

### View API logs
```bash
docker logs jdconnect_api -f --tail=100
```

### Restart a single container
```bash
docker restart jdconnect_api          # Backend API

docker restart jdconnect_attendance   # Attendance App
docker restart jdconnect_hr           # HR Dashboard
docker restart jdconnect_postgres     # Postgres (careful — brief downtime)
```

### Update Zulip (when a new Zulip version is released)
```bash
cd /opt/jdconnect_v2/zulip
git pull origin main       # Get the new compose.yaml from official repo
docker compose pull        # Pull new Zulip images
docker compose up -d       # Restart with new images
```

### Free up VPS disk space
```bash
docker image prune -a -f   # Removes ALL unused images (be careful)
docker system prune -f     # Removes stopped containers, dangling images, unused networks
```

### Postgres backup
```bash
docker exec jdconnect_postgres pg_dump \
  -U $POSTGRES_USER \
  -d jdconnect \
  --schema=public \
  -f /tmp/jdconnect_backup_$(date +%Y%m%d).sql

docker cp jdconnect_postgres:/tmp/jdconnect_backup_$(date +%Y%m%d).sql /opt/jdconnect_v2/backups/
```

---

## 7. FAQ

### Why are there two separate Docker compose stacks?
Zulip is a complex stack with its own internal database, cache, queue, and message broker. Keeping it isolated from the JD Connect compose stack means:
- You can restart the JD Connect stack without touching Zulip
- A Zulip crash doesn't affect the Backend API or HR Dashboard
- Zulip can be updated independently

### Why does the VPS not have the source code?
Following the JD CRM pattern: the VPS only runs pre-built Docker images. Building inside the VPS would consume large amounts of CPU and RAM and risk crashing the live service during deployment. GitHub's free runners build the images — the VPS only pulls and runs them.

### The Attendance App/HR Dashboard shows the wrong backend URL
The backend URL is baked into the Docker image at build time (`BACKEND_URL` build arg). After changing `PROD_BACKEND_URL` in GitHub Secrets, trigger a redeploy — the pipeline rebuilds the images with the new URL.

### Zulip's external SSO (OIDC) — when does it work?
The "Sign in with Zulip" button in the Attendance App requires full HTTPS with matching domains (Phase 3). It does not work in Phase 2 (plain HTTP, raw VPS IP). The JWT login in the Attendance App works in all phases.

### Can I use a different domain structure?
Yes. Instead of subdomains (`api.jdfusion.in`), you can use:
- Different subdomains of an existing domain: `jdapi.company.com`, `jdclock.company.com`, etc.
- Just update the `Host()` rules in `docker-compose.prod.yml` and `zulip-prod.override.yaml`, and update your DNS records and GitHub Secrets accordingly.

### Traefik's `root_default` network — what if mine is named differently?
The guide assumes `root_default` (as confirmed from your VPS's existing JD Connect deployment). Run this to verify:
```bash
docker inspect $(docker ps --filter "name=traefik" --format "{{.Names}}" | head -1) \
  --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
```
If the name differs, update it in `docker-compose.prod.yml` and `zulip-prod.override.yaml` accordingly.

---

## 6. Database Reset Runbook

Use this when you need to wipe and reinitialise either database from scratch (e.g. switching from test data to real production data, or recovering from a corrupted state).

> [!CAUTION]
> These commands **permanently delete all data** in the selected database. There is no undo. Make a backup first if you need to preserve anything.

---

### Reset JD Connect Postgres (app database only)

Wipes: all employees, attendance records, shifts, departments, sessions — everything in the JD Connect app DB.
Does NOT affect: Zulip, its users, or messages.

```bash
cd /opt/jdconnect_v2

# 1. Stop the app stack
docker compose -f docker-compose.vps-test.yml down

# 2. Delete the data volume (permanent)
docker volume rm jdconnect_v2_pgdata_test

# 3. Restart (volume is recreated empty, postgres initialises a fresh DB)
docker compose -f docker-compose.vps-test.yml up -d

# 4. Wait for postgres to be healthy, then run migrations + seed
sleep 15
docker exec jdconnect_api tsx scripts/migrate.ts
docker exec jdconnect_api tsx scripts/seed.ts
```

After seeding, the super-admin account is recreated:
- **Email:** `admin@company.com` (or whatever your seed script uses)
- **Password:** `AdminPassword123!`

Re-import employee data if needed using your migration scripts.

---

### Reset Zulip database only

Wipes: all Zulip realms, users, messages, channels, bot accounts, API keys.
Does NOT affect: the JD Connect Postgres database.

```bash
cd /opt/jdconnect_v2/zulip

# 1. Stop the Zulip stack
docker compose down

# 2. Delete the Zulip data volume (permanent)
docker volume rm zulip_zulip

# 3. Re-run one-time initialisation (same as first-time setup)
#    ⚠ Remove the default ports from compose.yaml again if you updated Zulip via git pull
docker compose run --rm zulip app:init

# 4. Start Zulip
docker compose up -d

# 5. Wait until healthy
docker ps | grep zulip-zulip   # wait for (healthy)

# 6. Re-run the full manage.py setup script (admin + bot + attendance channel)
#    → Same script from Step 6 of this guide
./manage.py shell -c "..."

./manage.py change_user_role -r '' jdconnect-bot@company.com admin || true
./manage.py change_user_role -r '' jdconnect-bot@company.com can_create_users
```

> [!IMPORTANT]
> After resetting Zulip, the bot's API key changes. You **must** update the `ZULIP_BOT_API_KEY` GitHub Secret with the new key from the `BOT_API_KEY:` output and trigger a redeploy so the backend picks up the new key.

---

### Reset both databases (full clean slate)

Run the JD Connect Postgres reset first, then the Zulip reset above. Order doesn't matter — they are fully independent.

---

### After either reset — re-invite employees

After a Zulip reset, all employee Zulip accounts are gone. You will need to re-invite them or re-run whatever bulk-invite process you used during initial onboarding.
