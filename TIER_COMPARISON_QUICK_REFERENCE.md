# 🚀 Tier Comparison - Quick Reference Guide

## 📍 Access the Feature

**URL:** `/tier-comparison`

**Menu Path:** Budget Proposal Management → Tier Comparison

**Required Roles:**
- BUDGET_PLANNING_ANALYST
- budgetAnalyst
- BUDGET_OFFICER
- BUDGET_MANAGER
- overallBudgetApprover
- superAdmin

---

## ⚡ Quick Actions

### View Tier 1 Data (Read-Only)
1. Select region from dropdown
2. Click **Refresh**
3. Switch to **Tier 1 (Read-Only)** tab
4. View all finalized proposals

### Create Tier 2 (Editable Copy)
1. Select region
2. Click **Copy Tier 1 to Tier 2**
3. Wait for confirmation
4. Switch to **Tier 2 (Editable)** tab

### Edit Tier 2 Proposal
1. Go to Tier 2 tab
2. Click **Edit** icon (✏️)
3. Modify fields in dialog
4. Click **Save Changes**

### Delete Tier 2 Proposal
1. Go to Tier 2 tab
2. Click **Delete** icon (🗑️)
3. Confirm deletion
4. *(Only works for Draft status)*

---

## 🎯 Key Features at a Glance

| Feature | Tier 1 | Tier 2 |
|---------|--------|--------|
| **Editable** | ❌ No | ✅ Yes |
| **Data Source** | Finalized proposals | Copied from Tier 1 |
| **Status** | Finalized only | Draft, Under Review, Approved, Finalized |
| **Purpose** | Reference baseline | Planning and adjustments |
| **Deletion** | ❌ Not allowed | ✅ Allowed (Draft only) |
| **History** | ❌ No | ✅ Full audit trail |

---

## 📊 Summary Cards

### Tier 1 Total
- Shows total of all finalized proposals
- **Color:** Blue

### Tier 2 Total
- Shows total of adjusted proposals
- **Color:** Purple

### Adjustment
- Shows difference between Tier 2 and Tier 1
- **Green:** Positive (increase)
- **Red:** Negative (decrease)

---

## 📝 Editable Fields in Tier 2

| Field | Type | Purpose |
|-------|------|---------|
| **Title** | Text | Name of proposal |
| **Description** | Text Area | Detailed description |
| **Tier 2 Amount** | Number | Adjusted budget amount |
| **Remarks** | Text Area | Justification for changes |
| **Priority** | Dropdown | High, Medium, Low, Critical |
| **Status** | Dropdown | Draft, Under Review, Approved, Finalized |

---

## 🔢 Auto-Calculated Fields

### Adjustment Amount
```
adjustmentAmount = tier2Amount - tier1Amount
```

### Adjustment Percentage
```
adjustmentPercentage = (adjustmentAmount / tier1Amount) × 100
```

---

## 🎨 Color Coding

| Element | Color | Meaning |
|---------|-------|---------|
| 🟢 Green Amount | Success | Positive adjustment (increase) |
| 🔴 Red Amount | Error | Negative adjustment (decrease) |
| 🟢 Green Chip | Success | Finalized status |
| 🔵 Blue Chip | Primary | Draft/In Progress |
| 🟡 Yellow Chip | Warning | High priority |
| 🔴 Red Chip | Error | Critical priority |

---

## 🔒 Status Restrictions

| Status | Can Edit? | Can Delete? |
|--------|-----------|-------------|
| **Draft** | ✅ Yes | ✅ Yes |
| **Under Review** | ✅ Yes | ❌ No |
| **Approved** | ✅ Yes | ❌ No |
| **Finalized** | ❌ No | ❌ No |
| **Locked** | ❌ No | ❌ No |

---

## 🔍 Filter Options

### Region
- Dropdown with all regions having finalized proposals
- **Required field**

### Fiscal Year
- Text input
- Default: 2025

### Budget Type
- Dropdown: All, Initial, NEP, GAA
- Optional filter

---

## 📱 Responsive Design

| Device | Layout |
|--------|--------|
| **Desktop** | Full two-panel interface |
| **Tablet** | Stacked tabs, full features |
| **Mobile** | Compact view, scrollable tables |

---

## ⚠️ Common Errors & Solutions

### "No finalized proposals found"
**Solution:** Select a different region or check if proposals are finalized

### "Tier 2 already exists"
**Solution:** Update existing Tier 2 records instead of copying again

### "Cannot edit this proposal"
**Solution:** Proposal is Finalized or Locked - change status first

### "Region parameter is required"
**Solution:** Select a region from the dropdown before refreshing

---

## 🔗 API Endpoints Reference

| Action | Method | Endpoint |
|--------|--------|----------|
| Get Tier 1 | GET | `/api/tier-comparison/tier1/finalized` |
| Get Tier 2 | GET | `/api/tier-comparison/tier2` |
| Copy to Tier 2 | POST | `/api/tier-comparison/tier2/copy-from-tier1` |
| Update Tier 2 | PUT | `/api/tier-comparison/tier2/:id` |
| Delete Tier 2 | DELETE | `/api/tier-comparison/tier2/:id` |
| Get Regions | GET | `/api/tier-comparison/regions` |

