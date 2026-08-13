# Docker Infrastructure — JD Connect

This directory contains the Docker Compose infrastructure setup for local development.

---

## 🛠 Services Overview

| Service | Container Name | Host Port | Purpose |
|:---|:---|:---|:---|
| **postgres** | `jdconnect_postgres` | `5432` | Plain Postgres 16 database (auto-initializes `jdconnect` and `jdconnect_test`) |
| **mongo** | `jdconnect_mongo` | `27017` | MongoDB 7 replica set (`rs0`) for Rocket.Chat |
| **mongo-init** | `jdconnect_mongo_init` | — | One-shot initialization script running `rs.initiate()` |
| **rocketchat** | `jdconnect_rocketchat` | `3100` | Rocket.Chat 8.x web application |

---

## 🚀 Startup & Lifecycle Commands

```bash
# Start all infrastructure containers in detached mode
docker compose up -d

# Check status of containers
docker compose ps

# View container logs
docker compose logs -f

# Stop containers
docker compose down

# Stop containers and purge data volumes (reset database & chat state)
docker compose down -v
```
