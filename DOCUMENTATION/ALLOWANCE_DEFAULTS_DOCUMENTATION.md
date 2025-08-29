# Medical and Meal Allowance Default Values Implementation

## Overview
This implementation sets the medical and meal allowances to a fixed default value of **200 pesos per month** for eligible employees, while maintaining the ability to adjust these amounts through the settings configuration.

## Key Features

### 1. Default Values
- **Medical Allowance**: 200 pesos per month per dependent (maximum 4 dependents)
- **Meal Allowance**: 200 pesos per day for eligible employees (typically 22 working days)

### 2. Calculation Logic

#### Medical Allowance
- **Monthly Rate**: 200 pesos per dependent
- **Maximum Dependents**: 4
- **Annual Calculation**: (Number of dependents × 200) × 12 months
- **Examples**:
  - 1 dependent: 200 × 12 = 2,400 pesos annually
  - 2 dependents: 400 × 12 = 4,800 pesos annually
  - 4 dependents: 800 × 12 = 9,600 pesos annually

#### Meal Allowance
- **Daily Rate**: 200 pesos per working day
- **Working Days**: 22 days per month (standard)
- **Monthly Calculation**: 200 × 22 = 4,400 pesos
- **Annual Calculation**: 4,400 × 12 = 52,800 pesos

### 3. Eligibility Criteria
Both allowances are available only to employees hired **before June 1, 1988**.

## Files Modified

### Backend Files
1. **SERVER/models/Settings.js**
   - Added default values of 200 for `medicalAllowance` and `meal` fields
   - Ensures new settings automatically get the default values

2. **SERVER/controllers/settingsController.js**
   - Updated `createSettings` to ensure default values are applied
   - Maintains backward compatibility with existing settings

3. **SERVER/utils/allowanceUtils.js** (NEW)
   - `calculateMedicalAllowance()` - Calculate annual medical allowance
   - `calculateMealAllowance()` - Calculate annual meal allowance
   - `calculateMonthlyMealAllowance()` - Calculate monthly meal allowance
   - `getAllowanceRates()` - Get rates with fallback to defaults
   - `calculateEmployeeAllowances()` - Complete employee allowance calculation

4. **SERVER/controllers/medicalAllowanceController.js**
   - Updated to use utility functions and default values
   - Graceful fallback when settings don't specify medical allowance

5. **SERVER/controllers/mealAllowanceController.js**
   - Updated to use utility functions and default values
   - Graceful fallback when settings don't specify meal allowance

6. **SERVER/migrations/setDefaultAllowances.js** (NEW)
   - Migration script to update existing settings with default values
   - Safe migration that preserves existing non-zero values

### Testing
7. **SERVER/tests/allowanceUtils.test.js** (NEW)
   - Comprehensive tests for all utility functions
   - Validates calculations and eligibility logic

## Usage Examples

### API Endpoints
All existing medical and meal allowance endpoints now use the default values:

```javascript
// Medical allowance calculation
POST /api/medical-allowance
{
  "employeeNumber": "12345",
  "noOfDependents": 2,
  // Amount will be automatically calculated as 4,800 (2 × 200 × 12)
}

// Meal allowance calculation  
POST /api/meal-allowance
{
  "employeeNumber": "12345",
  "actualDays": 22,
  // Amount will be automatically calculated as 52,800 (22 × 200 × 12)
}
```

### Settings Configuration
```javascript
// Default settings (automatically applied)
{
  "medicalAllowance": 200,  // 200 pesos per month per dependent
  "meal": 200               // 200 pesos per day
}

// Custom settings (can be adjusted)
{
  "medicalAllowance": 250,  // Increased to 250 pesos per month per dependent
  "meal": 300               // Increased to 300 pesos per day
}
```

### Utility Functions Usage
```javascript
const { 
  calculateMedicalAllowance, 
  calculateMealAllowance,
  getAllowanceRates 
} = require('./utils/allowanceUtils');

// Calculate medical allowance for 2 dependents
const medicalAmount = calculateMedicalAllowance(2, 200); // Returns 4800

// Calculate meal allowance for 22 days
const mealAmount = calculateMealAllowance(22, 200); // Returns 52800

// Get rates from settings with fallback
const rates = getAllowanceRates(settings); // Returns { medicalAllowance: 200, mealAllowance: 200 }
```

## Configuration

### Changing Default Values
To modify the default allowance amounts, update the Settings document:

```javascript
// Example: Increase allowances
{
  "medicalAllowance": 250,  // Increase medical to 250 pesos per month per dependent
  "meal": 300               // Increase meal to 300 pesos per day
}
```

### Running Migration
To update existing settings with default values:

```bash
cd SERVER
node migrations/setDefaultAllowances.js
```

## Benefits

1. **Standardization**: Consistent 200 peso default across the system
2. **Flexibility**: Values remain adjustable through settings
3. **Backward Compatibility**: Existing settings are preserved
4. **Automatic Calculation**: No manual amount entry required
5. **Error Prevention**: Reduces calculation errors and inconsistencies
6. **Compliance**: Ensures consistent application of allowance policies

## Migration Notes

- Existing settings with non-zero allowance values are preserved
- Settings with zero or missing allowance values are updated to 200
- The migration script provides detailed logging and verification
- No impact on existing allowance records

## Testing

Run the test suite to verify calculations:

```bash
cd SERVER
node tests/allowanceUtils.test.js
```

Expected results:
- Medical allowance (2 dependents): 4,800 pesos annually
- Meal allowance (22 days): 52,800 pesos annually
- Proper eligibility checking (hired before June 1988)
- Default value fallback when settings are missing

## Summary

The system now provides:
- **Fixed default values**: 200 pesos per month for both allowances
- **Configurable rates**: Can be adjusted in settings as needed
- **Automatic calculations**: No manual amount entry required
- **Consistent application**: Same logic across all modules
- **Easy maintenance**: Centralized utility functions for calculations
