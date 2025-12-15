# Accomplishment Report — December 1 to December 15, 2025

Period: 2025-12-01 — 2025-12-15
Prepared by: Development Team

## Executive summary ✅
Between December 1 and December 15, the team completed a focused set of fixes and enhancements across budgetary support, subsidy calculations, proposal workflows, core UI improvements, and several infra/security hardening tasks. The work prevented double-counting in subsidy calculations, tightened charged-to-income logic, improved the Budgetary Support display and calculations, implemented new features such as Tier Comparison, and applied several UI and UX improvements (app tray, calendar, chat). A sensitive secret (MAIL_PASSWORD) was removed from tracked files and guidance added for secure handling.

## High-level highlights
- Critical fixes to Projected Subsidy calculation and Charged-to-Income handling (multiple commits, Dec 5–6) — prevents double-counting and ensures subsidy reflects correct personnel deductions. ✅
- BudgetarySupport UI & backend enhancements to use backend-calculated projectedSubsidy and show accurate amounts (Dec 6). ✅
- Proposal and Proposal Details fixes and stability improvements (Dec 4–8) — includes editable fields, submit action fixes, duplicate attachment handling, and Create Proposal button state fixes. ✅
- New features: Tier Comparison (Dec 2) and several productivity apps added to comprehensive app tray (Dec 3). ✅
- Client UI fixes: CalendarApp, floating apps accessibility, dark theme issues, dropdown z-index problems (Dec 3). ✅
- MSSQL connection string encryption implemented (Dec 3) — security improvement. ✅
- Removed plaintext `MAIL_PASSWORD` from tracked `.env`, added docs and startup validation (Dec 15). ✅

---

## Detailed list of completed tasks (by date)

### 2025-12-15
- f7dc639 — chore(secrets): remove plaintext MAIL_PASSWORD, add docs and startup validation — Removed plaintext mail password from tracked `.env`, added `SECRETS.md` and startup validations to fail fast when critical mail env vars are missing. (Action: rotate exposed credentials and set in secrets manager / environment.)

### 2025-12-11
- f0690ca — fix: compensation settings compatibility - read from compensationSettingsId — Fix to read linked fiscal years correctly from Compensation settings (management page). ✅

### 2025-12-08
- 3ce9568 — Fix: Clear Create Proposal button state when proposals are deleted from database — UI state cleanup for proposal creation flow.
- 548f9c0 — Commit all pending changes: controllers/routers updates, proposal totals utils, and docs for projected subsidy fixes — Consolidation commit with controller/router and utility updates.
- c0d3cb0 — BudgetarySupport: remove debug banner; IncomeTable: remove banner, add proposal-aware fetch and region normalization; regions: alias mapping for Central Office — UI tidying and data normalization.

### 2025-12-06
- 1e5c40a — Fix projected subsidy fallback in workflow dialog — Ensure workflow dialog shows the correct fallback subsidy.
- 82497a3 — Fix budgetary support subsidy fallback — Fixing fallback behavior for subsidy values.
- f24a556 — Use projectedSubsidy instead of operatingRequirements in BudgetarySupportTable display — Use the correct field to present subsidy numbers.
- 4bf0af1 — Fix BudgetarySupportTable subsidy display: Add endpoint to fetch Proposal totals by workflowRef — Backend endpoint to support Budgetary support UI.
- 8243f9f — FIX: BudgetarySupportTable now uses backend-calculated projectedSubsidy — Ensure display matches authoritative backend calculation.

