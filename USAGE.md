# FMIS Budget System - User & Admin Guide

## 🧭 Overview
FMIS Budget System is a full-stack application for managing budget proposals, personnel services, MOOE, capital outlay, and income categories. This guide provides a clear, practical walkthrough to set up, use, and maintain the system across environments (local development, staging, and production).

---

## 👥 Who is this for?
- Developers: Setup environment and local development
- Administrators: DB & server management, maintenance tasks
- End Users: Creating and managing proposals, submitting workflows
- Testers: Run integration & unit tests, verify features

---

## ✅ Quick Start
Prerequisites:
- Node.js 18+ (use Node Version Manager or nvm)
- MongoDB (or use remote MongoDB URL)
- npm or yarn

1) **Clone repository**
```bash
git clone https://github.com/doriemon267/FMIS-BUDGET-SEPTEMBER.git
cd FMIS-BUDGET-SEPTEMBER
```

2) **Install Backend**
```powershell
Push-Location "d:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER"
npm install
Pop-Location
```

3) **Install Frontend**
```bash
cd CLIENT
npm install
```

4) **Configure environment**
- SERVER: copy `SERVER/.env` or read `.env.example` for server variables
- CLIENT: copy `CLIENT/.env.example` to `CLIENT/.env` and update VITE variables

5) **Run servers**
- Start backend (dev):
```powershell
cd SERVER
npm start
```
- Start frontend (dev):
```bash
cd CLIENT
npm start
```
- Open the app: `http://localhost:3005` (or the Vite port configured in `.env`) and backend API at `http://localhost:5005`.

> Quick shortcut (Windows): Use `START_SERVERS.bat` or `start-server.ps1` to spawn dev servers.

---

## 🧩 Environment & Configuration
Important server `.env` variables (in `SERVER/.env`):
- `APP_PORT` — HTTP port (default 5005)
- `MONGODB_BUDGET_URL` / `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET_KEY` — secret key for JWT (set a secure secret)
- `ALLOW_MOCK_AUTH` — set to `true` for local dev to use mock auth
- `DEBUG_MODE` — enables verbose logs (set to `true` for debugging)
- `ALLOW_SERVER_LOGS`, `REDACT_LOGS` — control log redaction
- `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` — email server settings
- `MSSQL_*` — for MSSQL integration, if used
- `BACKUP_STORAGE_PATH` — location to store DB backups (default `./backups`)

Important client `VITE_` variables (in `CLIENT/.env`):
- `VITE_APP_TITLE` — App title
- `VITE_SERVER_URL` / `VITE_API_BASE_URL` — Backend API URL
- `VITE_AUTH_SERVER_URL` — Authentication provider
- `VITE_SECRET_KEY` — client-side encryption key (DO NOT include secrets in public repo)

Secure secrets: Always use environment variables and avoid committing secrets to the repo.

---

## 🔧 Development Workflow
### Code structure
- CLIENT: React app (src/components, src/pages, src/context)
- SERVER: Express app (controllers, routers, models, middleware)
- DOCUMENTATION: Extensive feature docs and how-tos
- SCRIPTS: Useful maintenance scripts for DB, verification, and more

### Running the app locally
- Start MongoDB (local server or remote)
- Start server & client as described above
- Use `ALLOW_MOCK_AUTH=true` for local testing without external auth
  - With mock auth: You can use `x-dev-user-id` or `X-Dev-User-Id` header to impersonate a user

### Linting & Tests
- Frontend
  - `cd CLIENT && npm run lint` — run ESLint
  - `cd CLIENT && npm test` — run Vitest
- Backend
  - `cd SERVER && npm test` — run Jest tests (unit & integration)
  - `cd SERVER && npm run test:integration` — integration tests

### Utility & Maintenance Scripts
- `npm run recalc:proposals` (root script) — recalculate proposals totals
- `SERVER/scripts/*.js` — check scripts like `recalculate-all-proposals.js`, etc
- `SERVER/scripts/migrate:...` — migration scripts

---

