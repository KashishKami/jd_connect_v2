# Phase 11 — IST Date Anchor, Duration-Only Attendance, Break Fix & Zulip OIDC SSO

> **Decision reference:** Decision 15 in `CONTEXT/decision_log.md`
>
> **Why this phase exists:** The attendance system was built assuming a single US-timezone-anchored
> shift (9 AM EST). The company now operates multi-shift: Indian day-shift and night-shift employees.
> The EST work-date anchor causes wrong `work_date` for day-shift employees who arrive before 10:30 AM
> IST (still "yesterday" in EST). The hardcoded `09:00:00 EST` shift-start auto-marks all employees
> as `half_day` unless they clock in at exactly 9 AM EST. The `findOpenRecord(id, todayDate)` pattern
> in `clockOut`, `getStatus`, and `startBreak` causes false midnight-boundary errors for night-shift
> employees. Password changes in the portal do not propagate to Zulip — permanently eliminated by
> completing OIDC SSO (Zulip defers auth to JD Connect Postgres).

---

## Summary of All Changes

| Work Item | Area | What Changes |
|---|---|---|
| W-1101 | Backend — Service | Replace `getESTWorkDate()` with `getISTWorkDate()` in `clockIn()` |
| W-1102 | Backend — Service | Replace `findOpenRecord(id, date)` with `findAnyOpenRecord(id)` in `clockOut`, `getStatus`, `startBreak` |
| W-1103 | Backend — Service | Duration-only `computeAttendanceStatus` — remove hardcoded 9 AM EST shift-start |
| W-1104 | Backend — Repository | Update `getTodaySummary` + `getLiveMonitorSummary` SQL to IST date anchor |
| W-1105 | Backend — Service | Add `timezone: Asia/Kolkata` to Zulip user provisioning |
| W-1106 | Backend — Routes/Services | Complete OIDC provider endpoints (userinfo, jwks, discovery, id_token) |
| W-1107 | Zulip — Config | Configure Zulip realm for OIDC SSO; disable native password login |
| W-1108 | Portal — Frontend | Update date column labels from EST to IST |
| W-1109 | All | Full regression + new test suite pass |

---

## Architectural Constraints (Must Not Be Violated)

- Attendance writes ONLY to Postgres. Never read/write Zulip presence.
- `zulip_user_id` (INTEGER) resolved from JWT — never from request body.
- Backend API is the ONLY process calling Zulip Admin REST API.
- JD Connect Postgres and Zulip Postgres are completely isolated — no cross-DB queries ever.
- Employee creation provisions both Postgres AND Zulip atomically (Decision 9 stands).

---

## Pre-flight Checklist (Before Writing Any Code)

- [ ] `docker compose ps` — postgres, zulip, jdconnect_api all healthy.
- [ ] `pnpm --filter @jdconnect/backend test -- --passWithNoTests` passes.
- [ ] `pnpm lint` — 0 errors on current branch.
- [ ] `pnpm typecheck` — 0 errors on current branch.
- [ ] `pnpm --filter @jdconnect/portal test` — GREEN (34/34 tests).
- [ ] Git commit all unstaged W-1013 IST display changes before starting W-1101.

---

## Phase 11 Work Items

---

### W-1101 — Replace EST Work-Date Anchor with IST

**Root cause:**
`getESTWorkDate()` uses `America/New_York`. Indian day-shift employees arriving before 10:30 AM IST
(= midnight EST) get `work_date = yesterday` in EST — their records land on the wrong day, making
today's attendance audit blank until 10:30 AM IST.

**Goal:**
`clockIn()` uses `getISTWorkDate()` so `work_date = today in IST` for all employees.
Employee at 9:00 AM IST Sep 17 → `work_date = 2026-09-17`. Employee at 11:00 PM IST Sep 17 →
`work_date = 2026-09-17`.

**Approach:**
Add `export function getISTWorkDate(date = new Date()): string` in `attendance.service.ts` using
`Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'`. Replace `getESTWorkDate()` in `clockIn()`
only. Keep `getESTWorkDate()` exported with `@deprecated` JSDoc — still used in break.service.ts
(fixed in W-1102) and attendance.repository.ts (fixed in W-1104).

**Files touched:**
- `backend/src/services/attendance.service.ts`
- `backend/tests/attendance_ist.unit.test.ts` — NEW

---

