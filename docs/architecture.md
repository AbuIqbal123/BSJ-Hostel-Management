# Hostel Management System

The picture of what is running today is [system-architecture.md](system-architecture.md). This file is the later hosting plan. Update it when a hosting or technology decision changes.

## System Architecture & Technology Setup Specification

> **Scope:** Technology stack, environment architecture, driver configuration, Docker orchestration, and development/deployment workflow only.
>
> **Explicitly excluded:** Database schema, table definitions, migrations, entity relationships, and application data models beyond technology/framework configuration examples.

---

# 1. System Scope & Summary Table

The Hostel Management System is a lightweight production application intended for approximately **400 residents**, **10 administrative staff** (Wardens, Gate Staff, Provost), and automated **parent SMS alerts**.

The architecture is deliberately simple: a React Native mobile client, a single FastAPI backend service, SQLite for persistence, Nginx for TLS termination/reverse proxying, Docker Compose for orchestration, and a pluggable SMS driver.

| Layer | Technology / Configuration | Purpose |
|---|---|---|
| Mobile App | React Native + Expo + TypeScript | Resident and staff mobile application |
| Gate QR Scanning | `expo-camera` | Real-time QR scanning at the hostel gate |
| Mobile Delivery | Expo EAS | App builds and OTA JavaScript updates |
| API | FastAPI on Python 3.11+ | REST API and application services |
| Validation / Models | Pydantic v2 | Request/response validation and typed API models |
| Async Runtime | FastAPI async endpoints + Uvicorn | Non-blocking API request handling |
| API Documentation | FastAPI OpenAPI + Swagger UI | Auto-generated API documentation at `/docs` |
| Database | SQLite in WAL mode | Lightweight persistent storage with low operational overhead |
| DB Access | Python `sqlite3` / controlled DB driver layer | Explicit connection, timeout, and PRAGMA management |
| Reverse Proxy | Nginx | TLS/SSL termination, host-based routing, and forwarding to API containers |
| Containerization | Docker | Reproducible runtime environments |
| Orchestration | Docker Compose | Side-by-side Dev + Production services on one VPS |
| SMS Provider | Fast2SMS or MSG91 | DLT-compliant Indian transactional SMS delivery |
| Development SMS | Mock SMS driver | Prevents accidental real SMS during development |
| Production SMS | Live DLT SMS driver | Sends real parent alerts |
| VPS | Linux, 4 GB RAM, 2 vCore | Single-host production deployment |
| Dev Environment | Local machine + Docker Compose | Rapid local development and integration testing |
| Staging/Dev API | `api-dev.domain.com` | Isolated API environment using mock SMS |
| Production API | `api.domain.com` | Live environment using DLT SMS |
| Source Control | Git | Version control and release history |
| API Tests | Pytest + FastAPI test client | Automated backend validation |
| Mobile Quality | TypeScript compiler + Expo development tooling | Static checks and app testing |

### Architectural Principle

The system should **avoid unnecessary infrastructure** at this scale.

No Redis, Kafka, RabbitMQ, Celery cluster, Kubernetes cluster, or separate database server is required for the initial production deployment. The main objective is a small operational footprint while keeping the architecture modular enough to replace individual drivers later.

---

# 2. Architecture Diagram & Environment Isolation Rules

## 2.1 High-Level Architecture

