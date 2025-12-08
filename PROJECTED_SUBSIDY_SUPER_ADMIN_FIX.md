# Projected Subsidy Fix - Super Admin Visibility

## Issue
The "Projected Subsidy" in the Proposal Details dialog was displaying as ₱0.00 for Super Admin users when viewing proposals created by others.

## Root Cause
The backend API endpoints for MOOE and Capital Outlay (`/mooe/getByParams` and `/capital-outlay/getByParams`) contained logic that restricted Super Admins to seeing **only records they created themselves**.
```javascript
// OLD LOGIC
if (isSuperAdmin && userIdString) {
  mooe = mooe.filter(m => m.createdBy === userIdString);
}
```
This caused the frontend to receive empty arrays for MOOE and Capital Outlay when viewing another user's proposal, resulting in a sum of 0.

## Fix Applied
Removed the restrictive filtering for Super Admins in:
1. `SERVER/controllers/mooeController.js` (`getMOOEByParams`)
2. `SERVER/routers/capitalOutlayRouter.js` (`/capital-outlay/getByParams`)

Super Admins (and Budget Managers) will now receive all records associated with the proposal, allowing the frontend to calculate the correct subsidy total.

## Verification
1. Log in as Super Admin.
2. Open a proposal created by another user.
3. The "Projected Subsidy" should now display the correct calculated value.
