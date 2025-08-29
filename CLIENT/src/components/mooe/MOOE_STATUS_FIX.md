# MOOE Table Status Issue Fix

## 🐛 **Problem:**
Pag may new entry sa MOOE table at na-save, agad na "Draft" ang status instead na "Not Submitted".

## 🔍 **Root Cause Analysis:**

### **The Issue:**
```javascript
// BEFORE - All entries inherit the overall MOOE status
status: data?.status  // If MOOE module is "Draft", all entries become "Draft"
```

### **Why This Happens:**
1. **Overall Module Status**: When MOOE data is saved as draft, the entire MOOE module gets status "Draft"
2. **Status Inheritance**: New entries were inheriting this overall status instead of starting as "Not Submitted"
3. **No Distinction**: The code didn't distinguish between new entries and existing entries

### **Example Scenario:**
1. User adds MOOE entries → Saves as Draft → MOOE module status = "Draft"
2. User adds NEW entries → Saves again → New entries inherit "Draft" status
3. **Expected**: New entries should be "Not Submitted"
4. **Actual**: New entries become "Draft"

## 🔧 **Solution Implemented:**

### **1. Smart Status Assignment:**
```javascript
// NEW - Detect new entries and assign appropriate status
const hasValues = parseFloat(child.income || 0) > 0 || parseFloat(child.subsidy || 0) > 0;
const isNewEntry = hasValues && !child.status;

status: isNewEntry ? "Not Submitted" : (child.status || data?.status)
```

### **2. Entry Classification Logic:**
- **New Entry**: Has values (income/subsidy > 0) but no existing status → "Not Submitted"
- **Existing Entry**: Already has a status → Keep existing status
- **Empty Entry**: No values → Use overall module status (filtered out anyway)

### **3. Applied to Both Code Paths:**
- **Income Disabled Path**: When income inputs are locked
- **Normal Path**: Regular processing
- **Consistent Logic**: Same status assignment in both scenarios

### **4. Debug Logging:**
- Added console logging to track status assignments
- Shows which entries are detected as new vs existing
- Helps verify the fix is working correctly

## ✅ **What's Fixed:**

### **Before Fix:**
```
Scenario: MOOE module has "Draft" status
- Add new entry with income: 1000
- Save
- Result: New entry status = "Draft" ❌
```

### **After Fix:**
```
Scenario: MOOE module has "Draft" status
- Add new entry with income: 1000
- Save
- Result: New entry status = "Not Submitted" ✅
```

### **Status Logic Now:**
1. **New entries** (have values, no previous status) → **"Not Submitted"**
2. **Existing entries** (already have status) → **Keep existing status**
3. **Modified entries** → **Keep their current status**
4. **Empty entries** → **Filtered out** (not saved)

## 🧪 **How to Test:**

### **Test Case 1: New Entry After Draft**
1. Go to MOOE table
2. Add some entries and save as draft
3. Add NEW entries with values
4. Save again
5. **Expected**: New entries should be "Not Submitted" in status overview
6. **Check console** for debug logs showing status assignments

### **Test Case 2: Existing Entry Modification**
1. Have existing "Draft" entries
2. Modify their values
3. Save
4. **Expected**: Modified entries should remain "Draft"

### **Test Case 3: Mixed Scenario**
1. Have mix of "Draft" and "Not Submitted" entries
2. Add new entries
3. Modify existing entries
4. Save
5. **Expected**: 
   - New entries → "Not Submitted"
   - Existing "Draft" → Stay "Draft"
   - Existing "Not Submitted" → Stay "Not Submitted"

## 🔍 **Debug Information:**

### **Console Logs to Look For:**
```
MOOE Save Debug: {
  overallStatus: "Draft",
  entriesWithStatus: [
    {
      accountingTitle: "Existing Item",
      status: "Draft",           // Existing entry keeps status
      hasValues: true,
      originalStatus: "Draft"
    },
    {
      accountingTitle: "New Item",
      status: "Not Submitted",   // New entry gets "Not Submitted"
      hasValues: true,
      originalStatus: "none"
    }
  ]
}
```

### **Status Overview Should Show:**
- **Draft (X)**: Count of existing draft entries
- **Not Submitted (Y)**: Count of new entries + existing not submitted
- **No more unexpected "Draft" entries** for newly added items

## 🎯 **Expected Behavior:**

### **✅ Correct Flow:**
1. **First Save**: New entries → "Not Submitted"
2. **Save as Draft**: Entries become "Draft"
3. **Add More Entries**: New entries → "Not Submitted" (not "Draft")
4. **Save as Draft Again**: Only new entries change to "Draft"

### **✅ Status Progression:**
- **New Entry**: "Not Submitted"
- **Save as Draft**: "Draft"
- **Submit**: "Submitted"
- **Return**: "Returned"

### **✅ Independence:**
- **New entries** don't inherit overall module status
- **Each entry** has its own status lifecycle
- **Module status** is separate from individual entry status

The MOOE table now properly handles new entry status assignment! 🎉
