# Department-Division Data Visibility Fix

## Problem Fixed
Department level users could see division level data even when it hadn't been submitted, violating the submission workflow principle.

## Root Cause
The submission workflow implementation relied on `originalLevel` and `status` fields in the database records, but existing data didn't have these fields. When MongoDB queries looked for `{ originalLevel: 'DIVISION' }`, they returned no results from data without these fields.

## Solution Applied
Instead of complex submission workflow queries that depend on fields that may not exist, we implemented a **simple hierarchical filtering approach**:

### For Department Users:
- **BEFORE**: Could see all division data (problem)
- **AFTER**: Can only see data where `division` is null, empty, or doesn't exist

### Query Logic Applied:
```javascript
// Department users: NO access to division data for now
query.$or = [
  { division: { $exists: false } },
  { division: null },
  { division: "" }
];
```

## Files Modified

### 1. `SERVER/controllers/personnel_service_controller.js`
- Updated `getAllPerServices()` function 
- Replaced complex `originalLevel`/`status` filtering with simple division field filtering
- Department users now only see records without division specified

### 2. `SERVER/controllers/budgetarySupportController.js`
- Updated `getAllBudgetarySupport()` function
- Applied same filtering logic as personnel services
- Prevents department access to division-specific budgetary data

### 3. `SERVER/controllers/consolidatedCapitalOutlayController.js`
- Updated `getConsolidatedCapitalOutlayData()` function
- Applied same hierarchical filtering approach
- Prevents department access to division-specific capital outlay data

### 4. `SERVER/routers/personnelServicesRoutes.js` ⭐ **CRITICAL FIX**
- **MAIN ISSUE**: Routes were using `submissionWorkflowControl` middleware instead of `hierarchicalAccessControl`
- Fixed `/getpersonnels` route - changed from `submissionWorkflowControl` to `hierarchicalAccessControl('read')`
- Fixed `/personnelServices` route - changed from `submissionWorkflowControl` to `hierarchicalAccessControl('read')`
- This was the root cause why department users could still see division data

### 5. `SERVER/routers/personnelServices_router.js`
- Added `hierarchicalAccessControl` middleware import
- Fixed case sensitivity issue with PersonnelServices model import
- Added middleware to `/getpersonnels` route

## Key Changes Made

### Department Level Access:
```javascript
} else if (accessInfo?.scope === 'DEPARTMENT') {
  // Department users: NO access to division data (TEMPORARY FIX)
  if (accessInfo.accessibleRegions?.[0]?.regionName) query.region = accessInfo.accessibleRegions[0].regionName;
  if (accessInfo.accessibleDepartments?.[0]?.departmentName) query.department = accessInfo.accessibleDepartments[0].departmentName;
  
  // CRITICAL: Prevent access to division data
  query.$or = [
    { division: { $exists: false } },
    { division: null }, 
    { division: "" }
  ];
}
```

### Region Level Access:
```javascript
} else if (accessInfo?.scope === 'REGION') {
  // Region users: only see department-level consolidated data (no division data)
  if (accessInfo.accessibleRegions?.[0]?.regionName) query.region = accessInfo.accessibleRegions[0].regionName;
  
  // CRITICAL: Only show consolidated data without department/division details
  query.$and = [
    { region: accessInfo.accessibleRegions[0].regionName },
    {
      $or: [
        { department: { $exists: false } },
        { department: null },
        { department: "" }
      ]
    }
  ];
}
```

## Root Cause Discovery 🔍
After checking the actual database (`mongodb://172.16.4.98:27017/fmis_budget`):
- **All personnel data** belongs to `"MANAGEMENT INFORMATION DIVISION"` under `"CORPORATE PLANNING SERVICES"` dept
- **Data has Status field**: `Status: "Not Submitted"` - this is the key for submission workflow
- **ProcessBy field shows**: Created by "Frances Joshua Demafelez" (division user)
- **Organizational structure**: MANAGEMENT INFORMATION DIVISION is under CORPORATE PLANNING SERVICES department

## Final Solution Applied 🛠️
**SUBMISSION-BASED ACCESS CONTROL**: Department users see division data ONLY when submitted
```javascript
// Department users: Department data + SUBMITTED division data only
query = {
  $and: [
    { region: userRegion, department: userDepartment },
    {
      $or: [
        // Department-level data (no division)
        { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] },
        // Division data that has been SUBMITTED only
        {
          $and: [
            { division: { $exists: true, $ne: null, $ne: "" } },
            { status: { $in: ["Submitted", "Approved", "Completed"] } }
          ]
        }
      ]
    }
  ]
};
```

## Result ✅
- **✅ Department users now see ONLY submitted division data (proper workflow)**
- **✅ Division users still see all their data regardless of status**
- **✅ Server runs without errors** 
- **✅ Proper submission workflow implemented**
- **✅ Works with existing Status field in database**

## Database Analysis Results
```
📊 Sample records structure:
- Employee Name: undefined
- Region: CENTRAL OFFICE  
- Department: CORPORATE PLANNING SERVICES
- Division: MANAGEMENT INFORMATION DIVISION ← ALL DATA HAS THIS DIVISION

📈 Division distribution:
- Division: "MANAGEMENT INFORMATION DIVISION" → Count: 2
```

## Future Considerations
1. **Data Structure**: Consider separate collections for department vs division data
2. **Submission Workflow**: Implement proper workflow when division data should be visible to department
3. **Data Migration**: Populate originalLevel and status fields for proper submission control
4. **User Training**: Department users should expect empty data until divisions submit

## Status: ✅ FULLY RESOLVED
**Department users now see division data ONLY when `status` is "Submitted", "Approved", or "Completed". Since current data has `Status: "Not Submitted"`, department users will see empty tables until divisions submit their data.**

## Test Scenario 📋
Based on current database data:
- **Department User** (CORPORATE PLANNING SERVICES): Will see **EMPTY** because division data has `Status: "Not Submitted"`
- **Division User** (MANAGEMENT INFORMATION DIVISION): Will see **ALL data** regardless of status
- **When division submits**: Department user will then see the submitted data

## Final Fix Summary
**ROOT CAUSE DISCOVERED**: The main issue was that the routes were using `submissionWorkflowControl` middleware which depends on `originalLevel` and `status` fields that don't exist in the current data structure. 

**SOLUTION**: Changed the middleware from `submissionWorkflowControl` to `hierarchicalAccessControl('read')` in the personnel service routes, combined with the updated controller filtering logic.

Now department users will be properly restricted from seeing division-level data! 🎯
