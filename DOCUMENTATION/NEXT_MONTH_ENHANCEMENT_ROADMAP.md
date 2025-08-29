# One-Month Enhancement Roadmap

This document outlines a prioritized plan for enhancing the system over the next month. It focuses on aligning all routes with Hierarchical RBAC, improving reliability with tests and CI, upgrading the admin UX, and hardening security, performance, and observability.

## Week 1 — RBAC consistency and cleanup

- Unify RBAC middleware
  - Migrate proposalRoutesRBAC.js to use hierarchicalAccessControl/strictHierarchicalControl and requirePermission from hierarchicalAssignmentMiddleware
  - Deprecate usage of UserOrganizationalAssignment in active request paths; use HierarchicalUserAssignment everywhere
- Fix remaining model mismatches
  - Ensure controllers referencing rolePermissions all read from HierarchicalUserAssignment
  - Audit delete/update flows to use isActive soft-delete consistently
- Interceptor cleanup
  - Exclude /api/hierarchical-rbac from automatic ?region= appending
  - Standardize how region/department/division are read from query/body across controllers

Deliverables:
- PR: RBAC route migration to hierarchicalAccessControl + requirePermission
- PR: Consistency fixes + region interceptor exclusions
- Smoke tests verifying permissions work (create/update/delete/approve)

## Week 2 — Tests, CI, and safeguards

- Automated tests
  - Unit tests for hierarchicalAccessControl (create/update/delete permutations, permissions matrix)
  - API tests for hierarchical assignment endpoints (create/update/get/list/delete soft)
  - Ownership tests for proposals
- CI pipeline
  - GitHub Actions: lint, unit tests, API smoke tests on push to main/PR
  - Add coverage thresholds and badge
- Feature flags and migration safety
  - Introduce flag to toggle legacy vs hierarchical RBAC for quick rollback if needed
  - Add seed scripts for local test data for assignments/org structure

Deliverables:
- PR: tests + coverage
- PR: GitHub Actions workflows
- PR: feature flag wiring and seed scripts

## Week 3 — UX improvements and admin tooling

- Hierarchical User Assignment UI
  - Add search and filtering (by level, region, department, division)
  - Bulk actions (e.g., bulk assign to region/department, bulk deactivation)
  - Audit log per assignment (createdBy, lastModifiedBy, changes)
- Guardrails
  - In-form validation tied to server rules (e.g., DIVISION requires region+department+division)
  - Inline explanation tooltips for consolidation rules
- Read-only and approval flows
  - Reflect canApproveProposals, canManageUsers, canManageSettings in UI (hide/disable buttons)
  - Show consolidation preview when creating/updating proposals

Deliverables:
- PR: Enhanced assignment UI (filter/search/bulk)
- PR: UI permission gating across key screens
- PR: Consolidation preview component

## Week 4 — Security, performance, and observability

- Security
  - Harden admin routes with explicit allowlists; ensure rate-limiting on sensitive endpoints
  - Helmet/CORS review; verify auth headers and dev headers removed in prod builds
  - Input validation with a schema validator (e.g., Zod/Joi) for assignment and proposal payloads
- Performance
  - Add DB indexes for frequent queries: HierarchicalUserAssignment(userId, isActive), Proposal(region, department, division, processBy)
  - Add pagination + server-side filtering/versioned list endpoints
- Observability
  - Structured logging for RBAC decisions (userId, level, operation, outcome, target orgs)
  - Basic metrics: counts of allowed/denied operations, latency for RBAC middleware
  - Error dashboards via a lightweight tool (e.g., Sentry) if acceptable

Deliverables:
- PR: input validation + security tweaks
- PR: indexes and pagination on list endpoints
- PR: structured logs + basic metrics

## Cross-cutting improvements

- Documentation
  - Update HIERARCHICAL_RBAC_IMPLEMENTATION.md with examples for requirePermission per route
  - Add “How to debug permission denials” guide (which flags/logs to inspect)
- Data lifecycle
  - Admin page to view soft-deleted assignments and restore
  - Scheduled cleanup job for stale soft-deleted records if required
- Developer experience
  - Environments: sample .env and one-command bootstrapping for local dev
  - Postman/Insomnia collection with RBAC test flows

## Quick wins (can be started immediately)

- Migrate proposalRoutesRBAC.js to hierarchicalAccessControl + requirePermission (Week 1)
- Add region interceptor exclusion for /api/hierarchical-rbac (Week 1)
- Add unit tests for hierarchicalAccessControl permissions (Week 2)