- [ ] **RED — Unit (`backend/tests/attendance_ist.unit.test.ts`):**
  - [ ] Test: `getISTWorkDate(new Date('2026-09-17T03:30:00Z'))` → `'2026-09-17'`
        (03:30 UTC = 09:00 IST — same IST calendar day).
  - [ ] Test: `getISTWorkDate(new Date('2026-09-16T18:00:00Z'))` → `'2026-09-16'`
        (18:00 UTC = 23:30 IST — still Sep 16 IST).
  - [ ] Test: `getISTWorkDate(new Date('2026-09-16T18:31:00Z'))` → `'2026-09-17'`
        (18:31 UTC = 00:01 IST next day — Sep 17 IST).
  - [ ] Test: `getESTWorkDate(new Date('2026-09-17T03:30:00Z'))` → `'2026-09-16'`
        (03:30 UTC = 22:30 EST previous day — confirm old function is NOT changed).
  - [ ] **Run — confirm RED (`getISTWorkDate` is not defined yet).**

- [ ] **GREEN — Backend Service:**
  - [ ] [Service] `backend/src/services/attendance.service.ts`:
        Add `export function getISTWorkDate(date = new Date()): string` immediately after
        `getESTWorkDate`. Use `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` — same
        pattern as `getESTWorkDate` but with `'Asia/Kolkata'` instead of `'America/New_York'`.
  - [ ] [Service] In `AttendanceService.clockIn()`: replace `getESTWorkDate()` with `getISTWorkDate()`.
  - [ ] [Service] Add JSDoc on `getESTWorkDate`:
        `/** @deprecated Work dates now anchored to IST. Use getISTWorkDate() for new clock-in logic. Retained for backward-compat date-range filtering only. */`
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Day shift clocks in at 9:00 AM IST → `work_date = today IST` in Postgres. ✅
  - [ ] Night shift clocks in at 11:00 PM IST → `work_date = today IST`. ✅
  - [ ] Night shift clocks in at 12:30 AM IST → `work_date = next IST date` (correct). ✅
  - [ ] Attendance Audit "Today" button shows today's IST records correctly. ✅
  - [ ] ✅ Done.

---

### W-1102 — Replace Date-Scoped `findOpenRecord` with `findAnyOpenRecord`

**Root cause:**
`clockOut()`, `getStatus()`, and `startBreak()` call `findOpenRecord(employeeId, todayDate)`
which filters `WHERE work_date = todayDate`. Night-shift employees crossing IST midnight have
`work_date = yesterday` on their open record — `todayDate` is now "today" — the query returns
null and throws `NoOpenClockInError` / `NotClockedInError` falsely.

`findAnyOpenRecord(employeeId)` already exists in `attendance.repository.ts` (lines 24-34):
```sql
SELECT * FROM attendance_records
WHERE employee_id = $1 AND clock_out_at IS NULL
ORDER BY clock_in_at DESC LIMIT 1
```
This is the correct date-agnostic replacement. **No repository changes needed.**

`findOpenRecord(id, date)` is **kept and still used ONLY in `clockIn()`** to prevent double
clock-ins on the same IST work date.

**Files touched:**
- `backend/src/services/attendance.service.ts` — `clockOut()`, `getStatus()`
- `backend/src/services/break.service.ts` — `startBreak()`
- `backend/tests/attendance_boundary.integration.test.ts` — NEW
- `backend/tests/break_boundary.unit.test.ts` — NEW

---

- [ ] **RED — Integration (`backend/tests/attendance_boundary.integration.test.ts`):**
  - [ ] Setup: run migrations + seed. Issue JWT for seeded employee.
  - [ ] **Scenario A — Night shift crossing midnight (clock-out):**
    - [ ] POST `/api/attendance/clock-in` → HTTP 201.
    - [ ] SQL on test DB: `UPDATE attendance_records SET work_date = CURRENT_DATE - 1 WHERE clock_out_at IS NULL AND employee_id = $1`.
    - [ ] POST `/api/attendance/clock-out` → assert HTTP 200.
    - [ ] Assert DB: `clock_out_at IS NOT NULL`, `hours_worked IS NOT NULL` on the record.
  - [ ] **Scenario B — Night shift crossing midnight (start break):**
    - [ ] POST `/api/attendance/clock-in` → HTTP 201.
    - [ ] SQL: `UPDATE attendance_records SET work_date = CURRENT_DATE - 1 WHERE clock_out_at IS NULL AND employee_id = $1`.
    - [ ] POST `/api/breaks/start` with valid `{ "break_type_key": "<seeded-key>" }` → HTTP 201.
    - [ ] Assert DB: new `break_records` row with `status = 'active'`, `end_at IS NULL`.
  - [ ] **Scenario C — Double clock-in prevention (regression):**
    - [ ] POST `/api/attendance/clock-in` → HTTP 201.
    - [ ] POST `/api/attendance/clock-in` again → HTTP 409 `"Already clocked in for today"`.
    - [ ] Assert DB: exactly one open `attendance_records` row for today.
  - [ ] **Run — confirm RED (Scenarios A+B currently throw errors).**

