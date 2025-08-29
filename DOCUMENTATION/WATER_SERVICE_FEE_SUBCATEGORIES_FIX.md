# Water Service Fee Subcategories Fix

## Problem
Sa Region X, merong mga income subcategories na:
- "Balingasag Crusher (Region 10)"
- "Metropac (Region 10)" 
- "Water Fees (Mcdo)-Region 10"

Pero hindi sila nag-aappear under Water Service Fee category sa table, kahit may amount na nagpapakita sa tapat ng Water Service Fee.

## Root Cause Analysis
1. **Too strict region filtering** - Ang filtering logic ay nag-expect ng exact match sa region, pero ang subcategories ay may "Region 10" sa name nila while ang current region filter ay "Region X"

2. **Conflicting static subcategories** - May predefined static list ng Water Service Fee subcategories na hindi aligned sa actual data sa database, causing confusion

3. **Insufficient region matching logic** - Hindi flexible ang region matching logic para sa special cases like Region X/Region 10

4. **CO (Central Office) items showing in all regions** - Yung mga subcategories na may "(CO)" ay nagpapakita sa lahat ng regions kahit dapat Central Office lang

## Solutions Implemented

### 1. Made Water Service Fee Subcategories Purely Dynamic
```javascript
const getFilteredWaterServiceFeeSubcategories = () => {
  // Get all subcategories that actually exist in the database for Water Service Fee
  const waterServiceCategoryId = categoryMap.get("Water Service Fee")?.categoryId;
  
  // Find all unique subcategories from income items for Water Service Fee category
  const existingSubcategories = new Set();
  
  incomeItems.forEach(item => {
    if (!item.subcategory || !item.incomecategory) return;
    
    const itemCategoryId = typeof item.incomecategory === 'object' ? 
      item.incomecategory._id : item.incomecategory;
    
    // Check if this item belongs to Water Service Fee category
    if (itemCategoryId === waterServiceCategoryId) {
      existingSubcategories.add(item.subcategory);
    }
  });
  
  // Use only the subcategories that exist in the database (no more static predefined list)
  const allSubcategories = Array.from(existingSubcategories);
  
  // Filter based on region relevance - show all subcategories that are relevant to current region
  return Array.from(allSubcategories).filter(subcategory => {
    // If no region filter, show all
    if (!regionFilter) return true;
    
    // Show subcategories that are relevant to current region (even if empty)
    const isRelevantToRegion = 
      // 1. Subcategory explicitly mentions current region
      subcategory.includes(regionFilter) ||
      // 2. Special case: Region X should show Region 10 items
      (regionFilter === "Region X" && subcategory.includes("Region 10")) ||
      // 3. Special case: Region 10 should show Region X items  
      (regionFilter === "Region 10" && subcategory.includes("Region X")) ||
      // 4. CO (Central Office) items should only show when no region filter
      (subcategory.includes("(CO)") && !regionFilter) ||
      // 5. Generic subcategories (no specific region/location mentioned) - but exclude CO items
      (!subcategory.match(/Region \d+|NCR|MARIIS|UPRIIS|CAR|\(CO\)/i)) ||
      // 6. Check if there are actual data items for this subcategory in current region
      incomeItems.some(item => {
        // ... flexible region matching logic
      });
    
    return isRelevantToRegion;
  });
};
```

### 2. Flexible Region Matching Logic
Nag-improve ng region matching logic sa lahat ng relevant functions:

```javascript
// For region filtering - more flexible matching
const matchesRegion = !regionFilter || 
                     !item.region || 
                     item.region === regionFilter || 
                     item.region === "ALL" ||
                     (regionFilter === "Region X" && item.region === "Region 10") || // Special case for Region X/10
                     subcategory.includes(regionFilter) || // Check if region is mentioned in subcategory name
                     (regionFilter === "Region X" && subcategory.includes("Region 10")); // Another special case
```

### 3. Better Subcategory Amount Initialization
Nag-improve ng logic para sa proper initialization ng subcategory amounts:

```javascript
// If region filter is active, only include items from the current region or "ALL"
if (regionFilter) {
  if (item.region === regionFilter || item.region === "ALL" || !item.region) {
    initialAmounts[standardKey] = (currentValue + value).toString();
    console.log(`Added ${value} to ${item.subcategory} for region ${regionFilter}: total = ${initialAmounts[standardKey]}`);
  }
} else {
  // If no region filter, include all items
  initialAmounts[standardKey] = (currentValue + value).toString();
}
```

### 4. Enhanced Auto-save and Change Detection
Nag-add ng auto-save functionality para sa subcategory amounts:

```javascript
// Auto-save if enabled
if (autoSave) {
  // Clear existing timer
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  
  // Set new timer for auto-save
  const timer = setTimeout(() => {
    handleSaveSubcategoryAmount({ categoryId, _id: categoryId }, subcategoryName);
  }, 2000); // Auto-save after 2 seconds of inactivity
  
  setAutoSaveTimer(timer);
}
```

### 5. Improved Debug Logging
Nag-add ng comprehensive debug logging para makita kung ano ang nangyayari:

```javascript
console.log("Water Service Fee related items found:", waterServiceItems.length);
waterServiceItems.forEach(item => {
  console.log(`  - ${item.subcategory} (Region: ${item.region || 'none'}, Amount: ${item.amount || item.cost || 0})`);
});
```

## Expected Results

1. **Lahat ng relevant subcategories ay lalabas** - Lahat ng subcategories na related sa current region ay lalabas sa table under Water Service Fee, kahit walang data pa

2. **Empty fields para sa walang data** - Subcategories na walang existing data ay may empty input fields na pwedeng lagyan ng user later

3. **Visual indicators** - May "Available for input" chip sa mga empty subcategories para alam ng user na pwede sila mag-input

4. **Flexible region matching** - Ang Region X ay makaka-recognize ng Region 10 items at vice versa

5. **Purely dynamic subcategories** - Walang static predefined list - purely based na sa actual data sa database

6. **Proper amount display** - Yung amounts ay mag-display properly sa input fields

7. **Real-time updates** - May auto-save functionality at proper change detection

8. **Proper CO item isolation** - Ang mga CO (Central Office) items ay hindi na lalabas sa regional views, Central Office lang ang makakakita

## Testing Instructions

1. Navigate to Income Table sa Region X
2. Expand ang Water Service Fee category
3. Dapat makita na yung mga subcategories na related sa Region X/Region 10:
   - Balingasag Crusher (Region 10) - with existing amounts
   - Metropac (Region 10) - with existing amounts  
   - Water Fees (Mcdo)-Region 10 - with existing amounts
   - Other Region 10 subcategories - may show as empty fields with "Available for input" chip
4. Dapat may amounts na naka-display sa input fields para sa may existing data
5. Empty subcategories ay may "Available for input" chip para alam mo na pwede mag-input
6. Try mag-edit ng amounts - dapat mag-auto-save after 2 seconds
7. Try mag-add ng amount sa empty subcategories - dapat mag-save din
8. Check sa console logs para sa debug information

## Additional Improvements

1. **Save button per subcategory** - May individual save button para sa bawat subcategory
2. **Visual indicators** - May indicators kung may unsaved changes
3. **Better error handling** - Improved error messages
4. **Performance optimization** - Mas efficient na calculations

## Files Modified

- `CLIENT/src/components/corporateincome/IncomeTable.jsx`

## Notes

- Ang fixes ay backward compatible - hindi masisira yung existing functionality
- Ang region matching logic ay flexible pero safe - hindi mag-mix ng wrong data
- May extensive logging para sa debugging at monitoring