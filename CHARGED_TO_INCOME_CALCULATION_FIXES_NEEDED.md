# Charged to Income - Calculation Fixes Needed

## Current Status ✅
- Personnel can be tagged as "Charged to Income" 
- They appear in separate PS-Charged-to-Income tab
- They are removed from PS-Permanent and PS-Casual tabs

## Missing Fixes 🔴

### 1. PROJECTED INCOME Not Updated
**Problem**: When personnel are moved to Charged to Income, their salaries should be added to PROJECTED INCOME, but currently they're not.

**Location**: `/new-proposal-workflow` page - PROJECTED INCOME total

**Fix Needed**:
- Add `chargedToIncomeAmount` from PersonnelServices to income calculations
- Sum all chargedToIncomeAmount values where `chargedToIncomeEligible: true`
- Add this to the PROJECTED INCOME total

**Files to Update**:
- `CLIENT/src/pages/NewProposalWorkflowPage.jsx` - Update income calculation logic
- Need to fetch chargedToIncome personnel data and sum their amounts

### 2. PROJECTED SUBSIDY Still Includes Charged Personnel
**Problem**: When personnel are moved to Charged to Income, their subsidy amounts should be REMOVED from PROJECTED SUBSIDY, but they're still counting.

**Location**: `/new-proposal-workflow` page - PROJECTED SUBSIDY total

**Fix Needed**:
- When calculating subsidy totals, EXCLUDE personnel with `chargedToIncomeEligible: true`
- Their subsidyAmount should NOT be included in the subsidy total
- Reduce PROJECTED SUBSIDY by the amount of moved personnel's subsidies

**Files to Update**:
- `CLIENT/src/pages/NewProposalWorkflowPage.jsx` - Update subsidy calculation logic
- Need to filter out chargedToIncome personnel from subsidy totals

### 3. BudgetarySupportTable Not Including Charged to Income
**Problem**: The budget support table doesn't show the breakdown of Charged to Income amounts.

**Location**: `/new-proposal-workflow` page - BudgetarySupportTable component

**Fix Needed**:
- Add chargedToIncomeAmount field to calculations
- Show breakdown of where Charged to Income amounts are being used
- Update the "Use of Funds" breakdown to include chargedToIncome line item

**Files to Update**:
- `CLIENT/src/components/budgetarysupport/BudgetarySupportTable.jsx`

## Implementation Order
1. First: Update PROJECTED INCOME calculation
2. Then: Update PROJECTED SUBSIDY calculation  
3. Finally: Update BudgetarySupportTable

## Data Structure Reference
**Personnel with Charged to Income**:
```javascript
{
  _id: "...",
  employeeFullName: "...",
  chargedToIncomeEligible: true,
  chargedToIncomeAmount: 0,        // Amount charged to income
  chargedToIncomeTaggedAt: "...",  // When it was tagged
  subsidyAmount: 150000,            // This should be EXCLUDED from subsidy total now
  ...otherFields
}
```

## Query to Fetch Charged-to-Income Data
Endpoint: `GET /personnelServices?chargedToIncomeEligible=true`

Response includes:
- `personnelServices`: Array of charged-to-income personnel
- `totalRecords`: Total count
- Each record has `chargedToIncomeAmount` field