- [ ] **RED — Unit (`backend/tests/break_boundary.unit.test.ts`):**
  - [ ] Mock `employeeRepository.findByZulipUserId` → return `{ id: 'emp-uuid', ...employee }`.
  - [ ] Mock `attendanceRepository.findAnyOpenRecord` → return open record with `work_date = 'yesterday'`.
  - [ ] Mock `breakRepository.findActiveBreak` → null.
  - [ ] Mock `breakRepository.findBreakTypeByKey` → valid break type.
  - [ ] Mock `breakRepository.getEffectiveLimit` → 10.
  - [ ] Mock `breakRepository.createBreak` → fake break record.
  - [ ] Call `breakService.startBreak(1, 'bathroom')` → assert resolves without error.
  - [ ] Assert `attendanceRepository.findAnyOpenRecord` was called with `'emp-uuid'`.
  - [ ] Assert `attendanceRepository.findOpenRecord` was NOT called.
  - [ ] Mock `attendanceRepository.findAnyOpenRecord` → null.
  - [ ] Call `breakService.startBreak(1, 'bathroom')` → assert throws `NotClockedInError`.
  - [ ] **Run — confirm RED (`startBreak` still calls `findOpenRecord`).**

- [ ] **GREEN — Backend Services:**
  - [ ] [Service] `backend/src/services/attendance.service.ts` — `getStatus(employeeId)`:
        Replace `const todayEST = getESTWorkDate(); this.attRepo.findOpenRecord(employee.id, todayEST)`
        with `this.attRepo.findAnyOpenRecord(employeeId)`.
        Remove the date computation — no date needed in `getStatus`.
        _(Verify `getStatus` signature: if it takes `employeeId: string` directly, the employee
        repo lookup inside may be removable. If it takes `zulipUserId: number`, the lookup stays.)_
  - [ ] [Service] `backend/src/services/attendance.service.ts` — `clockOut(zulipUserId)`:
        Replace `const todayIST = getISTWorkDate(); findOpenRecord(employee.id, todayIST)`
        with `findAnyOpenRecord(employee.id)`.
        Remove `todayIST` variable entirely from `clockOut`.
        `work_date` for status computation is now read from `openRecord.work_date` — already stored.
  - [ ] [Service] `backend/src/services/break.service.ts` — `startBreak(zulipUserId, breakTypeKey)`:
        Remove `const todayEST = getESTWorkDate();`.
        Replace `this.attRepo.findOpenRecord(employee.id, todayEST)` with
        `this.attRepo.findAnyOpenRecord(employee.id)`.
        Remove `import { getESTWorkDate }` from `break.service.ts` if no longer used.
  - [ ] Run integration tests — **confirm GREEN.**
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Night shift clocks in 9 PM IST, clock-out at 12:30 AM IST → HTTP 200, record closed. ✅
  - [ ] Night shift starts break at 12:10 AM IST → HTTP 201. ✅
  - [ ] Day shift cannot clock in twice on same IST day → HTTP 409. ✅
  - [ ] `GET /api/attendance/status` at 12:30 AM IST returns `clocked_in` (not `off_shift`). ✅
  - [ ] ✅ Done.

---

### W-1103 — Duration-Only Attendance Status: Remove Hardcoded Shift-Start

**Root cause:**
`computeAttendanceStatus()` has `shiftStart = new Date(\`${todayEST}T09:00:00-05:00\`)`.
Employees not clocking in at exactly 9 AM EST are auto-flagged. With 24-hour multi-shift
operations this is meaningless — night-shift employees working full 9-hour shifts are marked
`half_day`, and day-shift employees at 9 AM IST appear 10.5 hours "late" in EST terms.

**Goal:**
`computeAttendanceStatus(hoursWorked: number): { status: AttendanceStatus }` uses only hours:
- `hours_worked >= 9` → `present`
- `hours_worked < 9` → `half_day`
`is_late` removed from auto-computation. HR overrides via `attendance_corrections`.
`LATE_CUTOFF_MINUTES` and `PRESENT_BUFFER_MINUTES` constants removed.
`MIN_HOURS_FOR_FULL_DAY` renamed `FULL_DAY_MIN_HOURS` set to `9`.

