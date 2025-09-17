# Save as Draft Backend Fix - Missing Implementation

## 🐛 **The Problem:**
Bakit kaya hindi nababago status ng mga ito kahit ilang beses ko ng na-click ang save as draft na button?

**Debug shows:**
- **2 Capital Outlay items**: Motor Vehicles, Aircraft (Not Submitted)
- **1 Budgetary Support item**: (Not Submitted)
- **Total**: 3 "Not Submitted" items not changing to "Draft"

## 🔍 **Root Cause - Missing Backend Implementation:**

### **The Issue:**
The `/saveAsDraft` API endpoint was **incomplete**! It only implemented **Personnel** updates but was missing:

- ❌ **MOOE** updates
- ❌ **Capital Outlay** updates  
- ❌ **Budgetary Support** updates

### **Backend Code Analysis:**

#### **BEFORE FIX:**
```javascript
// saveAsDraft function in proposalController.js
exports.saveAsDraft = async (req, res) => {
  // ... setup code ...
  
  // ✅ Personnel update - IMPLEMENTED
  if (personnelIds && Array.isArray(personnelIds) && personnelIds.length > 0) {
    await PersonnelService.updateMany(
      { _id: { $in: validPersonnelIds } },
      { $set: { status: "Draft", fiscalYear, budgetType, processBy, region } }
    );
  }

  // ❌ MISSING IMPLEMENTATIONS
  // Similar updates for other types...  ← This was just a comment!

  return res.status(200).json({
    message: "Proposal saved as draft successfully"
  });
};
```

#### **The Missing Parts:**
1. **No MOOE handling** - mooeIds ignored
2. **No Capital Outlay handling** - capitalOutlayIds ignored  
3. **No Budgetary Support handling** - budgetarySupportIds not even in function parameters
4. **Incomplete logging** - missing budgetarySupportIds in debug logs

## 🔧 **Solution - Complete Implementation:**

### **1. Added Missing Model Import:**
```javascript
// BEFORE
const CapitalOutlay = require('../models/CapitalOutlay');
const IncomeSubcategory = require('../models/IncomeSubcategory');

// AFTER
const CapitalOutlay = require('../models/CapitalOutlay');
const BudgetarySupport = require('../models/BudgetarySupport');  // ← Added
const IncomeSubcategory = require('../models/IncomeSubcategory');
```

### **2. Added Missing Parameter:**
```javascript
// BEFORE
let {
  personnelIds,
  mooeIds,
  capitalOutlayIds,
  incomeIds,  // ← budgetarySupportIds missing
  fiscalYear,
  budgetType,
  processBy,
  region
} = req.body;

// AFTER
let {
  personnelIds,
  mooeIds,
  capitalOutlayIds,
  incomeIds,
  budgetarySupportIds,  // ← Added
  fiscalYear,
  budgetType,
  processBy,
  region
} = req.body;
```

### **3. Implemented Missing Update Logic:**

#### **MOOE Updates:**
```javascript
if (mooeIds && Array.isArray(mooeIds) && mooeIds.length > 0) {
  console.log("Updating MOOE proposals to Draft for IDs:", mooeIds);
  const validMooeIds = mooeIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const mooeResult = await MooeProposal.updateMany(
    { _id: { $in: validMooeIds } },
    { $set: { status: "Draft", fiscalYear, budgetType, processBy, region } }
  );
  console.log("MOOE draft update result:", mooeResult);
}
```

#### **Capital Outlay Updates:**
```javascript
if (capitalOutlayIds && Array.isArray(capitalOutlayIds) && capitalOutlayIds.length > 0) {
  console.log("Updating Capital Outlay proposals to Draft for IDs:", capitalOutlayIds);
  const validCapitalIds = capitalOutlayIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const capitalResult = await CapitalOutlay.updateMany(
    { _id: { $in: validCapitalIds } },
    { $set: { status: "Draft", fiscalYear, budgetType, processBy, region } }
  );
  console.log("Capital Outlay draft update result:", capitalResult);
}
```

#### **Budgetary Support Updates:**
```javascript
if (budgetarySupportIds && Array.isArray(budgetarySupportIds) && budgetarySupportIds.length > 0) {
  console.log("Updating Budgetary Support proposals to Draft for IDs:", budgetarySupportIds);
  const validBudgetaryIds = budgetarySupportIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const budgetaryResult = await BudgetarySupport.updateMany(
    { _id: { $in: validBudgetaryIds } },
    { $set: { status: "Draft", fiscalYear, budgetType, processBy, region } }
  );
  console.log("Budgetary Support draft update result:", budgetaryResult);
}
```

