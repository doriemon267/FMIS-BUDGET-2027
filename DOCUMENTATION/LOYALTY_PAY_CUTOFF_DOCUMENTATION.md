# Loyalty Pay with June 22 Cutoff Date Implementation

## Overview
This implementation adds a cutoff date feature to the loyalty pay system, ensuring that only employees whose service anniversaries fall on or before June 22 each year are eligible for loyalty pay in that fiscal year.

## Key Features

### 1. Cutoff Date Configuration
- **Default Cutoff**: June 22 (06-22 format)
- **Configurable**: Can be modified in Settings model under `loyaltyPay.cutoffDate`
- **Format**: MM-DD (e.g., "06-22" for June 22)

### 2. Years of Service Calculation Logic
The system now calculates years of service with the following rules:

- **Base Calculation**: Current fiscal year minus appointment year
- **Cutoff Check**: If the employee's service anniversary falls AFTER the cutoff date, subtract 1 year
- **Example**:
  - Employee appointed: May 15, 2014
  - Fiscal Year: 2024
  - Service anniversary: May 15, 2024 (before June 22)
  - **Result**: 10 years of service ✓
  
  - Employee appointed: July 15, 2014
  - Fiscal Year: 2024
  - Service anniversary: July 15, 2024 (after June 22)
  - **Result**: 9 years of service (not eligible for 10-year milestone)

### 3. Eligibility Milestones
Employees are eligible for loyalty pay at these service milestones:
- 10, 15, 20, 25, 30, 35, 40, 45, 50 years

### 4. Amount Calculation
- **10 years**: Base amount (e.g., ₱10,000)
- **15+ years**: Succeeding amount (e.g., ₱5,000)

## Files Modified

### Backend Files
1. **SERVER/models/Settings.js**
   - Added `loyaltyPay.cutoffDate` field (default: "06-22")

2. **SERVER/models/loyaltyPay.js**
   - Added `appointmentDate` field to store employee appointment date

3. **SERVER/utils/loyaltyPayUtils.js** (NEW)
   - `calculateLoyaltyPayYearsOfService()` - Main cutoff calculation logic
   - `getEligibleLoyaltyPayYear()` - Find highest milestone reached
   - `calculateLoyaltyPayAmount()` - Calculate pay amount
   - `formatCutoffDate()` - Format date for display
   - `isBeforeCutoffDate()` - Check if current date is before cutoff

4. **SERVER/controllers/loyaltyPayController.js**
   - Updated to use new cutoff calculation logic
   - Includes appointment date in payload
   - Returns calculated years for debugging

5. **SERVER/controllers/EmployeeListController.js**
   - Updated `getEligibleForLoyaltyPay()` to use cutoff logic
   - Returns employees eligible based on cutoff date

### Frontend Files
1. **CLIENT/src/utils/loyaltyPayUtils.js** (NEW)
   - Frontend version of utility functions
   - Consistent calculation logic with backend

2. **CLIENT/src/components/loyaltypay/LoyaltyPayDialog.jsx**
   - Updated to use new cutoff calculation
   - Shows cutoff date information in dialog title
   - Includes appointment date in API payload

## Usage Examples

### API Endpoints
All existing loyalty pay endpoints now support the cutoff date logic:

```javascript
// Create loyalty pay record
POST /api/loyalty-pay
{
  "employeeNumber": "12345",
  "employeeFullName": "John Doe",
  "appointmentDate": "2014-05-15",
  "yearsInService": 10,
  // ... other fields
}
```

### Frontend Usage
```javascript
import { 
  calculateLoyaltyPayYearsOfService,
  getEligibleLoyaltyPayYear 
} from '../utils/loyaltyPayUtils';

// Calculate years with cutoff
const years = calculateLoyaltyPayYearsOfService(
  appointmentDate, 
  fiscalYear, 
  "06-22"
);

// Get eligible milestone
const milestone = getEligibleLoyaltyPayYear(years);
```

## Configuration

### Changing the Cutoff Date
To modify the cutoff date, update the Settings document:

```javascript
// Example: Change cutoff to December 31
{
  "loyaltyPay": {
    "cutoffDate": "12-31",
    "baseAmount": 10000,
    "succeedingAmount": 5000
  }
}
```

## Testing
A test file is included at `SERVER/tests/loyaltyPayUtils.test.js` to verify the cutoff logic works correctly with various scenarios.

## Benefits
1. **Compliance**: Ensures loyalty pay follows government regulations
2. **Accuracy**: Prevents premature loyalty pay awards
3. **Consistency**: Standardized calculation across the system
4. **Flexibility**: Configurable cutoff date for different requirements
5. **Transparency**: Clear display of cutoff information to users

## Migration Notes
- Existing loyalty pay records are not affected
- New records will use the cutoff date logic
- The system gracefully falls back to the old calculation if appointment date is not available