## 🔐 Authentication & Authorization
- Auth based on JWT — backend expects JWT signed with `JWT_SECRET_KEY`.
- If an external account system is used (e.g., an SSO), configure `ACCOUNT_USER_API_URL` to let the server fetch user info.
- For development, `ALLOW_MOCK_AUTH=true` allows bypassing external auth and using dev headers:
  - Headers: `x-dev-user-id`, `x-dev-user-name` or the `Authorization: Bearer <token>` header.
- RBAC: role-based arguments are enforced in server routers; roles include Budget Preparer, Reviewer, Approver, Manager, Officer, Analyst.
- See: `DOCUMENTATION/Authentication` and `DOCUMENTATION/HIERARCHICAL_RBAC_*` docs for detail.

---

## 🗂 Key User Actions & Pages
### Proposal Workflow (Create → Submit → Approve)
- Page: `New Proposal Workflow` (client route: `/new-proposal-workflow`)
- Steps:
  1. Create a draft proposal (choose Type: MOOE, Capital Outlay, Personnel Services)
  2. Save draft (use Save button) — always click Save to ensure persistence
  3. Submit the proposal for review → triggers notifications to the next roles in RBAC chain
  4. Reviewer/Approver/Officer will get notification to perform the action
  5. On Approval or further actions, status changes and notifications are sent

### Notifications
- Notifications appear in the bell icon (top-right) and contain deep-links to proposals
- Click a notification → automatically selects the right tab and opens the proposal details dialog
- See quick tests in `QUICK_REFERENCE.md` — `NOTIFICATION_QUICK_START.md`

### Attachments & Export
- Attach files via the Attachments UI in the proposal details
- Export proposals as PDF (uses server-side PDF generation)
- Excel export uses ExcelJS on the server

### Saving Data Best Practices
- Manual Save is recommended — see `USER_GUIDE_SAVING_DATA.md`
- Auto-save is available but optional (enabled via the toggle)

---

## 🛠 Admin & Operations
### Create a database backup
- The server has a built-in backup system (`backup-scripts/`). Use the admin UI or scripts to trigger a backup and configure `BACKUP_STORAGE_PATH`.
- `DOCUMENTATION/DATABASE_BACKUP_GUIDE.md` and `BACKUP_SYSTEM_DEMO.md` explain backup/restore operations.

### Running maintenance & migration scripts
- `SERVER/scripts/` contains scripts for migration and data fixes. Examples:
  - `recalculate-all-proposals.js` — maintenance recalc command
  - `backfill-capitaloutlay-particulars.js` — backfill data

Run scripts from server folder via powershell:
```powershell
Push-Location "d:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER"
node scripts/recalculate-all-proposals.js
Pop-Location
```

- Some scripts have dedicated npm scripts defined in `SERVER/package.json`.

### Backup & Agenda (Scheduled tasks)
- Agenda scheduler is initialized on server start to run periodic tasks.
- The server includes cleanup and backup scheduler utilities. See `SERVER/backup-scripts` and `SERVER/utils/backupPaths.js`.

### Database & Indexes
- The server ensures indexes on collections where necessary (e.g., unique compound index on `uacsCode` + `fiscalYear` + `region`).
- For data integrity, check `SERVER/index.js` and its index creation routines at startup.

### Migration & Seed Data
- `SERVER/scripts` and `SCRIPTS/` include relevant migration & seed tasks. Check `SERVER/MIGRATION_GUIDE.txt` and `DOCUMENTATION` for step-by-step migration procedures.

---

## ⚙️ Production / Deployment (High Level)
1. Build the frontend:
```bash
cd CLIENT
npm run build
```
2. Make sure `VITE_API_BASE_URL` points to production server
3. Deploy server (Node/Express) to a server (e.g., Linux VM, Windows IIS with Node hosting, or containerized with Docker)
4. Configure environment variables in the server environment (secrets, DB URLs, mail configuration, MSSQL)
5. Initialize backup system and configure `BACKUP_STORAGE_PATH`
6. Run DB migration scripts if necessary
7. Configure reverse proxy (Nginx, IIS) to forward traffic to the Express server
8. Monitor logs and use `NODE_OPTIONS` or logging config to enable production diagnostics if needed

