# Budget Coordinator Edit Application Fix

## Problem Description

When a **Budget Coordinator** edits a proposal (e.g., changing Income amount from 1,500,000 to 2,500,000) and submits it to the **Budget Officer**, the changes were NOT being applied to the original documents in the database.

### What Was Happening:

1. Budget Coordinator edits Income amount: `1,500,000` → `2,500,000`
2. Budget Coordinator submits
3. System saves edits to `budgetofficeredits` collection ✅
4. System updates proposal status to "Office Submitted" ✅
5. **BUG**: Original Income document still shows `1,500,000` ❌
6. Budget Officer loads proposal and sees old value `1,500,000` ❌

### Database Evidence:

**Original Income Document (NOT updated):**
```json
{
  "_id": "68ef00b792bce0c84064d2dc",
  "particulars": "Rent Income",
  "amount": 1500000,  // ❌ Should be 2500000
  "status": "Division Submitted",  // ❌ Should be "Office Submitted"
  "workflowLevel": "COORDINATOR"
}
```

**BudgetOfficerEdit Document (correctly stored):**
```json
{
  "_id": "68ef1c0a92bce0c84064f600",
  "proposalId": "68ef00bf92bce0c84064d354",
  "status": "Submitted",
  "editedIncome": [
    {
      "_id": "68ef00b792bce0c84064d2dc",
      "amount": 2500000,  // ✅ Correct edited value
      "changeType": "modified"
    }
  ]
}
```

## Root Cause

The `submitEdit` function in `budgetOfficerEditController.js` was only:
1. Saving edits to `budgetofficeredits` collection
2. Updating the **Proposal** document's status
3. Calling `syncBudgetItemsStatus()` which only updates **status** and **workflowLevel**

**It was NOT applying the actual data changes (amount, category, etc.) to the original Income/PS/MOOE/CO documents.**

## Solution

### 1. Created New Function: `applyEditsToOriginalDocuments`

Added a new helper function in `budgetOfficerEditController.js` that:
- Takes a `BudgetOfficerEdit` document
- Iterates through all edited items (Income, PS, MOOE, CO)
- Updates the original documents with the new values using `findByIdAndUpdate`

```javascript
const applyEditsToOriginalDocuments = async (budgetOfficerEdit) => {
  // Apply Income edits
  for (const edit of budgetOfficerEdit.editedIncome) {
    if (edit._id && edit.changeType === 'modified') {
      await Income.findByIdAndUpdate(edit._id, {
        $set: {
          amount: edit.amount,
          category: edit.category,
          subcategory: edit.subcategory,
          particulars: edit.particulars
        }
      });
    }
  }
  // Similar logic for PS, MOOE, CO...
};
```

### 2. Modified `submitEdit` Function

Updated the workflow to apply edits **BEFORE** updating status:

```javascript
// BEFORE (old code):
await budgetOfficerEdit.save();
proposal.status = 'Office Submitted';
await proposal.save();

// AFTER (fixed code):
await budgetOfficerEdit.save();

// ✅ NEW: Apply edits to original documents
await applyEditsToOriginalDocuments(budgetOfficerEdit);

// Then update status
proposal.status = 'Office Submitted';
await proposal.save();
```

## Benefits

1. **Data Consistency**: Original documents now reflect Budget Coordinator's approved changes
2. **Correct Workflow**: Budget Officer sees the correct, updated values when editing
3. **Audit Trail**: Changes are still logged in `budgetofficeredits` for comparison
4. **Status Sync**: Both data AND status are properly synchronized

## Workflow After Fix

1. **Budget Coordinator** edits Income: `1,500,000` → `2,500,000`
2. **Budget Coordinator** submits
3. System saves to `budgetofficeredits` ✅
4. **NEW**: System applies edits to original Income document ✅
5. Original Income now shows `2,500,000` ✅
6. Proposal status → "Office Submitted" ✅
7. **Budget Officer** loads and sees `2,500,000` ✅

## Files Modified

- `SERVER/controllers/budgetOfficerEditController.js`
  - Added `applyEditsToOriginalDocuments()` function
  - Modified `submitEdit()` to call the new function

## Testing Recommendations

1. Create a test proposal with Income = 1,000,000
2. Budget Analyst submits
3. Budget Coordinator edits to 2,000,000
4. Budget Coordinator submits
5. Verify in MongoDB: Original Income document shows 2,000,000
6. Budget Officer opens proposal
7. Verify in UI: Budget Officer sees 2,000,000

## Notes

- This fix applies to ALL roles using the edit workflow: Budget Coordinator, Budget Officer, and Budget Manager
- The `editorRole` variable correctly identifies which role made the edit
- Error handling ensures that if some edits fail, the workflow still continues
- All edits are logged with proper audit trail in `ProposalEditLog`

## Date Fixed
October 15, 2025
