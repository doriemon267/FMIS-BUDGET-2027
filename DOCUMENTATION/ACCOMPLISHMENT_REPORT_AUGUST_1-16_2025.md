# Accomplishment Report (August 1–16, 2025)

Period: August 1, 2025 — August 16, 2025

## Tasks Completed
• Refactored IncomeCategories and IncomeSubCategories for region-based mapping.
• Refactored the Budgetary Support page to show the full proposal list in the table.
• Budgetary Support UI/UX enhancements and calculation fixes (including MOOE/subsidy/income corrections).
• Implemented RATA separation into RA and TA columns and configured Compensation RATA rates.
• Implemented Budgetary Support refinements and related calculation updates.
• Created base schemas for Division, Department, and Region (schema/models ready; UI/backend integration pending).
• Fixed critical business logic issues in the Income Table and applied initialization fixes.
• Implemented real-time data fetching with React Query.
• Added data validation rules to improve input accuracy and completeness.
• Generated customizable reports and analytics (initial implementation).
• System performance optimizations and reliability improvements.
• Income Management UI/UX improvements and cleanup tasks.
• Region Isolation fix implemented.
• MOOE input persistence bug resolved.
• PDF export quality enhancements finalized.
• Proposal page enhancements completed.
• Backup system demo conducted for stakeholders.
• Court Appearance Access fix deployed.
• Enhanced error handling and validation across modules.
• Updated documentation for new features and fixes.
• Conducted user feedback sessions to guide UI/UX improvements.
• Implemented additional security measures for handling sensitive data.
• Held meeting with the Budget Department team (July 29, 2025).

## Highlights
- Completed multiple refactors that improve region-based mapping for incomes and stabilize budgetary support views.
- Implemented React Query for reliable, real-time data fetching and caching across the UI.
- Resolved key bugs (MOOE persistence, income initialization, business logic) that directly improve calculation accuracy and user workflows.
- Finalized PDF export quality improvements and completed a backup system demo to stakeholders.

## Planned System Enhancements – Online Submission of Budget Proposal Information System
• Finalize requirements and design portal
• Set up authentication and user roles
• Implement status tracking features
• Integrate notification and reminder system
• Design wireframes and UI mockups for entry and review
• Test and implement data validation and error handling
• Develop reporting and analytics modules
• Review and apply privacy/security standards
• Build collaboration and approval workflow features
• Implement audit trail and logging

### Meeting action items (not yet completed)
The following items were recommended during the meeting and remain pending work; include these in the online submission roadmap and prioritize accordingly:

- Integrate Division / Department / Region bases into UI and backend flows (schema created; implementation pending).
- Proposal Budget UI/UX and rules:
	- Remove subcategories and "Miscellaneous Others" from proposal entry.
	- Remove Water Service Fee and Lease Property entries where applicable.
	- Set default discount values and remove the global "Add item" action (clarifications handled via Budget team workflow).
	- Backend bug fix to allow adding new categories safely.
- User Region Assignments and permissions:
	- Limit access by assigned region; provide regional admin accounts and define EMU vs Regional user behavior.
	- If EMU cannot submit, allow historical data submission as fallback.
	- Standardize roles (Admin, Analyst, Manager) and finalize MAAM Maan ADMIN assignment.
- Capital Outlay improvements:
	- Add detailed, itemized breakdowns with annex support per IMU.
	- Support sub-items, descriptions, grouping, and an itemized column with encoding.
	- Auto-assign capital outlay category and enforce intangible threshold (50,000) rules.
- Budgetary Support & calculations:
	- Apply remaining calculation fixes so MOOE, subsidy and income are correctly included in totals.
	- Rename "Budgetary Support" to "Budget Support Government Corporation (BSGC)" and restrict editing to Central Office.
	- Plan to add NEP and GAA integrations later.
- Corporate Income Analysis & exports:
	- Reorder Corporate Income Analysis output for clarity and maintain versioning until final approval.
	- Export to Excel (preferred) and remove peso sign from exported amounts.
- Contractual Services / MOOE handling:
	- Remove deprecated contractual entries and replace generic MOOE items with named entries.
	- Adjust textboxes to display full amounts and review PhilHealth/COS/JO deductions handling.
- MARIIS / Plantilla / HR workflows:
- MARIIS / Plantilla / HR workflows:
	- Add HR accounts for Plantilla budgeting and ensure authorized plantilla positions are available for encoding and budgeting purposes.
	- Ensure plantilla position details are precise and available to budgeting modules (authorized positions, salary grades, appointment status).
	- Coordinate with HR to provision accounts and access for PS encoding; leave encoding open for authorized HR users.

Prioritize these items against the online submission MVP and assign owners and target dates before the next meeting (Aug 26, 2025).

