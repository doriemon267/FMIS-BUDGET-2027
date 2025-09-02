# Minimum Amount Validation - Capital Outlay Details

## 🎯 **Requirement**
Values below ₱50,000 should not be acceptable in Capital Outlay breakdown items.

## ✅ **Implementation**

### 🔒 **Validation Rules Added**
1. **Minimum Amount**: Each individual breakdown item must be at least ₱50,000
2. **Applies To**: Both income amounts and subsidy amounts in the details modal
3. **Validation Logic**: Only validates amounts greater than 0 (allows 0 values)
4. **Error Prevention**: Shows error message and prevents saving

### 📋 **Code Changes**

#### **1. Enhanced Validation Function**
```javascript
const validateDetails = () => {
  const newErrors = {};
  let isValid = true;
  const MINIMUM_AMOUNT = 50000; // ₱50,000 minimum requirement

  details.forEach((detail, index) => {
    // ... existing validations ...

    // NEW: Validate minimum amount requirement (₱50,000)
    if (incomeAmount > 0 && incomeAmount < MINIMUM_AMOUNT) {
      newErrors[`income_amount_${index}`] = `Income amount must be at least ₱${MINIMUM_AMOUNT.toLocaleString()}`;
      isValid = false;
    }

    if (subsidyAmount > 0 && subsidyAmount < MINIMUM_AMOUNT) {
      newErrors[`subsidy_amount_${index}`] = `Subsidy amount must be at least ₱${MINIMUM_AMOUNT.toLocaleString()}`;
      isValid = false;
    }
  });

  setErrors(newErrors);
  return isValid;
};
```

#### **2. User Information Alert**
```javascript
<Alert severity="info" sx={{ mb: 2 }}>
  <Typography variant="body2">
    <strong>Important:</strong> Each amount must be at least ₱50,000. Values below this amount are not acceptable.
  </Typography>
</Alert>
```

## 🎯 **User Experience**

### **Before Validation:**
- ❌ Users could enter any amount (e.g., ₱1,000)
- ❌ No guidance about minimum requirements
- ❌ Invalid data could be saved

### **After Validation:**
- ✅ Clear information about ₱50,000 minimum requirement
- ✅ Real-time error messages for amounts below ₱50,000
- ✅ Save button disabled until all validations pass
- ✅ User-friendly error messages with formatted amounts

## 📱 **Error Messages**

### **Income Amount Error:**
```
Income amount must be at least ₱50,000
```

### **Subsidy Amount Error:**
```
Subsidy amount must be at least ₱50,000
```

## 🔧 **Validation Logic**

### **Scenarios Handled:**
1. **₱0**: ✅ Allowed (user might want only income OR only subsidy)
2. **₱1 - ₱49,999**: ❌ Not allowed - shows error message
3. **₱50,000+**: ✅ Allowed - passes validation

### **Example Validation Results:**
- **₱0 income, ₱75,000 subsidy**: ✅ Valid
- **₱25,000 income, ₱60,000 subsidy**: ❌ Invalid (income too low)
- **₱60,000 income, ₱30,000 subsidy**: ❌ Invalid (subsidy too low)
- **₱75,000 income, ₱50,000 subsidy**: ✅ Valid

## 🚀 **Current Status**
- **Frontend**: http://localhost:3005 ✅ Running with validation
- **Backend**: http://localhost:5005 ✅ Running
- **Validation**: ✅ Active in Capital Outlay Details Modal

## 📋 **Testing Steps**
1. Navigate to Capital Outlay management
2. Click "Add Item Details" button (📋 icon)
3. Try entering an amount below ₱50,000
4. **Expected**: Red error message appears
5. **Expected**: Save button remains disabled
6. Enter ₱50,000 or more
7. **Expected**: Error clears, save becomes available

## 🎉 **Benefits**

### **For Users:**
- **Clear Guidance**: Upfront information about requirements
- **Immediate Feedback**: Real-time validation as they type
- **Error Prevention**: Cannot save invalid data
- **Professional Format**: Error messages show formatted amounts (₱50,000)

### **For System:**
- **Data Integrity**: Ensures all amounts meet minimum requirements
- **Consistent Standards**: Enforces business rules at the UI level
- **Error Prevention**: Stops invalid data before it reaches the backend
- **User-Friendly**: Clear, actionable error messages

## 🔄 **Integration with Existing Features**
- ✅ **Works with read-only amounts**: Main table amounts still calculated from breakdown
- ✅ **Works with breakdown display**: Validated amounts show in particulars column
- ✅ **Works with auto-sync**: Only valid data gets synchronized
- ✅ **Works with existing validations**: Adds to existing validation rules

The ₱50,000 minimum amount validation is now active and will prevent users from entering amounts below this threshold in Capital Outlay breakdown items!