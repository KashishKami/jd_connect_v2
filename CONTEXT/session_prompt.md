# Session Prompt: JD Connect

Use this prompt at the start of every new development session to orient the AI assistant before writing any code.

---

## Prompt

I am building **JD Connect** — a new internal platform for a BPO/call-centre operation, built around Rocket.Chat as the primary communication layer. The system handles employee management, clock-in/clock-out attendance tracking, break logging with reason selection, and HR administration.

All planning and architecture decisions are complete. Before you do anything, read these files in this exact order:

1. **CONTEXT/project_data.md**
   → Project metadata, four-component architecture overview, auth model (custom JWT, no Supabase), roles, permission keys, employee field definitions, break types, and the 10 key architectural constraints.

2. **CONTEXT/database_schema.md**
   → Authoritative Postgres schema (all tables, ENUMs, indexes, seed data plan, business logic constants) and MongoDB schema reference (Rocket.Chat-owned collections — read only, never written by Backend API).

3. **CONTEXT/decision_log.md**
   → All architectural decisions already made (Supabase dropped, custom JWT auth, MongoDB isolation, `rocketchat_user_id` as cross-system key, attendance decoupled from RC presence, three-layer architecture, etc.). Read these before proposing any design change — if your proposal contradicts a logged decision, flag it and ask.

4. **CONTEXT/current_state.md**
   → The phase-by-phase implementation tracker. This is your source of truth for what is done and what is next. Always check this FIRST before writing any code. Begin at the first phase that has unchecked `[ ]` items.

5. **CONTEXT/TDD_INSTRUCTION_GUIDE.md**
   → The checklist format that ALL implementation work must follow. Every work item must follow the RED → GREEN → Verification chain structure defined here.

After reading all five files:
- Confirm you understand the four-component architecture (Postgres + Backend API + Rocket.Chat/MongoDB + HR Dashboard).
- Confirm you understand the two-database model: Postgres owns HR/attendance/auth data; MongoDB owns only RC chat data; they never talk directly.
- Confirm you understand the cross-system key: `employees.rocketchat_user_id` = MongoDB `users._id`. This is the only bridge.
- Confirm you understand that attendance state is NEVER derived from Rocket.Chat presence — they are decoupled.
- Check `CONTEXT/current_state.md` to identify the first phase with unchecked items.
- Begin executing that phase's checklist exactly as described, following the TDD format from `CONTEXT/TDD_INSTRUCTION_GUIDE.md`.
- As you complete checklist items, update `CONTEXT/current_state.md` to mark them `[x]` done and `[/]` in-progress.
- Do not skip ahead to a later phase until all items in the current phase are checked off.

**Key constraints to always keep in mind:**
- There is no Supabase — plain Postgres container only.
- There is no self-service password reset email — HR resets passwords via `POST /api/employees/:id/reset-password`.
- Auth is entirely custom JWT (RS256 asymmetric). No third-party auth platform.
- The Backend API is the ONLY service that writes to Postgres and the ONLY service that calls RC Admin REST API.
- `rocketchat_user_id` is immutable — never use email as a join key between the two systems.
- Attendance clock-in/out happens via the RC App button action → Backend API → Postgres. Never infer attendance from RC online/away/offline status.
- Employee creation ALWAYS provisions both Postgres AND Rocket.Chat. A failed RC provisioning sets `rc_provisioned = false` and surfaces the error — it does not silently fail.
- All timestamps are in EST (UTC−5, `America/New_York`). The server, database, and all business logic operate in EST.