## Notes and Next Steps
- Continue development of the online submission portal; prioritize authentication, role-based access, and data validation.
- Schedule follow-up sessions with the Budget Department to demo the online submission prototype and collect feedback.
- Prepare release notes and update the project documentation to reflect the recent fixes and enhancements.

Prepared by: Development Team
Date created: August 18, 2025

## Additional requirements & meeting notes (Reymund)

The following notes were captured from Reymund and the workflow discussion (May). They have been translated to English for clarity and planning.

- Workflow not mentioned during the May discussion
- Initial proposal: NET followed by UAA
- Set the cut-off for GAA and NET
- When the cut-off is reached, define how to set up the submission cut-off process (for NET and GAA)
- Compensation settings: RATA configuration and its rate
- Separate RATA into RA and TA as two columns in the system
- There is RATA for SG 23 Division Manager B
- Machinery and Equipment: remove these from Capital Outlay Acquisition
- Ask Budget to clarify Capital Outlay items; re-categorize Capital Outlay entries as needed

- Income Management:
	- Determine whether items are region-wide or specific to a single region
	- Clean up and standardize Income Management particulars
	- Other: remove the Balingasag entry; request re-inclusion if needed

- User Region Assignments:
	- Limit user access based on assigned region
	- Define EMU and Regional user roles per region
	- If EMU cannot submit, use historical data only
	- Provide regional offices with admin accounts so they can perform admin tasks
	- Regional offices will submit on behalf of satellite offices where applicable
	- Remove Budget Coordinator role at Central Office; use Analysts who can handle both regional and central tasks
	- Set MAAM Maan as ADMIN (user role assignment)
	- Standardize user roles as: Admin, Analyst, and Manager with consistent privileges

- Create Proposal Budget:
	- Remove subcategories
	- Set a default discount value
	- Remove the "Add item" action everywhere; if clarification is needed, contact Budget directly
	- Remove "Miscellaneous Others" from subcategories
	- Remove Water Service Fee
	- Allow regions to request additions/removals for "Other" items as needed
	- Edit and remove "Lease Property" from Lease Property and Drainage Fee entries
	- Remove Lab Analysis
	- Backend fix required to allow adding new categories

- MARIIS and Plantilla positions:
	- MARIIS showed the permanent positions
	- Add authorized plantilla positions for budgeting; ensure precise plantilla information
	- HR will have accounts for Plantilla position budgeting; PS will be assigned to them, encoding remains open

- RA 1616:
	- Under RA 1616 there is no retirement claim; adjust calculations accordingly
	- Standardize lists and numeric values

- Contractual Services and Job Orders:
	- Remove "Contractual Services Additional Development Personnel"
	- Replace generic MOOE with named items
	- Enlarge the textbox to show full amounts for Other MOOE entries
	- COS and JO have PhilHealth deductions — verify handling
	- Charge gratuity and premium to savings in Excel and do not include in the system
	- Review PhilHealth handling and deductions

- Capital Outlay:
	- Include detailed breakdowns for Capital Outlay items
	- Each IMU's Capital Outlay Proposal should display itemized details
	- Items must be itemized; create an annex for Capital Outlay breakdowns so items are visible
	- Grouping is allowed but remain open for encoding
	- Require detailed descriptions for capital outlay items
	- Add sub-items so users can enumerate components (open for encoding)
	- Use an itemized column and allow sub-item encoding
	- Automatically assign category for capital outlay (users should not manually add category)
	- Allow intangible items with open encoding and set capital outlay threshold to 50,000

- Budgetary Support / Budget calculations:
	- Budgetary support budget is correct
	- MOOE budget summary was incorrect: it should include subsidy and income; current result only included subsidy causing totals to be zero in uses
	- Review total budget calculations (subsidy and budget components)
	- Ensure bottom columns include income and budgetary support totals in the incorporated income
	- Total sources of funds should sum to zero
	- Rename the "Total sources of funds" label to a clearer name
	- Rename "Budgetary Support" to "Budget Support Government Corporation (BSGC)"
	- Editing should be restricted to Central Office (CO), not Region
	- NEP and GAA will be added later

- Corporate Income Analysis and Exports:
	- Reorder items in Corporate Income Analysis for clarity
	- Remove the explicit "Total" column; show the central regional value only
	- Keep the original submitted version intact; duplicates should be routed to the region
	- Maintain versioning until approval; budget division will mark the final version
	- PS column is for income subsidy and totals
	- Use Excel for exports instead of PDF
	- Remove the peso sign from amounts in exports

- Roles and scheduling:
	- Standardize and fix all assigned roles across the system
	- Next meeting: August 26, 2025 (Tuesday) — time: TBD

### Progress update (from developer)

- Complete: RATA changes and Budgetary Support refinements were implemented.
- In progress / pending: Division, Department, and Region base structures have been created (schema/model ready) but are not yet fully implemented in UI or backend flows.

