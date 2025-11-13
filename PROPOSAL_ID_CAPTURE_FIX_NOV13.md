# ProposalId Capture and Linking Fix - November 13, 2025

## Issue Summary
When users created income entries on the `/proposal` page, the `proposalId` field was not being saved to the Income document. This prevented income data from being properly linked to specific proposals.

## Root Cause Analysis
The `/proposal` page uses placeholder `dataListName="tests"` from the Proposals.jsx component, which was:
1. Being passed as `proposalId="tests"` to IncomeTable
2. Filtered out in the conditional check to prevent saving "tests" as proposalId
3. Resulting in `proposalId=undefined` when creating new income entries
4. The actual proposal ID created in the dialog was never captured

## Solution Implemented

### 1. ProposalCustomPage.jsx - State Addition
**Location:** Lines 154 (added with existing state declarations)
```javascript
const [currentProposalId, setCurrentProposalId] = useState(null);
```

### 2. ProposalCustomPage.jsx - Capture Proposal ID on Creation
**Location:** Lines 170-183 (createProposalMutation.onSuccess handler)
```javascript
onSuccess: (response) => {
  queryClient.invalidateQueries({ queryKey: ["proposals"] });
  // Capture the created proposal ID
  const proposalId = response.data?._id || response.data?.id;
  setCurrentProposalId(proposalId);  // ← NEW: Store the proposal ID
  toast.success("Proposal created successfully!");
  setCreateDialogOpen(false);
  // ... reset form data
}
```

### 3. ProposalCustomPage.jsx - Pass Captured ID to IncomeTable
**Location:** Line 3015 (IncomeTable prop)

**Before:**
```javascript
proposalId={dataListName !== "tests" ? dataListName : undefined}
```

**After:**
```javascript
proposalId={currentProposalId || (dataListName !== "tests" ? dataListName : undefined)}
```

This ensures:
- When a new proposal is created, `currentProposalId` is set and passed to IncomeTable
- Income entries created after proposal creation will save with the actual proposalId
- Fallback to checking dataListName for when editing existing proposals

### 4. App.jsx - Restored Original Route
**Location:** Lines 1, 71 (Route configuration)
- Removed `Navigate` import (no longer needed)
- Restored original `/proposal` route to use `<Proposals />` component
- Reason: User needs `/proposal` page to remain functional for creating proposals and income

## Flow After Fix

### Creating New Proposal and Income:
1. User navigates to `/proposal` page
2. Clicks "Create Proposal" → Dialog opens
3. Fills in proposal details and submits
4. Backend creates Proposal document with `_id` → API returns response
5. **NEW:** `createProposalMutation.onSuccess` captures `proposalId` from response
6. **NEW:** `setCurrentProposalId(proposalId)` stores ID in state
7. Income table receives: `proposalId={currentProposalId}` (actual proposal ID)
8. User adds income entries
9. Income saves with `proposalId` field properly linked ✅

### Fetching Income Data:
1. ProposalDetailsPage queries: `/income/getByParams?proposalId=<actualId>`
2. Backend filters by proposalId (primary filter)
3. Income data displays correctly in proposal details ✅

## Testing Checklist

- [x] Build successful (13,616 modules, 0 errors)
- [x] Code compiles without errors
- [x] Git commit created: `4cb9c7e`
- [x] Changes pushed to GitHub

### Manual Testing Required:
1. Navigate to `/proposal` page
2. Create a new proposal through the dialog
3. After dialog closes, add an income entry
4. Check MongoDB: Verify `proposalId` field is saved on Income document
5. Navigate to ProposalDetailsPage for that proposal
6. Verify income entries display correctly in details view

## Files Modified
1. `CLIENT/src/components/proposals/ProposalCustomPage.jsx`
   - Added currentProposalId state
   - Updated createProposalMutation.onSuccess to capture proposal ID
   - Updated IncomeTable proposalId prop to use captured ID

2. `CLIENT/src/App.jsx`
   - Removed Navigate import
   - Restored original /proposal route (reverted redirect)

## Dependencies
- Backend: IncomeController.getIncomeByParams already supports proposalId filtering
- Models: Income model updated to accept proposalId (Mixed type)
- Models: HierarchicalUserAssignment enum extended to support both role formats

## Impact Assessment
- **Scope:** Income creation flow on /proposal page
- **Risk:** Low (minimal changes, only state management)
- **Backward Compatibility:** Yes (fallback to dataListName if currentProposalId not set)
- **Performance:** No impact
- **Database Migration:** No (new field only, optional)

## Related Commits
- `0a4981f` - Fixed Income model validation (proposalId Mixed type)
- `8d729de` - Extended HierarchicalUserAssignment enum
- `4e40843` - Filtered out "tests" placeholder from saves
- `1b69b97` - Updated ProposalDetailsPage to use proposalId in queries
- `4a442d9` - Documented income display fix
- `4cb9c7e` - THIS COMMIT: Capture and pass proposal ID in ProposalCustomPage

## Next Steps
1. Test end-to-end proposal creation → income entry → data retrieval
2. Monitor for any issues with proposalId linking
3. Extend same pattern to Personnel, MOOE, Capital Outlay if needed
4. Document final end-to-end workflow in user guides
