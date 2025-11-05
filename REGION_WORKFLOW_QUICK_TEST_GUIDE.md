# 🚀 QUICK START: TESTING REGION-BASED WORKFLOW

## 5-Minute Setup & Test

### Step 1: Create Test Users (2 minutes)

Navigate to **Hierarchical User Assignments** page

#### Create BUDGET_PLANNING_ANALYST #1 - MARIIS Only
```
User ID: [Search for a test user ID]
Name: [Auto-filled]
Email: [Auto-filled]
Role: BUDGET_PLANNING_ANALYST
Assignment Level: RESPONSIBILITY_CENTER
Office: [Select any office]

Region Assignment:
  ○ NIA-Wide / All Regions
  ✓ Specific Regions
  
  [Select Regions]
    ✓ MARIIS
    ☐ CALABARZON
    ☐ REGION I
    ☐ CAR
    
[Create Assignment]
```

#### Create BUDGET_PLANNING_ANALYST #2 - NIA-Wide
```
User ID: [Search for another test user ID]
Name: [Auto-filled]
Email: [Auto-filled]
Role: BUDGET_PLANNING_ANALYST
Assignment Level: RESPONSIBILITY_CENTER
Office: [Select any office]

Region Assignment:
  ✓ NIA-Wide / All Regions
  ○ Specific Regions

[Create Assignment]
```

### Step 2: Create Test Proposals (2 minutes)

Go to **All Proposals** → Create multiple proposals from different regions

```
Proposal 1:
  ├─ Description: "MARIIS Office Budget"
  ├─ Region: MARIIS
  ├─ Status: Create and submit through workflow
  └─ Forward to ANALYST when ready

Proposal 2:
  ├─ Description: "CALABARZON Office Budget"
  ├─ Region: CALABARZON
  ├─ Status: Create and submit through workflow
  └─ Forward to ANALYST when ready
```

### Step 3: Test Region Filtering (1 minute)

#### Test #1: MARIIS-Only Analyst
```
1. Login as: ANALYST #1 (MARIIS assignment)
2. Go to: All Proposals
3. Check What You See:
   ✅ MARIIS Proposal - VISIBLE
   ❌ CALABARZON Proposal - NOT VISIBLE
4. Expected: 1 proposal shown
```

#### Test #2: NIA-Wide Analyst
```
1. Login as: ANALYST #2 (NIA-Wide assignment)
2. Go to: All Proposals
3. Check What You See:
   ✅ MARIIS Proposal - VISIBLE
   ✅ CALABARZON Proposal - VISIBLE
4. Expected: 2 proposals shown
```

---

## Expected Results

### ✅ Test Passed If:
- MARIIS-only analyst sees 1 proposal (MARIIS only)
- NIA-Wide analyst sees 2 proposals (all regions)
- Other roles see all proposals (BUDGET_OFFICER, OVERALL_APPROVER)

### ❌ Test Failed If:
- MARIIS-only analyst sees all proposals
- NIA-Wide analyst sees limited proposals
- System crashes or shows errors
- Region selection not available for BUDGET_PLANNING_ANALYST

---

## Debugging If Tests Fail

### Check 1: Verify Assignment Created

**In Database** (MongoDB):
```javascript
db.hierarchicaluserassignments.find({
  userRole: "BUDGET_PLANNING_ANALYST"
})
```

**Look For**:
```javascript
{
  userId: "12345",
  isNIAWide: false,  // OR true
  assignedRegions: ["MARIIS"],  // OR empty for NIA-Wide
}
```

### Check 2: View Server Logs

**Look for messages like**:
```
🔐 [budgetRoleVisibilityControl] BUDGET_PLANNING_ANALYST region filtering
🔒 BUDGET_PLANNING_ANALYST restricted to regions: MARIIS
🌍 BUDGET_PLANNING_ANALYST has NIA-Wide access
```

### Check 3: Verify Proposal Region Field

**In Database**:
```javascript
db.proposals.findOne({ description: "MARIIS Office Budget" })
```

**Look For**:
```javascript
{
  region: "MARIIS",  // Must match assignedRegions value
  status: "Forwarded to Analyst",
}
```

### Check 4: Test Different Scenarios

```
Scenario 1: MARIIS analyst + MARIIS proposal
  → Result: ✅ VISIBLE

Scenario 2: MARIIS analyst + CALABARZON proposal
  → Result: ❌ NOT VISIBLE

Scenario 3: NIA-Wide analyst + Any region proposal
  → Result: ✅ VISIBLE

Scenario 4: Analyst without region assignment
  → Result: ❌ NO PROPOSALS (safety measure)
```

