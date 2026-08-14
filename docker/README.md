# Docker Infrastructure — JD Connect

This directory contains the Docker Compose infrastructure setup for local development.

---

## 🛠 Services Overview

JD Connect uses two isolated Docker Compose stacks:

1. **JD Connect Infrastructure (`docker/docker-compose.yml`)**
   - `postgres` (`jdconnect_postgres`, port `5432`): Plain Postgres 16 database owning JD Connect HR, employee, and attendance data (`jdconnect` and `jdconnect_test` databases).

2. **Zulip Official Stack (`docker/zulip/`)**
   - Cloned directly from `github.com/zulip/docker-zulip`.
   - Managed independently via `docker/zulip/compose.yaml` and `docker/zulip/compose.override.yaml`.
   - Accessible at `https://127.0.0.1:9991`.

---

## 🚀 Startup Commands

### 1. Start JD Connect Database Stack
```bash
docker compose -f docker/docker-compose.yml up -d
```

### 2. Start Zulip Chat Stack
```bash
cd docker/zulip
docker compose pull
docker compose run --rm zulip app:init
docker compose up zulip --wait
```
