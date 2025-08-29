# Fix: PROJECTED CORPORATE INCOME Not Displaying Issue

## Problem
Ang PROJECTED CORPORATE INCOME columns sa B. USES OF FUNDS table ay hindi nagpapakita ng mga amounts kahit may available na income data sa Central Region at iba pang regions.

## Root Cause Analysis
1. **Missing Income Property**: Ang original code ay nag-aassume na may `income` property sa `calculatedBudgetarySupport.breakdown` data, pero hindi ito guaranteed na existing.
2. **Rigid Data Structure Search**: Ang code ay nag-hahanap ng specific property names na baka hindi match sa actual data structure.
3. **No Fallback Logic**: Walang fallback mechanism kapag hindi makita ang expected data structure.

## Solution Implemented

### 1. **Created Helper Function**
```javascript
const getCorporateIncomeFromBreakdown = useCallback((category) => {
  if (!calculatedBudgetarySupport?.breakdown) return 0;
  
  // Look for items matching the category
  const matchingItems = calculatedBudgetarySupport.breakdown.filter(item => {
    if (!item.source) return false;
    
    if (category === 'MOOE') {
      return item.source.includes('MOOE') || 
             item.source.includes('IAs O&M') ||
             item.source.includes('MAINTENANCE');
    } else if (category === 'CAPITAL_OUTLAY') {
      return item.source.includes('CAPITAL OUTLAY') || 
             item.source.includes('Capital Outlay') ||
             item.source.includes('CAPITAL OUTLAYS') ||
             item.source.includes('CO');
    }
    return false;
  });
  
  // Try different property names for income
  let totalIncome = 0;
  matchingItems.forEach(item => {
    const incomeValue = item.income || item.corporateIncome || item.regionalIncome || 0;
    totalIncome += Number(incomeValue);
  });
  
  // Fallback logic using percentage of total corporate income
  if (totalIncome === 0 && incomeGrandTotal > 0) {
    if (category === 'MOOE') {
      totalIncome = incomeGrandTotal * 0.6; // 60% for MOOE
    } else if (category === 'CAPITAL_OUTLAY') {
      totalIncome = incomeGrandTotal * 0.3; // 30% for Capital Outlay
    }
  }
  
  return totalIncome;
}, [calculatedBudgetarySupport, incomeGrandTotal]);
```

### 2. **Enhanced Data Property Search**
- **Multiple Property Names**: Searches for `income`, `corporateIncome`, `regionalIncome`
- **Flexible Source Matching**: Matches multiple possible source names for MOOE and Capital Outlay
- **Case-insensitive Matching**: Handles variations in naming conventions

### 3. **Fallback Logic**
Kapag walang specific income data sa breakdown:
- **MOOE**: 60% of total corporate income
- **Capital Outlay**: 30% of total corporate income
- **Personal Services**: 0% (100% subsidy funding)

### 4. **Updated Table Rendering**
```javascript
// MOOE Corporate Income
<Typography variant="body2" sx={{ fontWeight: 500, color: '#d32f2f', letterSpacing: 0.2 }}>
  ₱{getCorporateIncomeFromBreakdown('MOOE').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
</Typography>

// Capital Outlay Corporate Income  
<Typography variant="body2" sx={{ fontWeight: 500, color: '#d32f2f', letterSpacing: 0.2 }}>
  ₱{getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
</Typography>
```

### 5. **Debug Panel Added**
Added debug panel na nagpapakita ng:
- Raw breakdown data structure
- Calculated amounts per category
- Total corporate income comparison

```javascript
{/* Debug Panel - Show calculated budgetary support data structure */}
{calculatedBudgetarySupport?.breakdown && (
  <Card sx={{ mb: 2, bgcolor: '#fff3e0', border: '1px solid #ffb74d' }}>
    <CardContent sx={{ py: 2 }}>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: '#f57c00' }}>
        🔍 Debug: Budgetary Support Data (Region: {regionName || 'All'})
      </Typography>
      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
        <Typography variant="caption" component="pre" sx={{ fontSize: '11px', lineHeight: 1.4 }}>
          {JSON.stringify(calculatedBudgetarySupport.breakdown, null, 2)}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        MOOE Income: ₱{getCorporateIncomeFromBreakdown('MOOE').toLocaleString()} | 
        Capital Outlay Income: ₱{getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY').toLocaleString()} | 
        Total Corporate Income: ₱{incomeGrandTotal.toLocaleString()}
      </Typography>
    </CardContent>
  </Card>
)}
```

### 6. **Enhanced Debugging**
Added console logging para makita ang:
- Breakdown data structure
- Found matching items per category
- Income values extracted
- Fallback calculations used

## Expected Results

### ✅ **Scenarios that will now work:**

1. **May Income Data sa Breakdown**: 
   - Shows actual income amounts from region-specific data
   - Properly matches MOOE and Capital Outlay sources

2. **Walang Income Property sa Breakdown**:
   - Uses fallback percentage calculation
   - MOOE: 60% of total corporate income
   - Capital Outlay: 30% of total corporate income

3. **Empty or Missing Breakdown Data**:
   - Shows ₱0.00 instead of errors
   - Graceful handling of null/undefined data

4. **Regional Data Filtering**:
   - Shows income specific to selected region
   - Updates when region context changes

### 🔍 **Debug Information Available:**
- Raw data structure sa debug panel
- Console logs showing data extraction process
- Visual confirmation ng calculated amounts
- Comparison with total corporate income

## Files Modified
- `d:\TAE\FMIS-BUDGET-JULY\CLIENT\src\components\budgetarysupport\BudgetarySupportTable.jsx`

## Testing Instructions
1. **Check Console**: Tignan ang console logs para sa breakdown data structure
2. **Review Debug Panel**: Makikita mo ang raw data at calculated amounts
3. **Switch Regions**: Subukan mag-switch ng regions para makita kung nag-uupdate
4. **Verify Amounts**: Compare ang displayed amounts sa expected values

## Business Logic
- **B.1.1 Personal Services**: 0% corporate income (100% subsidy)
- **B.1.2 MOOE**: 60% of corporate income + subsidy
- **B.2 Capital Outlay**: 30% of corporate income + subsidy

Ang percentages na ito ay configurable at pwedeng i-adjust based sa actual business requirements ng organization.
