# TDD Instruction Guide
## How to Write Checklists That Produce Rock-Solid, Fully Wired Features

> **Who is this for?** Anyone — developer, product owner, or AI assistant — working on JD Connect. If you hand this guide to a complete beginner, they should be able to write a proper implementation checklist by the end of it.

> **Why does this exist?** Many teams discover "phantom features" — things that have green (passing) tests but are completely broken in the real, running application. The root cause is always poorly written checklists that allow lazy mocking and skipped integration. This guide makes that impossible.

---

## Part 1: The 5 Principles of a Great Checklist

### Principle 1: Always Start with "Root Cause" and End with "Verification Chain"

Every checklist must be **bookended** by these two things.

**Root Cause** answers: *Why does this problem exist, or why does this feature need to be built?*
It stops the developer (or AI) from guessing what to fix or build. Without it, they might fix the wrong thing, and the tests might still pass.

**Verification Chain** answers: *What does success look like from the user's perspective, end to end?*
It is not "tests pass." It is a human-readable sequence of events: *User does X → System does Y → User sees Z.*
If the feature doesn't achieve this exact chain, it is not done — no matter what the tests say.

> **Bad:** "Fix the attendance bug."
>
> **Good:**
> **Root cause:** `POST /api/attendance/clock-in` does not validate that the employee already has an open session for today, so an employee can clock in twice without clocking out, resulting in corrupted attendance records.
> **Verification chain:** Employee clicks "Clock In" button in Rocket.Chat → Backend API creates `attendance_records` row in Postgres → Employee clicks "Clock In" again → System returns error "Already clocked in" → Employee sees error toast in Rocket.Chat UIKit → Only one open attendance record exists in DB for today → ✅ Done.

---

### Principle 2: Demand a Confirmed RED State Before Any Code

This is the most important principle and the one most commonly skipped.

**The rule:** A test must be written first, run, and confirmed to be **failing (RED)** before any implementation code is written.

**Why?** If a test passes immediately after you write it (before writing the feature), it means the test is not actually testing reality. It is probably mocked incorrectly, or it is testing something that already works. A test that can't fail is worthless.

**How to write it:** Every test instruction must end with: *"Run — confirm RED."*

