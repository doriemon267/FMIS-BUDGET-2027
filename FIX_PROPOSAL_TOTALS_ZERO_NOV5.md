# FIX: Proposal Totals Showing ₱0.00 After Submit
**Date:** November 5, 2025  
**Issue:** After BUDGET PREPARER submits proposal to BUDGET REVIEWER, dashboard totals show ₱0.00  
**Root Cause:** Line items not linked to proposals via `proposalId` field

---

## Problem Analysis

### Symptoms
- Status correctly changes to "Forwarded to Reviewer"
- Line items exist with correct amounts (₱6M income, ₱8.4M personnel, ₱5M MOOE, ₱10M capital)
- Dashboard shows ₱0.00 for all totals
- Server logs show recalculation returns all zeros:
  ```
  📊 Recalculated proposal totals after edits: {
    proposalId: new ObjectId('690b067cdbec7013008163ad'),
    income: 0,
    personnelServices: 0,
    mooe: 0,
    capitalOutlay: 0
  }
  ```

### Root Cause
All line item models (Income, PersonnelServices, MOOE, CapitalOutlay) have `proposalId` field defined in schema, but:

1. **syncRelatedBudgetItems()** - Updates line items by organizational keys (region, department, division) but doesn't set `proposalId`
2. **Modification logic** - When editing existing line items, `proposalId` was not included in update operations
3. **Recalculation** - `recalculateProposalTotals.js` searches by `proposalId` but finds no matches → returns 0

---

## Solution Implemented

### 1. Fixed `syncRelatedBudgetItems()` Function
**File:** `SERVER/controllers/budgetOfficerEditController.js` (Lines 559-587)

**Change:**
```javascript
// BEFORE: Only updated status and workflowLevel
await Promise.all([
  Income.updateMany(criteria, { $set: { status: mappedStatus, workflowLevel: mappedWorkflowLevel } }),
  PersonnelServices.updateMany(criteria, { $set: { status: mappedStatus, workflowLevel: mappedWorkflowLevel } }),
  MOOE.updateMany(criteria, { $set: { status: mappedStatus, workflowLevel: mappedWorkflowLevel } }),
  CapitalOutlay.updateMany(criteria, { $set: { status: mappedStatus, workflowLevel: mappedWorkflowLevel } })
]);

// AFTER: Also sets proposalId to link items to proposal
const updateFields = { 
  status: mappedStatus, 
  workflowLevel: mappedWorkflowLevel,
  proposalId: proposal._id  // CRITICAL FIX: Link line items to this proposal
};

await Promise.all([
  Income.updateMany(criteria, { $set: updateFields }),
  PersonnelServices.updateMany(criteria, { $set: updateFields }),
  MOOE.updateMany(criteria, { $set: updateFields }),
  CapitalOutlay.updateMany(criteria, { $set: updateFields })
]);
```

**Impact:** When a proposal status changes (e.g., Draft → Forwarded to Reviewer), all related line items are now linked to the proposal via `proposalId`.

---

### 2. Fixed Income Modification Logic
**File:** `SERVER/controllers/budgetOfficerEditController.js` (Lines 247-260)

**Change:**
```javascript
// BEFORE: updateData didn't include proposalId
const updateData = {};
if (edit.amount !== undefined) updateData.amount = Number(edit.amount);
if (edit.amount !== undefined) updateData.cost = Number(edit.amount);
if (edit.category !== undefined) updateData.category = edit.category;
if (edit.subcategory !== undefined) updateData.subcategory = edit.subcategory;
if (edit.particulars !== undefined) updateData.particulars = edit.particulars;

// AFTER: proposalId included in update
const updateData = {};
if (edit.amount !== undefined) updateData.amount = Number(edit.amount);
if (edit.amount !== undefined) updateData.cost = Number(edit.amount);
if (edit.category !== undefined) updateData.category = edit.category;
if (edit.subcategory !== undefined) updateData.subcategory = edit.subcategory;
if (edit.particulars !== undefined) updateData.particulars = edit.particulars;
updateData.proposalId = budgetOfficerEdit.proposalId;  // Ensure proposalId is set
```

---

### 3. Fixed PersonnelServices Modification Logic
**File:** `SERVER/controllers/budgetOfficerEditController.js` (Lines 304-317)

**Change:** Same pattern - added `updateData.proposalId = budgetOfficerEdit.proposalId;`

---

### 4. Fixed MOOE Modification Logic
**File:** `SERVER/controllers/budgetOfficerEditController.js` (Lines 358-371)

**Change:** Same pattern - added `updateData.proposalId = budgetOfficerEdit.proposalId;`

---