```text
                         ┌───────────────────────────┐
                         │       Mobile Clients      │
                         │                           │
                         │  React Native + Expo      │
                         │       TypeScript          │
                         │                           │
                         │  Resident / Staff Modes   │
                         │  QR Scanner: expo-camera  │
                         └─────────────┬─────────────┘
                                       │
                                       │ HTTPS
                                       ▼
                         ┌───────────────────────────┐
                         │          Nginx            │
                         │                           │
                         │  TLS / SSL termination    │
                         │  Host-based routing       │
                         └─────────────┬─────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    │                                     │
          Host: api.domain.com                Host: api-dev.domain.com
                    │                                     │
                    ▼                                     ▼
          ┌───────────────────┐                 ┌───────────────────┐
          │     api-prod      │                 │      api-dev      │
          │                   │                 │                   │
          │ FastAPI           │                 │ FastAPI           │
          │ Python 3.11+      │                 │ Python 3.11+      │
          │ Uvicorn           │                 │ Uvicorn           │
          │ Pydantic v2       │                 │ Pydantic v2       │
          └─────────┬─────────┘                 └─────────┬─────────┘
                    │                                     │
                    ▼                                     ▼
          ┌───────────────────┐                 ┌───────────────────┐
          │ SQLite Production │                 │  SQLite Dev/Test  │
          │                   │                 │                   │
          │ WAL enabled       │                 │ WAL enabled       │
          │ Dedicated volume  │                 │ Dedicated volume  │
          └─────────┬─────────┘                 └───────────────────┘
                    │
                    │ Live transactional SMS
                    ▼
          ┌───────────────────┐
          │ SMS Provider      │
          │ Fast2SMS / MSG91  │
          │ DLT-compliant     │
          └───────────────────┘

Dev API SMS path:
api-dev → Mock SMS Driver → logs/test sink only
```

## 2.2 VPS Layout

The production host contains both environments side-by-side:

```text
Linux VPS
4 GB RAM / 2 vCore
│
├── Nginx
│   ├── api.domain.com      → api-prod
│   └── api-dev.domain.com  → api-dev
│
├── api-prod container
│   └── /data/prod/hostel.db
│
├── api-dev container
│   └── /data/dev/hostel.db
│
└── Docker volumes
    ├── hostel_prod_data
    └── hostel_dev_data
```

The environments share the same VPS and Nginx instance, but **must not share application state**.

## 2.3 Environment Isolation Rules

### Production

```text
Environment        = production
Hostname           = api.domain.com
Database path      = /data/hostel.db
Database volume    = hostel_prod_data
SMS driver         = live DLT SMS driver
SMS mode           = REAL SEND
Debug              = false
Reload              = false
API docs            = available at /docs unless explicitly disabled by deployment policy
```

### Development / Staging

```text
Environment        = development
Hostname           = api-dev.domain.com
Database path      = /data/hostel.db
Database volume    = hostel_dev_data
SMS driver         = mock SMS driver
SMS mode           = NO REAL SEND
Debug              = true
Reload              = false on VPS
API docs            = available at /docs
```

### Mandatory Isolation Rules

1. **Separate SQLite files/volumes**
   - `api-prod` must never mount the development database.
   - `api-dev` must never mount the production database.

2. **Separate environment variables**
   - Production secrets must not be copied into Dev/Staging `.env` files.
   - Dev must never receive live SMS credentials unless explicitly required for a controlled test.

3. **Different SMS drivers**
   - `api-dev` → `MockSmsDriver`
   - `api-prod` → `DltSmsDriver`

4. **No production data in development by default**
   - Dev should use synthetic/test data.
   - Any future data copy process should be deliberate and separately controlled.

5. **Separate API base URLs in the mobile app**
   - Development build → `https://api-dev.domain.com`
   - Production build → `https://api.domain.com`

6. **Separate secrets**
   - JWT/authentication secrets, SMS credentials, encryption keys, and any other application secrets must be environment-specific.

7. **Separate deployment lifecycle**
   - A Dev deployment must not automatically overwrite or restart Production.
   - Production deployment should be an explicit release action.

8. **Separate SQLite backups**
   - Production backups must be retained independently from Dev backups.

---

# 3. SQLite Driver Configuration

## 3.1 Driver Goals

SQLite is selected because the expected load is modest and the application benefits from a single-file database with minimal operational complexity.

**WAL (Write-Ahead Logging)** should be enabled so readers can continue while a write transaction is in progress. SQLite still permits only one writer at a time, so the application should keep write transactions short and avoid long-running transactions.

The driver should also set an explicit **busy timeout** so transient lock contention does not immediately surface as an error.

## 3.2 `app/db.py`

