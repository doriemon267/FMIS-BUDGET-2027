# MOOE Input & Auto-Computation Debugging Guide

## 🐛 Current Issues Reported

1. **Input values not being saved** - User enters values but they don't persist
2. **Auto-computation not working** - Totals don't update when typing in income/subsidy fields

## 🔍 Debugging Steps Added

### 1. Enhanced Logging in NumberFormatCustom
**File**: `CLIENT/src/components/mooe/MooeRow.jsx` (lines 17-43)

Added detailed logging to track value changes:
```javascript
onValueChange={(values) => {
  const numericValue = values.value || "";
  console.log("NumberFormatCustom onValueChange:", { 
    formattedValue: values.formattedValue, 
    value: values.value, 
    numericValue 
  });
  onChange({
    target: {
      value: numericValue,
    },
  });
}}
```

### 2. Enhanced Input Change Logging
**File**: `CLIENT/src/components/mooe/MooeRow.jsx` (lines 138-148, 180-190)

Added detailed logging for income and subsidy changes:
```javascript
onChange={(e) => {
  console.log("MooeRow income onChange triggered:", { 
    rowId: row.id, 
    childId: child.id, 
    value: e.target.value,
    currentIncome: child.income,
    currentSubsidy: child.subsidy
  });
  onIncomeChange(row.id, child.id, e.target.value);
}}
```

### 3. Visual Debug Information
**File**: `CLIENT/src/components/mooe/MooeRow.jsx` (lines 211-220)

Added visual indicators showing current stored values:
```javascript
{/* Debug info - remove in production */}
<Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'gray' }}>
  I:{child.income} S:{child.subsidy}
</Typography>
```

## 🧪 Testing Instructions

### Step 1: Open Browser Console
1. Open the MOOE page in your browser
2. Open Developer Tools (F12)
3. Go to the Console tab

### Step 2: Test Input Functionality
1. **Expand a MOOE category** (click the + icon)
2. **Click on an Income field** and type a number (e.g., "1000")
3. **Watch the console** for these logs:
   - `NumberFormatCustom onValueChange:` - Shows the formatting component is working
   - `MooeRow income onChange triggered:` - Shows the input handler is called
   - `Updating income:` - Shows the state update in MooeTable.jsx

### Step 3: Test Auto-Computation
1. **After entering income**, check if:
   - The Amount column updates immediately
   - The debug text shows `I:1000 S:0` (or similar)
   - The row total updates

2. **Enter subsidy value** and check if:
   - The Amount column updates
   - The debug text shows both values
   - The row total includes both income and subsidy

### Step 4: Test Save Functionality
1. **Click Save** after entering values
2. **Watch the console** for:
   - `=== SAVE DEBUG INFO ===` - Shows what's being sent to server
   - `Filter check for...` - Shows client-side filtering
   - Server logs showing the save operation

3. **Refresh the page** and check if values persist

## 🔧 Expected Console Output

### When Typing "1000" in Income Field:
```
NumberFormatCustom onValueChange: {formattedValue: "1,000", value: "1000", numericValue: "1000"}
MooeRow income onChange triggered: {rowId: "...", childId: "...", value: "1000", currentIncome: "0", currentSubsidy: "0"}
Updating income: {childId: "...", oldIncome: "0", newIncome: "1000", subsidy: "0", newAmount: "1000"}
```

### When Saving:
```
=== SAVE DEBUG INFO ===
Raw entries before filtering: 116
Filtered entries count: 1
Total entries to save: 1
Sample entries: [{income: 1000, subsidy: 0, amount: 1000, ...}]
```

## 🚨 Potential Issues to Look For

### Issue 1: NumberFormatCustom Not Working
**Symptoms**: No `NumberFormatCustom onValueChange` logs
**Cause**: NumericFormat component not properly configured
**Fix**: Check NumericFormat import and configuration

### Issue 2: Input Handler Not Called
**Symptoms**: No `MooeRow income onChange triggered` logs
**Cause**: Event handler not properly bound
**Fix**: Check onChange prop passing

### Issue 3: State Not Updating
**Symptoms**: Logs show but values don't change in UI
**Cause**: React Query state not updating properly
**Fix**: Check queryClient.setQueryData implementation

### Issue 4: Values Not Persisting
**Symptoms**: Values show but disappear after save/refresh
**Cause**: Server filtering or database issues
**Fix**: Check server logs and filtering logic

### Issue 5: Auto-Computation Not Working
**Symptoms**: Individual values update but totals don't
**Cause**: Memoization or calculation issues
**Fix**: Check useMemo dependencies in MooeRow

## 🔄 Data Flow Diagram

```
User Types → NumberFormatCustom → MooeRow onChange → MooeTable handler → React Query State → UI Update
                     ↓                    ↓                    ↓                    ↓              ↓
              onValueChange        onChange event      handleIncomeChange    setQueryData    Re-render
```

## 📝 Next Steps Based on Console Output

### If No Logs Appear:
1. Check if the input fields are enabled (not disabled)
2. Verify NumberFormatCustom is being used
3. Check for JavaScript errors blocking execution

### If Logs Show But Values Don't Update:
1. Check React Query state management
2. Verify the queryClient.setQueryData calls
3. Check for state mutation issues

### If Values Update But Don't Save:
1. Check client-side filtering logic
2. Verify server-side processing
3. Check database operations

### If Values Save But Don't Persist:
1. Check data retrieval logic
2. Verify database queries
3. Check data transformation on load

## 🎯 Success Criteria

✅ **Input Working**: Console shows all three log types when typing
✅ **Auto-Computation Working**: Amount and totals update immediately
✅ **Save Working**: Values persist after save and page refresh
✅ **No Errors**: No JavaScript errors in console

---

**Debug Mode**: ✅ Active
**Server**: ✅ Running with enhanced logging
**Client**: ✅ Enhanced with debugging information

Use this guide to systematically identify where the issue occurs in the data flow.
