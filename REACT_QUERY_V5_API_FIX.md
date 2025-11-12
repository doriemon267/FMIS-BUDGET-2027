# React Query useMutation API Fix - November 12, 2025

## Problem
Frontend error in `ProposalCustomPage.jsx` line 148:
```
Uncaught TypeError: __privateGet(...).defaultMutationOptions is not a function
```

This error occurs because the code was using the old React Query v4 API syntax with the newer v5 API.

## Root Cause
The `useMutation` hook in `ProposalCustomPage.jsx` was using the old two-argument syntax:
```javascript
// ❌ OLD v4 SYNTAX (deprecated in v5)
useMutation(
  (newProposal) => api.post("/api/proposals", newProposal),
  {
    onSuccess: () => { ... },
    onError: () => { ... }
  }
)
```

React Query v5+ changed the API to use an object-first syntax:
```javascript
// ✅ NEW v5 SYNTAX
useMutation({
  mutationFn: (newProposal) => api.post("/api/proposals", newProposal),
  onSuccess: () => { ... },
  onError: () => { ... }
})
```

## Solution Applied

### File: `CLIENT/src/components/proposals/ProposalCustomPage.jsx` (Lines 148-167)

**Changed:**
```javascript
// OLD (incorrect for v5)
useMutation(
  (newProposal) => { return api.post("/api/proposals", newProposal); },
  {
    onSuccess: () => { ... },
    onError: () => { ... }
  }
)

// NEW (correct for v5)
useMutation({
  mutationFn: (newProposal) => {
    return api.post("/api/proposals", newProposal);
  },
  onSuccess: () => { ... },
  onError: () => { ... }
})
```

### Additional Changes:
1. Changed `useMutation` to object-first syntax
2. Wrapped mutation function in `mutationFn` property
3. Updated `queryClient.invalidateQueries("proposals")` to `queryClient.invalidateQueries({ queryKey: ["proposals"] })`

## Status
✅ **FIXED** - Frontend now uses correct React Query v5 API syntax

## Next Steps
1. ✅ Frontend error should now be resolved
2. The budget calculation backend logic is ready (deployed in `proposalController.js`)
3. Restart backend server to load updated code
4. Test creating a new proposal - should now calculate PROPOSED BUDGET correctly

## Files Modified
- `CLIENT/src/components/proposals/ProposalCustomPage.jsx` - Updated useMutation API call to v5 syntax
