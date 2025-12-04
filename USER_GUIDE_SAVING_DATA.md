# Proposal Entry - How to Save Your Data

## 📋 Quick Start

### Entering Data in MOOE, Income, or Capital Outlay Tables

1. **Type your values** into the income/subsidy fields
2. **Click the GREEN "SAVE" button** at the top of the table
3. **Wait for confirmation** - you should see:
   - ✅ Green success notification saying "Data saved successfully!"
   - The data should stay visible in the table

## ⚠️ Important

**❌ DO NOT:** Rely on auto-save. Your data is NOT automatically saved.  
**✅ DO:** Always click the SAVE button to persist your entries.

## 🛡️ What Happens to Your Data

### Before You Click SAVE
- Data is only in your browser's memory
- If you refresh the page, **you will lose your work**
- Text is visible in the input field (temporary)

### After You Click SAVE
- Data is sent to the server
- Server saves it to the database
- You see "Data saved successfully!" toast notification
- Data persists even if you refresh or close the browser

## ⚙️ The Auto-Save Checkbox

In the toolbar, you'll see:

```
☐ Auto-save (OFF)    ← checkbox on the left
```

### If You Enable Auto-save
- Check the box to turn it ON
- Data will automatically save every 1.5 seconds
- You'll see toast notifications for each save
- Not recommended for unreliable internet

### Default Setting
- Auto-save is **OFF** by default
- You must click SAVE button manually
- More reliable and transparent

## 🔄 Typical Workflow

```
1. Open table (Income, MOOE, Capital Outlay, etc.)
   ↓
2. Find a line item and enter a value
   ↓
3. Value appears in the field (not saved yet)
   ↓
4. Click the GREEN SAVE button
   ↓
5. Wait for success message (toast notification)
   ↓
6. ✅ Data is now saved to database
   ↓
7. You can close browser/navigate away - data is safe
```

## ✅ How to Verify Data Was Saved

### Method 1: Look for Success Toast
- After clicking SAVE
- Green notification appears saying "Data saved successfully!"
- Notification disappears after 3 seconds

### Method 2: Refresh Page
1. Enter data
2. Click SAVE
3. Refresh page (F5 or Ctrl+R)
4. If data is still there → ✅ saved successfully
5. If data is gone → ❌ it wasn't saved

### Method 3: Check Database (Admin Only)
Ask your admin to verify in MongoDB:
```
Collection: mooeproposals (or income, capitaloutlay, etc)
Filter: { fiscalYear: 2026, region: "YOUR_REGION" }
Should see your entries with the values you entered
```

## ❌ If Data Disappears

### What Might Have Happened
1. **You didn't click SAVE** - data was only in browser
2. **SAVE button failed** - check for error message
3. **Network error** - internet disconnected
4. **Browser crashed** - session lost

### What TO DO
1. **Check console** - Are there any error messages?
2. **Retry saving** - Click SAVE again
3. **Ask your admin** - Check if data is in database
4. **Report the issue** - Include:
   - What you typed
   - What you were saving (MOOE/Income/etc)
   - When it happened
   - Any error messages you saw

## 🎯 Best Practices

| ✅ DO | ❌ DON'T |
|------|---------|
| Click SAVE when done entering data | Assume data is saved without clicking SAVE |
| Refresh page AFTER seeing success message | Refresh immediately after clicking SAVE |
| Use SAVE + Auto-save together if you want extra safety | Rely only on auto-save |
| Keep browser window open while saving | Close browser or tab while saving |
| Check for error messages if SAVE fails | Ignore error messages and leave |

## 🤔 Common Questions

### Q: My data disappeared after I clicked SAVE. What happened?
A: Very unlikely. Check:
1. Did you see "Data saved successfully!" message?
2. Refresh page - is data there from database?
3. If yes, data was saved - you might have just missed it in the UI
4. If no, the SAVE might have failed - look for error message

### Q: Can I enter data without clicking SAVE?
A: Yes, but your data is NOT saved. It only exists in your browser.
If you refresh, close, or navigate away, you'll lose it.

### Q: Should I enable auto-save?
A: Only if you prefer not to click SAVE manually.
Default is OFF because explicit saves are more reliable.

### Q: What if SAVE button gives an error?
A: 
1. Read the error message carefully
2. Fix the issue (wrong amount format, etc)
3. Try SAVE again
4. If error persists, contact support with the error message

### Q: How long does SAVE take?
A: Usually 1-2 seconds. You should see the success message within that time.

### Q: Can I edit data after saving?
A: Yes! Just change the value and click SAVE again.
The new value will overwrite the old one in the database.

## 📞 Need Help?

- **Data won't save?** Check browser console for errors
- **Data disappeared?** Refresh page - it's probably still in the database
- **Button not responding?** Check your internet connection
- **Still stuck?** Contact your system administrator

---

**Remember**: SAVE button = Data is safe  
**No SAVE button** = Data is at risk
