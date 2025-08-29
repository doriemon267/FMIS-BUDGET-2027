# Updated Fix: PROJECTED CORPORATE INCOME Using Actual Recorded Data

## Problem
Hindi nagpapakita ng actual recorded income amounts sa PROJECTED CORPORATE INCOME columns kahit may recorded data na 115,444,000.00 para sa Central Region's Capital Outlay.

## Root Cause
Ginagamit ko ang fallback percentages (60% MOOE, 30% Capital Outlay) instead of accessing the actual recorded income data sa system.

## Updated Solution

### 1. **Removed Fallback Percentages**
Tinanggal ko na yung artificial percentages at nag-focus sa actual recorded data:

```javascript
// REMOVED: Fallback percentages
// if (totalIncome === 0 && incomeGrandTotal > 0) {
//   if (category === 'MOOE') {
//     totalIncome = incomeGrandTotal * 0.6; // ❌ REMOVED
//   } else if (category === 'CAPITAL_OUTLAY') {
//     totalIncome = incomeGrandTotal * 0.3; // ❌ REMOVED  
//   }
// }
```

### 2. **Added Direct Data Access**
Added queries to fetch actual MOOE and Capital Outlay data:

```javascript
// New MOOE data query
const { data: mooeData } = useQuery({
  queryKey: ['mooe-data', fiscalYear, budgetType, regionName],
  queryFn: async () => {
    // Fetch actual MOOE data with income fields
    const response = await api.get('/mooedata', { params });
    return response.data?.formattedData || response.data?.data || response.data || [];
  },
  enabled: hasValidParams
});

// Existing Capital Outlay data query (already available)
const { data: capitalOutlayData } = useQuery({...});
```

### 3. **Enhanced Income Extraction Logic**

#### For Capital Outlay:
```javascript
if (category === 'CAPITAL_OUTLAY') {
  // First: Try to get from calculatedBudgetarySupport breakdown
  if (calculatedBudgetarySupport?.breakdown) {
    const coItems = calculatedBudgetarySupport.breakdown.filter(item => 
      item.source?.includes('CAPITAL OUTLAY') || 
      item.source?.includes('Capital Outlay')
    );
    
    coItems.forEach(item => {
      const incomeValue = item.income || item.corporateIncome || item.regionalIncome || 0;
      totalIncome += Number(incomeValue);
    });
  }
  
  // Second: Try to get from direct capitalOutlayData
  if (totalIncome === 0 && capitalOutlayData && Array.isArray(capitalOutlayData)) {
    totalIncome = capitalOutlayData.reduce((sum, item) => {
      const incomeValue = Number(item.income) || 0;  // ✅ ACTUAL RECORDED INCOME
      return sum + incomeValue;
    }, 0);
  }
}
```

#### For MOOE:
```javascript
if (category === 'MOOE') {
  // First: Try breakdown data
  if (calculatedBudgetarySupport?.breakdown) {
    const mooeItems = calculatedBudgetarySupport.breakdown.filter(item => 
      item.source?.includes('MOOE') || item.source?.includes('IAs O&M')
    );
    // Extract income from breakdown
  }
  
  // Second: Try direct mooeData
  if (totalIncome === 0 && mooeData) {
    if (Array.isArray(mooeData)) {
      totalIncome = mooeData.reduce((sum, item) => {
        const incomeValue = Number(item.income) || 0;  // ✅ ACTUAL RECORDED INCOME
        return sum + incomeValue;
      }, 0);
    } else if (mooeData.formattedData) {
      // Handle nested structure
      totalIncome = mooeData.formattedData.reduce((sum, row) => {
        return sum + (row.children || []).reduce((childSum, child) => {
          const incomeValue = Number(child.income) || 0;  // ✅ ACTUAL RECORDED INCOME
          return childSum + incomeValue;
        }, 0);
      }, 0);
    }
  }
}
```

### 4. **Enhanced Debug Panel**
Added comprehensive debug panel na nagpapakita ng:

```javascript
{/* Debug Panel - Show income data sources and calculated values */}
<Card sx={{ mb: 2, bgcolor: '#fff3e0', border: '1px solid #ffb74d' }}>
  <CardContent sx={{ py: 2 }}>
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>Capital Outlay Income:</Typography>
        <Typography variant="body2" sx={{ color: '#d32f2f', fontWeight: 600 }}>
          ₱{getCorporateIncomeFromBreakdown('CAPITAL_OUTLAY').toLocaleString()}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Data points: {capitalOutlayData ? capitalOutlayData.length : 0}
        </Typography>
        {capitalOutlayData && capitalOutlayData.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            Sample income: ₱{(Number(capitalOutlayData[0]?.income) || 0).toLocaleString()}
          </Typography>
        )}
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>MOOE Income:</Typography>
        <Typography variant="body2" sx={{ color: '#d32f2f', fontWeight: 600 }}>
          ₱{getCorporateIncomeFromBreakdown('MOOE').toLocaleString()}
        </Typography>
      </Grid>
    </Grid>
    
    <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block', fontWeight: 600 }}>
      🎯 Expected Central Region Capital Outlay Income: ₱115,444,000.00
    </Typography>
  </CardContent>
</Card>
```

### 5. **Data Source Priorities**

#### Capital Outlay Income Priority:
1. **Primary**: `calculatedBudgetarySupport.breakdown[].income`
2. **Secondary**: `capitalOutlayData[].income` (direct database records)
3. **Fallback**: ₱0.00 (no artificial percentages)

#### MOOE Income Priority:
1. **Primary**: `calculatedBudgetarySupport.breakdown[].income`
2. **Secondary**: `mooeData[].income` or `mooeData.formattedData[].children[].income`
3. **Fallback**: ₱0.00 (no artificial percentages)

## Expected Results

### ✅ **For Central Region Capital Outlay:**
- Should now display the actual recorded ₱115,444,000.00
- Debug panel will show kung saan nakuha ang data
- Console logs will show extraction process

### ✅ **For Other Categories:**
- MOOE: Shows actual recorded income amounts per region
- Personal Services: Still 0% corporate income (100% subsidy)

### 🔍 **Debug Information:**
- Shows data source counts
- Displays sample income values
- Compares expected vs actual amounts
- Console logs show data extraction details

## Testing Instructions

1. **Navigate to Central Region** at Budgetary Support page
2. **Check Debug Panel** - dapat makita mo:
   - Capital Outlay Income: ₱115,444,000.00 (or actual recorded amount)
   - Data points count (ilang records)
   - Sample income value
3. **Check Console** para sa detailed logs
4. **Verify Table Display** - PROJECTED CORPORATE INCOME columns should show actual amounts
5. **Test Other Regions** para makita kung different amounts per region

## Files Modified
- `d:\TAE\FMIS-BUDGET-JULY\CLIENT\src\components\budgetarysupport\BudgetarySupportTable.jsx`

## Key Improvements
- ✅ **Uses actual recorded data** instead of artificial percentages
- ✅ **Multiple data sources** with proper priority
- ✅ **Enhanced debugging** to see data extraction process
- ✅ **Region-specific accuracy** - shows actual regional income
- ✅ **Graceful fallbacks** without artificial calculations

Ngayon dapat na makita mo na ang actual recorded income amounts sa PROJECTED CORPORATE INCOME columns, specifically yung ₱115,444,000.00 para sa Central Region's Capital Outlay!