**Files touched:**
- `backend/src/services/attendance.service.ts`
- `backend/tests/attendance_status.unit.test.ts` — NEW or MODIFY

---

- [ ] **RED — Unit (`backend/tests/attendance_status.unit.test.ts`):**
  - [ ] `computeAttendanceStatus(9.0)` → `{ status: 'present' }`.
  - [ ] `computeAttendanceStatus(9.5)` → `{ status: 'present' }`.
  - [ ] `computeAttendanceStatus(8.99)` → `{ status: 'half_day' }`.
  - [ ] `computeAttendanceStatus(0)` → `{ status: 'half_day' }`.
  - [ ] `computeAttendanceStatus(4.5)` → `{ status: 'half_day' }`.
  - [ ] `!('isLate' in computeAttendanceStatus(9))` → true (old `isLate` field gone).
  - [ ] **Run — confirm RED (old function has 3 params, not 1).**

- [ ] **GREEN — Backend Service:**
  - [ ] [Service] `backend/src/services/attendance.service.ts`:
        - Remove `PRESENT_BUFFER_MINUTES: 15` and `LATE_CUTOFF_MINUTES: 30`.
        - Rename `MIN_HOURS_FOR_FULL_DAY: 6` → `FULL_DAY_MIN_HOURS: 9`.
        - Rewrite `computeAttendanceStatus`:
          ```ts
          export function computeAttendanceStatus(
            hoursWorked: number
          ): { status: AttendanceStatus } {
            if (hoursWorked >= ATTENDANCE_THRESHOLDS.FULL_DAY_MIN_HOURS) {
              return { status: 'present' };
            }
            return { status: 'half_day' };
          }
          ```
        - In `clockOut()`: remove `shiftStart` line.
          Change call from `computeAttendanceStatus(clockInAt, shiftStart, hoursWorked)`
          to `computeAttendanceStatus(hoursWorked)`.
          Pass `false` as `isLate` to `attRepo.updateClockOut(...)`.
          Add comment: `// is_late always false from auto; HR overrides via corrections`.
  - [ ] Run unit tests — **confirm GREEN.**
  - [ ] `pnpm typecheck` — confirm zero TypeScript errors (3-arg call site is gone).

- [ ] **Verification chain:**
  - [ ] 9 hours worked → `present`. ✅
  - [ ] 5 hours worked → `half_day`. ✅
  - [ ] Night shift 9 hours crossing midnight → `present`. ✅
  - [ ] No employee auto-marked late. ✅
  - [ ] ✅ Done.

---

### W-1104 — Update Dashboard Summary Queries to IST Date Anchor

**Root cause:**
`getTodaySummary()` and `getLiveMonitorSummary()` in `attendance.repository.ts` use
`NOW() AT TIME ZONE 'America/New_York'` in SQL. After W-1101, `work_date` is stored in IST.
Between midnight IST and 10:30 AM IST, the SQL computes yesterday's EST date while all
`work_date` values are already today (IST) — dashboard metrics show zero until 10:30 AM IST.

**Goal:**
Both methods use `NOW() AT TIME ZONE 'Asia/Kolkata'` for "today" computation. Dashboard
metrics are accurate for all shifts at all IST times.

**Files touched:**
- `backend/src/repositories/attendance.repository.ts`
- `backend/src/services/attendance.service.ts` — `getLiveMonitorSummary` call site
- `backend/tests/attendance_summary.test.ts` — MODIFY

---

- [ ] **RED — Integration (`backend/tests/attendance_summary.test.ts`):**
  - [ ] After seed, INSERT `attendance_records` with `work_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`.
  - [ ] GET `/api/attendance/summary/today` → assert `present >= 1`.
  - [ ] (Optional: also assert that a row with EST date anchor would NOT be counted when
        IST and EST calendar dates differ — annotate as time-dependent.)
  - [ ] **Run — confirm RED if IST and EST calendar dates currently differ.**

- [ ] **GREEN — Backend Repository & Service:**
  - [ ] [Repository] `backend/src/repositories/attendance.repository.ts` — `getTodaySummary()`:
        Replace ALL occurrences of `'America/New_York'` in the SQL queries inside this method
        with `'Asia/Kolkata'`. Rename JS variable `todayEST` → `todayIST`.
  - [ ] [Service] `backend/src/services/attendance.service.ts` — `getLiveMonitorSummary()`:
        Replace `getESTWorkDate()` with `getISTWorkDate()`. Rename variable `todayEST` → `todayIST`.
  - [ ] [Repository] `getLiveMonitorSummary(todayIST)`: rename parameter `todayEST` → `todayIST`.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] At 9:30 AM IST, dashboard shows today's metrics immediately. ✅
  - [ ] Day shift employees clocked in at 9 AM IST appear in today's count. ✅
  - [ ] ✅ Done.

