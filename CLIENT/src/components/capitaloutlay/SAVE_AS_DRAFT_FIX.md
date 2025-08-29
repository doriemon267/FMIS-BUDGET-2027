# Capital Outlay Save as Draft Fix

## 🐛 **Problem:**
Sa Capital Outlay table, pag nag-save ako naka "Not Submitted" pero pag e-click ko na yung "Save as Draft" hindi sya nagbabago as "Draft".

## 🔍 **Root Cause Analysis:**

### **The Issue:**
The Capital Outlay table has **two separate save mechanisms** that don't communicate properly:

1. **Individual Save**: Each Capital Outlay item has its own save button that saves to database with "Not Submitted" status
2. **Global Save as Draft**: The "Save as Draft" button in ProposalCustomPage that should change status to "Draft"

### **Why It Doesn't Work:**
1. **Data Synchronization Issue**: Individual saves update the local CapitalOutlayTable state but don't refresh the global `capitalOutlayData` array in ProposalCustomPage
2. **Stale Data**: Global "Save as Draft" works with outdated data that doesn't include newly saved items
3. **Missing Integration**: No communication between individual saves and global state management

### **Flow Problem:**
```
1. User adds Capital Outlay item → Saves individually → Status: "Not Submitted"
2. Item saved to database ✅
3. Local CapitalOutlayTable state updated ✅
4. Global capitalOutlayData array NOT updated ❌
5. User clicks "Save as Draft" → Works with stale data ❌
6. New items not included in draft save ❌
```

## 🔧 **Solution Implemented:**

### **1. Enhanced Data Refresh Mechanism:**
```javascript
// After individual save in CapitalOutlayTable
onDataChange?.(updatedData);

// Trigger global data refresh
setTimeout(() => {
  if (window.location.pathname.includes('proposals')) {
    window.dispatchEvent(new CustomEvent('capitalOutlayDataChanged'));
  }
}, 500);
```

### **2. Event-Based Communication:**
- **Custom Event**: `capitalOutlayDataChanged` dispatched after individual saves
- **Event Listener**: ProposalCustomPage listens for this event
- **Automatic Refresh**: Triggers React Query invalidation and refetch

### **3. React Query Integration:**
```javascript
// In ProposalCustomPage
const handleCapitalOutlayDataChanged = () => {
  console.log("Capital Outlay data changed, refreshing global data...");
  queryClient.invalidateQueries([QUERY_KEYS.capitalOutlay]);
  queryClient.refetchQueries([QUERY_KEYS.capitalOutlay]);
};

window.addEventListener('capitalOutlayDataChanged', handleCapitalOutlayDataChanged);
```

### **4. Applied to Both Save Functions:**
- **handleSaveEdit**: When editing existing items
- **handleAddOutlay**: When adding new items
- **Consistent Behavior**: Both trigger global data refresh

## ✅ **What's Fixed:**

### **Before Fix:**
```
1. Add Capital Outlay item → Individual save → "Not Submitted" ✅
2. Click "Save as Draft" → No change ❌
3. Status remains "Not Submitted" ❌
4. Global state out of sync ❌
```

### **After Fix:**
```
1. Add Capital Outlay item → Individual save → "Not Submitted" ✅
2. Global data automatically refreshed ✅
3. Click "Save as Draft" → Changes to "Draft" ✅
4. Status overview updated correctly ✅
```

### **Integration Flow:**
```
Individual Save → Local State Update → onDataChange Callback → 
Custom Event Dispatch → Global Event Listener → React Query Refresh → 
Updated Global State → Save as Draft Works ✅
```

## 🧪 **How to Test the Fix:**

### **Test Case 1: New Item Save as Draft**
1. **Go to Capital Outlay table**
2. **Add new item** with income/subsidy values
3. **Click individual Save button** → Should show "Not Submitted"
4. **Wait 1 second** for global refresh
5. **Click "Save as Draft"** button in header
6. **Expected**: Item status changes to "Draft"
7. **Check status overview**: Should show "Draft (1)" instead of "Not Submitted (1)"

### **Test Case 2: Multiple Items**
1. **Add multiple Capital Outlay items**
2. **Save each individually** → All show "Not Submitted"
3. **Click "Save as Draft"**
4. **Expected**: All items change to "Draft"
5. **Status overview**: Should show "Draft (X)" where X = number of items

### **Test Case 3: Mixed Status**
1. **Have some existing "Draft" items**
2. **Add new items** → Save individually → "Not Submitted"
3. **Click "Save as Draft"**
4. **Expected**: 
   - Existing "Draft" items stay "Draft"
   - New "Not Submitted" items change to "Draft"

### **Test Case 4: Console Verification**
1. **Open browser dev tools** → Console tab
2. **Perform save operations**
3. **Look for logs**:
   - "Capital Outlay data changed, refreshing global data..."
   - "Status Overview Debug:" showing updated statuses

## 🔍 **Debug Information:**

### **Console Logs to Watch:**
```
// After individual save
"Outlay added successfully." or "Outlay updated successfully."

// After global refresh trigger
"Capital Outlay data changed, refreshing global data..."

// Status overview debug
"Status Overview Debug:" {
  capitalOutlayData: [
    { id: "...", status: "Not Submitted" },  // Before save as draft
    { id: "...", status: "Draft" }           // After save as draft
  ]
}
```

### **Network Tab Verification:**
1. **Individual Save**: `POST /capital-outlays` or `PUT /capital-outlays/{id}`
2. **Global Refresh**: `GET /capital-outlays` (triggered by event)
3. **Save as Draft**: `POST /saveAsDraft`
4. **Final Refresh**: `GET /capital-outlays` (after save as draft)

## 🎯 **Expected Behavior Now:**

### **✅ Seamless Integration:**
1. **Individual saves** work as before
2. **Global state** automatically stays in sync
3. **Save as Draft** includes all saved items
4. **Status overview** shows accurate counts
5. **No manual refresh** needed

### **✅ User Experience:**
- **Natural workflow**: Save items individually, then save as draft
- **Immediate feedback**: Status changes visible right away
- **Consistent behavior**: All save mechanisms work together
- **Reliable state**: No more stale data issues

The Capital Outlay table now properly integrates with the global "Save as Draft" functionality! 🎉