For detailed deployment steps and IBM/IIS setup, check `IIS_DEPLOYMENT_GUIDE.md` and `DOCUMENTATION/DEPLOYMENT*` docs.

---

## 🧪 Testing & Verification
- Backend unit tests: `cd SERVER && npm test`
- Backend integration tests: `cd SERVER && npm run test:integration`
- Frontend tests: `cd CLIENT && npm test`
- Run end-to-end or smoke tests from `test-*.js` files in repo root or `test-scripts/` directory
- Use `QUICK_TEST_GUIDE_NOV15.md` and related docs for recommended smoke and integration tests.

---

## 🔍 Troubleshooting & Diagnostics
**When a problem occurs**:
1. Check browser console and Network tab for failed requests
2. Check server logs (console output or container logs) for errors
3. Check MongoDB for inconsistent data in `proposals`, `mooeproposals`, and `notifications` collections
4. Recreate the issue using `ALLOW_MOCK_AUTH` to test with dev credentials if needed

**Common debugging scripts**:
- `check-division-submissions.js` and `check-workflow-status.js` — to validate workflow and data for given proposals
- `check-notification-messages.js` — verify notification messages and links
- `test-scripts` — lots of small tests to validate features

**Known troubleshooting docs**:
- `NOTIFICATION_DEBUG_GUIDE.md` — notification system debugging
- `MOOE_DEBUGGING_GUIDE.md` — MOOE related issues
- `DOCUMENTATION/BACKUP_TROUBLESHOOTING_GUIDE.md` — backup issues

---

## 🛎️ Common Administrative Tasks & Commands
- Recalculate proposal totals: `npm run recalc:proposals` (from repo root)
- Run database migration script: `cd SERVER && node scripts/<script-name>.js`
- Rebuild notifications: see `NOTIFICATION_REBUILD_VERIFICATION.md` and scripts in `SERVER/scripts`
- Rebuild backups: `node SERVER/backup-scripts/initBackupSystem.js` (review docs)

---

## 👨‍⚖️ Roles & Permissions (High Level)
- Budget Preparer: creates drafts and submits proposals
- Budget Reviewer: reviews and returns or approves drafts
- Budget Approver: approves proposals for finalization
- Budget Officer: can act as approver for some workflows
- Budget Manager: monitoring & visibility across regions
- Budget Analyst: generates reports and monitors budgets

For full role descriptions and permissions, see `DOCUMENTATION/WORKFLOW_ROLES_*` and `DOCUMENTATION/HIERARCHICAL_RBAC_*` files.

---

## 📞 Support & Contributing
- To contribute: Fork the repo, create a branch, push changes and open a PR
- Use `CODE_CHANGE` and `FIXES_*` docs for standards used by contributors
- For questions or issues, check the `DOCUMENTATION/` folder first, create an issue if you cannot find a topic

---

## 📚 Where to find more details
- `README.md` — Project summary & quick start
- `DOCUMENTATION/` — Comprehensive features, guides and reference
- `SCRIPTS/` & `SERVER/scripts/` — Data manipulation & maintenance scripts
- `CLIENT/src/pages/` — UI pages & flows
- `SERVER/controllers/` — Backend logic and route handlers

---

## 🎯 Final Notes
- For day-to-day use, `USER_GUIDE_SAVING_DATA.md`, `QUICK_REFERENCE.md`, and `NOTIFICATION_QUICK_START.md` are your best starting points
- Administrators and DevOps should review `DATABASE_BACKUP_GUIDE.md` and `DEPLOYMENT_*` documents for secure deployment and backup procedures
- For role-based access, read `DOCUMENTATION/HIERARCHICAL_RBAC_*` and `DOCUMENTATION/WORKFLOW_*` docs

---

If you'd like, I can also:
- Consolidate and add screenshots and step-by-step UI walkthroughs to this guide.
- Add a `USAGE.md` file in `DOCUMENTATION/` and link it from the top-level README.
- Create a simple script to set recommended `.env` values for local dev (without secrets).

Would you like me to add screenshots and step-by-step workflows next? 👇
