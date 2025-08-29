# Dynamic Department-Division Mapping System

## Overview
The hierarchical RBAC system now supports dynamic department-division mappings, ensuring that only departments with actual divisions are available for Division level assignments.

## Department-Division Structure

### Corporate Planning Services
- Planning & Programming Division (PPD)
- Management Information Division (MID)

### Engineering Department  
- Project Planning Division (PPD)
- Design and Specifications Division (DSD)
- Construction Management Division (CMD)

### Operations Department
- System Management Division (SMD)
- Equipment Management Division (EMD) 
- Institutional Development Division (IDD)
- Irrigation Engineering Division (IED)

### Financial Management Department
- Accounting Division (AD)
- Budget and Revenue Division (BRD)
- Cash Division (CD)

### Administrative Department
- Human Resources Division (HRD)
- Procurement and Property Division (PPD)
- General Services Division (GSD)
- Civil Security Division (CSD)
- Medical and Dental Division (MDD)

## Implementation Features

### 1. Dynamic Filtering
- **Division Level Assignments**: Only departments with divisions are shown in the dropdown
- **Department Selection**: Shows badge indicating number of divisions available
- **Division Selection**: Dynamically filtered based on selected department

### 2. Validation System
- **Department-Division Validation**: Ensures selected division exists in chosen department
- **Real-time Feedback**: Shows warnings when invalid combinations are selected
- **Database Validation**: Backend validates all department-division combinations

### 3. User Interface Enhancements
- **Visual Indicators**: Chips showing division count and availability
- **Contextual Alerts**: Information about consolidation behavior
- **Progressive Disclosure**: Division dropdown only enabled after department selection
- **Error Prevention**: Clear messages when no divisions are available

## API Endpoints

### Organization Structure
```
GET /api/hierarchical-rbac/organization-structure
```
Returns:
- Complete organization hierarchy
- Department-division mappings
- Departments with divisions only
- Validation rules

### Response Structure
```json
{
  "hierarchy": "Division → Department → Region",
  "consolidationFlow": {
    "DIVISION": "Proposals consolidate to Department level",
    "DEPARTMENT": "Proposals consolidate to Region level", 
    "REGION": "Proposals remain at Region level"
  },
  "availableUnits": {
    "regions": [...],
    "departments": [...],
    "departmentsWithDivisions": [...],
    "allDivisions": [...]
  },
  "mappings": [...],
  "validationRules": {...}
}
```

## Database Schema

### OrganizationStructure Model
```javascript
{
  departmentId: ObjectId,
  departmentName: String,
  divisions: [{
    name: String,
    code: String,
    isActive: Boolean
  }],
  hasSubDivisions: Boolean,
  regionId: ObjectId
}
```

## Setup Instructions

### 1. Run Department-Division Mapping Setup
```bash
node SERVER/scripts/setupDepartmentDivisionMappings.js
```

### 2. Run Complete Quick Setup
```bash
node SERVER/scripts/quickSetupWithMappings.js
```

### 3. Verify Setup
The script will display:
- Department-division structure
- Sample assignments created
- Validation results

## Frontend Integration

### Department Filtering Logic
```javascript
// Get departments that have divisions (for Division level assignments)
const getDepartmentsWithDivisions = () => {
  if (!organizationStructure?.availableUnits?.departmentsWithDivisions) {
    return [];
  }
  return organizationStructure.availableUnits.departmentsWithDivisions;
};

// Get available divisions for selected department
const getAvailableDivisions = () => {
  if (!formData.departmentId || !organizationStructure?.availableUnits?.departmentsWithDivisions) {
    return [];
  }
  
  const department = organizationStructure.availableUnits.departmentsWithDivisions.find(
    dept => dept.departmentId === formData.departmentId
  );
  
  return department ? department.divisions : [];
};
```

### Validation
```javascript
// Validate that selected department has divisions
if (!selectedDepartmentHasDivisions()) {
  setSnackbar({
    open: true,
    message: 'Selected department does not have divisions. Please choose a department with divisions.',
    severity: 'warning'
  });
  return;
}

// Validate that selected division exists in the department
const availableDivisions = getAvailableDivisions();
if (!availableDivisions.some(div => div.name === formData.divisionName)) {
  setSnackbar({
    open: true,
    message: 'Selected division does not exist in the chosen department.',
    severity: 'warning'
  });
  return;
}
```

## User Experience

### For Division Level Assignments
1. **Department Selection**: Only departments with divisions appear
2. **Visual Feedback**: Chips show "X divisions" count
3. **Division Selection**: Dynamically populated based on department
4. **Validation**: Real-time feedback for invalid combinations

### For Department Level Assignments  
1. **All Departments**: Shows all departments (with and without divisions)
2. **Division Indicator**: Badge shows "Has divisions" for departments with divisions
3. **No Division Required**: Division field not shown/required

### For Region Level Assignments
1. **Simple Selection**: Only region selection required
2. **No Filtering**: All regions available

## Consolidation Behavior

### Division → Department → Region Flow
- **Division User Creates Proposal**: Saves to Department records
- **Department User Creates Proposal**: Saves to Region records  
- **Region User Creates Proposal**: Saves directly to Region records

### Data Access Patterns
- **Division Users**: Can access own division data, consolidates up
- **Department Users**: Can access all divisions in department, consolidates up
- **Region Users**: Can access all departments and divisions in region

## Benefits

1. **Data Integrity**: Ensures only valid department-division combinations
2. **User Experience**: Clear, intuitive interface with helpful feedback
3. **Scalability**: Easy to add/modify department-division relationships
4. **Flexibility**: Supports departments with and without divisions
5. **Validation**: Comprehensive error prevention and user guidance

## Maintenance

### Adding New Departments/Divisions
1. Update `setupDepartmentDivisionMappings.js` with new data
2. Run setup script to populate database
3. Frontend automatically reflects changes via API

### Modifying Existing Structure
1. Update the `departmentDivisionData` array in setup script
2. Re-run setup script (it clears and recreates mappings)
3. Verify through frontend interface

This dynamic system ensures that the hierarchical RBAC properly reflects the actual organizational structure while maintaining flexibility for future changes.
