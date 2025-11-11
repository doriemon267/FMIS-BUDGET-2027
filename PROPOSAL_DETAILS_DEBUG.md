# ProposalDetailsWithTables - Debugging Guide

## Issue: "No Data Found" on All Tabs

If the Details dialog shows "No data found" on all tabs (Personnel Services, MOOE, Capital Outlay, Income), follow these steps:

### Step 1: Check Browser Console
1. Open browser (Press `F12`)
2. Go to **Console** tab
3. Look for messages like:
   - `📍 Fetching Personnel Services for proposalId: 65abc123...`
   - `✅ Personnel Services response: [...]`
   - `❌ Error fetching personnel services: ...`

### Step 2: Possible Causes

#### **Cause 1: Budget Data Not Created**
The proposal exists, but no budget line items have been entered yet.

**Solution**: 
- Go back to "All Proposals" page
- Click the proposal title to edit it
- Fill in Personnel Services, MOOE, Capital Outlay, or Income data
- Save/Submit the proposal
- Then try viewing details again

#### **Cause 2: Data Not Linked to Proposal**
Budget data exists but doesn't have the `proposalId` field set properly.

**Solution** (For Admins):
```javascript
// In MongoDB console:
db.personnelservices.updateMany(
  { proposalId: { $exists: false } },
  { $set: { proposalId: ObjectId("65abc123...") } }
)
```

#### **Cause 3: API Returns Error 401/403**
- Check Network tab (Press F12 → Network)
- Look for failed API calls to `/api/personnel/getByParams`, `/mooe/getByParams`, etc.
- If you see 401/403 errors: User may not be authenticated

**Solution**:
- Log out and log back in
- Clear browser cookies/cache
- Make sure user has correct role permissions

#### **Cause 4: API Returns Empty Array**
- Console shows: `✅ Personnel Services response: []`
- This means the API call succeeded, but no matching records found

**Solutions**:
- Verify budget data exists: Go to Personnel Services, MOOE, etc. pages directly
- Check if fiscal year matches between proposal and budget data
- Check if region/department matches

### Step 3: Testing API Directly

Open browser console and run:

```javascript
// Test Personnel Services API
fetch('/api/personnel/getByParams?proposalId=PASTE_PROPOSAL_ID_HERE')
  .then(r => r.json())
  .then(d => console.log('Personnel:', d))

// Test MOOE API
fetch('/mooe/getByParams?proposalId=PASTE_PROPOSAL_ID_HERE')
  .then(r => r.json())
  .then(d => console.log('MOOE:', d))

// Test Capital Outlay API
fetch('/capital-outlay/getByParams?proposalId=PASTE_PROPOSAL_ID_HERE')
  .then(r => r.json())
  .then(d => console.log('Capital Outlay:', d))

// Test Income API
fetch('/income/getByParams?proposalId=PASTE_PROPOSAL_ID_HERE')
  .then(r => r.json())
  .then(d => console.log('Income:', d))
```

### Step 4: ProposalId Value

**Important**: The ProposalId must be the **MongoDB ObjectId** of the proposal, not a string ID.

- ✅ Correct: `65abc123def456789xyz1234`
- ❌ Wrong: `"proposal-123"` or `123`

The component displays the proposalId in the alert message for debugging.

---

## Quick Checklist

- [ ] Budget data exists in Personnel Services, MOOE, Capital Outlay, or Income pages
- [ ] Budget data shows same fiscal year as proposal
- [ ] Budget data shows same region/department as proposal
- [ ] Proposal is in "Forwarded to Reviewer" status or later (not Draft)
- [ ] User is logged in and authenticated
- [ ] Browser console shows API responses (not errors)
- [ ] ProposalId matches between proposal and budget records

---

## API Endpoints Used

| Component | Endpoint | Route File |
|-----------|----------|-----------|
| Personnel Services | `/api/personnel/getByParams` | `personnelServicesRoutes.js` |
| MOOE | `/mooe/getByParams` | `mooeRoutes.js` |
| Capital Outlay | `/capital-outlay/getByParams` | `capitalOutlayRouter.js` |
| Income | `/income/getByParams` | `incomeRoutes.js` |

All endpoints require:
- `proposalId` query parameter
- Valid JWT token in Authorization header
- User with appropriate role permissions
