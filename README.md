# JD Connect — Monorepo BPO Operations Platform

JD Connect is a platform for BPO/call-centre operations built around **Zulip** (communication & SSO), **Backend API** (custom Postgres auth & attendance tracking), **Attendance Web App** (clock-in/out & break tracking), **Zulip Bot** (daily prompts), and **HR Dashboard**.

---

## 🏗️ System Architecture & Service Connections

```text
                                 +-------------------------------------------------------+
                                 |            ZULIP CHAT PLATFORM                        |
                                 |         (Docker: https://127.0.0.1:9991)              |
                                 |  - Owns Zulip Postgres (zerver_userprofile, chat)    |
                                 |  - Serves #attendance channel for daily prompts       |
                                 +---------------------------+---------------------------+
                                                             |
                                           Bot Posts Message | Direct SSO Link / OIDC
                                           to #attendance    v
+-----------------------------+          +-------------------+-------------------+
|         ZULIP BOT           |          |        ATTENDANCE WEB APP             |
|   (Stateless Node Service)  |=========>|      (npx serve . -p 3300)             |
|  - Reads env ZULIP_BOT_*    |          |  - Employee Clock In/Out UI           |
|  - Triggers daily prompt    |          |  - Bio/Tea/Dinner/Smoke/Meeting Breaks|
|  - Run: pnpm bot:start      |          |  - Parses ?token=<jwt> & OAuth SSO    |
+-----------------------------+          +-------------------+-------------------+
                                                             |
                                                             | REST API Calls (Bearer JWT)
                                                             v
+-----------------------------+          +-------------------+-------------------+
|         HR DASHBOARD        |          |            BACKEND API                |
|   (pnpm dev on port 3500)   |=========>|       (Express / Node on 4000)        |
|  - Employee Directory       | REST API |  - RS256 Asymmetric JWT Auth          |
|  - Add Employee Modal       | Bearer   |  - OIDC Provider (/oauth/authorize)   |
|  - Password Reset & Audit   | JWT      |  - Zulip Admin Provisioning REST API  |
+-----------------------------+          +-------------------+-------------------+
                                                             |
                                                             | SQL Queries (pg pool)
                                                             v
                                         +-------------------+-------------------+
                                         |         JD CONNECT POSTGRES           |
                                         |      (Docker: localhost:5432)         |
                                         |  - Database: jdconnect                   |
                                         |  - Schema: users, employees, shifts,  |
                                         |    attendance_records, break_records  |
                                         +---------------------------------------+
```

---

## 🤖 What is the Zulip Bot?

The **Zulip Bot** (`zulip-bot/`) is a lightweight, stateless Node.js service that runs as a background process or cron job.
- **Purpose**: Posts the daily shift check-in prompt message to the `#attendance` stream in Zulip.
- **Message Content**: Contains a markdown link (`👉 [Clock In / Manage Attendance](http://localhost:3300)`) directing employees straight into the Attendance Web App.
- **How to run it manually**:
  ```bash
  pnpm --filter @jdconnect/zulip-bot start
  ```
  *(Output: `[Zulip Bot] Successfully posted attendance prompt (Message ID: 21)`)*

---

## 🔑 Seeded Accounts & Credentials

| Service / App | Role | Email | Password | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Attendance & HR Dashboard** | Standard Employee | `john.doe@jdconnect.com` | `Employee123!` | Employee attendance & break tracking |
| **Attendance & HR Dashboard** | Department Manager | `jane.mgr@jdconnect.com` | `Manager123!` | Department manager reports |
| **Attendance, HR & Zulip** | Super Admin / Realm Admin | `admin@company.com` | `AdminPassword123!` | Full system & HR Operations management |
| **Zulip Platform** | System Bot | `jdconnect-bot@company.com` | API Key in `.env` | Automation bot for daily prompts |

---

## ⚡ Quickstart — Running Services Locally

### Terminal 1: Database & Backend API
```bash
cd /Users/kashihyadav/Desktop/jd_connect_v2

# Start Postgres container (port 5432) & seed data
pnpm docker:dev:up
pnpm db:migrate
pnpm db:seed

# Start Backend API (port 4000)
cd backend
pnpm dev
```

### Terminal 2: Attendance Web App
```bash
cd /Users/kashihyadav/Desktop/jd_connect_v2/attendance-app
npx serve . -p 3300
```
*Access at: `http://localhost:3300`*

### Terminal 3: HR Dashboard
```bash
cd /Users/kashihyadav/Desktop/jd_connect_v2/hr-dashboard
pnpm dev
```
*Access at: `http://localhost:3500`*

---

## 🔄 How Zulip SSO Authentication Works

1. **Zulip Channel Navigation**: Employee logs into Zulip (`https://127.0.0.1:9991`), opens `#attendance`, and clicks the clock-in link.
2. **OIDC OAuth Authorization**: Link points to `http://localhost:4000/oauth/authorize?client_id=attendance-app&response_type=code&redirect_uri=http://localhost:3300`.
3. **Token Exchange**: The Attendance Web App reads `?code=` from the URL, calls `POST /oauth/token` to exchange it for an RS256 JWT `access_token`, saves it in `localStorage`, and logs the employee in automatically.
4. **Direct Login Alternative**: Enter `john.doe@jdconnect.com` / `Employee123!` directly on `http://localhost:3300`.

---

## 🧪 Monorepo Quality Gate Verification

Run full CI quality suite across all workspace packages:
```bash
pnpm ci:quality
```
*Executes linting, typechecking, 107 Vitest tests across 32 test files, and builds all workspace packages.*