---

### W-1105 — Set Zulip Timezone to IST on Account Creation

**Root cause:**
`ZulipService.createUser()` calls `POST /api/v1/users` without a `timezone` parameter.
New Zulip accounts default to UTC. Message timestamps appear in UTC until the employee
manually sets Settings → Timezone → Asia/Kolkata. This step is invisible and causes confusion.

**Goal:**
`createUser()` sends `timezone: 'Asia/Kolkata'` in the Zulip API request body. New accounts
show IST timestamps from day one.

**Files touched:**
- `backend/src/services/zulip.service.ts`
- `backend/tests/zulip_provisioning.unit.test.ts` — NEW or MODIFY

---

- [ ] **RED — Unit (`backend/tests/zulip_provisioning.unit.test.ts`):**
  - [ ] Spy/intercept the HTTP request body in `zulipService.createUser(...)`.
  - [ ] Assert request body contains `timezone=Asia%2FKolkata` (URL-encoded form field).
  - [ ] **Run — confirm RED (`timezone` not in request body yet).**

- [ ] **GREEN — Backend Service:**
  - [ ] [Service] `backend/src/services/zulip.service.ts` — `createUser()`:
        Add `params.append('timezone', 'Asia/Kolkata')` alongside existing
        `email`, `full_name`, `password`, `role` params.
  - [ ] Run unit test — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Create new employee in portal → provisioned in Zulip.
  - [ ] Log into Zulip as that employee → timestamps show IST immediately. ✅
  - [ ] ✅ Done.

---

### W-1106 — Complete OIDC Provider Endpoints for Zulip SSO

**Root cause:**
`backend/src/routes/oauth.ts` has `/oauth/authorize` and `/oauth/token`. Zulip's OIDC
integration additionally requires:
1. `GET /.well-known/openid-configuration` — OIDC discovery document.
2. `GET /oauth/userinfo` — returns employee claims from a Bearer access token.
3. `GET /oauth/jwks` — RS256 public key as JWK Set for token verification.
4. `POST /oauth/token` must return an `id_token` (RS256 JWT) alongside `access_token`.

Without these, Zulip cannot complete OIDC flow and falls back to native password login.
With them, JD Connect becomes Zulip's sole identity provider. Password changes in the portal
work automatically — Zulip never stored the password.

**Approach:**
Read `oauth.ts` and `oauth.service.ts` fully before writing any code. Reuse `jose` library
(already in package.json) and existing `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` env vars.
Add `BACKEND_PUBLIC_URL` env var for the OIDC issuer.

**Files touched:**
- `backend/src/routes/oauth.ts`
- `backend/src/services/oauth.service.ts`
- `backend/src/app.ts`
- `backend/src/repositories/employee.repository.ts` (if `findByUserId` missing)
- `.env.example`
- `backend/tests/oidc.integration.test.ts` — NEW
- `backend/tests/oidc.service.unit.test.ts` — NEW

---

- [ ] **Read existing implementation first (no code yet):**
  - [ ] View `backend/src/routes/oauth.ts` — list all existing endpoints.
  - [ ] View `backend/src/services/oauth.service.ts` — note `exchangeCode()` return shape and
        whether `access_token` is a JWT or opaque token.
  - [ ] View `backend/src/app.ts` — note route mounting order.
  - [ ] View `backend/src/repositories/employee.repository.ts` — confirm whether
        `findByUserId(userId: string)` exists. If not, it must be added.

- [ ] **RED — Integration (`backend/tests/oidc.integration.test.ts`):**
  - [ ] **Test 1:** `GET /.well-known/openid-configuration` → HTTP 200 JSON with:
        `issuer`, `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`,
        `jwks_uri`, `response_types_supported: ['code']`,
        `subject_types_supported: ['public']`,
        `id_token_signing_alg_values_supported: ['RS256']`.
  - [ ] **Test 2:** `GET /oauth/jwks` → HTTP 200, body `{ keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', n, e }] }`.
  - [ ] **Test 3:** `GET /oauth/userinfo` with no Authorization → HTTP 401.
  - [ ] **Test 4:** `GET /oauth/userinfo` with invalid Bearer token → HTTP 401.
  - [ ] **Test 5:** Full OIDC flow — get code → `POST /oauth/token` → assert `access_token` AND
        `id_token` in response. Decode `id_token` payload (no signature check) → assert `sub`,
        `email`, `iss = BACKEND_PUBLIC_URL`, `aud = client_id`, `zulip_user_id` integer.
        Then `GET /oauth/userinfo` with `access_token` → HTTP 200 `{ sub, email, name, zulip_user_id }`.
  - [ ] **Run — confirm RED (discovery and jwks return 404, id_token missing).**

