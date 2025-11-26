# Specific Work to be Done — December 2025 Weekends

This document lists the "Specific Work to be Done" scheduled every Saturday and Sunday in December 2025. Use the `SERVER/scripts/create-weekend-notifs-dec-2025.js` script (optional) to insert these as notifications in the DB.

## Dates (Saturdays and Sundays)
- Saturday, 06 December 2025
- Sunday, 07 December 2025
- Saturday, 13 December 2025
- Sunday, 14 December 2025
- Saturday, 20 December 2025
- Sunday, 21 December 2025
- Saturday, 27 December 2025
- Sunday, 28 December 2025


## Weekend Tasks (Per Date)
Below is the per-weekend table (same format as your November schedule). I have kept the Remarks column empty as requested.

Date | Regular Tasks | Specific Work to be Done | Remark/s
:---|:---|:---|:---
Saturday, 06 December 2025 | Weekend | Consolidation & Hierarchy Verification — verify BM cannot see division proposals; run role-based UI/API checks, validate DB filter and audit entries | 
Sunday, 07 December 2025 | Weekend | Consolidation Logic Validation — validate aggregation logic and expected totals; run sample cases and performance checks | 
Saturday, 13 December 2025 | Weekend | Submission Block Enforcement Tests — confirm BO → BM blocking behavior using mixed-status proposals and validate messaging | 
Sunday, 14 December 2025 | Weekend | Audit & Telemetry Check — validate audit trail entries for blocked submissions and visibility violations; check logs and telemetry data | 
Saturday, 20 December 2025 | Weekend | Data Cleanup & Backfill — run backfill scripts for inconsistent consolidated records, verify DB integrity | 
Sunday, 21 December 2025 | Weekend | Documentation & Release Notes — update BRD and release notes; prepare support guidance for BM/BO role differences | 
Saturday, 27 December 2025 | Weekend | Performance & Bulk Operation Tests — load test consolidations and large dataset behavior; check query timings and caching strategy | 
Sunday, 28 December 2025 | Weekend | Final Wrap-up & Handover — compile verification summary, test results and follow-up items for January | 

## Usage
- To import into your calendar, use the ICS file at: `CALENDARS/weekend-work-dec-2025.ics`.
- To insert Notification documents into the DB (dry-run by default), run:

  NODE_ENV=production node SERVER/scripts/create-weekend-notifs-dec-2025.js --role=BUDGET_MANAGER --message="Please complete FMIS review tasks" --title="Weekend Work" --dry-run

- To actually insert notifications set `--dry-run=false` and optionally `--insert-as-created` (which sets `createdAt` to scheduled date, otherwise the script uses current time).

## Notes
- This is intended to be a template. Adjust recipients, titles, messages, and task details to match your team's workflow.
- If you want these notifications to appear only on the scheduled date, check whether your application checks `metadata.scheduledAt`. If not, use `--insert-as-created` to set `createdAt` to the scheduled date for long-term or historical purposes.
- If you prefer exporting recurring rules (RRULE) rather than explicit dates, modify or use an ICS generator to add RRULE entries that cover December 2025 weekend dates only.
