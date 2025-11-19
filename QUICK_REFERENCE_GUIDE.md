# 🎯 QUICK REFERENCE - PERSONNEL SERVICES UPDATES

**Last Updated**: November 18, 2025

---

## 📝 What Changed?

### ✅ New Feature: "Charged to Income"
- Alternative to "Charged to Subsidy"
- Works for Permanent AND Casual employees
- Independent from subsidy categorization
- Same employee can have BOTH

---

## 🎨 User Interface Changes

### New Button Location
```
Personnel Services Tab
├── Tag Subsidy Button
├── ✨ Charge to Income Button (NEW)
└── Remove Tag Button
```

### New Display in Proposals
```
Personnel Table
├── Employee Name
├── Position
├── Status
├── ✨ Tags Column (NEW)
│   ├── 🔵 "PS - Subsidy" (if subsidized)
│   └── 🟢 "PS - Charged to Income" (if charged)
├── Monthly Salary
├── Annual Salary
└── Total
```

---

## 🔧 How to Use

### Tagging an Employee for Charged to Income

**Step 1**: Open Personnel Services  
**Step 2**: Select Permanent or Casual employees  
**Step 3**: Click "Charge to Income" button  
**Step 4**: Enter amount per employee  
**Step 5**: (Optional) Add notes  
**Step 6**: Click "Apply Charged to Income"  
**Step 7**: View updated tags in proposal  

### Removing a Tag

**Step 1**: Select tagged employees  
**Step 2**: Click "Remove Tag" button  
**Step 3**: Confirm removal  

---

## 📊 Proposal Details Display

### What You'll See

| Employee | Position | Status | Tags | Salary |
|----------|----------|--------|------|--------|
| John Doe | Engineer | PERMANENT | 🔵 PS - Subsidy | ₱50,000 |
| Jane | Manager | PERMANENT | 🟢 PS - Income | ₱60,000 |
| Bob | Clerk | CASUAL | 🔵🟢 Both | ₱30,000 |
| Mary | Officer | PERMANENT | - | ₱55,000 |

---

## 💾 Data Structure

```
Personnel Record:
├── subsidyEligible: true/false
├── subsidyAmount: number
├── chargedToIncomeEligible: true/false
└── chargedToIncomeAmount: number
```

---

## 🎯 Key Points

✅ **Independent Categories**
- Subsidy and Charged to Income are separate
- Amount for each can be different
- Employee can have one, both, or neither

✅ **Visual Indicators**
- 🔵 Blue = Charged to Subsidy
- 🟢 Green = Charged to Income
- Both = Employee has both designations

✅ **Bulk Operations**
- Tag multiple employees at once
- Set same amount for all
- Add notes for the batch

✅ **Audit Trail**
- Records who made the change
- Records when the change was made
- Cannot be edited once finalized

---

## 🚀 Available Actions

| Action | Location | Enabled When |
|--------|----------|--------------|
| Tag for Subsidy | Personnel Services | Employees selected |
| Charge to Income | Personnel Services | Employees selected |
| Remove Tags | Personnel Services | Employees selected |
| View Tags | Proposals | Employee tagged |
| View Both | Proposals | Employee dual-tagged |

---

## ⚠️ Important Rules

❌ **Cannot modify:**
- Finalized proposals
- Submitted personnel records
- Locked employee entries

✅ **Can modify:**
- Draft personnel
- Employees in active proposals
- Both tags (independent)

---

## 📍 Navigation Path

```
Personnel Services Page
    ├── Permanent Personnel Tab
    │   ├── Select Employees
    │   ├── Click "Charge to Income" ✨
    │   └── Set Amount & Notes
    │
    └── Casual Personnel Tab
        ├── Select Employees
        ├── Click "Charge to Income" ✨
        └── Set Amount & Notes
            ↓
        Proposal Details
        └── View Tags in Table
            ├── "PS - Subsidy"
            └── "PS - Charged to Income"
```

---

## 🎨 Tag Colors

| Tag | Color | Meaning |
|-----|-------|---------|
| PS - Subsidy | 🔵 Blue | Charged to Subsidy Fund |
| PS - Charged to Income | 🟢 Green | Charged to Income |
| No Tag | - | Not categorized |

---

## 📋 Comparison: Before vs After

### Before
- Only "Tag Subsidy" available
- Cannot charge employees to income
- Limited budget categorization

### After
- "Tag Subsidy" available ✅
- **"Charge to Income" available** ✨
- **Both independent categories** ✨
- **Visual tags in proposals** ✨
- **Flexible budget categorization** ✨

---

## 🔍 Troubleshooting

**Q: Button is disabled?**  
A: Select at least one employee first

**Q: Tags not showing in proposal?**  
A: Ensure personnel are tagged before viewing proposal

**Q: Cannot remove tag?**  
A: Record might be finalized - check proposal status

**Q: Amount error?**  
A: Amount must be greater than zero

---

## 📞 Support

For issues or questions about:
- **New Charged to Income feature**: Check documentation
- **Tag display in proposals**: Verify tags were applied
- **Access or permissions**: Contact administrator
- **Data issues**: Check audit trail

---

## ✨ Summary

Personnel Services now has complete dual-categorization support:

1. **Subsidy** - For subsidized employees (existing)
2. **Charged to Income** - For income-charged employees (NEW)

Both are independent and can be applied to the same employee. All tags are visible in proposal detail tables for complete transparency.

**Ready to use!** 🚀

---

*For more details, see the comprehensive documentation files.*