---

## Common Test Issues

### Issue: "I don't see region selection in the form"
**Solution**:
- Select role: BUDGET_PLANNING_ANALYST
- Wait for UI to load
- Region selection should appear below role selector
- If not, refresh page and try again

### Issue: "Region selection not saving"
**Solution**:
- Make sure to click "Create Assignment" button
- Check for validation error (red text)
- Must select at least one region if not NIA-Wide
- Verify user ID was found correctly

### Issue: "ANALYST still sees all proposals after region assignment"
**Solution**:
- Wait 30 seconds for cache to clear
- Logout and login again
- Clear browser cache
- Check server logs for filtering messages
- Verify assignment in database has correct regions

### Issue: "Getting error 'Cannot read property isNIAWide'"
**Solution**:
- Check if hierarchical assignment exists in database
- Verify `isNIAWide` field is set (true or false)
- If field missing, recreate assignment

---

## Commands for Manual Testing

### MongoDB - Check Assignments
```javascript
db.hierarchicaluserassignments.findOne({
  userRole: "BUDGET_PLANNING_ANALYST",
  userId: "12345"
})
```

### MongoDB - Check Proposals
```javascript
db.proposals.find({
  status: "Forwarded to Analyst"
}).pretty()
```

### MongoDB - Update Assignment (if needed)
```javascript
db.hierarchicaluserassignments.updateOne(
  { userId: "12345", userRole: "BUDGET_PLANNING_ANALYST" },
  {
    $set: {
      isNIAWide: false,
      assignedRegions: ["MARIIS", "CALABARZON"]
    }
  }
)
```

---

## Quick Reference

### Region Filtering Rules

| Assignment | Proposal Region | Result | Why |
|------------|-----------------|--------|-----|
| NIA-Wide | MARIIS | ✅ VISIBLE | NIA-Wide sees all |
| NIA-Wide | CALABARZON | ✅ VISIBLE | NIA-Wide sees all |
| MARIIS | MARIIS | ✅ VISIBLE | Region matches |
| MARIIS | CALABARZON | ❌ HIDDEN | Region doesn't match |
| [MARIIS, CALABARZON] | MARIIS | ✅ VISIBLE | In assigned regions |
| [MARIIS, CALABARZON] | REGION I | ❌ HIDDEN | Not in assigned regions |
| [] (empty) | Any | ❌ HIDDEN | No regions assigned |

---

## Success Checklist

- [ ] Created BUDGET_PLANNING_ANALYST with MARIIS assignment
- [ ] Created BUDGET_PLANNING_ANALYST with NIA-Wide assignment
- [ ] Created proposals from MARIIS and CALABARZON regions
- [ ] Forwarded proposals to ANALYST step
- [ ] MARIIS analyst sees only MARIIS proposals
- [ ] NIA-Wide analyst sees all region proposals
- [ ] Server logs show region filtering messages
- [ ] No errors in browser console
- [ ] Logout/login refreshes filters correctly

---

## Next Steps After Successful Test

1. ✅ Test with additional regions (REGION I, CAR, etc.)
2. ✅ Test with multiple analysts assigned to overlapping regions
3. ✅ Test editing analyst's region assignment
4. ✅ Verify other roles (OFFICER, APPROVER) see all proposals
5. ✅ Load test with 100+ proposals
6. ✅ Test on different browsers (Chrome, Firefox, Safari)
7. ✅ Deploy to production

---

## Support

If tests fail or you need help:

1. Check the documentation files:
   - `REGION_BASED_WORKFLOW.md`
   - `REGION_WORKFLOW_VISUAL_GUIDE.md`
   - `REGION_WORKFLOW_IMPLEMENTATION_SUMMARY.md`

2. Review server logs for:
   - `🔐 [budgetRoleVisibilityControl]` messages
   - `🔒 BUDGET_PLANNING_ANALYST restricted`
   - `🌍 BUDGET_PLANNING_ANALYST has NIA-Wide`
   - Any `ERROR` messages

3. Check database assignments:
   - Verify `isNIAWide` field exists
   - Verify `assignedRegions` array has values
   - Verify proposal `region` field matches

---

**Status**: ✅ Ready for Testing
**Time to Complete**: ~5 minutes
**Expected Result**: Region-based filtering working correctly