### **4. Enhanced Logging:**
```javascript
// BEFORE
console.log("Received save as draft request with:", {
  personnelIds: personnelIds ? personnelIds.length : 0,
  mooeIds: mooeIds ? mooeIds.length : 0,
  capitalOutlayIds: capitalOutlayIds ? capitalOutlayIds.length : 0,
  incomeIds: incomeIds ? incomeIds.length : 0,  // ← Missing budgetarySupportIds
  // ...
});

// AFTER
console.log("Received save as draft request with:", {
  personnelIds: personnelIds ? personnelIds.length : 0,
  mooeIds: mooeIds ? mooeIds.length : 0,
  capitalOutlayIds: capitalOutlayIds ? capitalOutlayIds.length : 0,
  incomeIds: incomeIds ? incomeIds.length : 0,
  budgetarySupportIds: budgetarySupportIds ? budgetarySupportIds.length : 0,  // ← Added
  // ...
});
```

### **5. Updated Total Count:**
```javascript
// BEFORE
const totalProposals = (personnelIds?.length || 0) + (mooeIds?.length || 0) +
                      (capitalOutlayIds?.length || 0) + (incomeIds?.length || 0);

// AFTER
const totalProposals = (personnelIds?.length || 0) + (mooeIds?.length || 0) +
                      (capitalOutlayIds?.length || 0) + (incomeIds?.length || 0) +
                      (budgetarySupportIds?.length || 0);  // ← Added
```

## ✅ **What's Fixed:**

### **Complete Implementation:**
- ✅ **Personnel** - Already working
- ✅ **MOOE** - Now implemented
- ✅ **Capital Outlay** - Now implemented
- ✅ **Budgetary Support** - Now implemented

### **Expected Results:**
1. **Motor Vehicles** (Capital Outlay) → Changes from "Not Submitted" to "Draft"
2. **Aircraft** (Capital Outlay) → Changes from "Not Submitted" to "Draft"  
3. **Operating Requirements** (Budgetary Support) → Changes from "Not Submitted" to "Draft"

### **Status Overview After Fix:**
- **Before**: Draft (308), Not Submitted (3)
- **After**: Draft (311), Not Submitted (0)

## 🧪 **How to Test the Fix:**

### **Step 1: Click Save as Draft**
1. **Go to Proposals page**
2. **Click "Save as Draft"** button
3. **Check console logs** for detailed backend processing

### **Step 2: Verify Console Logs**
Look for these logs in browser console:
```
"About to call /saveAsDraft API with payload:" {
  capitalOutlayIds: ["684392d29742005df58c4a85", "684396d09742005df58c51f2"],
  budgetarySupportIds: ["683fda51f134ec2bbd399a99"]
}

"Save as draft API response:" {
  message: "Proposal saved as draft successfully"
}

"Capital Outlay Status After Save as Draft:" {
  expectedDraftCount: 2,
  actualDraftCount: 2  // ← Should match now
}

"Budgetary Support Status After Save as Draft:" {
  expectedDraftCount: 1,
  actualDraftCount: 1  // ← Should match now
}
```

### **Step 3: Check Server Logs**
Look for these logs in server console:
```
"Received save as draft request with:" {
  capitalOutlayIds: 2,
  budgetarySupportIds: 1
}

"Updating Capital Outlay proposals to Draft for IDs:" [...]
"Capital Outlay draft update result:" { modifiedCount: 2 }

"Updating Budgetary Support proposals to Draft for IDs:" [...]
"Budgetary Support draft update result:" { modifiedCount: 1 }
```

### **Step 4: Verify Status Changes**
1. **Click "Debug" button** in Status Overview
2. **Check status counts**: Should show Draft (311), Not Submitted (0)
3. **Verify individual items**: Motor Vehicles, Aircraft, Operating Requirements should all show "Draft"

## 🎉 **The Fix is Complete!**

The `/saveAsDraft` endpoint now properly handles **all proposal types**:
- ✅ Personnel Services
- ✅ MOOE  
- ✅ Capital Outlay
- ✅ Budgetary Support

**Your 3 "Not Submitted" items should now change to "Draft" when you click "Save as Draft"!** 🚀