---

## 💾 Data Categories

Tier 1 data includes proposals from:

1. **Personnel Services** - Employee-related budgets
2. **MOOE** - Maintenance and Other Operating Expenses
3. **Capital Outlay** - Infrastructure and equipment
4. **Income** - Revenue and income projections
5. **Budgetary Support** - Support and subsidies

---

## 🧮 Calculation Examples

### Example 1: Increase
```
Tier 1 Amount: ₱50,000,000
Tier 2 Amount: ₱55,000,000
──────────────────────────
Adjustment:    +₱5,000,000 (10%)  🟢
```

### Example 2: Decrease
```
Tier 1 Amount: ₱50,000,000
Tier 2 Amount: ₱45,000,000
──────────────────────────
Adjustment:    -₱5,000,000 (-10%)  🔴
```

### Example 3: No Change
```
Tier 1 Amount: ₱50,000,000
Tier 2 Amount: ₱50,000,000
──────────────────────────
Adjustment:    ₱0 (0%)
```

---

## 🎯 Best Practices

### ✅ Do's
- ✅ Always add remarks when making adjustments
- ✅ Set appropriate priority levels
- ✅ Review summary cards before finalizing
- ✅ Use meaningful titles for Tier 2 entries
- ✅ Keep Tier 2 status updated

### ❌ Don'ts
- ❌ Don't delete approved proposals
- ❌ Don't skip adding justification remarks
- ❌ Don't finalize without review
- ❌ Don't copy Tier 1 multiple times for same region
- ❌ Don't modify Tier 1 data (it's read-only)

---

## 🔔 Notifications

| Event | Notification |
|-------|--------------|
| Copy Success | "Successfully copied X Tier 1 proposals to Tier 2" |
| Update Success | "Tier 2 proposal updated successfully" |
| Delete Success | "Tier 2 proposal deleted successfully" |
| Copy Error | "Tier 2 proposals already exist..." |
| Edit Error | "This Tier 2 proposal is locked..." |
| Load Error | "Failed to fetch..." |

---

## 📊 Sample Workflow Timeline

```
Day 1: Review Tier 1 finalized data
       ↓
Day 2: Copy Tier 1 to Tier 2 (Draft status)
       ↓
Day 3-5: Make adjustments, add remarks
       ↓
Day 6: Set priority levels
       ↓
Day 7: Change status to "Under Review"
       ↓
Day 8-10: Team review and discussions
       ↓
Day 11: Approve adjustments
       ↓
Day 12: Finalize Tier 2 proposals
```

---

## 🎓 Training Tips

### For New Users
1. Start with viewing Tier 1 (read-only) to understand the data
2. Practice copying to Tier 2 with a test region
3. Make small edits and observe auto-calculations
4. Review summary cards to see impact
5. Practice with different priority and status values

### For Administrators
1. Monitor Tier 2 approval history
2. Review adjustment percentages for reasonableness
3. Ensure proper justification in remarks
4. Verify status transitions follow workflow
5. Check audit trail regularly

---

## 📞 Support

### Documentation
- 📖 Full Documentation: `TIER_COMPARISON_FEATURE_DOCUMENTATION.md`
- 🏗️ Architecture: `TIER_COMPARISON_VISUAL_ARCHITECTURE.md`
- 📋 Summary: `TIER_COMPARISON_IMPLEMENTATION_SUMMARY.md`

### Getting Help
- 💬 Technical Support: Contact system administrator
- 🐛 Bug Reports: Use issue tracking system
- 💡 Feature Requests: Submit to development team

---

## ✅ Pre-Flight Checklist

Before starting work:
- [ ] Logged in with BRD-level role
- [ ] Region selected
- [ ] Fiscal year confirmed
- [ ] Tier 1 data loaded and verified
- [ ] Understanding of adjustment goals

Before finalizing:
- [ ] All adjustments reviewed
- [ ] Remarks added for all changes
- [ ] Priority levels assigned
- [ ] Status updated appropriately
- [ ] Summary totals verified
- [ ] Team approval received

---

## 🔢 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl + R` | Refresh data |
| `Tab` | Switch between tabs |
| `Esc` | Close edit dialog |
| `Enter` | Save changes (in dialog) |

---

## 📈 Performance Tips

### For Better Performance
- Filter by specific fiscal year
- Select single region instead of all
- Close edit dialog when not in use
- Refresh only when needed
- Clear browser cache periodically

---

## 🎉 Success Indicators

You'll know you're successful when:
- ✅ Tier 2 data shows in table
- ✅ Adjustments calculate automatically
- ✅ Summary cards update correctly
- ✅ Edit dialog saves without errors
- ✅ Toast notifications appear
- ✅ Status changes reflect immediately

---

**Version:** 1.0.0  
**Last Updated:** December 2, 2025  
**Status:** ✅ Production Ready
