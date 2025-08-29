# Budgetary Support Table - Uses of Funds Refactoring

## Overview
Refactored the table **B. USES OF FUNDS** in `BudgetarySupportTable.jsx` to include three new columns: **PROJECTED CORPORATE INCOME**, **PROJECTED SUBSIDY**, and **PROPOSED BUDGET**. This enhancement provides region-based breakdown of funding sources and requirements.

## Changes Made

### 1. **New Table Structure**

#### Previous Structure:
- Simple two-column table: Use of Funds | Amount

#### New Structure:
- Four-column table: 
  - **USE OF FUNDS** (40% width)
  - **PROJECTED CORPORATE INCOME** (15% width) 
  - **PROJECTED SUBSIDY** (15% width)
  - **PROPOSED BUDGET** (15% width)

### 2. **Column Logic by Category**

#### B.1.1 PERSONAL SERVICES
- **PROJECTED CORPORATE INCOME**: `-` (No corporate income allocation)
- **PROJECTED SUBSIDY**: Full personal services amount from region data
- **PROPOSED BUDGET**: Same as projected subsidy (100% subsidy funding)
- **Note**: Added explanatory text "(100% Subsidy - No corporate income allocation)"

#### B.1.2 MAINTENANCE AND OTHER OPERATING EXPENSES  
- **PROJECTED CORPORATE INCOME**: Income from MOOE-related categories in the region
- **PROJECTED SUBSIDY**: MOOE subsidy from budgetary support calculation
- **PROPOSED BUDGET**: Corporate Income + Subsidy
- **Note**: Added explanatory text "(Mixed funding: Regional income + Subsidy)"

#### B.2 CAPITAL OUTLAYS
- **PROJECTED CORPORATE INCOME**: Income from Capital Outlay-related categories in the region  
- **PROJECTED SUBSIDY**: Capital Outlay subsidy from budgetary support calculation
- **PROPOSED BUDGET**: Corporate Income + Subsidy
- **Note**: Added explanatory text "(Mixed funding: Regional income + Subsidy)"

### 3. **Data Sources**

#### Corporate Income Data:
```javascript
// MOOE Corporate Income
const mooeIncomeFromRegion = calculatedBudgetarySupport?.breakdown?.find(item => 
  item.source?.includes('MOOE') && item.income
)?.income || 0;

// Capital Outlay Corporate Income  
const coIncomeFromRegion = calculatedBudgetarySupport?.breakdown?.find(item => 
  (item.source?.includes('CAPITAL OUTLAY') || item.source?.includes('Capital Outlay')) && item.income
)?.income || 0;
```

#### Subsidy Data:
- Uses existing `useOfFundsBreakdown` calculations
- Personal Services: `useOfFundsBreakdown.personalServices`
- MOOE: `useOfFundsBreakdown.maintenanceAndOperating` 
- Capital Outlays: `useOfFundsBreakdown.capitalOutlays`

### 4. **Visual Enhancements**

#### Color Coding:
- **PROJECTED CORPORATE INCOME**: Red (`#d32f2f`) - Regional income
- **PROJECTED SUBSIDY**: Green (`#1a3c1a`) - Government funding  
- **PROPOSED BUDGET**: Blue (`#1565c0`) - Total requirement

#### Explanation Card:
- Added informational card above the table
- Shows region name and color-coded legend
- Explains what each column represents

#### Tooltips & Info:
- Added info icon with tooltip explaining the columns
- Individual explanatory notes under each category name

### 5. **Enhanced Export Functionality**

#### Updated CSV Export:
- Includes all new columns in export data
- Separate rows for each category with breakdown
- Enhanced filename with region information
- Updated export data structure:

```javascript
{
  'Description': 'B.1.1 PERSONAL SERVICES',
  'Projected Corporate Income': 0,
  'Projected Subsidy': parseFloat(useOfFundsBreakdown.personalServices || 0),
  'Proposed Budget': parseFloat(useOfFundsBreakdown.personalServices || 0),
  // ... other fields
}
```

### 6. **Region-Based Logic**

#### Region Context:
- All calculations are region-aware
- Uses `regionName` from context for filtering
- Corporate income comes from region-specific income data
- Explanation card shows current region

#### Data Flow:
1. **Input**: Region-filtered income data via `calculatedBudgetarySupport`
2. **Processing**: Extract income amounts for MOOE and Capital Outlay categories
3. **Display**: Show breakdown by funding source (corporate vs subsidy)
4. **Export**: Include region information in export data

## Technical Implementation

### Files Modified:
- `d:\TAE\FMIS-BUDGET-JULY\CLIENT\src\components\budgetarysupport\BudgetarySupportTable.jsx`

### Key Functions Updated:
- `handleExportToExcel()` - Enhanced with new column data
- Table rendering - Complete restructure with new columns
- Added explanation components

### Dependencies:
- Uses existing `calculatedBudgetarySupport` data structure
- Leverages `useOfFundsBreakdown` calculations  
- Integrates with `regionName` context

## Benefits

### 1. **Transparency**
- Clear breakdown of funding sources
- Distinguishes between corporate income and government subsidy
- Shows regional contribution to budget requirements

### 2. **Better Planning**
- Proposed budget column shows total requirements
- Helps in budget allocation decisions
- Region-specific income projections

### 3. **Enhanced Reporting**
- More detailed export data
- Professional presentation format
- Color-coded visual hierarchy

### 4. **User Experience**
- Explanatory cards and tooltips
- Clear visual indicators
- Consistent with existing UI patterns

## Testing Recommendations

1. **Verify Data Accuracy**: Ensure corporate income amounts match region-specific income data
2. **Test Region Switching**: Confirm values update when region changes
3. **Export Functionality**: Validate all columns appear correctly in CSV export
4. **Visual Consistency**: Check responsive design and color scheme
5. **Edge Cases**: Test with zero values, missing data, and multiple regions

## Future Enhancements

1. **Drill-down Detail**: Click to view subcategory breakdown
2. **Historical Comparison**: Show previous year comparisons
3. **Variance Analysis**: Compare projected vs actual amounts
4. **Interactive Charts**: Visual representation of funding mix
5. **Bulk Region Export**: Export data for all regions simultaneously