### 5. Fixed CapitalOutlay Modification Logic
**File:** `SERVER/controllers/budgetOfficerEditController.js` (Lines 420-437)

**Change:** Same pattern - added `updateData.proposalId = budgetOfficerEdit.proposalId;`

---

## Verification Checklist

✅ **Schema Check:** All models have `proposalId` field defined
- ✅ Income.js (Line 115)
- ✅ PersonnelServices.js (Line 254)
- ✅ mooeProposals.js (Line 81)
- ✅ CapitalOutlay.js (Line 49)

✅ **Creation Logic:** New items set proposalId
- ✅ budgetOfficerEditController.js (lines 226, 282, 336, 397)
- ✅ IncomeController.js (Line 58)
- ✅ capitalOutlayController.js (Line 217)

✅ **Modification Logic:** Existing items updated with proposalId
- ✅ Income updates (Line 254)
- ✅ PersonnelServices updates (Line 310)
- ✅ MOOE updates (Line 364)
- ✅ CapitalOutlay updates (Line 436)

✅ **Sync Logic:** Status changes also set proposalId
- ✅ syncRelatedBudgetItems (Lines 573-576)

---

## Expected Results After Fix

### When BUDGET PREPARER submits proposal:
1. ✅ Status changes to "Forwarded to Reviewer"
2. ✅ All line items get `proposalId` set to proposal._id
3. ✅ `recalculateProposalTotals()` searches by proposalId and finds line items
4. ✅ Dashboard shows correct totals:
   - Projected Corporate Income: ₱6,000,000.00
   - Projected Subsidy: ₱13,400,000.00
   - Proposed Budget: ₱19,400,000.00

### Server logs should show:
```
✅ Synced budget items to proposal 690b067cdbec7013008163ad: {
  status: 'Forwarded to Reviewer',
  workflowLevel: 'DIVISION',
  itemsLinked: 'proposalId set'
}

📊 Recalculated proposal totals after edits: {
  proposalId: new ObjectId('690b067cdbec7013008163ad'),
  income: 6000000,
  personnelServices: 8400000,
  mooe: 5000000,
  capitalOutlay: 10000000
}
```

---

## Testing Steps

1. **Login as BUDGET PREPARER** (Frances Joshua Demafelez)
2. **Create new proposal** with line items:
   - Add Income items (target ₱6M)
   - Add Personnel items (target ₱8.4M)
   - Add MOOE items (target ₱5M)
   - Add Capital Outlay items (target ₱10M)
3. **Submit to BUDGET REVIEWER**
4. **Verify dashboard totals** show correct amounts (not ₱0.00)
5. **Check server logs** for successful sync and recalculation messages

---

## Technical Notes

### Why proposalId is Critical
- **Referential Integrity:** Links line items to their parent proposal
- **Data Isolation:** Prevents cross-proposal data mixing
- **Accurate Totals:** Allows recalculation to find only relevant line items
- **Multi-Proposal Support:** Multiple proposals can exist with same org keys (region, department, division)

### Fallback Mechanism
The recalculation logic in `recalculateProposalTotals.js` already has fallback:
- **If proposalId provided:** Search ONLY by proposalId (strict mode)
- **If proposalId NOT provided:** Fall back to organizational keys (legacy support)

With this fix, all modern workflow submissions will use proposalId mode, ensuring accurate totals.

---

## Files Modified

1. `SERVER/controllers/budgetOfficerEditController.js`
   - syncRelatedBudgetItems() - Added proposalId to updateFields
   - Income modification logic - Added proposalId to updateData
   - PersonnelServices modification logic - Added proposalId to updateData
   - MOOE modification logic - Added proposalId to updateData
   - CapitalOutlay modification logic - Added proposalId to updateData

**Total Changes:** 5 locations in 1 file

---

## Related Issues Fixed Previously

This fix completes the proposal totals calculation chain:
1. ✅ **Oct 28:** Fixed dashboard to use backend summary (not manual calculation)
2. ✅ **Oct 30:** Added recalculation to saveDraftEdit function
3. ✅ **Nov 4:** Fixed workflow stepper status mappings
4. ✅ **Nov 5:** **THIS FIX** - Ensured line items linked to proposals via proposalId

---

## Deployment Notes

**No database migration required** - proposalId field already exists in all schemas.

**Backward compatibility:** 
- Existing line items without proposalId will be updated when their proposal status changes
- Legacy fallback to organizational keys still works for old data

**Server restart required:** Yes - to load updated controller code

---

**Status:** ✅ READY FOR TESTING  
**Next Step:** Restart server and test full PREPARER → REVIEWER workflow
