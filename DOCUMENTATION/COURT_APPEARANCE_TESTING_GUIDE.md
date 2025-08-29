# Court Appearance Page - Testing Guide

## 🧪 How to Test the Enhanced Features

### **Prerequisites**
1. Make sure the application is running at `http://localhost:3006`
2. Navigate to the Court Appearance page
3. Ensure you have some test data in the database

### **1. Testing Auto-save Functionality**

#### **Enable Auto-save**
1. Look for the "Auto-save" toggle switch in the toolbar
2. Click to enable it (should show "Auto-save enabled" toast)
3. The switch should be in the "ON" position

#### **Test Auto-save Behavior**
1. Edit any "No. of Court Appearances" field
2. Wait for 3 seconds without making any changes
3. You should see:
   - "Auto-saving court appearances..." status
   - "Auto-saved successfully!" toast message
   - Save status indicator updates to show last saved time

#### **Test Auto-save Validation**
1. Enter a negative value in any court appearance field
2. Auto-save should NOT trigger
3. You should see validation error message
4. Fix the error and auto-save should work again

### **2. Testing Enhanced Save/Cancel Features**

#### **Manual Save**
1. Make changes to any court appearance values
2. Click the "Save" button
3. Should see loading spinner and "Saving..." text
4. Success toast: "Successfully saved X changes"
5. Save status updates with timestamp

#### **Cancel Changes**
1. Make some changes to court appearance values
2. Click the "Cancel" button
3. All changes should revert to original values
4. "Changes discarded" toast should appear
5. Modified indicators should disappear

#### **Save with Validation Errors**
1. Enter negative values in some fields
2. Try to click "Save" button
3. Button should be disabled
4. Validation error chip should appear
5. Fix errors and save button becomes enabled

### **3. Testing Export Functionality**

#### **CSV Export**
1. Click the menu button (⋮) in the toolbar
2. Select "Export to CSV"
3. A CSV file should download automatically
4. File name format: `court-appearances-YYYY-MM-DD.csv`
5. Open the file to verify all data is included

#### **Print Preview**
1. Click the menu button (⋮) in the toolbar
2. Select "Print Preview"
3. Print preview dialog should open
4. Verify the report contains:
   - "CONFIDENTIAL" watermark
   - Professional header with NIA branding
   - All court appearance data in table format
   - Grand totals at the bottom
   - Current date and record count

#### **Actual Printing**
1. In the print preview dialog, click "Print"
2. Browser print dialog should open
3. Verify landscape orientation is set
4. Print or save as PDF to test final output

### **4. Testing Enhanced Table Features**

#### **Summary Statistics**
1. Look above the table for summary chips
2. Should show:
   - Total Records count
   - Total Court Appearances sum
   - Total Amount sum
   - Search filter indicator (if searching)

#### **Column Totals**
1. Scroll to the bottom of the table
2. Footer should show:
   - Total Records count on the left
   - Sum of court appearances in the appropriate column
   - Sum of amounts in the amount column
3. Totals should update when you filter or search

#### **Enhanced Filtering**
1. Use the search box to filter records
2. Summary statistics should update
3. Column totals should recalculate
4. Search filter chip should appear in summary

### **5. Testing Validation & Error Handling**

#### **Input Validation**
1. Try entering negative numbers
2. Should see red error text under the field
3. Validation error chip appears in toolbar
4. Save button becomes disabled

#### **Error Recovery**
1. Fix validation errors
2. Error messages should disappear
3. Validation chip should be removed
4. Save button should become enabled

#### **Network Error Handling**
1. Disconnect internet or stop the server
2. Try to save changes
3. Should see appropriate error messages
4. Reconnect and try again - should work

### **6. Testing Visual Enhancements**

#### **Modified Record Indicators**
1. Edit any court appearance value
2. Should see "Modified" chip next to the input
3. Row might have different background color
4. After saving, indicators should disappear

#### **Loading States**
1. Click refresh button
2. Should see loading indicators
3. Data should reload with success message

#### **Responsive Design**
1. Resize browser window
2. Table should remain usable
3. Toolbar should adapt to smaller screens
4. Print preview should work on mobile

### **7. Performance Testing**

#### **Large Dataset Handling**
1. If you have many records, test scrolling
2. Pagination should work smoothly
3. Search and filter should be responsive
4. Export should handle all records

#### **Auto-save Performance**
1. Make rapid changes to multiple fields
2. Auto-save should debounce properly
3. Should not make excessive API calls
4. UI should remain responsive

### **8. Edge Cases to Test**

#### **Empty Data**
1. If no records exist, should show appropriate message
2. Export should handle empty data gracefully
3. Print preview should work with no data

#### **Invalid Settings**
1. Test behavior when court appearance rate is not set
2. Should show appropriate error messages
3. Should not crash the application

#### **Browser Compatibility**
1. Test in different browsers (Chrome, Firefox, Safari, Edge)
2. All features should work consistently
3. Print functionality should work across browsers

## ✅ Expected Results Summary

### **Working Features Checklist**
- [ ] Auto-save toggle works and saves after 3 seconds
- [ ] Manual save/cancel buttons work properly
- [ ] CSV export downloads correct data
- [ ] Print preview shows professional report
- [ ] Validation prevents negative values
- [ ] Column totals calculate correctly
- [ ] Summary statistics update in real-time
- [ ] Loading states show during operations
- [ ] Error messages are clear and helpful
- [ ] Modified record indicators appear/disappear
- [ ] Responsive design works on different screen sizes
- [ ] All buttons have proper tooltips
- [ ] Toast notifications appear for user actions

### **Performance Expectations**
- Page loads quickly (< 2 seconds)
- Auto-save triggers within 3 seconds
- Search/filter is responsive (< 500ms)
- Export completes within reasonable time
- Print preview generates quickly
- No memory leaks or performance degradation

### **Error Handling Verification**
- Validation errors are clearly displayed
- Network errors show appropriate messages
- Invalid data is handled gracefully
- User can recover from error states
- No application crashes or freezes

## 🐛 Common Issues & Solutions

### **If Auto-save Doesn't Work**
- Check if toggle is enabled
- Verify there are actual changes
- Look for validation errors
- Check browser console for errors

### **If Export Fails**
- Check if data exists
- Verify browser allows downloads
- Try different browser
- Check network connectivity

### **If Print Preview is Blank**
- Refresh the page and try again
- Check if data is loaded
- Try different browser
- Verify popup blockers are disabled

### **If Validation Errors Persist**
- Clear the field and re-enter value
- Refresh the page
- Check for special characters
- Verify number format is correct

## 📞 Support

If you encounter any issues during testing:
1. Check the browser console for error messages
2. Try refreshing the page
3. Clear browser cache if needed
4. Test in a different browser
5. Report specific steps to reproduce the issue