- [ ] **GREEN — Backend Routes & Services:**
  - [ ] [Repository] If `employeeRepository.findByUserId(userId: string)` does not exist:
        Add to `backend/src/repositories/employee.repository.ts`. Query joins `users` table
        via `users.employee_id → employees.id` (verify exact FK from DB schema).
  - [ ] [Service] `backend/src/services/oauth.service.ts`:
        - Add `async getJWKS(): Promise<{ keys: object[] }>`:
          Import public key from `JWT_PUBLIC_KEY` env var using `jose`.
          `const jwk = await exportJWK(publicKey)`.
          Return `{ keys: [{ ...jwk, use: 'sig', alg: 'RS256' }] }`.
        - Add `async getUserInfo(accessToken: string): Promise<OIDCUserInfo>`:
          `jwtVerify(accessToken, publicKey)` — extract `payload.sub`.
          `employeeRepository.findByUserId(payload.sub)` — look up employee.
          Return `{ sub: payload.sub, email, name: employee.alias || employee.full_name, zulip_user_id }`.
          Throw 401-class error if verification fails or employee not found.
        - Extend `exchangeCode()` — after `access_token`, also sign `id_token` RS256 JWT:
          Claims: `{ iss: BACKEND_PUBLIC_URL, sub: user.id, aud: clientId, email, name, zulip_user_id, iat, exp: iat+3600 }`.
          Return `{ access_token, id_token, token_type: 'Bearer', expires_in: 3600 }`.
  - [ ] [Routes] `backend/src/routes/oauth.ts`:
        - `GET /oauth/userinfo`: extract Bearer token → `oauthService.getUserInfo(token)` →
          401 on error, 200 with user info on success.
        - `GET /oauth/jwks`: `oauthService.getJWKS()` → 200 with JWK Set.
  - [ ] [App] `backend/src/app.ts`:
        Mount `GET /.well-known/openid-configuration` before all other routes, no auth middleware.
        Returns static JSON built from `BACKEND_PUBLIC_URL` env var:
        ```json
        {
          "issuer": "<BACKEND_PUBLIC_URL>",
          "authorization_endpoint": "<BACKEND_PUBLIC_URL>/oauth/authorize",
          "token_endpoint": "<BACKEND_PUBLIC_URL>/oauth/token",
          "userinfo_endpoint": "<BACKEND_PUBLIC_URL>/oauth/userinfo",
          "jwks_uri": "<BACKEND_PUBLIC_URL>/oauth/jwks",
          "response_types_supported": ["code"],
          "subject_types_supported": ["public"],
          "id_token_signing_alg_values_supported": ["RS256"],
          "scopes_supported": ["openid", "email", "profile"],
          "token_endpoint_auth_methods_supported": ["client_secret_post"],
          "claims_supported": ["sub", "email", "name", "zulip_user_id"]
        }
        ```
  - [ ] [Env] `.env.example`: add `BACKEND_PUBLIC_URL=https://api.yourcompany.com`.
  - [ ] Run integration tests — **confirm GREEN (all 5 OIDC tests pass).**

- [ ] **RED → GREEN — Unit (`backend/tests/oidc.service.unit.test.ts`):**
  - [ ] Generate test RS256 key pair in `beforeAll`.
  - [ ] Mock `employeeRepository.findByUserId` → `{ id: 'u', email: 'e@co.com', alias: 'Eve', full_name: 'Evelyn', zulip_user_id: 42 }`.
  - [ ] Sign test token with `sub = 'u'`. Call `getUserInfo(testToken)` → `{ sub: 'u', email, name: 'Eve', zulip_user_id: 42 }`. ✅
  - [ ] Call `getUserInfo('garbage')` → throws 401-class error. ✅
  - [ ] Call `getJWKS()` → `{ keys: [{ kty: 'RSA', alg: 'RS256', use: 'sig' }] }`. ✅
  - [ ] **Run — confirm RED → GREEN.**

