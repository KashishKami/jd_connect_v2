# Local Setup Guide — JD Connect

This document provides complete, step-by-step instructions for setting up **JD Connect** on a fresh development machine, from cloning the repository to running the full stack locally.

---

## 📋 Prerequisites

Before starting, ensure the following software is installed on your operating system:

1. **Git**: `git --version` (2.x+)
2. **Node.js**: `node --version` (v20.x or higher)
3. **pnpm**: `pnpm --version` (v9.x or v10.x)
   - If pnpm is not installed, run: `npm install -g pnpm`
4. **Docker Desktop & Docker Compose**: `docker compose version` (v2.x+)

---

## 🚀 Step 1: Clone the Repository

Clone the project repository to your local machine and navigate into the workspace root:

```bash
git clone <repository-url> jd_connect
cd jd_connect
```

---

## ⚙️ Step 2: Configure Environment Files

The monorepo uses `.env` for development and `.env.test` for automated testing. Copy the template files:

```bash
# 1. Copy development environment file
cp .env.example .env

# 2. Copy test environment template to active test environment file
cp .env.test.example .env.test
```

> **Note on Network Hosts:** All services are configured to connect using direct IPv4 addresses (`127.0.0.1`) rather than `localhost` to eliminate DNS lookup latency and cross-platform resolution issues:
> - **Dev Postgres DB:** `postgresql://jduser:jdpassword@127.0.0.1:5432/jdconnect`
> - **Test Postgres DB:** `postgresql://jduser:jdpassword@127.0.0.1:5432/jdconnect_test`
> - **Backend API:** `http://127.0.0.1:4000`
> - **Rocket.Chat Container:** `http://127.0.0.1:3100`
> - **HR Web Dashboard:** `http://127.0.0.1:3000`

---

## 📦 Step 3: Install Dependencies via `pnpm`

Install all monorepo dependencies (`backend`, `rc-app`, `hr-dashboard`) from the root:

```bash
pnpm install
```

---

## 🐳 Step 4: Start Docker Container Infrastructure

Start the local Postgres database container and Rocket.Chat + MongoDB replica set stack:

```bash
# Option A: Using pnpm shortcut
pnpm docker:dev:up

# Option B: Direct docker compose command
docker compose -f docker/docker-compose.yml up -d
```

Verify that all containers are healthy and running:

```bash
docker compose -f docker/docker-compose.yml ps
```

The database container automatically initializes both the development database (`jdconnect`) and dedicated test database (`jdconnect_test`).

---

## 🗄️ Step 5: Run Database Migrations & Seeders

Apply SQL migrations and seed initial domain lookup records (roles, permissions, departments, centres, shifts, break types):

```bash
# Run migrations on development database (jdconnect)
cd backend
npx ts-node scripts/migrate.ts
npx ts-node scripts/seed.ts
cd ..
```

To run migrations on the test database (`jdconnect_test`):

```bash
cd backend
NODE_ENV=test npx ts-node scripts/migrate.ts
cd ..
```

---

## 🧪 Step 6: Verify System Quality & Run Tests

Run quality checks across the monorepo using `pnpm`:

```bash
# 1. Run ESLint across all workspaces
pnpm lint

# 2. Run TypeScript compilation check across all workspaces
pnpm typecheck

# 3. Run unit & integration test suites against test database (jdconnect_test)
pnpm test

# 4. Run full CI pipeline validation (lint + typecheck + test)
pnpm ci:quality
```

---

## 💻 Step 7: Run Development Servers

To run the applications locally in development mode:

1. **Backend API Service (`http://127.0.0.1:4000`)**:
   ```bash
   cd backend
   pnpm dev
   ```

2. **HR Dashboard Web App (`http://127.0.0.1:3000`)**:
   ```bash
   cd hr-dashboard
   pnpm dev
   ```

3. **Rocket.Chat Web UI (`http://127.0.0.1:3100`)**:
   - Open `http://127.0.0.1:3100` in your web browser to access Rocket.Chat.

---

## 🛠️ Summary of Common Commands

| Command | Action |
|:---|:---|
| `pnpm install` | Install all monorepo dependencies |
| `pnpm lint` | Run ESLint check |
| `pnpm typecheck` | Run TypeScript typecheck (`tsc --noEmit`) |
| `pnpm test` | Run Vitest test suites using `.env.test` |
| `pnpm ci:quality` | Run lint, typecheck, test suite, and build in sequence |
| `pnpm docker:dev:up` | Start Docker containers (Postgres, Mongo, Rocket.Chat) |
| `pnpm docker:dev:down` | Stop Docker containers |
| `pnpm docker:logs` | Tail Docker container logs |