```python
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Generator

DATABASE_PATH = Path(
    # Keep the path configurable through the deployment environment.
    # Example container path: /data/hostel.db
    "/data/hostel.db"
)

BUSY_TIMEOUT_MS = 5_000


def create_connection() -> sqlite3.Connection:
    """
    Create a SQLite connection with production-safe connection settings.

    WAL:
        Allows readers to continue while a write is occurring.

    busy_timeout:
        Waits briefly for a locked database rather than immediately failing.
    """

    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(
        DATABASE_PATH,
        timeout=BUSY_TIMEOUT_MS / 1_000,
        check_same_thread=False,
    )

    # SQLite WAL mode persists at the database level once enabled.
    connection.execute("PRAGMA journal_mode=WAL;")

    # Wait up to BUSY_TIMEOUT_MS for transient lock contention.
    connection.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS};")

    # Foreign key enforcement should be explicit for every connection.
    connection.execute("PRAGMA foreign_keys=ON;")

    # Return rows in a convenient mapping-like form if needed by callers.
    connection.row_factory = sqlite3.Row

    return connection


def get_connection() -> Generator[sqlite3.Connection, None, None]:
    """
    FastAPI dependency-style connection provider.

    The transaction lifecycle should remain short.
    """

    connection = create_connection()

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
```

## 3.3 Environment-Configurable Variant

For deployment flexibility, the database path and timeout should ultimately be environment-configurable:

```python
import os
import sqlite3
from pathlib import Path

DATABASE_PATH = Path(
    os.getenv("DATABASE_PATH", "/data/hostel.db")
)

BUSY_TIMEOUT_MS = int(
    os.getenv("SQLITE_BUSY_TIMEOUT_MS", "5000")
)


def create_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(
        DATABASE_PATH,
        timeout=BUSY_TIMEOUT_MS / 1000,
        check_same_thread=False,
    )

    connection.execute("PRAGMA journal_mode=WAL;")
    connection.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS};")
    connection.execute("PRAGMA foreign_keys=ON;")

    return connection
```

Recommended container values:

```text
Production:
DATABASE_PATH=/data/hostel.db
SQLITE_BUSY_TIMEOUT_MS=5000

Development:
DATABASE_PATH=/data/hostel.db
SQLITE_BUSY_TIMEOUT_MS=5000
```

## 3.4 SQLite Operational Rules

```text
DO:
- Enable WAL.
- Set a busy timeout.
- Keep write transactions short.
- Use parameterized SQL.
- Use separate DB files for Dev and Production.
- Back up the production database regularly.
- Keep the database on a persistent Docker volume.

DO NOT:
- Put the database on an ephemeral container filesystem.
- Mount the production DB into Dev.
- Keep long-running write transactions open.
- Run multiple independent API containers against the same SQLite file.
- Assume WAL means unlimited concurrent writes.
```

For the initial 4 GB / 2 vCore VPS, run **one production API container** and **one Dev API container**, each with its own SQLite database file.

---

# 4. Production Orchestration

## 4.1 Docker Compose

The following Compose configuration runs Nginx, Production, and Development side-by-side.

```yaml
services:

  nginx:
    image: nginx:1.27-alpine
    container_name: hostel-nginx
    restart: unless-stopped

    ports:
      - "80:80"
      - "443:443"

    depends_on:
      - api-prod
      - api-dev

    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./certbot/conf:/etc/letsencrypt:ro

    networks:
      - hostel-network

  api-prod:
    build:
      context: ./backend
      dockerfile: Dockerfile

    container_name: hostel-api-prod
    restart: unless-stopped

    environment:
      ENVIRONMENT: production
      DATABASE_PATH: /data/hostel.db
      SQLITE_BUSY_TIMEOUT_MS: "5000"

      SMS_DRIVER: dlt
      SMS_PROVIDER: "${SMS_PROVIDER}"
      SMS_API_KEY: "${SMS_API_KEY}"
      SMS_SENDER_ID: "${SMS_SENDER_ID}"
      SMS_DLT_TEMPLATE_ID: "${SMS_DLT_TEMPLATE_ID}"

      # Example application secrets:
      APP_SECRET_KEY: "${PROD_APP_SECRET_KEY}"

    volumes:
      - hostel_prod_data:/data

    expose:
      - "8000"

    command:
      [
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000"
      ]

    healthcheck:
      test:
        [
          "CMD",
          "python",
          "-c",
          "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
        ]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

    networks:
      - hostel-network

  api-dev:
    build:
      context: ./backend
      dockerfile: Dockerfile

    container_name: hostel-api-dev
    restart: unless-stopped

    environment:
      ENVIRONMENT: development
      DATABASE_PATH: /data/hostel.db
      SQLITE_BUSY_TIMEOUT_MS: "5000"

      # Critical: Dev must never send real SMS.
      SMS_DRIVER: mock

      APP_SECRET_KEY: "${DEV_APP_SECRET_KEY}"

    volumes:
      - hostel_dev_data:/data

    expose:
      - "8000"

    command:
      [
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000"
      ]

    healthcheck:
      test:
        [
          "CMD",
          "python",
          "-c",
          "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
        ]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

    networks:
      - hostel-network


volumes:
  hostel_prod_data:
  hostel_dev_data:


networks:
  hostel-network:
    driver: bridge
```