- [ ] **Verification chain:**
  - [ ] `curl https://api.yourcompany.com/.well-known/openid-configuration` → valid JSON. ✅
  - [ ] `curl https://api.yourcompany.com/oauth/jwks` → RSA JWK Set. ✅
  - [ ] Full OIDC code flow executes end-to-end. ✅
  - [ ] ✅ Done.

---

### W-1107 — Configure Zulip Realm for OIDC SSO

**Root cause:**
Zulip uses native email/password login by default even with working OIDC endpoints available.
The realm must be configured to use JD Connect OIDC and native password login must be disabled.

**Goal:**
1. Zulip login page shows only "Log in with JD Connect".
2. Clicking redirects to `/oauth/authorize` → authenticates → returns to Zulip.
3. Password changes in portal automatically work in Zulip (Zulip has no stored password).
4. Employees cannot bypass SSO.

**Approach:** Zulip admin configuration + Docker env vars. No Backend API code changes.
Document steps in `vps_deployment_guide.md` for reproducibility.

**Files touched:**
- `docker/zulip-prod.override.yaml`
- `docker/zulip/.env`
- `.env.example`
- `vps_deployment_guide.md`

---

> **Note:** W-1107 has no RED phase — it is a configuration-only work item.

- [ ] **GREEN — Zulip Configuration & VPS Deployment:**
  - [ ] [Config] `docker/zulip-prod.override.yaml` — ensure Traefik internal HTTPS transport and OIDC settings are present:
        ```yaml
        # Traefik internal self-signed TLS skip label
        - "traefik.http.services.zulip.loadbalancer.serversTransport=zulip-internal@file"

        # OIDC SSO Environment variables in zulip service
        SOCIAL_AUTH_OIDC_ENABLED: "true"
        SOCIAL_AUTH_OIDC_OIDC_ENDPOINT: "https://api.yourcompany.com"
        SOCIAL_AUTH_OIDC_KEY: "zulip"
        ```
        Note: Zulip auto-appends `/.well-known/openid-configuration` to `OIDC_ENDPOINT`.
  - [ ] [Config] `docker/zulip/.env`: add `SOCIAL_AUTH_OIDC_SECRET=<client-secret>`.
        Value must match `OAUTH_CLIENT_SECRET_ZULIP` in Backend API `.env`.
  - [ ] [Backend] In `oauth.service.ts` or `oauth.ts` — confirm `POST /oauth/token` validates
        `client_id = "zulip"` and `client_secret = process.env.OAUTH_CLIENT_SECRET_ZULIP`.
        If not implemented, add the check now.
  - [ ] [Env] `.env.example`: add `OAUTH_CLIENT_SECRET_ZULIP=<generate-a-strong-secret>`.
  - [ ] [CI/CD or Manual VPS File Transfer] Ensure `zulip-prod.override.yaml` is placed on VPS:
        - **Option A (Manual SCP):**
          ```bash
          scp docker/zulip-prod.override.yaml user@vps:/opt/jdconnect_v2/docker/zulip-prod.override.yaml
          ```
        - **Option B (CI/CD Pipeline update in `.github/workflows/deploy.yml`):**
          Update deploy step to copy `docker/docker-compose.prod.yml,docker/zulip-prod.override.yaml` to `/opt/jdconnect_v2/`.
  - [ ] [Restart / Recreate Container on VPS] Recreate Zulip container so new Traefik labels and environment variables take effect (simple `restart` will not pick up new Traefik labels):
        ```bash
        cd /opt/jdconnect_v2
        docker compose -f docker-compose.prod.yml -f docker/zulip-prod.override.yaml up -d zulip
        ```
  - [ ] [Admin UI] Zulip Admin → Organization settings → Authentication:
        Enable OIDC. Disable "Email and password". Save.
  - [ ] [Docs] `vps_deployment_guide.md` — add "Zulip OIDC SSO Configuration" section with:
        env var list, override file transfer, Admin UI steps, end-to-end test instructions, rollback procedure.

- [ ] **Verification chain:**
  - [ ] Zulip loads without Traefik 502/SSL errors (via `zulip-internal@file` transport). ✅
  - [ ] Zulip login page: only "Log in with JD Connect" visible. ✅
  - [ ] Click → portal login page. Enter credentials → back to Zulip logged in. ✅
  - [ ] HR resets password in portal → employee uses new password on next Zulip login. ✅
  - [ ] Employee cannot log into Zulip with email/password directly. ✅
  - [ ] ✅ Done.

---

### W-1108 — Portal Frontend: Update Date Labels from EST to IST