> **Bad:** "Write a test for clock-in and then implement it."
>
> **Good:**
> - [ ] **RED — Integration (`tests/attendance.test.ts`):**
>   - [ ] Test: POST `/api/attendance/clock-in` with valid Bearer JWT → assert HTTP 201, DB row in `attendance_records` with `clock_in_at` set, `clock_out_at` null.
>   - [ ] **Run — confirm RED (endpoint doesn't exist yet).**

The phrase "Run — confirm RED" is not optional decoration. It is a gate. You do not proceed to GREEN until you have seen the test fail.

---

### Principle 3: Always Require Both a Unit Test AND an Integration Test

**Unit tests** prove that a single function or module works correctly in isolation.
**Integration tests** prove that the full system path — from HTTP request, through the router, through the service, into the database, and back — works correctly.

You need **both**. A unit test alone is never sufficient for a feature that spans the backend and frontend.

| Test Type | What It Proves | Is It Enough Alone? |
|---|---|---|
| Unit (service) test | `computeBreakDuration()` returns the correct minutes | NO. The API might not call this function correctly. |
| Integration test | `POST /api/breaks/end` updates `break_records.end_at` in Postgres | NO. The RC app might not send the right payload. |
| **Both together** | The full path: RC button → Backend API → service → DB → RC UI response | YES. |

---

### Principle 4: Separate the Tiers Explicitly (DB → Backend → RC App / Dashboard)

A checklist that says "add clock-in feature" is useless. A good checklist breaks the work into the architectural layers it touches.

The standard tiers in JD Connect are:

1. **Schema / Migration:** Any change to the Postgres schema requires a numbered SQL migration file. Specify the migration filename explicitly (e.g., `migrations/003_add_break_records.sql`).
2. **Repository (`src/repositories/`):** Does the query need to return a new field? Join a new table? Accept a new filter parameter?
3. **Service (`src/services/`):** What business logic changes? What is the calculation or rule? Are the inputs typed correctly?
4. **Controller / Route (`src/routes/`):** Is the new field being validated (Zod)? Serialized into the response? Is the JWT auth guard in place?
5. **Types (`src/types/`):** Does the TypeScript type that mirrors the API response need a new field?
6. **RC App (`rc-app/`):** What UIKit block changes? Which action handler? Which modal view?
7. **HR / Admin Dashboard:** What page or component changes in the web dashboard?

By listing each tier, you make it impossible to skip a step.

---

### Principle 5: The "No Fake Pass" Rule

A checklist item is only checked off `[x]` when:
1. The test was seen failing (RED).
2. The implementation was written.
3. The test is now passing (GREEN).
4. The **verification chain** was manually validated in Rocket.Chat or the HR dashboard.

**Signs of a Fake Pass:**
- The test passes without any implementation code written.
- The test asserts something trivially true (e.g., `expect(response).toBeDefined()`).
- The test mocks the exact return value it's asserting.
- The test uses `as any` to bypass TypeScript and tests a wrong shape.

---

## Part 2: The Standard Checklist Template

Use this template for every Work Item (`W-XXX`) in `current_state.md`:

```markdown
### Phase N — [Phase Name]

#### W-N01 — [Short Feature Name]

**Root cause:**
[One or two sentences explaining WHY this work is needed.]

**Goal:**
[What the system will be able to do after this work is done.]

**Approach:**
[High-level implementation strategy. Which layers are touched. What the key algorithm or logic is.]

---

- [ ] **RED — Integration (`tests/[feature].test.ts`):**
  - [ ] Test: [Exact description — what endpoint, what input, what expected output.]
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] [If schema change: describe the SQL migration. Specify migration filename.]
  - [ ] [Repository] [Describe the query change in `src/repositories/[name].ts`.]
  - [ ] [Service] [Describe the business logic in `src/services/[name].ts`.]
  - [ ] [Controller] [Describe the route in `src/routes/[name].ts`. Include Zod validation and JWT guard.]
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit (`tests/[name].unit.test.ts`):**
  - [ ] Test: [Exact description — what function, what input, what expected output.]
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — RC App / Dashboard:**
  - [ ] [Type] Update `src/types/[name].ts`.
  - [ ] [RC App / Dashboard] Describe the exact UIKit or component change.
  - [ ] Run unit test — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] [Step 1: User action in RC or dashboard.]
  - [ ] [Step 2: Expected system behavior — API call, DB write.]
  - [ ] [Step 3: Expected UI outcome in RC or dashboard.]
  - [ ] ✅ Done.
```

---

## Part 3: JD Connect-Specific Rules

### Rule 1: Always Include the JWT Auth Guard

Every Backend API route must validate the JWT token before doing anything else.

```markdown
- [ ] [Controller] Apply JWT auth middleware: verify Bearer token in `Authorization` header
      using `src/middleware/auth.ts`. Attach `req.employee` (id, role, rc_user_id).
      Return HTTP 401 if token is missing or invalid. Return HTTP 403 if role is insufficient.
```

### Rule 2: Attendance and Break Events Must Never Touch RC Presence

Any work item involving attendance or breaks MUST include this note:

```markdown
- [ ] [Service] Clock-in, clock-out, and break events write ONLY to Postgres.
      NEVER read or write Rocket.Chat's native online/away/offline presence status.
      These are two completely separate systems that must never be coupled.
```

### Rule 3: Always Resolve Employee via rc_user_id, Never Trust Client-Supplied IDs

Any work item where the RC app sends a request to the Backend API must include:

```markdown
- [ ] [Service] Resolve the authenticated employee by calling
      `employeeRepository.findByRocketChatId(req.employee.rc_user_id)` from
      the JWT payload. Never accept a raw `employee_id` from the request body
      as the acting employee — always derive it from the verified JWT.
```

### Rule 4: New Employee Creation Always Provisions Both Systems

Any work item touching employee creation must include this note:

```markdown
- [ ] [Service] Employee creation flow:
      1. INSERT into Postgres `employees` table → get the new `id`.
      2. Call Rocket.Chat Admin REST API `POST /api/v1/users.create`.
      3. Store the returned `_id` as `employees.rocketchat_user_id` in Postgres.
      4. If RC provisioning fails: do NOT silently swallow — mark `rc_provisioned = false`,
         surface the error to HR dashboard so it can be retried.
```

### Rule 5: Break Duration is Always Computed on Break End

Any work item that ends a break must recompute and store the duration:

```markdown
- [ ] [Service] On break end: compute `duration_minutes = (end_at - start_at) in minutes`.
      Set `status = 'exceeded'` if `duration_minutes > break_type.default_limit_minutes`,
      else `status = 'completed'`. Never store a completed break with null `duration_minutes`.
```

### Rule 6: Admin Password Reset is HR-Only, No Self-Service Email Flow

```markdown
- [ ] [Controller] `POST /api/employees/:id/reset-password` is only accessible
      to users with the `hr:reset_password` permission. There is NO self-service
      email reset flow. The endpoint accepts `{ new_password }`, bcrypt-hashes it,
      and updates `users.password_hash` in Postgres. Return HTTP 403 if the caller
      lacks the required permission.
```

---

## Part 4: Common Mistakes to Avoid

### Mistake 1: Testing Only the Happy Path
Always add at least one failure case per feature.

| Feature | Happy Path | Required Failure Tests |
|---|---|---|
| Clock in | Valid JWT + not clocked in → 201 | Already clocked in → 409 |
| Start break | Clocked in + no active break → 201 | Not clocked in → 400 |
| Create employee | Valid payload → 201 + RC provisioned | Duplicate email → 409 |
| Admin password reset | Valid permission → 200 | Missing `hr:reset_password` → 403 |
| Clock out | Open session exists → 200 | No open session → 400 |

### Mistake 2: Mocking Postgres in Integration Tests
Integration tests use a **real test Postgres database** running in the Docker container. Never mock the database driver in an integration test. Mocking is only acceptable in unit tests of the Service Layer (mock the repository, keep the service logic real).

### Mistake 3: Forgetting to Update `current_state.md`
After completing each checklist item, immediately mark it `[x]`. In-progress items are `[/]`. Never let the tracker fall more than one work item behind.

### Mistake 4: Skipping the Type Update
When the Backend API response gains a new field, update the corresponding TypeScript type in `src/types/` in the same work item. Do not defer — it causes cascading TypeScript errors in the RC app and dashboard.

### Mistake 5: Coupling Rocket.Chat Presence to Attendance State
An employee going on break does NOT set them to "away" in Rocket.Chat. Closing a laptop does NOT clock them out. These systems are completely independent and must stay that way.

### Mistake 6: Mocking RC Admin API Responses with the Wrong Shape
Rocket.Chat API responses are wrapped (e.g., `{ success: true, user: { _id, ... } }`). If your test mocks the inner shape without the wrapper, the test passes but the provisioning code fails in production. Always verify your mock matches the real Rocket.Chat API response shape.

---

## Part 5: Example — A Complete, Correctly Written Work Item

```markdown
#### W-202 — Employee Clock-In Endpoint

**Root cause:**
The attendance app button in Rocket.Chat has no Backend API endpoint to send
clock-in events to. Without this endpoint, all attendance tracking is manual
and there is no audit trail of when employees actually start their shifts.

**Goal:**
1. Backend API accepts a clock-in request from the RC attendance app button.
2. Creates an `attendance_records` row in Postgres with `clock_in_at = now()`.
3. Returns HTTP 409 if the employee already has an open record for today.

**Approach:**
JWT-protected POST endpoint. Service resolves the employee from the `rc_user_id`
in the JWT, checks for an existing open record (no `clock_out_at`), inserts a new
record if clear. RC app displays a success or error notification based on the response.

---

- [ ] **RED — Integration (`tests/attendance.test.ts`):**
  - [ ] Seed: create test employee with `rocketchat_user_id = 'RC_test_001'`, issue JWT.
  - [ ] Test: POST `/api/attendance/clock-in` with valid Bearer JWT →
        assert HTTP 201, body `{ record_id, clock_in_at, employee_id }`,
        one row in `attendance_records` with `clock_out_at = null` for today.
  - [ ] Test: POST `/api/attendance/clock-in` again with same JWT →
        assert HTTP 409, body `{ error: "Already clocked in for today" }`,
        still only one row in DB.
  - [ ] Test: POST `/api/attendance/clock-in` with no/invalid token →
        assert HTTP 401.
  - [ ] **Run — confirm RED (endpoint doesn't exist yet).**

- [ ] **GREEN — Backend:**
  - [ ] [Schema] No migration needed — `attendance_records` exists per `database_schema.md`.
  - [ ] [Repository] In `src/repositories/attendance.repository.ts`:
        - `findOpenRecord(employee_id)`: SELECT WHERE `clock_out_at IS NULL AND work_date = CURRENT_DATE`.
        - `createClockIn(employee_id)`: INSERT with `clock_in_at = NOW()`, `work_date = CURRENT_DATE`.
  - [ ] [Service] `src/services/attendance.service.ts#clockIn(rc_user_id)`:
        - Resolve employee: `employeeRepository.findByRocketChatId(rc_user_id)`.
        - Check open record: if exists → throw `AlreadyClockedInError`.
        - Else: call `attendanceRepository.createClockIn(employee.id)`.
  - [ ] [Controller] `src/routes/attendance.ts` POST `/clock-in`:
        - Apply JWT middleware → attach `req.employee`.
        - Call `attendanceService.clockIn(req.employee.rc_user_id)`.
        - Catch `AlreadyClockedInError` → HTTP 409.
        - Success → HTTP 201 with record serialized.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **RED — Unit (`tests/attendance.service.unit.test.ts`):**
  - [ ] Mock `employeeRepository.findByRocketChatId` → return test employee.
        Mock `attendanceRepository.findOpenRecord` → return null.
        Mock `attendanceRepository.createClockIn` → return fake record.
        Call `attendanceService.clockIn('RC_test_001')` → assert returns fake record,
        `createClockIn` called with correct `employee_id`.
  - [ ] Mock `attendanceRepository.findOpenRecord` → return existing open record.
        Assert `attendanceService.clockIn` throws `AlreadyClockedInError`,
        `createClockIn` NOT called.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — RC App:**
  - [ ] [Type] Add `AttendanceRecord` to `rc-app/src/types/attendance.ts`:
        `{ record_id: string, clock_in_at: string, employee_id: string }`.
  - [ ] [RC App] In `rc-app/src/handlers/clockInAction.ts`:
        POST `{BACKEND_URL}/api/attendance/clock-in` with `Authorization: Bearer {jwt}`.
        On 201 → RC UIKit notification: "You're clocked in ✅".
        On 409 → RC UIKit error: "You're already clocked in today."
        Other errors → generic RC error notification.
  - [ ] Run unit test — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Log into Rocket.Chat as test employee.
  - [ ] Click attendance toolbar button → select "Clock In".
  - [ ] Observe: success notification "You're clocked in ✅" appears.
  - [ ] Open HR dashboard → employee shows as "Logged In" with correct timestamp.
  - [ ] Click "Clock In" again → observe error "You're already clocked in today."
  - [ ] Check DB → exactly one `attendance_records` row today, `clock_out_at = null`.
  - [ ] ✅ Done.
```

---

## Summary: The Checklist Quality Checklist

Before submitting any work item checklist for review, verify:

- [ ] Root cause is written (explains WHY, not just WHAT).
- [ ] At least one RED integration test is specified (exact endpoint, input, expected output).
- [ ] Each backend tier listed separately (Schema / Repo / Service / Controller).
- [ ] JWT auth guard explicitly included in the Controller tier.
- [ ] At least one RED unit test is specified.
- [ ] Type update included if the API response shape changes.
- [ ] Verification chain describes the full user flow in RC or the dashboard.
- [ ] At least one failure/edge case test is specified.
- [ ] For any attendance/break event: decoupling from RC presence noted.
- [ ] For any employee creation: dual-system provisioning (Postgres + RC) included.
- [ ] For any break end: duration computation included.
- [ ] For any cross-system identity lookup: rc_user_id → employee_id resolution included.
