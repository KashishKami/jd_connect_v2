# JD Connect — Developer Quickstart & Component Guide

This guide is the single source of truth for running all JD Connect platform services, web interfaces, and testing user flows locally.

---

## 📁 Monorepo Component & Port Reference

| Component | Directory Path | Description | Access URL & Port |
| :--- | :--- | :--- | :--- |
| **Monorepo Root** | `/Users/kashihyadav/Desktop/jd_connect_v2` | Project root, database scripts & CI quality gates | N/A |
| **Postgres Database** | `docker/docker-compose.yml` | Plain Postgres 16 database container | `localhost:5432` |
| **Zulip Chat Platform** | `docker/zulip/` | Official Zulip Docker Compose stack | `https://127.0.0.1:9991` |
| **Backend API** | `backend/` | Express TypeScript REST API | `http://localhost:4000` |
| **Attendance Web App** | `attendance-app/` | Single-page UI for employee clock-in/out & breaks | `http://localhost:3300` |
| **HR Dashboard** | `hr-dashboard/` | Next.js HR Web App for workforce management | **`http://localhost:3500`** |

---

## 🔐 Seeded Accounts & Default Credentials

Use these credentials to test user flows across the system out-of-the-box:

| Service / App | Role | Email | Password | Privileges |
| :--- | :--- | :--- | :--- | :--- |
| **Attendance, HR & Zulip** | Super Admin / Realm Admin | `admin@company.com` | `AdminPassword123!` | Full system access, Zulip workspace admin, HR management |
| **Attendance & HR Dashboard** | Department Manager | `jane.mgr@jdconnect.com` | `Manager123!` | Department manager, attendance & break reporting |
| **Attendance & HR Dashboard** | Standard Employee | `john.doe@jdconnect.com` | `Employee123!` | Standard employee clock-in/out & break tracking |
| **Zulip Platform** | Realm Admin | `admin@company.com` | `AdminPassword123!` | Zulip workspace administrator |
| **Zulip Platform** | System Bot | `jdconnect-bot@company.com` | API Key in `.env` | Posts daily attendance prompts to `#attendance` |

---

## ⚡ How to Run Everything (3 Terminals)

### Terminal 1: Database & Backend API

```bash
# 1. Start at the Monorepo Root
cd /Users/kashihyadav/Desktop/jd_connect_v2

# 2. Boot Postgres container (port 5432)
pnpm docker:dev:up

# 3. Run database migrations & seed core data
pnpm db:migrate
pnpm db:seed

# 4. Navigate into backend/ and start API server
cd backend
pnpm dev
```
> **Check**: Open `http://localhost:4000/health` → returns `{"status":"ok"}`.

---

### Terminal 2: Attendance Web App

```bash
# 1. Navigate into attendance-app/
cd /Users/kashihyadav/Desktop/jd_connect_v2/attendance-app

# 2. Serve attendance app on port 3300
npx serve . -p 3300
```
> **Check**: Open `http://localhost:3300` in your browser.

---

### Terminal 3: HR Dashboard (Web App)

```bash
# 1. Navigate into hr-dashboard/
cd /Users/kashihyadav/Desktop/jd_connect_v2/hr-dashboard

# 2. Start HR Admin Dashboard on port 3500
pnpm dev
```
> **Check**: Open `http://localhost:3500` in your browser.

---

## 🔄 End-to-End User Flow & SSO Navigation Guide

### Step 1: Access Zulip Workspace & Attendance Channel
1. Navigate to `https://127.0.0.1:9991` in your browser (accept self-signed TLS warning).
2. Log in as Zulip Administrator (`admin@company.com` / `AdminPassword123!`).
3. Under **CHANNELS** in the left sidebar, click **`# attendance`** (or create a channel named `attendance` if it does not exist).
4. Run the Zulip Bot script from your terminal to post the daily prompt:
   ```bash
   pnpm --filter @jdconnect/zulip-bot start
   ```
   > **Output**: `[Zulip Bot] Successfully posted attendance prompt (Message ID: 21)`

### Step 2: Employee Shift Clock-In & Zulip SSO Flow
1. **Zulip SSO / OAuth Path**: Click the clock-in link posted by the bot in `# attendance` (or navigate directly to `http://localhost:3300`).
2. **Authentication Options**:
   - **Direct Login**: Enter employee email & password (`john.doe@jdconnect.com` / `Employee123!`).
   - **Zulip SSO / Token URL**: The Attendance App automatically parses `?token=<jwt>` from the URL search query (e.g. `http://localhost:3300/?token=<access_token>`), or initiates OIDC authorization via `http://localhost:4000/oauth/authorize?client_id=attendance-app&response_type=code&redirect_uri=http://localhost:3300`.
3. Click **Clock In** → status changes to "Clocked In", shift timer starts (`00:00:01`).
4. Select a break reason from the dropdown (e.g. *Bio Break* or *Dinner Break*) → click **Start Break**. Status updates to "On Break".
5. Click **End Break** → status returns to "Clocked In".
6. Click **Clock Out** → shift summary appears with total hours worked.

### Step 3: HR Management & Employee Provisioning
1. Open `http://localhost:3500` (HR Dashboard).
2. Log in using HR Admin credentials: `admin@company.com` / `AdminPassword123!`.
3. **View Directory**: Inspect active employees, departments, and Zulip account status (`✓ Provisioned`).
4. **Add Employee**: Click **+ Add Employee** button → fill out employee name, email, password, and role → click **Provision Employee**. The Backend API creates the user in Postgres AND provisions their Zulip account automatically.
5. **Live Monitor**: Open **Live Workforce Monitor** tab to see real-time active staff counts and workers currently on break.

---

## 🧪 Full Monorepo Quality Gate Verification

To run linting, typechecking, and all unit/integration tests across all packages:

```bash
cd /Users/kashihyadav/Desktop/jd_connect_v2
pnpm ci:quality
```
