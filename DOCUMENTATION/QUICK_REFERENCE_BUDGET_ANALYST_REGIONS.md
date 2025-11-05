# 📖 Quick Reference - Budget Planning Analyst Region Assignment

## For Admins: How to Use

### Creating a NIA-Wide Budget Planning Analyst

1. Go to **Settings → Hierarchical User Assignments**
2. Enter the **User ID** (e.g., 908785)
   - User information auto-fills
3. Select **User Role**: `BUDGET_PLANNING_ANALYST`
4. Select **Assignment Level**: Usually `Responsibility Center Level`
5. **NEW**: Select **"NIA-Wide / All Regions"** button
6. Click **UPDATE ASSIGNMENT**

✅ **Result**: Analyst can see proposals from ALL regions

---

### Creating a Region-Specific Budget Planning Analyst

1. Go to **Settings → Hierarchical User Assignments**
2. Enter the **User ID** (e.g., 908786)
   - User information auto-fills
3. Select **User Role**: `BUDGET_PLANNING_ANALYST`
4. Select **Assignment Level**: Usually `Responsibility Center Level`
5. **NEW**: Select **"Specific Regions"** button
6. **NEW**: Select regions from the list
   - Example: Select **MARIIS**, **CALABARZON**
   - Can select 1 or more regions
7. Click **UPDATE ASSIGNMENT**

✅ **Result**: Analyst can see proposals ONLY from selected regions

---

## Information Display

In the **Current Assignments** table, you'll see:

| User | Role | Level | Organization | Region Access |
|------|------|-------|--------------|----------------|
| John Analyst | Budget Planning Analyst | Responsibility Center | NIA | **NIA-Wide** |
| Jane Regional | Budget Planning Analyst | Responsibility Center | NIA | **MARIIS, CALABARZON** |

---

## Editing an Existing Assignment

1. Click the **✏️ Edit** icon next to analyst's name
2. To change to NIA-Wide:
   - Click **"NIA-Wide / All Regions"** button
   - Click **UPDATE ASSIGNMENT**
3. To change specific regions:
   - Click **"Specific Regions"** button
   - Select NEW regions (old selection clears)
   - Click **UPDATE ASSIGNMENT**

---

## What Does Each Setting Do?

### 🌍 NIA-Wide / All Regions
- Analyst sees **ALL** proposals from **ALL** regions
- No region restrictions
- Best for: Nationwide analysts, headquarters analysts
- Example: "NIA can have analyst see all regional submissions"

### 🎯 Specific Regions
- Analyst sees proposals from **ONLY selected regions**
- Cannot see proposals from other regions
- Must select at least 1 region
- Best for: Regional analysts, specialized analysts
- Example: "MARIIS analyst only sees MARIIS proposals"

---

## Real-World Example

**Scenario**: Proposal submitted from MARIIS Region

### Who Sees It?

| Analyst | Region Access | Can See? |
|---------|---------------|----------|
| John (NIA-Wide) | All regions | ✅ YES |
| Jane (MARIIS) | MARIIS, CALABARZON | ✅ YES |
| Bob (ILOCOS) | ILOCOS only | ❌ NO |
| Grace (NIA-Wide) | All regions | ✅ YES |

---

## Changed Name

The "Budget Admin Level" has been renamed to **"Budget Revenue Division Level"**

- This is the **FULL** assignment level
- Used for administrators with complete system access
- NOT the same as Budget Planning Analyst

---

## Troubleshooting

### ❌ Error: "Please select at least one region"
- You selected "Specific Regions" but didn't choose any regions
- **Fix**: Select at least 1 region from the dropdown

### ❌ Error: "Budget Planning Analyst must be assigned..."
- You didn't select NIA-Wide OR any specific regions
- **Fix**: Click one of the two buttons to make a selection

### ❌ Analyst can't see any proposals
- Check if analyst has region assignment:
  1. View analyst in "Current Assignments" table
  2. Check if showing "NIA-Wide" or specific regions
  3. If blank/missing: Create or update the assignment

### ❌ Analyst sees proposals they shouldn't
- Check the analyst's region assignment
- Verify analyst regions match proposal regions
- If NIA-Wide, they will see all proposals (as designed)

---

## Common Tasks

### Task 1: Set Up Analyst for Single Region
1. Create assignment with role `BUDGET_PLANNING_ANALYST`
2. Select "Specific Regions"
3. Select **ONE** region
4. Save

### Task 2: Set Up Analyst for Multiple Regions
1. Create assignment with role `BUDGET_PLANNING_ANALYST`
2. Select "Specific Regions"
3. Select **multiple** regions (click each one)
4. Save

### Task 3: Upgrade Analyst to NIA-Wide
1. Edit existing assignment
2. Click "NIA-Wide / All Regions"
3. Save
4. (Old region selection clears automatically)

### Task 4: Downgrade Analyst to Specific Regions
1. Edit existing assignment
2. Click "Specific Regions"
3. Select desired regions
4. Save

---

## Key Points to Remember

✅ Every Budget Planning Analyst MUST have:
- Either **NIA-Wide** access, OR
- One or more **Specific Regions** assigned

❌ You CANNOT:
- Leave a Budget Planning Analyst with no region assignment
- Assign conflicting region settings

📌 Region assignment affects:
- Which proposals analyst can VIEW
- Which proposals analyst can WORK ON
- System-level data visibility

---

## Support

**For more details**, see:
- 📖 Full Implementation Guide: `BUDGET_PLANNING_ANALYST_REGION_ASSIGNMENT.md`
- 🛠️ Technical Details: `BUDGET_PLANNING_ANALYST_IMPLEMENTATION_COMPLETE.md`

---

**Last Updated**: November 4, 2025  
**System Version**: FMIS Budget v1.0
