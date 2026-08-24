# Technical Analysis: Zulip & JD Connect Password Synchronization

## 1. Executive Summary

When an employee is created in the **JD Connect Portal**, their account is provisioned in both JD Connect's Postgres database and Zulip, and their initial password works for both applications.

However, when an administrator or manager updates an employee's password via the **Portal Edit Employee modal** (`PATCH /api/employees/:id`) or the **Reset Password endpoint** (`POST /api/employees/:id/reset-password`), the password only changes for the JD Connect Attendance/HR Portal, but **not for Zulip**. The employee is unable to log into Zulip with their new password.

---

## 2. Root Cause Analysis

### A. Asymmetric Zulip REST API Capabilities
* **On User Creation (`POST /api/v1/users`):**
  Zulip's Admin REST API accepts a `password` parameter when creating a new user. The Backend API sends this request over HTTP, and Zulip sets the user's initial password successfully.
* **On User Modification (`PATCH /api/v1/users/{user_id}`):**
  Zulip's REST API **does not support changing passwords**. For security and privacy design reasons, Zulip's REST API only permits updating fields like `full_name`, `role`, and custom profile fields, but explicitly blocks setting or overriding user passwords via HTTP endpoints.

### B. Why the CLI Fallback Failed in Production
In local development on a host machine, running a shell command like:
```bash
docker compose exec -T -u zulip zulip /home/zulip/deployments/current/manage.py shell -c "..."
```
can invoke Zulip's internal Django Python shell.

However, **in production on the VPS:**
1. The **Backend API (`jdconnect_api`)** runs **inside an isolated Docker container**.
2. A containerized process cannot execute `docker` or `docker compose` commands on the host system because the `docker` CLI binary and the Docker daemon socket (`/var/run/docker.sock`) are not present inside the container.
3. As a result, the shell execution threw a `docker: not found` error, which was caught by the error handler. The Postgres database updated successfully, but Zulip was never modified.

### C. Why Changing the Password Inside Zulip Directly Is Problematic
If employees change their password directly inside the Zulip app (**Settings $\rightarrow$ Account & Privacy $\rightarrow$ Password**):
1. **No Back-Propagation:** Zulip does not notify or push password change events back to JD Connect.
2. **Password Drift / Desynchronization:** The employee will end up with two different passwords (a new one for Zulip, and an old one for JD Connect Attendance).
3. **No Admin Overrides in Zulip UI:** Zulip's web interface does not allow administrators to set passwords for employees; it only offers a "Send reset email" link, which conflicts with JD Connect's internal call-center policy (where HR manages passwords directly without email links).

---

## 3. Proposed Approaches & Solutions

### Approach 1: Docker Socket Mount (Recommended & Standard for Containerized Ops)

* **Concept:**
  Mount the host Docker socket (`/var/run/docker.sock`) into the `jdconnect_api` container in `docker-compose.prod.yml`.
* **Mechanism:**
  Instead of relying on the `docker` CLI binary, the Backend API uses Node's native HTTP client to communicate directly with Docker Engine's REST API over the unix socket:
  1. Locates the running Zulip container (`POST /v1.41/containers/.../exec`).
  2. Executes Django's standard `u.set_password(new_password); u.save()` command inside Zulip.
* **Pros:**
  - Uses Zulip's own internal Django password hashing and validation logic.
  - Zero schema changes and no direct database coupling.
  - 100% reliable in both production Docker containers and VPS environments.
* **Cons:**
  - Requires mounting `/var/run/docker.sock` in `docker-compose.prod.yml`.

---

### Approach 2: Direct Database Sync with Django PBKDF2 Hashing

* **Concept:**
  Allow the Backend API to connect to Zulip's Postgres database (or share database network access).
* **Mechanism:**
  1. The Backend API computes a standard Django-compatible PBKDF2 password hash in Node.js using `node:crypto`:
     $$\text{hash} = \text{pbkdf2\_sha256}\$\text{iterations}\$\text{salt}\$\text{base64\_digest}$$
  2. Directly executes `UPDATE zerver_userprofile SET password = $1 WHERE id = $2` in Zulip's database.
* **Pros:**
  - Does not require Docker socket access.
  - Fast SQL execution.
* **Cons:**
  - Violates the isolation boundary between JD Connect's Postgres and Zulip's database.
  - Relies on matching Django's exact hashing format.

---

### Approach 3: Full OIDC / SSO Integration (Passwordless Zulip)

* **Concept:**
  Configure Zulip to use JD Connect's Backend API as its **OpenID Connect (OIDC) Single Sign-On (SSO)** provider.
* **Mechanism:**
  - Users never enter a password on Zulip directly.
  - Clicking "Log in with JD Connect" on Zulip redirects the user to JD Connect's auth server (`/oauth/authorize`), which validates the single centralized password in JD Connect's Postgres DB.
* **Pros:**
  - Eliminates dual password storage entirely.
  - Zulip never stores passwords; JD Connect Postgres is the sole identity store.
* **Cons:**
  - Requires full SSO/OIDC realm configuration in Zulip.

---

## 4. Summary & Next Steps

| Approach | Implementation Complexity | Architectural Cleanliness | Security & Maintenance |
|---|---|---|---|
| **Approach 1 (Docker Socket)** | Low (Docker socket mount + Node HTTP exec) | High (Zulip manages own state) | High |
| **Approach 2 (Direct DB Write)** | Medium (Network routing + Django hashing) | Low (Breaks DB isolation) | Medium |
| **Approach 3 (Full OIDC SSO)** | Medium-High (Zulip Realm SSO settings) | Highest (Single Source of Truth) | Highest |

The recommended and immediate fix is **Approach 1**, which allows the Portal's Edit Employee modal to update Zulip's password cleanly and reliably without requiring users to maintain two different logins.
