# 🚀 DEPLOYMENT GUIDE: Fix Coordinator → Officer Workflow

## ⚠️ IMPORTANTE: Kailangan I-RESTART ang Server!

Ang code ay **TAMA NA** pero kailangan i-restart ang backend server para ma-load ang bagong functions!

---

## 📋 Pre-Deployment Checklist

- [x] Code committed to GitHub ✅
- [x] Test script created ✅
- [x] No legacy "Office Submitted" proposals in database ✅
- [ ] **Backend server RESTARTED** ❌ **KAILANGAN PA!**
- [ ] **Frontend browser cache CLEARED** ❌ **KAILANGAN PA!**
- [ ] Manual testing completed ❌ **PENDING**

---

## 🔧 Step-by-Step Deployment

### Step 1: Restart Backend Server 🖥️

**IMPORTANTE:** Ang Node.js ay hindi nag-aautoreload ng code. Kailangan i-restart!

#### Option A: Manual Restart
```bash
# Terminal 1: Stop current server
# Press Ctrl+C to stop

# Then start again
cd D:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER
node server.js
```

#### Option B: Using nodemon (if installed)
```bash
cd D:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER
nodemon server.js
```

#### Option C: PM2 (if using PM2)
```bash
pm2 restart fmis-budget-server
# or
pm2 restart all
```

**✅ Verify Server Restarted:**
- Check terminal for "Server running on port..."
- Check for "Connected to MongoDB" message
- No error messages should appear

---

### Step 2: Clear Frontend Cache 🌐

Ang browser ay nag-cacache ng old JavaScript files!

#### Method 1: Hard Refresh
1. Open browser
2. Go to http://localhost:3005 (or your frontend URL)
3. Press **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac)
4. Or press **Ctrl + F5**

#### Method 2: Clear Browser Cache
**Chrome:**
1. Press **Ctrl + Shift + Delete**
2. Select "Cached images and files"
3. Select "All time"
4. Click "Clear data"

**Firefox:**
1. Press **Ctrl + Shift + Delete**
2. Check "Cache"
3. Click "Clear Now"

#### Method 3: Restart Frontend Dev Server
```bash
# Terminal 2: Stop current frontend
# Press Ctrl+C

# Restart frontend
cd D:\DREED\FMIS-BUDGET-SEPTEMBER\CLIENT
npm start
```

---

### Step 3: Manual Testing 🧪

#### Test Case 1: Coordinator Forwards to Officer

**Prerequisites:**
- Login as **BUDGET_COORDINATOR** (Nelson Eloso)
- Have a proposal with status "Division Submitted"

**Steps:**
1. Go to **All Proposals**
2. Click on a proposal with status "Division Submitted"
3. Click **Actions** dropdown
4. Select **"Approve & Forward to Officer"**
5. Enter a comment: "Approved for Officer review"
6. Click **Confirm**

**Expected Results:**
- ✅ Success message: "Proposal approved and forwarded to Budget Officer successfully"
- ✅ Status changes to: **"Forwarded to Officer"** (NOT "Office Submitted")
- ✅ Dialog updates immediately without manual refresh
- ✅ Workflow history shows two events:
  - COORDINATOR_APPROVE → Coordinator Approved
  - COORDINATOR_SUBMIT_TO_OFFICER → Forwarded to Officer

**❌ WRONG Results (Old Workflow):**
- Status becomes "Office Submitted"
- Bypasses Officer review
- Goes directly to Manager

---

#### Test Case 2: Officer Can See and Approve

**Prerequisites:**
- Login as **BUDGET_OFFICER** (Andrie Barrameda)

**Steps:**
1. Go to **All Proposals**
2. Check if proposal is visible
3. Status should show: "Forwarded to Officer"
4. Click on the proposal
5. Click **Actions** dropdown

**Expected Available Actions:**
- ✅ "Save Edits" - Save changes without forwarding
- ✅ "Approve" - Approve the proposal
- ✅ "Return to Coordinator" - Send back for revisions

**Steps to Approve:**
1. Click **"Approve"**
2. Enter comment: "Verified and approved"
3. Click **Confirm**

**Expected Results:**
- ✅ Status changes to: **"Officer Approved"**
- ✅ Officer can then click **"Submit to Manager"**
- ✅ Workflow history updated correctly

---

#### Test Case 3: Manager Receives After Officer Approval

**Prerequisites:**
- Officer has approved the proposal
- Login as **BUDGET_MANAGER** (Reymund Edra)

**Steps:**
1. Officer clicks **"Submit to Manager"**
2. Status should become: **"Forwarded to Manager"**
3. Login as Budget Manager
4. Check **All Proposals**

**Expected Results:**
- ✅ Proposal is visible to Manager
- ✅ Status: "Forwarded to Manager" (or "Office Submitted" for legacy)
- ✅ Manager can view, edit, and finalize

---

### Step 4: Verify Complete Workflow Path ✅

**Correct Flow:**
```
1. Analyst creates → Draft
2. Analyst submits → Division Submitted
3. Coordinator approves → Forwarded to Officer ✅
4. Officer approves → Officer Approved ✅
5. Officer submits → Forwarded to Manager ✅
6. Manager finalizes → Finalized ✅
```

**Wrong Flow (Legacy - Should NOT Happen):**
```
1. Analyst creates → Draft
2. Analyst submits → Division Submitted
3. Coordinator submits → Office Submitted ❌ (SKIP OFFICER)
4. Manager finalizes → Finalized ❌ (NO OFFICER APPROVAL)
```

---

## 🐛 Troubleshooting

### Problem 1: Still showing "Office Submitted"

**Cause:** Backend server not restarted with new code

