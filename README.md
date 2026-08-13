# JD Connect — Monorepo

Internal platform for BPO/call-centre operations built around Rocket.Chat as the primary communication layer, Postgres for HR/attendance tracking, custom JWT authentication, and an HR Dashboard.

---

## 🏗️ Architecture Overview

The system consists of four isolated components:

1. **Rocket.Chat Platform (`rocketchat`)**: Self-hosted chat container backed by a MongoDB replica set (`rs0`). Stores chat messages, rooms, and channels.
2. **Rocket.Chat Attendance App (`rc-app`)**: Sandboxed TypeScript UIKit app installed into Rocket.Chat via Apps-Engine. Provides toolbar buttons and modal views for clock-in/out and break tracking.
3. **Backend API (`backend`)**: Node.js/TypeScript Express REST API. The single source of truth for business logic, sole writer to Postgres, and sole caller of RC Admin REST API.
4. **HR Dashboard (`hr-dashboard`)**: Next.js web application for HR administrators to manage employees, view attendance logs, inspect break audits, and reset passwords.

---

## 🛠️ Quick Links

- [Local Setup Guide](file:///c:/Users/Administrator/Desktop/jd_connect/local_setup.md) — Step-by-step developer setup instructions.
- [Project Data Context](file:///c:/Users/Administrator/Desktop/jd_connect/CONTEXT/project_data.md) — Technical metadata, permission keys, and constants.
- [Database Schema Context](file:///c:/Users/Administrator/Desktop/jd_connect/CONTEXT/database_schema.md) — Authoritative Postgres & MongoDB schemas.
- [Decision Log Context](file:///c:/Users/Administrator/Desktop/jd_connect/CONTEXT/decision_log.md) — Architectural decisions record.

---

## ⚡ Quality Commands

```bash
# Install dependencies
pnpm install

# Run ESLint check
pnpm lint

# Run TypeScript compilation check
pnpm typecheck

# Run test suites
pnpm test

# Run full CI quality check (lint + typecheck + test)
pnpm ci:quality
```
