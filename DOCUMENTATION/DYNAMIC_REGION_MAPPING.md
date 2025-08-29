# Dynamic Region Mapping for Water Service Fee Subcategories

## Overview
This system implements dynamic region-based filtering for Water Service Fee subcategories based on the `region` field stored in the database, eliminating the need for static mappings.

## How It Works

### 1. **Subcategory Creation**
When creating new income subcategories:
- Automatically assigns the current active region to the `region` field
- Uses this priority order: `regionFilter` → `currentUser.Region` → `"Central Office"`
- Each subcategory is "owned" by the region where it was created

### 2. **Dynamic Filtering**
When displaying Water Service Fee subcategories:
- Only shows subcategories that belong to the current active region
- Based on the `region` field in the database (not static mapping)
- No hardcoded lists - purely data-driven

### 3. **Region Matching Logic**
```javascript
const shouldInclude = 
  // No region filter - show all (Central Office view)
  !regionFilter ||
  // Exact region match
  itemRegion === regionFilter ||
  // Special case: Region X and Region 10 are the same
  (regionFilter === "Region X" && itemRegion === "Region 10") ||
  (regionFilter === "Region 10" && itemRegion === "Region X") ||
  // Items marked as ALL regions
  itemRegion === "ALL" ||
  // Items with no region specified (legacy data)
  !itemRegion;
```

## Key Benefits

✅ **Fully Dynamic** - No static predefined lists  
✅ **Region Ownership** - Each subcategory belongs to the region that created it  
✅ **Clean Separation** - Regions only see their own subcategories  
✅ **Automatic Assignment** - New subcategories automatically get correct region  
✅ **Legacy Support** - Handles existing data without region assignments  
✅ **Special Cases** - Region X/Region 10 sharing handled properly  

## Database Structure

### Income Items Schema
```javascript
{
  subcategory: "Balingasag Crusher",
  incomecategory: ObjectId("..."), // Water Service Fee category ID
  region: "Region 10", // ← This field determines visibility
  amount: 150000,
  fiscalYear: "2024",
  budgetType: "REGULAR"
}
```

### Region Field Values
- `"Region 10"`, `"Region 12"`, etc. - Specific regions
- `"Central Office"` - Central Office items
- `"ALL"` - Available to all regions
- `null` or `undefined` - Legacy data (visible to all)

## User Experience

### Region 10 User
- Sees only subcategories with `region: "Region 10"` or `region: "Region X"`
- Can create new subcategories (automatically assigned to Region 10)
- Cannot see Region 12 or Central Office specific subcategories

### Region 12 User  
- Sees only subcategories with `region: "Region 12"`
- Can create new subcategories (automatically assigned to Region 12)
- Cannot see other regions' subcategories

### Central Office User
- Sees ALL subcategories regardless of region
- Can create subcategories for any region
- Has full visibility and control

## Implementation Details

### 1. **Filtering Function**
```javascript
const getFilteredWaterServiceFeeSubcategories = () => {
  // Get only subcategories that belong to current region
  const regionSubcategories = new Set();
  
  incomeItems.forEach(item => {
    if (itemCategoryId === waterServiceCategoryId) {
      const itemRegion = item.region;
      
      const shouldInclude = 
        !regionFilter || // Central Office sees all
        itemRegion === regionFilter || // Exact match
        (regionFilter === "Region X" && itemRegion === "Region 10") || // Special case
        (regionFilter === "Region 10" && itemRegion === "Region X") || // Special case
        itemRegion === "ALL" || // Universal access
        !itemRegion; // Legacy data
      
      if (shouldInclude) {
        regionSubcategories.add(item.subcategory);
      }
    }
  });
  
  return Array.from(regionSubcategories);
};
```

### 2. **Data Creation**
```javascript
const incomeData = {
  subcategory: subcategoryName,
  incomecategory: category._id,
  region: regionFilter || currentUser?.Region || "Central Office",
  // ... other fields
};
```

## Migration from Static Mapping

### Before (Static)
- Hardcoded list of subcategories per region
- Complex mapping logic
- Difficult to maintain
- New subcategories required code changes

### After (Dynamic)
- Database-driven filtering
- Simple region field comparison
- Self-maintaining
- New subcategories automatically appear in correct region

## Testing Scenarios

1. **Create subcategory in Region 10** → Should only appear in Region 10/Region X
2. **Create subcategory in Region 12** → Should only appear in Region 12
3. **Switch regions** → Should see different sets of subcategories
4. **Central Office view** → Should see all subcategories
5. **Legacy data** → Should appear in all regions (backward compatibility)

This approach provides clean separation between regions while maintaining flexibility and ease of maintenance.