**Solution:**
1. Stop backend server (Ctrl+C)
2. Start server again: `node server.js`
3. Wait for "Server running..." message
4. Hard refresh browser (Ctrl+Shift+R)

---

### Problem 2: Action button not appearing

**Cause:** Frontend cache still has old code

**Solution:**
1. Clear browser cache completely
2. Close all browser tabs
3. Restart browser
4. Go to frontend URL again
5. Login again

---

### Problem 3: Status not updating in real-time

**Cause:** Dialog not refreshing after API call

**Solution:**
- Already fixed! The `onRefresh()` is called immediately
- If still happening, refresh page manually (F5)

---

### Problem 4: Officer can't see proposal

**Cause:** Wrong status or visibility filter

**Debug Steps:**
1. Check proposal status in database:
   ```bash
   node
   > const mongoose = require('mongoose');
   > const Proposal = require('./models/Proposal');
   > mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
   > Proposal.find({}).select('title status workflowLevel').then(console.log);
   ```

2. Check user roles:
   ```bash
   > const User = require('./models/User');
   > User.findOne({ Username: 'andrie.barrameda' }).then(u => console.log(u.Roles));
   ```

---

## 📊 Database Verification Queries

### Check Proposal Status:
```javascript
db.proposals.find(
  { status: { $in: ['Forwarded to Officer', 'Office Submitted'] } },
  { title: 1, status: 1, workflowLevel: 1, bypassedOfficerReview: 1 }
)
```

**Expected:**
- status: "Forwarded to Officer"
- workflowLevel: "OFFICER"
- bypassedOfficerReview: false or undefined

**Wrong (Legacy):**
- status: "Office Submitted"
- workflowLevel: "MANAGER"
- bypassedOfficerReview: true

---

### Check Workflow History:
```javascript
db.proposals.findOne(
  { _id: ObjectId('YOUR_PROPOSAL_ID') },
  { workflowHistory: 1 }
)
```

**Expected Events:**
1. SUBMIT → Division Submitted
2. COORDINATOR_APPROVE → Coordinator Approved
3. COORDINATOR_SUBMIT_TO_OFFICER → Forwarded to Officer
4. OFFICER_APPROVE → Officer Approved
5. OFFICER_SUBMIT_TO_MANAGER → Forwarded to Manager
6. MANAGER_APPROVE → Finalized

---

## 🎯 Success Criteria

All of these must be TRUE:

- [x] Backend server restarted successfully
- [x] Frontend cache cleared
- [x] Coordinator button: "Approve & Forward to Officer" visible
- [ ] After coordinator approval: Status = "Forwarded to Officer" ✅
- [ ] Officer can see proposal in their list ✅
- [ ] Officer can approve proposal ✅
- [ ] Officer can submit to Manager ✅
- [ ] Manager receives after Officer approval (not before) ✅
- [ ] NO "Office Submitted" status appears ✅
- [ ] Complete workflow history recorded ✅

---

## 🔐 User Credentials (For Testing)

From `create-initial-users.js`:

| Role | Name | Username | Password |
|------|------|----------|----------|
| BUDGET_ANALYST | Joshua Demafelez | joshua.demafelez | (set in DB) |
| BUDGET_COORDINATOR | Nelson Eloso | nelson.eloso | (set in DB) |
| BUDGET_OFFICER | Andrie Barrameda | andrie.barrameda | (set in DB) |
| BUDGET_MANAGER | Reymund Edra | reymund.edra | (set in DB) |

---

## 📝 Post-Deployment Verification

After testing, verify:

```bash
# Run test script
cd D:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER
node test-coordinator-forward-officer.js
```

**Expected Output:**
- ✅ No "Office Submitted" proposals found
- ✅ All proposals using new workflow
- ✅ Officer step not bypassed

---

## 🚨 If Still Not Working

1. **Check Backend Logs:**
   - Look for errors in server console
   - Check for "coordinatorApproveAndForwardToOfficer" being called
   - Verify status changes logged

2. **Check Frontend Network Tab:**
   - Open DevTools (F12)
   - Go to Network tab
   - Click the action button
   - Check request to: `/api/workflow/coordinator/approve-and-forward-to-officer`
   - Verify response: `{ success: true, proposal: { status: "Forwarded to Officer" } }`

3. **Check Database Directly:**
   ```bash
   mongo mongodb://172.16.4.98:27017/fmis_budget
   db.proposals.find({ _id: ObjectId('...') }).pretty()
   ```

4. **Re-pull Latest Code:**
   ```bash
   cd D:\DREED\FMIS-BUDGET-SEPTEMBER
   git pull origin reorg/preserve-history
   npm install  # if needed
   ```

---

## ✅ Final Checklist

Before declaring success:

- [ ] Restart backend server ✅
- [ ] Clear browser cache ✅
- [ ] Test Coordinator → Officer flow ✅
- [ ] Test Officer → Manager flow ✅
- [ ] Verify NO "Office Submitted" status ✅
- [ ] Check workflow history complete ✅
- [ ] Document test results ✅

---

## 📞 Support

If issues persist:
1. Check `LEGACY_WORKFLOW_BYPASS_ISSUE.md` for detailed explanation
2. Review all commits related to "coordinator-approve-forward-officer"
3. Check server logs for errors
4. Verify database connection
5. Confirm user roles in `hierarchicaluserassignments` collection

---

**REMEMBER:**
Ang pinaka-importante ay **I-RESTART ANG BACKEND SERVER**! 🔄

Kahit gaano ka-tama ang code, kung hindi nire-restart ang server, 
ang OLD CODE pa rin ang tumatakbo! 

---

**Last Updated:** October 16, 2025
**Status:** Code is CORRECT ✅ - Just needs server restart! 🚀
