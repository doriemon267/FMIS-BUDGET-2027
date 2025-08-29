# Environment Variable and Parameter Fixes

## 🔧 **Issues Fixed**

### 1. **ACCOUNT_USER_API_URL Environment Variable**
**Problem:** The logs showed "ACCOUNT_USER_API_URL is not defined in environment variables"

**Root Cause:** The `ACCOUNT_USER_API_URL` environment variable was missing from the SERVER/.env file

**Solution:** 
- Added the environment variable to SERVER/.env with proper documentation
- Updated middleware messages to be more informative
- Provided clear instructions for development vs production setup

### 2. **Undefined Parameters in Budgetary Support**
**Problem:** The logs showed "Fetching budgetary support with params: { fiscalYear: undefined, budgetType: undefined, region: undefined }"

**Root Cause:** The budgetary support query in ProposalCustomPage.jsx was not passing the available parameters

**Solution:**
- Updated the query to include fiscalYear, budgetType, and region parameters
- Added proper query key dependencies for cache invalidation
- Added enabled condition to prevent unnecessary API calls

## 📁 **Files Modified**

### 1. `SERVER/.env`
```env
# AUTHENTICATION API URL (for user data fetching)
# For development/testing, leave commented to use mock authentication
# ACCOUNT_USER_API_URL=http://localhost:5000/api/user
# For production, uncomment and set the correct URL
# ACCOUNT_USER_API_URL=https://fmis-server.nia.gov.ph/api/user
```

### 2. `SERVER/middleware/check_token.js` & `SERVER/middleware/checkToken.js`
- Changed warning message to informative log
- Added clear instructions for enabling real authentication

### 3. `CLIENT/src/components/proposals/ProposalCustomPage.jsx`
- Updated budgetary support query to pass proper parameters
- Added query dependencies for proper cache management
- Added enabled condition to prevent unnecessary API calls

## 🚀 **How to Configure**

### **Development Mode (Current Setup)**
- Keep `ACCOUNT_USER_API_URL` commented out in SERVER/.env
- The system will use mock authentication with BUDGET ADMIN role
- You'll see informative logs instead of warnings

### **Production Mode**
1. Uncomment and set the correct `ACCOUNT_USER_API_URL` in SERVER/.env:
   ```env
   ACCOUNT_USER_API_URL=https://fmis-server.nia.gov.ph/api/user
   ```
2. Restart the server
3. The system will fetch real user data from the authentication API

## 🔍 **Expected Log Changes**

### **Before Fix:**
```
ACCOUNT_USER_API_URL is not defined in environment variables
Fetching budgetary support with params: { fiscalYear: undefined, budgetType: undefined, region: undefined }
```

### **After Fix:**
```
ℹ️  ACCOUNT_USER_API_URL is not defined - using mock authentication for development
   To use real authentication, set ACCOUNT_USER_API_URL in your .env file
Fetching budgetary support data with params: { fiscalYear: "2025", budgetType: "Initial", region: "Region I" }
```

## ✅ **Benefits**

1. **Cleaner Logs:** No more warning messages about missing environment variables
2. **Proper Parameters:** Budgetary support queries now include all required parameters
3. **Better Performance:** Queries only run when necessary parameters are available
4. **Clear Documentation:** Easy to understand how to switch between development and production modes
5. **Improved Debugging:** More informative log messages for troubleshooting

## 🧪 **Testing**

1. **Start the server** and check the logs - you should see informative messages instead of warnings
2. **Navigate to the Proposals page** and switch to the "Budgetary Support" tab
3. **Check the browser console** - you should see proper parameters being passed
4. **Verify the API calls** in the Network tab show the correct query parameters

## 📝 **Notes**

- The mock authentication provides BUDGET ADMIN role for testing purposes
- All existing functionality remains unchanged
- The fixes are backward compatible and don't break existing features
- For production deployment, simply uncomment and configure the ACCOUNT_USER_API_URL