**Root cause:**
After W-1101, `work_date` is anchored to IST. Portal column headers still say "Work Date (EST)"
and notices say "Dates are in EST (US Day), Times are in IST (India Time)" — both incorrect now.

**Goal:**
All labels updated: "Work Date (IST)" and "Dates and Times are in IST (India Time)".

**Files touched:**
- `portal/src/pages/attendance.ts`
- `portal/src/pages/attendance_audit.ts`
- `portal/src/pages/breaks_audit.ts`
- `portal/tests/portal_pages.unit.test.ts`

---

- [ ] **RED — Unit (`portal/tests/portal_pages.unit.test.ts`):**
  - [ ] Change assertions for `"Work Date (EST)"` → `"Work Date (IST)"`.
  - [ ] Change assertions for `"Dates are in EST"` → `"Dates and Times are in IST (India Time)"`.
  - [ ] **Run — confirm RED (old labels still in source).**

- [ ] **GREEN — Portal Pages:**
  - [ ] `portal/src/pages/attendance.ts`: update `<th>` and notice string.
  - [ ] `portal/src/pages/attendance_audit.ts`: update `<th>` and notice string.
  - [ ] `portal/src/pages/breaks_audit.ts`: update `<th>` and notice string.
  - [ ] Run unit tests — **confirm GREEN.**
  - [ ] `pnpm --filter @jdconnect/portal build` — **confirm build passes.**

- [ ] **Verification chain:**
  - [ ] All three pages show "IST" labels. ✅
  - [ ] Portal unit tests GREEN. ✅
  - [ ] ✅ Done.

---

### W-1109 — Full Regression Test Suite

**Root cause:**
W-1101–W-1108 touch core attendance/break paths used daily. Full regression confirms no regressions.

---

- [ ] **Regression:**
  - [ ] `pnpm --filter @jdconnect/backend test` — all backend tests GREEN.
  - [ ] `pnpm --filter @jdconnect/portal test` — all portal tests GREEN.
  - [ ] `pnpm typecheck` — zero TypeScript errors.
  - [ ] `pnpm lint` — zero ESLint errors.

- [ ] **New tests must all be GREEN:**
  - [ ] `backend/tests/attendance_ist.unit.test.ts`
  - [ ] `backend/tests/attendance_boundary.integration.test.ts`
  - [ ] `backend/tests/break_boundary.unit.test.ts`
  - [ ] `backend/tests/attendance_status.unit.test.ts`
  - [ ] `backend/tests/oidc.integration.test.ts`
  - [ ] `backend/tests/oidc.service.unit.test.ts`
  - [ ] `backend/tests/zulip_provisioning.unit.test.ts`
  - [ ] `portal/tests/portal_pages.unit.test.ts`

- [ ] **Manual end-to-end:**
  - [ ] Day shift: in 9 AM IST, break 10-10:15, out 7 PM → `present`, ~10h, break `completed`. ✅
  - [ ] Night shift: in 9 PM IST Sep16, break 12:30-12:45 AM Sep17, out 6 AM → `present`, 9h, `work_date=Sep16`. ✅
  - [ ] Dashboard metrics accurate for both shifts at all times of day. ✅
  - [ ] Zulip login via OIDC → portal password change reflected immediately. ✅
  - [ ] New employee → Zulip shows IST timestamps from day one. ✅

- [ ] **Update `CONTEXT/current_state.md`:**
  - [ ] Add Phase 11 row to Section 1 progress table.
  - [ ] Add W-1101 through W-1109 TDD checklists to Section 2.
  - [ ] Add Session Note upon completion.

- [ ] ✅ Phase 11 Complete.

---

## Key Invariants (Must Remain True After All Changes)

| Invariant | Enforced By |
|---|---|
| Attendance writes ONLY to Postgres — never touches Zulip presence | `attendance.service.ts` |
| `zulip_user_id` resolved from JWT, never from request body | All route handlers |
| `clockIn()` uses `findOpenRecord(id, todayIST)` — prevents double clock-in on same IST day | W-1101 |
| `clockOut()`, `getStatus()`, `startBreak()` use `findAnyOpenRecord(id)` — no date filter | W-1102 |
| Duration-only: hours >= 9 = present, hours < 9 = half_day | W-1103 |
| `work_date` set once at clock-in using IST anchor, never recomputed after | W-1101 |
| Zulip never stores employee passwords (once W-1107 OIDC is live) | W-1106 + W-1107 |
| Employee creation provisions both Postgres AND Zulip atomically | `zulip.service.ts` — unchanged |
| JD Connect Postgres and Zulip Postgres remain completely isolated | No cross-DB queries added |
