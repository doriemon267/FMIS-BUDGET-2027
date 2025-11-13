# Testing Audit Trail Feature

## Quick Start Testing Guide

### Setup
1. Build the client: `npm run build` in CLIENT directory
2. Start the server (if not running)
3. Login to the application

### Test Case 1: Create and Edit Draft Proposal

**Steps:**
1. Create a new budget proposal as BUDGET PREPARER
2. Click "View Audit Trail" immediately
   - Expected: "No changes recorded" message
3. Edit the proposal (change title and amount)
4. Click "View Audit Trail" again
   - Expected: One entry showing:
     - Changed By: Your name
     - Role: BUDGET PREPARER
     - Fields Changed: title, amount
     - Old → New values visible
     - Current timestamp

**Expected Result:** ✅ Change is recorded with correct old/new values

---

### Test Case 2: Multiple Sequential Edits

**Steps:**
1. Create a new proposal
2. Edit 1: Change title only
3. Edit 2: Change amount only
4. Edit 3: Change description only
5. View Audit Trail
   - Expected: 3 separate entries (latest first)
   - Each showing only the field that changed

**Expected Result:** ✅ Each edit creates separate audit trail entry

---

### Test Case 3: Multi-Field Simultaneous Edit

**Steps:**
1. Create a new proposal
2. Edit multiple fields at once (title, description, amount)
3. View Audit Trail
   - Expected: 1 entry showing all 3 fields changed
   - All old/new values visible

**Expected Result:** ✅ Single entry captures all simultaneous changes

---

### Test Case 4: No Changes Edit

**Steps:**
1. Create a new proposal
2. Open edit dialog
3. Make no changes, just submit
4. View Audit Trail
   - Expected: No new entry created (still shows previous entries or "No changes recorded")

**Expected Result:** ✅ Empty edits don't create audit trail entries

---

### Test Case 5: BRD Staff Editing

**Steps:**
1. Create proposal as BUDGET PREPARER
2. Login as BUDGET PLANNING ANALYST (or other BRD role)
3. Edit the proposal (change amount, description)
4. View Audit Trail
   - Expected: Entry showing:
     - Changed By: BRD staff name
     - Role: BUDGET PLANNING ANALYST
     - Fields Changed: amount, description

**Expected Result:** ✅ BRD edits are tracked separately with correct role

---

### Test Case 6: Long Text Values

**Steps:**
1. Create proposal
2. Edit with long description (> 30 characters)
3. View Audit Trail
   - Expected: Long values truncated to 30 chars with "..." indicator

**Expected Result:** ✅ Values display properly even if long

---

### Test Case 7: Numeric vs String Values

**Steps:**
1. Create proposal with amount = 100000
2. Edit to 150000
3. View Audit Trail
   - Expected: 
     - Old Value: 100000 (numeric)
     - New Value: 150000 (numeric)
     - Color: Red → Green

**Expected Result:** ✅ Numeric values displayed correctly

---

### Test Case 8: Null/Empty Changes

**Steps:**
1. Create proposal with description = "Test"
2. Edit to description = "" (empty)
3. View Audit Trail
   - Expected: Entry showing:
     - Old Value: "Test"
     - New Value: "empty"

**Expected Result:** ✅ Empty values displayed as "empty"

---

### Test Case 9: Dialog Display and Navigation

