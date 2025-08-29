# Capital Outlay Endpoint Mismatch Fix

## 🐛 **Problem:**
Mga existing "Not Submitted" Capital Outlay items hindi nagbabago pagkapos mag-save as draft.

## 🔍 **Root Cause - Endpoint Mismatch:**

### **The Issue:**
May **dalawang different endpoints** na ginagamit para sa Capital Outlay data:

#### **1. CapitalOutlayTable (Individual Table):**
```javascript
// Fetching data
api.get("/capital-outlays")
// Response: { capitalOutlays: [...] }

// Saving data
api.post("/capital-outlays", {...})
api.put("/capital-outlays/${id}", {...})
```

#### **2. ProposalCustomPage (Global Save as Draft):**
```javascript
// Fetching data (BEFORE FIX)
api.get("/capital-outlay-list")
// Response: [...] (direct array)

// Save as Draft
api.post("/saveAsDraft", { capitalOutlayIds: [...] })
```

### **The Problem:**
1. **Individual saves** update data in `/capital-outlays` endpoint
2. **Global "Save as Draft"** reads data from `/capital-outlay-list` endpoint
3. **Different endpoints** = **Different data** = **Stale information**
4. **Save as Draft** works with **outdated data** that doesn't include newly saved items

### **Data Flow Problem:**
```
1. User adds Capital Outlay → Individual save → Updates /capital-outlays ✅
2. ProposalCustomPage reads from /capital-outlay-list ❌ (different endpoint)
3. Save as Draft uses stale data ❌
4. New items not included in draft save ❌
```

## 🔧 **Solution - Endpoint Unification:**

### **Fixed ProposalCustomPage to use same endpoint:**
```javascript
// BEFORE (Wrong endpoint)
const response = await api.get("/capital-outlay-list");
return response.data.map(item => ({
  ...item,
  key: item._id,
}));

// AFTER (Correct endpoint - same as CapitalOutlayTable)
const response = await api.get("/capital-outlays");
return response.data.capitalOutlays.map(item => ({
  ...item,
  key: item._id,
  status: item.status || "Not Submitted"
}));
```

### **Benefits of the Fix:**
1. **Same data source**: Both components read from `/capital-outlays`
2. **Real-time sync**: Individual saves immediately available to global save
3. **Consistent data structure**: Same response format and status handling
4. **No more stale data**: Save as Draft works with fresh, accurate data

## ✅ **What's Fixed:**

### **Before Fix:**
```
Data Flow:
Individual Save → /capital-outlays endpoint → Database ✅
Global Read → /capital-outlay-list endpoint → Stale data ❌
Save as Draft → Works with stale data → Items not included ❌
```

### **After Fix:**
```
Data Flow:
Individual Save → /capital-outlays endpoint → Database ✅
Global Read → /capital-outlays endpoint → Fresh data ✅
Save as Draft → Works with fresh data → Items included ✅
```

### **Status Flow Now Works:**
```
1. Add Capital Outlay item → Individual save → "Not Submitted" ✅
2. Global data automatically synced ✅
3. Save as Draft → Finds "Not Submitted" items ✅
4. Changes status to "Draft" ✅
5. Status overview shows correct counts ✅
```

## 🧪 **How to Test the Fix:**

### **Test Case 1: Basic Save as Draft**
1. **Add Capital Outlay items** and save individually
2. **Check status**: Should show "Not Submitted"
3. **Click "Save as Draft"** button
4. **Expected**: Items change to "Draft"
5. **Status overview**: Should show "Draft (X)" instead of "Not Submitted (X)"

### **Test Case 2: Console Verification**
1. **Open browser dev tools** → Console tab
2. **Add and save Capital Outlay items**
3. **Click "Save as Draft"**
4. **Look for logs**:
   ```
   "Capital Outlay Debug - Save as Draft:" {
     totalCapitalOutlayItems: X,
     eligibleCount: X,
     notSubmittedCount: X (before save)
   }
   
   "Capital Outlay Status After Save as Draft:" {
     expectedDraftCount: X,
     actualDraftCount: X (should match)
   }
   ```

### **Test Case 3: Network Tab Verification**
1. **Open Network tab** in dev tools
2. **Add Capital Outlay items** → Should see `POST /capital-outlays`
3. **Save as Draft** → Should see:
   - `GET /capital-outlays` (data refresh)
   - `POST /saveAsDraft` (with correct IDs)
   - `GET /capital-outlays` (final refresh)

## 🔍 **Debug Information:**

### **Console Logs to Watch:**
```
// Before Save as Draft
"Capital Outlay Debug - Save as Draft:" {
  totalCapitalOutlayItems: 3,
  eligibleCount: 2,           // Should include "Not Submitted" items
  notSubmittedCount: 2,       // Should be > 0 if you have new items
  draftCount: 0
}

// After Save as Draft
"Capital Outlay Status After Save as Draft:" {
  expectedDraftCount: 2,      // Number of items that should become "Draft"
  actualDraftCount: 2         // Should match expectedDraftCount
}
```

### **Expected API Calls:**
1. **Page Load**: `GET /capital-outlays` (loads existing data)
2. **Individual Save**: `POST /capital-outlays` (saves new item)
3. **Auto Refresh**: `GET /capital-outlays` (triggered by event)
4. **Save as Draft**: `POST /saveAsDraft` (changes status to Draft)
5. **Final Refresh**: `GET /capital-outlays` (shows updated statuses)

## 🎯 **Expected Results:**

### **✅ Unified Data Flow:**
- **Single source of truth**: `/capital-outlays` endpoint
- **Real-time synchronization**: No more stale data
- **Consistent behavior**: Individual and global saves work together
- **Accurate status tracking**: Status overview shows correct counts

### **✅ User Experience:**
- **Natural workflow**: Add items → Save individually → Save as draft
- **Immediate feedback**: Status changes visible right away
- **Reliable functionality**: Save as Draft always works with latest data
- **No manual refresh needed**: Everything syncs automatically

The Capital Outlay "Save as Draft" functionality now works correctly with existing "Not Submitted" items! 🎉
