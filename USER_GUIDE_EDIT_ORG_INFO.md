# BRD Consolidation - User Guide: Editing Organizational Information

## Overview

The BRD Consolidation Dashboard now includes an **Edit Organizational Information** feature that allows BRD analysts to correct or update:
- Division names
- Department names
- Office designations
- Central Office classification

## Where to Find the Edit Button

### Regional Structure (Regional Proposals)
1. Open the **BRD Consolidation** page
2. Click on the **"Regional"** tab
3. Find the region you want to edit
4. Look for the **Edit** button (pencil icon) in the "Actions" column next to each Division
5. Click to open the editor

### Central Office Structure (Central Office Proposals)
1. Open the **BRD Consolidation** page
2. Click on the **"Central Office"** tab
3. Look for the **Edit** button (pencil icon) in the "Actions" column next to each Department
4. Click to open the editor

## How to Edit Organizational Information

### Step 1: Open the Editor
- Click the **Edit** button next to the Division or Department you want to update
- An **"Edit Organizational Information"** dialog will open

### Step 2: View Current Information
The modal shows:
- **Current Consolidation:** The region and division
- **Proposal:** The proposal title associated with this record

### Step 3: Make Changes
Edit any of these fields as needed:

| Field | Purpose | Example |
|-------|---------|---------|
| **Division** | The organizational division | ADMINISTRATIVE AND FINANCE DIVISION |
| **Department** | The specific department | HEAD OFFICE |
| **Office (Optional)** | Office designation | CO, REGIONAL, MAIN OFFICE |
| **Central Office** | Checkbox to mark as Central Office | Check if CO proposal |

### Step 4: Save Changes
1. Click the **"Save Changes"** button
2. A success message will appear: "Organizational information updated successfully!"
3. The modal will close automatically
4. The dashboard will refresh to show the updated information

### Step 5: Verify Updates
- The Division/Department names in the table will now show the updated values
- The consolidation path will automatically update

## Important Notes

### What Happens When You Update?

- **Division Changes:** The consolidation path updates automatically
  - Before: MARIIS/MARIIS
  - After: MARIIS/ADMINISTRATIVE AND FINANCE DIVISION

- **Department Changes:** Reflected in the display but doesn't affect path
  - Before: MARIIS
  - After: HEAD OFFICE

- **Central Office Flag:** Changes the record organization
  - Unchecked: Shows in Regional structure by Region/Division
  - Checked: Moves to Central Office structure by Department

### Validation Rules

- ✅ Division field is required (cannot be empty)
- ✅ Department field is required (cannot be empty)
- ✅ Office field is optional
- ✅ Save button is disabled if no changes are made
- ✅ All changes are saved to the database immediately

### Common Tasks

#### Task 1: Correct a Division Name
```
Old: MARIIS
New: ADMINISTRATIVE AND FINANCE DIVISION
Result: Consolidation path updates automatically
```

#### Task 2: Mark as Central Office Proposal
1. Click Edit on the department
2. Check the "This is a Central Office proposal" checkbox
3. Click Save
4. Record moves to Central Office structure

#### Task 3: Add Office Designation
1. Click Edit on division/department
2. In "Office" field enter: CO, REGIONAL, etc.
3. Click Save

#### Task 4: Unmark as Central Office
1. Click Edit on the Central Office department
2. Uncheck the "This is a Central Office proposal" checkbox
3. Click Save
4. Record moves back to Regional structure

## Troubleshooting

### "Edit" button is disabled/not showing
- ✓ Refresh the page to reload data
- ✓ Check that you have BRD analyst permissions
- ✓ Verify the consolidation record exists

### "Save Changes" button is disabled
- ✓ You haven't made any changes yet
- ✓ Make a change to any field to enable Save

### Error message appears when saving
- ✓ Check internet connection
- ✓ Verify all required fields are filled
- ✓ Refresh page and try again
- ✓ Contact IT support if persists

### Changes don't appear after saving
- ✓ The page should auto-refresh
- ✓ If not, manually refresh the browser (F5)
- ✓ Your changes are saved in the database even if display is slow

## Best Practices

1. **Review Before Saving**
   - Double-check all changes are correct
   - Verify spelling of Division/Department names

2. **Use Consistent Naming**
   - Follow organizational hierarchy naming standards
   - Use official names from organizational structure

3. **Update Central Office Flag Correctly**
   - Mark as Central Office only for CO proposals
   - Leave unchecked for Regional proposals

4. **Document Major Changes**
   - Note significant organizational updates
   - Keep team informed of changes

## Example Scenarios

### Scenario 1: Wrong Division Name
**Situation:** Proposal shows "MARIIS" instead of actual division
**Solution:**
1. Click Edit next to MARIIS in Regional tab
2. Change Division to: "ADMINISTRATIVE AND FINANCE DIVISION"
3. Click Save
4. Dashboard updates with correct name

### Scenario 2: Proposal Should Be Central Office
**Situation:** Proposal is marked as Regional but should be Central Office
**Solution:**
1. Click Edit on the division
2. Check "This is a Central Office proposal"
3. Update Department field if needed
4. Click Save
5. Proposal moves to Central Office tab

### Scenario 3: Multiple Proposals Under Wrong Department
**Situation:** Several proposals show wrong department name
**Solution:**
1. Edit the first division/department
2. Update the Department field
3. Repeat for other affected records
4. All will show updated name

## Support & Questions

If you encounter issues or have questions:
- Check this guide for common tasks
- Refer to troubleshooting section
- Contact your BRD coordinator
- Report bugs to IT support

## Related Features

- **BRD Consolidation Dashboard:** Main view of all consolidated proposals
- **Fiscal Year Filter:** Select which fiscal year to display
- **Proposal Details:** Expand proposals to see budget details
- **Regional/Central Office Tabs:** Switch between organization types

---

**Last Updated:** November 20, 2025  
**Version:** 1.0