## 4.2 Nginx Host Routing

Example Nginx virtual hosts:

```nginx
server {
    listen 80;
    server_name api.domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;

    server_name api.domain.com;

    ssl_certificate /etc/letsencrypt/live/api.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.domain.com/privkey.pem;

    location / {
        proxy_pass http://api-prod:8000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}


server {
    listen 80;
    server_name api-dev.domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;

    server_name api-dev.domain.com;

    ssl_certificate /etc/letsencrypt/live/api-dev.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-dev.domain.com/privkey.pem;

    location / {
        proxy_pass http://api-dev:8000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 4.3 FastAPI Application Entry Point

Example production application setup:

```python
from fastapi import FastAPI

app = FastAPI(
    title="Hostel Management System API",
    version="1.0.0",
    description="Backend API for the Hostel Management System.",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

FastAPI automatically exposes:

```text
OpenAPI specification:
https://api.domain.com/openapi.json

Swagger UI:
https://api.domain.com/docs

ReDoc:
https://api.domain.com/redoc
```

## 4.4 SMS Driver Abstraction

The SMS provider must be hidden behind a small interface so the application does not depend directly on Fast2SMS or MSG91 throughout the codebase.

```python
from __future__ import annotations

from typing import Protocol


class SmsDriver(Protocol):
    async def send_sms(
        self,
        mobile_number: str,
        message: str,
    ) -> None:
        ...


class MockSmsDriver:
    async def send_sms(
        self,
        mobile_number: str,
        message: str,
    ) -> None:
        print(
            f"[MOCK SMS] recipient={mobile_number} "
            f"message={message}"
        )


class DltSmsDriver:
    async def send_sms(
        self,
        mobile_number: str,
        message: str,
    ) -> None:
        # Provider-specific Fast2SMS or MSG91 implementation.
        #
        # Keep DLT entity/template configuration in environment variables.
        # Do not hard-code credentials or template identifiers here.
        raise NotImplementedError
```

Environment selection:

```python
import os


def create_sms_driver():
    driver = os.getenv("SMS_DRIVER", "mock")

    if driver == "mock":
        return MockSmsDriver()

    if driver == "dlt":
        return DltSmsDriver()

    raise ValueError(f"Unsupported SMS_DRIVER: {driver}")
```

### SMS Architecture Rule

```text
Dev / Staging:
Application → MockSmsDriver → logs/test output

Production:
Application → DltSmsDriver → Fast2SMS or MSG91 → DLT-compliant transactional SMS
```

The provider-specific implementation should support the selected Indian DLT transactional workflow, including the required sender/template configuration.

---

# 5. Development & Deployment Roadmap

## 5.1 Repository Structure

Recommended initial project layout:

```text
hostel-management-system/
│
├── mobile/
│   ├── app/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   ├── types/
│   ├── app.json
│   ├── eas.json
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── services/
│   │   ├── drivers/
│   │   └── db.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 5.2 Local Mobile Development

Install dependencies and start Expo:

```bash
cd mobile

npm install

npx expo start
```

For a device with an Expo development build, use the normal Expo workflow to connect the physical phone/emulator.

QR scanning uses:

```bash
npx expo install expo-camera
```

The application should request camera permission only when the gate QR scanning workflow requires it.

---

## 5.3 Local Backend Development

Create a Python 3.11+ virtual environment:

```bash
cd backend

python3.11 -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt
```

Run FastAPI with hot reload:

```bash
uvicorn app.main:app --reload
```

Local development API:

```text
http://127.0.0.1:8000
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

OpenAPI specification:

```text
http://127.0.0.1:8000/openapi.json
```

---

## 5.4 Recommended Python Dependencies

Initial backend dependencies should remain intentionally small:

```text
fastapi
uvicorn[standard]
pydantic
pytest
httpx
```

Additional libraries should be added only when a concrete requirement exists.

For example, an HTTP client library can be added when implementing the Fast2SMS/MSG91 provider driver.

---

## 5.5 Dockerized Local Development

Build and start the complete stack:

```bash
docker compose up --build
```

Run in the background:

```bash
docker compose up -d --build
```

Inspect services:

```bash
docker compose ps
```

View API logs:

```bash
docker compose logs -f api-prod
docker compose logs -f api-dev
```

Stop the stack:

```bash
docker compose down
```

Dev API should always use:

```text
SMS_DRIVER=mock
```

so local testing cannot accidentally trigger real parent SMS messages.

---

## 5.6 Testing Workflow

### Backend

Run unit and API tests:

```bash
pytest
```

Recommended test categories:

```text
Unit tests
    ↓
Service/driver tests
    ↓
FastAPI endpoint tests
    ↓
SQLite integration tests
    ↓
Docker smoke test
```

### SMS

The mock SMS driver should record or log:

```text
recipient
message
timestamp
driver=mock
```

Tests should assert that the correct SMS would have been requested without making an external network call.

### Mobile

Before release:

```bash
npx tsc --noEmit
```

Then test the critical workflows on a physical device, particularly:

```text
Resident QR display
Gate QR scanning
Network failure handling
API authentication/session expiry
Push/OTA update behavior
```

---

## 5.7 Expo EAS & OTA Updates

Use Expo EAS for mobile build and release management.

Typical setup:

```bash
npm install -g eas-cli

eas login

eas build:configure
```

Build an Android/iOS application using EAS:

```bash
eas build
```

Use EAS OTA updates for JavaScript/TypeScript changes that are eligible for OTA delivery:

```bash
eas update
```

The release strategy should distinguish:

```text
Native dependency / native configuration change
    → New EAS build required

JavaScript / TypeScript application change eligible for OTA
    → EAS OTA update
```

OTA updates must be released deliberately and tested against the corresponding production API version.

---

## 5.8 VPS Provisioning

Target host:

```text
OS: Linux
CPU: 2 vCore
RAM: 4 GB
Runtime: Docker + Docker Compose
Public endpoints:
    api.domain.com
    api-dev.domain.com
```

Install the required host packages:

```bash
sudo apt update

sudo apt install -y \
  ca-certificates \
  curl \
  git
```

Install Docker using the official Docker installation method for the selected Linux distribution.

Verify:

```bash
docker --version
docker compose version
```

Clone the application:

```bash
git clone <repository-url>

cd hostel-management-system
```

Create the server environment file from the example:

```bash
cp .env.example .env
```

Populate production-only secrets on the VPS.

Never commit `.env` to Git.

---

## 5.9 Initial Production Deployment

Start the containers:

```bash
docker compose up -d --build
```

Verify:

```bash
docker compose ps
```

Check the production API:

```bash
curl https://api.domain.com/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Check Dev:

```bash
curl https://api-dev.domain.com/health
```

Verify Swagger:

```text
https://api.domain.com/docs
https://api-dev.domain.com/docs
```

---

## 5.10 TLS / SSL

Use Nginx as the public TLS termination point.

Recommended certificate flow:

```text
Internet
    ↓
HTTPS :443
    ↓
Nginx
    ↓
HTTP inside Docker network
    ↓
FastAPI :8000
```

Certificates can be managed with Let's Encrypt / Certbot.

The API containers do not need public host ports because Nginx is the only public HTTP(S) entry point.

---

## 5.11 Deployment Procedure

### Development Release

```text
1. Developer commits code.
2. Tests pass locally.
3. Build Dev container.
4. Deploy/restart api-dev.
5. Test using api-dev.domain.com.
6. Confirm mock SMS behavior.
7. Verify critical workflows.
```

### Production Release

```text
1. Development version validated.
2. Production release tag created.
3. Production image built.
4. api-prod container updated.
5. /health endpoint checked.
6. API /docs checked.
7. Critical resident/gate workflows tested.
8. SMS configuration verified.
9. Production monitoring/log review completed.
```

---

## 5.12 Resource & Reliability Rules for the 4 GB VPS

The deployment is intentionally sized around a small VPS.

Recommended principles:

```text
Nginx:
- Lightweight reverse proxy only.

api-prod:
- One container / one Uvicorn process initially.

api-dev:
- One container / one Uvicorn process initially.

SQLite:
- One dedicated DB file per environment.

Logging:
- Use Docker logs initially.
- Prevent unbounded application log growth.

Memory:
- Avoid unnecessary background workers.
- Avoid queue brokers unless a real requirement appears.

CPU:
- Keep synchronous/blocking work out of async API handlers.
- Keep SMS calls isolated behind a driver/service boundary.
```

At this scale, the system should prioritize **simplicity, predictable behavior, backups, and clear environment isolation** over distributed infrastructure.

---

# 6. Technology Decisions & Non-Goals

## 6.1 Chosen Technology Stack

```text
Frontend:
React Native
Expo
TypeScript
expo-camera
Expo EAS / OTA

Backend:
Python 3.11+
FastAPI
Pydantic v2
Uvicorn
OpenAPI / Swagger UI

Persistence:
SQLite
WAL mode
busy_timeout
Persistent Docker volume

Infrastructure:
Linux VPS
Docker
Docker Compose
Nginx
TLS/SSL

Messaging:
Fast2SMS OR MSG91
DLT-compliant transactional SMS

Environments:
Development/Staging
Production
```

## 6.2 Explicit Non-Goals for This Specification

This document intentionally does **not** define:

```text
- Database tables
- Database columns
- Database relationships
- SQL schema
- Authentication schema
- User/role data model
- Hostel/room data model
- Outing data model
- Permission data model
- Notification data model
- Detailed API endpoint contract
- UI screen specifications
- Business workflow rules
```

Those should be documented separately after the technology and deployment architecture is finalized.

---

# 7. Final Deployment Topology

```text
                          INTERNET
                              │
                     HTTPS / TLS :443
                              │
                              ▼
                    ┌─────────────────┐
                    │      NGINX      │
                    │  TLS termination│
                    │  Host routing   │
                    └───────┬─────────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
      api.domain.com              api-dev.domain.com
             │                             │
             ▼                             ▼
      ┌─────────────┐              ┌─────────────┐
      │  api-prod   │              │   api-dev   │
      │  FastAPI    │              │   FastAPI   │
      │  Uvicorn    │              │   Uvicorn   │
      │  Pydantic   │              │   Pydantic  │
      └──────┬──────┘              └──────┬──────┘
             │                             │
             ▼                             ▼
      ┌─────────────┐              ┌─────────────┐
      │ SQLite WAL  │              │ SQLite WAL  │
      │ PROD volume │              │ DEV volume  │
      └──────┬──────┘              └─────────────┘
             │
             ▼
      ┌─────────────┐
      │ DLT SMS     │
      │ Fast2SMS /  │
      │ MSG91       │
      └─────────────┘

Mobile:
React Native + Expo + TypeScript
        │
        ├── Dev build → api-dev.domain.com
        │
        └── Prod build → api.domain.com

Gate QR:
expo-camera → FastAPI API
```

**Resulting architecture:** a single 4 GB / 2 vCore Linux VPS running Nginx plus isolated `api-prod` and `api-dev` containers, each backed by its own SQLite WAL database, with Dev using a mock SMS driver and Production using the live DLT-compliant SMS provider.