**Steps:**
1. View Audit Trail on proposal with multiple entries
2. Verify:
   - Dialog title: "Change Log & Audit Trail"
   - Orange header (#d97706)
   - All columns visible: CHANGED BY, ROLE, FIELDS CHANGED, OLD → NEW, DATE & TIME
   - Sticky header for scrolling
   - Close button works properly

**Expected Result:** ✅ UI displays correctly with all elements

---

### Test Case 10: Multiple Proposals

**Steps:**
1. Create Proposal A, edit it 3 times
2. Create Proposal B, edit it 2 times
3. View Audit Trail for Proposal A
   - Expected: Shows only 3 entries for A
4. View Audit Trail for Proposal B
   - Expected: Shows only 2 entries for B
   - Entries don't mix with Proposal A

**Expected Result:** ✅ Each proposal has independent audit trail

---

## Verification Checklist

### Data Integrity
- [ ] Old values match actual previous values
- [ ] New values match what was submitted
- [ ] Field names are correct
- [ ] No fields missing from changes

### UI/UX
- [ ] "View Audit Trail" button appears in action menu
- [ ] Dialog opens without errors
- [ ] Table displays all data clearly
- [ ] Colors are applied correctly (red/green/orange)
- [ ] Dates are in readable format
- [ ] No console errors

### Functionality
- [ ] Works for DRAFT proposals
- [ ] Works for proposals in workflow
- [ ] BRD roles can trigger edits and see changes
- [ ] Empty proposals show "No changes recorded"
- [ ] Loading spinner shows while fetching

### Performance
- [ ] Dialog loads within 2 seconds
- [ ] Table scrolls smoothly with many entries
- [ ] No memory leaks or performance degradation

---

## Common Test Scenarios

### Scenario A: Complete Draft Lifecycle
```
1. Create draft (no history)
2. Edit title → 1 entry
3. Edit amount → 2 entries
4. Edit description → 3 entries
5. Submit to reviewer → workflow action (separate)
```

### Scenario B: Workflow with Edits
```
1. Create draft by Preparer
2. Preparer edits → audit entry #1
3. Submit to Reviewer
4. Reviewer reviews (no edit) → workflow action only
5. Reviewer returns to Preparer
6. Preparer edits → audit entry #2
7. View shows both edits
```

### Scenario C: BRD Modifications
```
1. Proposal reaches Planning Analyst
2. Analyst reviews and edits (amount, personnel)
3. Analyst forwards to Officer
4. Officer edits (MOOE, Capital Outlay)
5. View Audit Trail shows all edits with role info
```

---

## Expected Audit Trail Entry Format

```
CHANGED BY: John Doe
ROLE: BUDGET PLANNING ANALYST
FIELDS CHANGED: amount, description, modelType
OLD → NEW VALUES:
  amount:
    ← 100000
    → 150000
  description:
    ← "Old description"
    → "Updated description for 2025"
  modelType:
    ← "REGULAR"
    → "MODIFIED BUDGET"
DATE & TIME: 11/11/2025, 10:30:45 AM
```

---

## Troubleshooting

### Issue: "No changes recorded" always shows
**Solution**: 
- Ensure you're making actual changes (not just opening/closing edit dialog)
- Check browser console for errors
- Verify proposal status allows edits

### Issue: Old/new values are the same
**Solution**:
- Verify you actually changed the value
- Check if it's comparing correctly (number vs string)
- Clear browser cache and reload

### Issue: User name shows as "undefined"
**Solution**:
- Check token contains user information
- Verify user object has `name` or `email` property
- Check backend logs for user context

### Issue: Dialog doesn't open
**Solution**:
- Check browser console for errors
- Verify API endpoint is accessible
- Check network tab for 404 or 500 errors

---

## API Testing (cURL)

Get audit trail for a proposal:
```bash
curl -X GET "http://localhost:5000/api/newProposalWorkflow/proposals/{proposalId}/audit-trail" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

Expected Response:
```json
{
  "success": true,
  "message": "Audit trail retrieved successfully",
  "data": {
    "proposalId": "...",
    "proposalTitle": "...",
    "totalChanges": 3,
    "changes": [...]
  }
}
```

---

## Performance Testing

### Stress Test: Many Changes
```
Create proposal
Loop 100 times:
  - Edit proposal
  - Record time
View Audit Trail
  - Verify all 100 entries load
  - Check response time < 5s
```

### Load Test: Table Rendering
```
Get proposal with 500 changes
Render audit trail dialog
Verify:
  - Loads in < 10s
  - Table responsive
  - No UI freezes
  - Can scroll smoothly
```

---

## Integration Testing

### With Workflow System
- Create proposal as BUDGET PREPARER
- Submit through workflow
- Verify audit trail captures only edits (not workflow actions)
- Forward through multiple roles
- Each role's edits appear with correct role name

### With Role-Based Access
- Create as one role
- Edit as different role
- Verify both roles show in audit trail
- Verify role names are accurate

---

## Notes
- Audit trail is read-only (no editing/deleting entries)
- Entries sorted by timestamp (latest first)
- All times are server-side (prevent clock skew issues)
- Entries permanent once created (cannot be modified)