### 2025-12-05 (Subsidy / Charged-to-Income corrections — multiple commits)
- 086addc — FIX: Use backend-calculated projectedSubsidy in Proposal Details dialog
- 035f7e4 — FIX: Set all Personnel Services subsidy to their Total and deduct charged-to-income subsidy
- 607d347 — FIX: Correct proposed budget formula
- 8522ef4 — FIX: Correct charged-to-income amounts for all 16 casual personnel to full salary
- 103b042 — FIX: Select All + Charge to Income now marks full salary amounts
- 4f06fd3 — FIX: Update all permanent personnel to 100% charged-to-income and recalculate
- cb459bf — FIX: Invalidate personnel-services-combined queries when marking as charged-to-income
- 7323c25 — Add debug logging for charged-to-income amount resolution
- 7a54531 — FIX: Add query cache listener to auto-refetch proposals when personnel marked as charged-to-income
- a04ce65 — CLEANUP: Remove test files
- 7609efc — FIX: Correct charged-to-income calculation - include all PS records and deduct charged amounts from expenses
- 132f3b9 — CLEANUP: Remove temporary test files - fixes have been verified
- dbd0665 — IMPROVE: Better org keys handling - filter out undefined fields and add detailed logging
- d25b66d — FIX: Use org keys for recalculation instead of trying to find proposalId
- 00b733f — Add detailed error logging for recalculation failures
- 878ed2a — Add detailed logging to show charged-to-income personnel and their subsidy amounts
- ff1666c — FIX: Filter chargedToIncomeData by proposalId in BudgetarySupportTable to only show charged-to-income personnel for current proposal
- 9627f03 — FIX: Use chargedToIncomeSubsidyAmount field in BudgetarySupportTable calculation
- 8a6e6b7 — FIX: Correct calculateProjectedSubsidy to use subsidyAmount field and exclude charged-to-income personnel
- 4295b73 — CRITICAL FIX: Exclude charged-to-income personnel from psTotal to prevent double-counting
- 9e8dc7f — Add comprehensive logging to debug subsidy calculation and see individual personnel records
- 512d60c — Add debug logging for subsidy calculation and clarify charged-to-income exclusion logic
- 4f75a71 — Fix Charged-to-Income subsidy deduction: capture subsidyAmount when marking personnel as charged to income so it gets deducted from PROJECTED SUBSIDY

(Collectively these commits fix calculation correctness, UI stale data, caching and add helpful logging for maintenance and future debugging.)

### 2025-12-04
- f23e4de — Fix SUPER_ADMIN role detection and region handling in MOOE: check for both SUPER_ADMIN and SUPER ADMIN formats, improve activeRegion validation
- 47d7c08 — SUPER_ADMIN enhancements: createdBy field population, region filtering, tab visibility, and unlink proposal feature
- 1c167c0 — Update table display to show calculated amounts in real-time
- 55aab82 — Fix Projected Subsidy calculation to include all components
- a573d4f — Fix processBy ID matching and calculateProjectedSubsidy from MOOE data
- 31a37fb — Fix Budget Preparer ownership check by adding ID-based verification
- 0c44643 — Fix Proposal Details dialog issues - editable fields, submit action, and duplicate attachments
- 4edb653 — Fix MOOE data persistence and input disappearance issues

### 2025-12-03
- 7775f18 — Fix dropdown z-index issues in CalendarApp, TodoApp, and ClockApp
- 343932c — Fix CalendarApp dark theme text visibility and add functional month selector
- dc096ae — Enhance all 4 core floating apps with new features
- 1527b10 / ffe0988 — feat: Add comprehensive app tray enhancements - 8 new productivity apps including Notifications, Budget Overview, Quick Actions, Global Search, Timeline, Audit Trail, Performance Metrics, and Notes (one commit was reverted, another reinstated)
- 3d9628d — feat: Implement comprehensive chat auto-open enhancements with DND, mentions, cooldown, focus detection and auto-scroll
- eb490e2 — fix: Update CLIENT package files and components (line ending normalization)
- dd9c49c — feat: Add MSSQL connection string encryption (AES-256-CBC)
- bca78fa — Delete SERVER/.env.test (housekeeping)
- 9a701fe — Delete MSSQL encryption guides (cleanup)

### 2025-12-02
- a9d51bd — Fix: PROJECTED INCOME calculation from actual data instead of initial estimates
- ba02a80 — Add Tier Comparison feature with dynamic filtering - Initial budget type default, regions and fiscal years auto-populate from finalized proposals
- c679407 — Chat app improvements: remove horizontal scrollbar, add emoji picker close button, convert settings to dialog, add user avatar support

---

## Notes / Action items 🔧
- Rotate the exposed Gmail app password (it was removed from tracked `.env` on Dec 15). Ensure new password is stored via environment secrets or a secret manager. See project docs or ask me to add SOPS examples.
- Verify deployment pipelines and staging environments to ensure they have the required environment variables (MAIL_*, DB URIs, JWT secret). The server now fails fast in production when critical mail vars are missing.
- Tests: add regression tests for projected subsidy calculation and for charged-to-income exclusion logic to prevent regressions.

---

If you want, I can:
- Create a PR with this report file and link relevant issues/PRs, or
- Extend the report with links to specific PRs or ticket IDs (if you provide the ticket IDs), or
- Generate a short slide or email version for distribution.

Would you like me to commit this report to the repo and push it? (I can also open a PR.)
