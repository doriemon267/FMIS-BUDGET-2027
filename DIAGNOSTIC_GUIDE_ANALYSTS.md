# DIAGNOSTIC GUIDE - No Analysts Found Issue

**Issue:** Found 0 analysts for submit-to-analyst  
**Status:** Enhanced logging added to diagnose root cause  
**Next Step:** Restart server and test to see diagnostic output

---

## Current Problem

When BUDGET APPROVER submits to analyst:
```
[getNotificationRecipients] Found 0 analysts for submit-to-analyst
[PERFORM_ACTION] Recipients found: 0 IDs: []
```

The query is running **without errors** (casting error is fixed!) but **finding 0 recipients**.

---

## Possible Root Causes

### 1. No users with "BUDGET PLANNING ANALYST" role in the system
- Users exist but don't have the role assigned
- Or they have a different role name

### 2. Role field is in a different location
- Might be in a subdocument or array with different name
- Could be in a different collection

### 3. Region field mismatch
- Users don't have Region field
- Or Region is stored in a different format

### 4. User schema structure different than expected
- Field names might be different (case-sensitive)
- Structure might be nested

---

## Enhanced Logging Added

**File:** `SERVER/controllers/newProposalWorkflowController.js` - `submit-to-analyst` action

New diagnostic logs will show:

```
[getNotificationRecipients] Searching for analysts with region: ObjectId(...)
[getNotificationRecipients] Found X analysts with region filter
[getNotificationRecipients] No analysts found with standard roles, searching for any analyst...
[getNotificationRecipients] Total users in system: X
[getNotificationRecipients] Users with analyst-like roles: X
  - User: ID, Roles: [...], Region: ...
  - User: ID, Roles: [...], Region: ...
  - User: ID, Roles: [...], Region: ...
```

---

## How to Get Diagnostic Information

### Step 1: Restart Server
```bash
cd SERVER
npm start
```

### Step 2: Trigger submit-to-analyst action
1. Login as BUDGET APPROVER
2. Find proposal with status: `FORWARDED_TO_APPROVER`
3. Click "Submit to Analyst"
4. Confirm

### Step 3: Check Server Logs

Look for the diagnostic output showing:
- Total users in system
- Users with analyst roles
- Their actual Roles and Region values

---

## What the Logs Tell Us

### If "Total users in system: 0"
- Database is empty or wrong database connected
- **Fix:** Check MongoDB connection and populated data

### If "Total users in system: X" but "Users with analyst-like roles: 0"
- No users have analyst role assigned
- **Fix:** Need to create/assign analyst role to users

### If "Users with analyst-like roles: X" shows roles and regions
- Users exist but query isn't matching them
- **Possible fixes:**
  - Role names don't exactly match our search strings
  - Region field doesn't exist
  - Region format is different

---

## Next Actions Based on Diagnostics

### Scenario A: No users have BUDGET PLANNING ANALYST role
**Solution:** Create a test user with the role
```javascript
// Add to a test script
db.users.updateOne(
  { email: 'analyst@test.com' },
  { $set: { Roles: ['BUDGET PLANNING ANALYST'] } }
)
```

### Scenario B: Users exist but roles don't match exactly
**Solution:** Update the query to match actual role names
- Check server log output showing actual role names
- Update `'BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST'` to match

### Scenario C: Region field doesn't exist
**Solution:** Modify query to not require region
```javascript
analysts = await User.find({
  Roles: { $in: ['BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST'] }
}).select('_id');
```

### Scenario D: Users have analyst role but different region
**Solution:** Return analysts from any region (if that's acceptable)

---

## Testing Checklist

- [ ] Server restarted with new diagnostic code
- [ ] BUDGET APPROVER logged in
- [ ] Proposal selected with status FORWARDED_TO_APPROVER
- [ ] Submit to Analyst action triggered
- [ ] Server logs checked for diagnostic output
- [ ] Identified which scenario applies (A, B, C, or D)
- [ ] Applied appropriate fix

---

## Expected Workflow After Fix

Once we identify the issue:

```
BUDGET APPROVER submits to analyst
    ↓
getNotificationRecipients finds X analysts
    ↓
Filters out current user
    ↓
Sends notifications to remaining analysts
    ↓
Analysts receive notifications ✅
```

---

## Commands to Debug

### Check users in database
```bash
# Open MongoDB shell
mongo

# Use the correct database
use fmis_budget

# Count total users
db.users.countDocuments()

# Find users with analyst role
db.users.find({ Roles: /analyst/i }).pretty()

# Find users with specific role
db.users.find({ Roles: 'BUDGET PLANNING ANALYST' }).pretty()

# Check user structure
db.users.findOne().pretty()
```

### Check proposal region
```bash
db.newproposalworkflows.findOne({ _id: ObjectId("691928eb66e7570d3d0f1c6a") }, { region: 1, _id: 1 })
```

---

## Next Steps

1. **Restart server** with diagnostic logging
2. **Trigger action** to generate diagnostic output
3. **Check logs** to identify which scenario applies
4. **Report back** with the diagnostic output
5. **Apply fix** based on findings

---

## Files Modified

| File | Changes |
|------|---------|
| `SERVER/controllers/newProposalWorkflowController.js` | Added diagnostic logging to submit-to-analyst |

**Syntax Errors:** 0  
**Status:** Ready to test

