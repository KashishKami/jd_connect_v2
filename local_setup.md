# Local Setup & Developer Onboarding Guide — JD Connect

This document provides complete, step-by-step instructions to set up the JD Connect platform from scratch on a new developer machine.

---

## 1. System Status on This Machine

> [!NOTE]
> **Everything is ALREADY fully configured and running on this machine!**
> - **JD Connect Postgres**: Running on port `5432` (`jdconnect_postgres` container). All database migrations and seed data are applied.
> - **Zulip Chat Platform**: Running on `https://127.0.0.1:9991` (`docker/zulip/` compose stack).
> - **Zulip Admin Account**: `admin@company.com` / `AdminPassword123!` (Role: Organization Administrator).
> - **Zulip Bot Account**: `jdconnect-bot@company.com` / API Key: `G8e43VrvWU1x5Llk2Amjtqm3u6FXH7xI` (configured in root `.env`).
> - **Test Suite**: 30/30 backend unit & integration tests passing cleanly.

---

## 2. Prerequisites for a New System

Before starting, ensure the target machine has:
- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher (`npm install -g pnpm`)
- **Docker Desktop**: Installed and running

---

## 3. Step-by-Step Setup Guide on a New Machine

### Step 1: Clone Repository & Install Monorepo Dependencies
```bash
git clone <repository-url> jd_connect_v2
cd jd_connect_v2

# Install dependencies and approve built scripts
pnpm install
pnpm approve-builds --all
```

### Step 2: Configure Environment Files
```bash
cp .env.example .env
cp .env.test.example .env.test
```

### Step 3: Start JD Connect Postgres Container & Run Database Setup
```bash
# Start JD Connect Postgres container (port 5432)
pnpm docker:dev:up

# Run SQL database migrations and seed core domain constants
pnpm db:migrate
pnpm db:seed
```

### Step 4: Clone & Configure Zulip Official Stack
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
```

Create `docker/zulip/.env`:
```dotenv
ZULIP__POSTGRES_PASSWORD=zulipdevpostgrespassword
ZULIP__MEMCACHED_PASSWORD=zulipdevmemcachedpassword
ZULIP__RABBITMQ_PASSWORD=zulipdevrabbitmqpassword
ZULIP__REDIS_PASSWORD=zulipdevredispassword
ZULIP__SECRET_KEY=zulipdevsecretkey32charsminimumXXX
ZULIP__EMAIL_PASSWORD=
```

### Step 5: Boot Zulip Container Stack
Run the mandatory one-time initialization sequence from inside `docker/zulip/`:
```bash
# Pull official images
docker compose pull

# Initialize internal database schema and secrets (must end with === End Initial Configuration Phase ===)
docker compose run --rm zulip app:init

# Start Zulip stack
docker compose up zulip --wait
```

### Step 6: Create Admin & Bot Accounts

From inside `docker/zulip/`:
```bash
./manage.py shell -c "
from zerver.models import Realm, UserProfile
from zerver.actions.create_user import do_create_user

realm = Realm.objects.get(string_id='')

# Check / Create Admin User
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

# Check / Create Bot Account
bot = UserProfile.objects.filter(delivery_email='jdconnect-bot@company.com', realm=realm).first()
if not bot:
    bot = do_create_user(
        email='jdconnect-bot@company.com',
        password=None,
        realm=realm,
        full_name='JD Connect Bot',
        bot_type=UserProfile.DEFAULT_BOT,
        acting_user=None,
    )
    print('BOT_CREATED')
else:
    print('BOT_EXISTS')

print('BOT_API_KEY:', bot.api_key)
"
```

Copy the output `BOT_API_KEY` and update the root `.env` file:
```dotenv
ZULIP_BASE_URL=https://127.0.0.1:9991
ZULIP_BOT_EMAIL=jdconnect-bot@company.com
ZULIP_BOT_API_KEY=<pasted_bot_api_key_here>
```

### Step 7: Start Development Servers

Once `.env` is updated with `ZULIP_BOT_API_KEY`, start the development servers:

1. **Backend API Server (`http://127.0.0.1:4000`)**:
   ```bash
   cd backend
   pnpm dev
   ```

2. **HR Dashboard (`http://127.0.0.1:3200`)**:
   ```bash
   cd hr-dashboard
   pnpm dev
   ```

3. **Access Zulip Workspace (`https://127.0.0.1:9991`)**:
   - Open `https://127.0.0.1:9991` in your browser.
   - Log in using `admin@company.com` / `AdminPassword123!`.

---

## 4. How Email & Password Work During Account Creation

### A. Admin / Initial Zulip Setup
- Initial admin account (`admin@company.com`) and Bot account (`jdconnect-bot@company.com`) are provisioned during initial setup via Django shell scripts or Zulip organization registration links.

### B. Employee Account Creation (Standard BPO Operations)
When an employee joins the company, account creation follows a strict dual-system flow managed by the **Backend API**:

1. **HR Action**: HR administrator fills out employee details in HR Dashboard (`full_name`, `email`, `password`, `role_key`, `department_id`, `centre_id`, `shift_id`).
2. **Backend API Request**: Dashboard sends request to `POST /api/employees`.
3. **Database Write**: Backend API hashes the password using `bcrypt` (12 rounds) and creates rows in Postgres `users` and `employees` tables.
4. **Zulip Provisioning**: Backend API calls Zulip Admin REST API (`POST /api/v1/users`) using the Bot API Key to create the corresponding Zulip chat account automatically.
5. **Cross-System Link**: The returned integer `user_id` from Zulip is saved in Postgres as `employees.zulip_user_id`.
6. **Password Resets**: Password resets are strictly admin/HR initiated via `POST /api/employees/:id/reset-password` (no self-service email reset links).

---

## 5. Verification Commands

Run the full monorepo quality suite to verify code health:
```bash
# Run linting check
pnpm lint

# Run TypeScript compilation check
pnpm typecheck

# Run unit and integration tests
pnpm test

# Full CI quality check
pnpm ci:quality
```
