Objective

Refactor my budget proposal submission system that enforces a strict hierarchical workflow for creating, approving, consolidating, and submitting proposals. The system ensures role-based access, visibility restrictions, bulk approval functionality, accurate aggregation, mandatory comments for approval actions, real-time notifications in the Dashboard Header, and tracking of the user who approves or returns proposals. All monetary amounts are in Philippine Pesos (₱).

Roles and Responsibilities


Budget Analyst: Creates and submits division-level proposals to Budget Officer. Receives notifications on approvals/returns, including the user who performed the action.


Budget Coordinator: Creates and submits department-level proposals to Budget Officer. Receives notifications on approvals/returns, including the user who performed the action.


Budget Officer: Reviews and approves/returns proposals from Analysts and Coordinators, with mandatory comments. Consolidates approved proposals into a department-level proposal, submitted to Budget Manager only when all are approved. Supports bulk approvals. Sends/receives notifications, with identity recorded.


Budget Manager (and Budget Admin): Receives consolidated department-level proposals. Can approve, return, or edit proposals, with mandatory comments. Sends/receives notifications, with identity recorded.

Current Issues
Multiple clicks required for approvals instead of bulk approval.
Edited/removed amounts cause records to disappear—records should persist with changes logged.
Division-level proposals visible to Budget Manager before Budget Officer approval.

Division-level transactions not restricted to their level until submission.

Proposals submitted to Budget Manager before full department approval and consolidation.

Desired Workflow


Proposal Creation and Submission:


Budget Analyst submits division-level proposals to Budget Officer.



Budget Coordinator submits department-level proposals to Budget Officer.



Visibility: Division proposals visible only to respective division until submitted.



Notification: Budget Officer notified in Dashboard Header (e.g., "New proposal submitted from [Division/Department] by [User Name]").



Budget Officer Review and Consolidation:





Reviews proposals; approves (bulk/individual), returns with comments, or views details. Comments mandatory for Approve/Return. User performing action recorded.



Status: From "Division Submitted" or "Office" to "Office Verified/Approved".



Consolidates approved proposals into one department-level proposal, submitted to Budget Manager only when all are approved.



Notification: Sender notified (e.g., "Your proposal for [Fiscal Year] has been [Approved/Returned] by [User Name] with comment: [Comment Text]"). Notify upon submission to Budget Manager.



Budget Manager Review:





Receives consolidated department-level proposals. Approves, returns, edits, or views, with mandatory comments and user tracking.



Notification: Budget Manager notified on submission (e.g., "Consolidated proposal from [Office] by [Budget Officer Name]"). Sender/receiver notified on actions.

Hierarchy Summary





Flow: Budget Analyst/Coordinator → Budget Officer → Budget Manager & Admin.



Process: Division (Create) → Department (Approve/Return & Consolidate) → Budget Manager & Admin (Approve/Return/Edit & Final Consolidation).

Visibility and Aggregation Rules





Proposals visible only within their level until submitted upward.



"//AllProposals" page shows aggregated views post-submission.



Group by Responsibility Center (divisions) or Office (departments/regions).



Include totals row for Projected Corporate Income, Projected Subsidy, Proposed Budget.



Statuses: "Division Submitted", "Office Approved", "Office Submitted".



Actions: Role-specific buttons (View, Approve, Return, Submit). Bulk actions for Budget Officer.



Budget Manager cannot see division-level proposals until consolidated.



Track user (name/ID) for Approve/Return, visible in history and notifications.

Example Table Outputs

1. Budget Analyst View (After Submitting Division Proposal)







RESPONSIBILITY CENTER



FISCAL YEAR



BUDGET TYPE



SUBMITTED DATE



PROJECTED CORPORATE INCOME



PROJECTED SUBSIDY



PROPOSED BUDGET



STATUS



ACTIONS





MANAGEMENT INFORMATION DIVISION



2026



Initial



Sep 23, 2025



₱0.00



₱1,000.00



₱1,000.00



DIVISION SUBMITTED



(Action Button List) View





TOTAL















₱0.00



₱1,000.00



₱1,000.00









2. Budget Coordinator View (After Submitting Department Proposal)







OFFICE



FISCAL YEAR



BUDGET TYPE



SUBMITTED DATE



PROJECTED CORPORATE INCOME



