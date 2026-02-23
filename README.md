# FMIS – Online Submission of Budget Proposal Information System

Sistema para sa **online submission at pagsusuri ng budget proposals** (Initial, NEP, GAA) na may workflow, Tier versioning, at BRD consolidation.

---

## 📋 Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the Application](#running-the-application)
- [Environment Variables](#environment-variables)
- [Main Features](#main-features)
- [Documentation](#documentation)
- [Scripts](#scripts)
- [License](#license)

---

## Overview

Ang **FMIS Budget** ay isang full-stack web app para sa:

- **Budget proposals** – Create, submit, at i-track ang proposals (Initial → NEP → GAA)
- **Workflow** – DRAFT → Reviewer → Approver → BRD Analyst → BRD Officer → BRD Manager → FINALIZED (with Return)
- **Tier data** – Tier 1 / Tier 2 split by Region/Department/Division, may version history at restore
- **BRD consolidation** – Reports, ceilings, at Tier linkage sa workflow history
- **Reports & analytics** – Consolidated reports, PDF/Excel export

May support para sa **SSO/external auth** at optional **MSSQL** integration.

---

## Tech Stack

| Layer   | Stack |
|--------|--------|
| **Frontend** | React 18, Vite 7, MUI (Material UI), React Query (TanStack), React Router |
| **Backend**  | Node.js, Express, Mongoose |
| **Database** | MongoDB (required) |
| **Auth**     | JWT / external auth API (e.g. NIA SSO) |
| **Optional** | MSSQL (external systems), Socket.IO, Agenda (jobs) |

---

## Project Structure

```
FMIS-BUDGET/
├── CLIENT/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # Reusable UI (e.g. tier/, reports/)
│   │   ├── config/         # API, auth config
│   │   ├── context/        # Region, User, etc.
│   │   ├── pages/          # Route pages (Tier, Proposals, etc.)
│   │   └── ...
│   ├── .env.example
│   └── package.json
├── SERVER/                 # Express API
│   ├── controllers/
│   ├── models/
│   ├── routers/
│   ├── middleware/
│   ├── index.js            # Entry point
│   ├── .env.example
│   └── package.json
├── BUDGET_WORKFLOW_DOCUMENTATION.md   # Workflow & Tier docs
├── package.json            # Root (optional scripts)
└── README.md               # This file
```

---

## Prerequisites

- **Node.js** (LTS, e.g. 18.x or 20.x)
- **MongoDB** (local or Atlas)
- **npm** or **yarn**

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd FMIS-BUDGET
```

Install root (if needed), client, and server:

```bash
npm install
cd CLIENT && npm install && cd ..
cd SERVER && npm install && cd ..
```

### 2. Environment files

**Server**

```bash
cd SERVER
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_SECRET_KEY, APP_PORT, auth URLs, etc.
```

**Client**

```bash
cd CLIENT
cp .env.example .env
# Edit .env: VITE_SERVER_URL, VITE_AUTH_SERVER_URL, VITE_AUTH_CLIENT_URL, etc.
```

See [Environment Variables](#environment-variables) below for important keys.

### 3. MongoDB

Ensure MongoDB is running and `MONGODB_URI` / `MONGODB_BUDGET_URL` in `SERVER/.env` point to your database (e.g. `mongodb://localhost:27017/fmis_budget`).

---

## Running the Application

**Terminal 1 – Backend**

```bash
cd SERVER
npm start
# Default: http://localhost:5000 (or APP_PORT from .env)
```

**Terminal 2 – Frontend**

```bash
cd CLIENT
npm start
# Default: http://localhost:3005 (Vite dev server)
```

Open the app at **http://localhost:3005** (or the port shown by Vite).  
For production, build the client and serve the `CLIENT/dist` folder (e.g. via Nginx or the same Express app).

---

## Environment Variables

### Server (SERVER/.env)

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `APP_PORT` | API port (default `5000`) |
| `MONGODB_URI` / `MONGODB_BUDGET_URL` | MongoDB connection string |
| `JWT_SECRET_KEY` | Secret for JWT (min 256 bits) |
| `SESSION_SECRET` | Session secret |
| `ACCOUNT_USER_API_URL` | External auth API URL |
| `ALLOW_MOCK_AUTH` | `true` only in dev (mock auth) |
| `CLIENT1`, `CLIENT2`, … | Allowed CORS origins |

See `SERVER/.env.example` for the full list (DB, auth, SMTP, backup, etc.).

### Client (CLIENT/.env)

| Variable | Description |
|----------|-------------|
| `VITE_SERVER_URL` | Backend API base URL |
| `VITE_AUTH_SERVER_URL` | Auth API URL |
| `VITE_AUTH_CLIENT_URL` | Auth frontend URL (e.g. SSO login) |
| `VITE_SECRET_KEY` | Client-side encryption key |

See `CLIENT/.env.example` for more options.

---

## Main Features

- **Budget Proposal Management** – Create/edit proposals, attach income, Personnel, MOOE, Capital Outlay.
- **Workflow** – Submit → Reviewer → Approver → BRD Analyst → BRD Officer → BRD Manager → Finalize; Return at any step.
- **Tier** – Edit Tier 1/Tier 2 by Region/Department/Division; save versions; version history and restore; version shown in UI and linked to workflow history.
- **BRD Consolidation** – Structure, ceilings (NEP), and reports.
- **Reports & Analytics** – Consolidated reports, PDF/Excel export.
- **Settings** – Fiscal year, active budget type, etc.
- **User/RBAC** – Roles (e.g. Budget Planning Analyst, Budget Officer, Budget Manager); region/department/division access.

Details and diagrams: **BUDGET_WORKFLOW_DOCUMENTATION.md**.

---

## Documentation

- **USER_MANUAL.md** – End-user manual: login, roles, navigation, proposal management, reports, workflow reference, troubleshooting.
- **SYSTEM_DOCUMENTATION.md** – Technical reference: architecture, API routes, data models, auth, workflow engine, configuration.
- **RUNBOOK.md** – Operations runbook: health checks, startup issues, user access, workflow, backups.
- **CHANGELOG.md** – Version history and changes.
- **openapi.yaml** – OpenAPI 3.0 spec for main API endpoints.
- **BUDGET_WORKFLOW_DOCUMENTATION.md** – Full workflow (Initial → NEP → GAA), Tier versioning, NEP ceilings, workflow actions, and technical notes.

---

## Scripts

**Root**

- `npm run organize-utils` – Organize server utils
- `npm run backfill:co-particulars` – Backfill capital outlay particulars
- `npm run recalc:proposals` – Recalculate all proposals

**Server (SERVER/)**

- `npm start` – Start API (nodemon)
- `npm run format` / `npm run format:check` – Prettier

**Client (CLIENT/)**

- `npm start` – Dev server (Vite, port 3005)
- `npm run build` – Production build
- `npm run preview` – Preview production build
- `npm run lint` – ESLint

---

## License

ISC (or as specified in the repository).
