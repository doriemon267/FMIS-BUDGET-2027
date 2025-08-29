# Auto-Save Functionality Test Guide

## 🔧 How Auto-Save Now Works

### **What was fixed:**
1. **Real auto-save logic** - Now actually saves data to the database
2. **Change tracking** - Detects when there are unsaved changes
3. **Visual indicators** - Shows save status and last saved time
4. **Smart detection** - Only saves when there are actual changes

### **Auto-Save Scenarios:**

#### **Scenario 1: Editing Existing Items**
1. Click **Edit** button on any item
2. Modify any field (income, subsidy, particulars, etc.)
3. **Auto-save will trigger** if enabled after 3 seconds of inactivity
4. You'll see "Auto-saved successfully!" toast message
5. **Last saved time** will update in the toolbar

#### **Scenario 2: Adding New Items**
1. Click **Add Item** for any category
2. Fill in the form fields
3. **Auto-save will NOT trigger** for incomplete new items
4. You'll see "Please complete adding new items first" message
5. **Must click Save button** to add new items

#### **Scenario 3: Manual Save**
1. Make any changes (edit existing items)
2. Click the **Save Changes** button in toolbar
3. Same logic as auto-save but triggered manually
4. Works even when auto-save is disabled

## 🧪 Testing Steps

### **Test 1: Enable Auto-Save**
1. Go to Capital Outlay page
2. Toggle **Auto-save (OFF)** to **Auto-save (ON)**
3. You should see: "Auto-save enabled - changes will be saved automatically after 3 seconds"

### **Test 2: Edit and Auto-Save**
1. Click **Edit** on any existing item
2. Change the **Income** or **Subsidy** value
3. Wait 3 seconds without typing
4. You should see: "Auto-saved successfully!" toast
5. Check **Last saved** time in toolbar
6. Refresh page to verify changes were saved

### **Test 3: Manual Save**
1. Disable auto-save
2. Edit any item
3. Notice **Save Changes** button becomes enabled
4. Click **Save Changes** button
5. Should see success message and "Saved" button state

### **Test 4: Unsaved Changes Indicator**
1. Edit any item
2. Notice **unsaved changes indicator** at bottom left
3. Save the changes
4. Indicator should disappear

### **Test 5: Add New Item (No Auto-Save)**
1. Click **Add Item**
2. Fill in some fields
3. Enable auto-save
4. Wait 3 seconds
5. Should see: "Please complete adding new items first"
6. Must click **Save** button in the row to add item

## 🎯 Expected Behavior

### **Auto-Save ON:**
- ✅ Saves edited items automatically after 3 seconds
- ✅ Shows "Auto-saved successfully!" message
- ✅ Updates last saved time
- ❌ Does NOT auto-save incomplete new items
- ✅ Shows visual feedback (green switch, primary color)

### **Auto-Save OFF:**
- ✅ Manual save button works
- ✅ Shows "Save Changes" when there are changes
- ✅ Shows "Saved" when no changes
- ✅ Unsaved changes indicator works
- ✅ Shows visual feedback (gray switch, disabled color)

### **Change Detection:**
- ✅ Detects income/subsidy changes
- ✅ Detects particulars changes
- ✅ Detects accounting title changes
- ✅ Resets after successful save
- ✅ Resets when canceling edits

## 🚨 Troubleshooting

### **If auto-save doesn't work:**
1. Check browser console for errors
2. Verify you're editing an existing item (not adding new)
3. Make sure auto-save toggle is ON
4. Wait full 3 seconds after last change
5. Check network tab for API calls

### **If changes aren't saved:**
1. Check validation errors (red text under fields)
2. Verify all required fields are filled
3. Check server is running (localhost:5005)
4. Look for error toast messages

### **If unsaved indicator doesn't show:**
1. Make sure you're actually changing values
2. Check that the field isn't disabled
3. Verify change tracking is working in console

## 💡 Pro Tips

### **For Testing:**
1. Open browser dev tools to see console logs
2. Watch Network tab for API calls
3. Use small changes to test quickly
4. Test both auto-save ON and OFF modes

### **For Users:**
1. **Auto-save is disabled by default** (as requested)
2. **Enable auto-save** for convenience during data entry
3. **Use manual save** for more control
4. **Watch for validation errors** that prevent saving
5. **Complete new items** before relying on auto-save

## 🔍 Debug Information

### **Console Logs to Look For:**
- "Auto-saving edited outlay: [ID]"
- "Cannot auto-save: Please fix validation errors first"
- "Auto-save: Please complete adding new items first"
- "No changes to auto-save"

### **API Calls to Verify:**
- `PUT /capital-outlays/[ID]` for edited items
- `GET /capital-outlays` for refreshing data
- Should see 200 status codes for successful saves

The auto-save functionality is now fully implemented and working! 🎉