PROJECTED SUBSIDY



PROPOSED BUDGET



STATUS



ACTIONS





CORPORATE PLANNING SERVICES



2026



Initial



Sep 22, 2025



₱0.00



₱1,000.00



₱1,500.00



OFFICE



(Action Button List) View





TOTAL















₱0.00



₱1,000.00



₱1,500.00









3. Budget Officer View (Incoming Proposals)







RESPONSIBILITY CENTER



FISCAL YEAR



BUDGET TYPE



SUBMITTED DATE



PROJECTED CORPORATE INCOME



PROJECTED SUBSIDY



PROPOSED BUDGET



STATUS



ACTIONS





MANAGEMENT INFORMATION DIVISION



2026



Initial



Sep 23, 2025



₱0.00



₱1,000.00



₱1,000.00



DIVISION SUBMITTED



(Action Button List) Approve - Return - View





PLANNING & PROGRAMMING DIVISION



2026



Initial



Sep 22, 2025



₱0.00



₱1,000.00



₱1,500.00



DIVISION SUBMITTED



(Action Button List) Approve - Return - View





CORPORATE PLANNING SERVICES



2026



Initial



Sep 22, 2025



₱0.00



₱1,000.00



₱1,500.00



OFFICE



(Action Button List) Approve - Return - View





TOTAL



















₱3,000.00



₱4,000.00









4. Budget Officer View (After Approving All Proposals)







OFFICE



FISCAL YEAR



BUDGET TYPE



SUBMITTED DATE



PROJECTED CORPORATE INCOME



PROJECTED SUBSIDY



PROPOSED BUDGET



STATUS



ACTIONS





CORPORATE PLANNING SERVICES



2026



Initial



Sep 23, 2025



₱0.00



₱3,000.00



₱4,000.00



OFFICE APPROVED



(Action Button List) Submit (to Budget Manager)





TOTAL















₱0.00



₱3,000.00



₱4,000.00









5. Budget Manager/Admin View (Consolidated Proposals)







OFFICE



FISCAL YEAR



BUDGET TYPE



SUBMITTED DATE



PROJECTED CORPORATE INCOME



PROJECTED SUBSIDY



PROPOSED BUDGET



STATUS



ACTIONS





CORPORATE PLANNING SERVICES



2026



Initial



Sep 23, 2025



₱0.00



₱3,000.00



₱4,000.00



OFFICE SUBMITTED



(Action Button List) Approve - Return - View





REGION I



2026



Initial



Sep 24, 2025



₱15,000.00



₱1,000.00



₱1,500.00



OFFICE SUBMITTED



(Action Button List) Approve - Return - View





TOTAL















₱15,000.00



₱4,000.00



₱5,500.00









Implementation Requirements





Enforce role-based access control (RBAC) for visibility and actions.



Support bulk approvals for Budget Officer.



Persist records after edits, with changes in an audit log.



Prevent division-level proposal visibility to Budget Manager until consolidated.



Block submission to Budget Manager until all department proposals are approved.



Mandatory Comments: Require text comment for Approve/Return actions via modal pop-up. Store in proposal history.



User Tracking: Record user (name/ID) for each Approve/Return action. Display in history (e.g., "View Details" modal) and notifications.



Notifications: Real-time alerts in Dashboard Header (e.g., bell icon with unread count). Include action type, proposal info, comment, user name/ID, timestamp. Examples:





To Budget Officer: "New proposal submitted from MANAGEMENT INFORMATION DIVISION by [Analyst Name] on Sep 23, 2025."



To Budget Analyst: "Your proposal for 2026 has been Approved by [Budget Officer Name] with comment: [Comment Text]."



To Budget Manager: "Consolidated proposal submitted from CORPORATE PLANNING SERVICES by [Budget Officer Name] on Sep 23, 2025."



To Budget Officer: "Your proposal has been Returned by [Budget Manager Name] with comment: [Comment Text]."



Use push notifications or in-app alerts.

Notes for Implementation





Use workflows/triggers for status updates, aggregation, comment validation, user tracking, and notifications.



Store actions in history log (Proposal ID, Action, User Name/ID, Comment, Timestamp).



Validate hierarchy, comment requirements, user tracking, and notification delivery.



Test totals, visibility, and notification content across views.