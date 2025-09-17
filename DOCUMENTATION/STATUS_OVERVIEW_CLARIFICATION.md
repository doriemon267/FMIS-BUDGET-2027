# Status Overview & Submission Clarification

## 📊 **Status Overview - What's Included:**

### **✅ INCLUDED in Status Overview (Actual Proposals):**
1. **Personnel Services**
   - PS-Permanent
   - PS-Casual  
   - COS/JO
2. **MOOE** (Maintenance and Other Operating Expenses)
3. **Capital Outlay**
4. **Budgetary Support** (Subsidary)

### **❌ EXCLUDED from Status Overview:**
1. **Income Data** (Corporate Income)
   - **Why excluded**: This is **projection/target data**, not actual proposals
   - **Purpose**: Used for validation and balance checking only
   - **Not submitted**: Income projections are reference data, not budget requests

## 🎯 **What Gets Submitted:**

### **When you click "Submit All Proposals" or "Save as Draft":**

#### **✅ INCLUDED in Submission:**
1. **Personnel Services** - Actual salary and benefit requests
2. **MOOE** - Operating expense requests  
3. **Capital Outlay** - Equipment and infrastructure requests
4. **Budgetary Support** - Subsidary funding requests

#### **❌ NOT INCLUDED in Submission:**
1. **Income Data** (Corporate Income)
   - **Reason**: These are **projections**, not requests
   - **Function**: Used to **validate** that total requests don't exceed projected income
   - **Role**: Reference data for budget balance checking

## 🔍 **Why This Distinction Matters:**

### **Proposals vs Projections:**

#### **Proposals (Get Submitted):**
- **What you're requesting**: Budget allocations for expenses
- **Status tracking**: Draft → Submitted → Approved/Returned
- **Examples**: Salaries, equipment purchases, operating costs, subsidies

#### **Projections (Reference Only):**
- **What you expect to receive**: Income estimates
- **Purpose**: Ensure requests don't exceed available funds
- **Examples**: Corporate income projections, revenue estimates

### **Budget Balance Logic:**
```
Total Requests (Proposals) ≤ Total Projected Income (Reference)
```

## 📋 **Submission Process Clarification:**

### **Step 1: Create Proposals**
- Add Personnel Services items
- Add MOOE items  
- Add Capital Outlay items
- Add Budgetary Support items

### **Step 2: Set Income Projections**
- Set Corporate Income projections
- **Purpose**: Validate that total proposals don't exceed projected income

### **Step 3: Validate Balance**
- System checks: `Total Proposals ≤ Corporate Income`
- **If balanced**: Can submit proposals
- **If unbalanced**: Must adjust proposals or income projections

### **Step 4: Submit**
- **What gets submitted**: Only the 4 proposal types
- **What stays local**: Income projections (used for validation only)

## 🎯 **Answer to Your Questions:**

### **Q: Yung nasa status overview accurate ba yun?**
**A: ✅ YES, now accurate!** 
- **Fixed**: Removed Income data from status overview
- **Includes**: Only actual proposals (Personnel, MOOE, Capital Outlay, Budgetary Support)
- **Excludes**: Income projections (as it should be)

### **Q: Need ko pa bang isama status nila Corporate Income at Subsidary kong mag submit?**

#### **Corporate Income: ❌ NO**
- **Don't include**: Corporate Income in submissions
- **Reason**: It's projection data, not a proposal
- **Purpose**: Reference only for validation

#### **Budgetary Support (Subsidary): ✅ YES**  
- **Include**: Budgetary Support in submissions
- **Reason**: It's an actual funding request/proposal
- **Purpose**: Request for subsidary funding

## 📊 **Updated Status Overview Logic:**

### **Before Fix:**
```javascript
// WRONG - Included income projections
const allProposals = [...personnelData, ...mooeData, ...capitalOutlayData, ...incomeData, ...budgetarySupportData];
```

### **After Fix:**
```javascript
// CORRECT - Only actual proposals
const allProposals = [...personnelData, ...mooeData, ...capitalOutlayData, ...budgetarySupportData];
```

## 🎉 **Summary:**

### **Status Overview Now Shows:**
- **Personnel Services** proposals and their statuses
- **MOOE** proposals and their statuses
- **Capital Outlay** proposals and their statuses  
- **Budgetary Support** proposals and their statuses
- **Total count**: Only actual proposals, not projections

### **Submission Includes:**
- **Same 4 categories** as status overview
- **Corporate Income**: Used for validation only, not submitted
- **Budgetary Support**: Included as actual proposal

### **Result:**
- **Accurate status counts** ✅
- **Proper submission scope** ✅
- **Clear distinction** between proposals and projections ✅

The status overview is now accurate and only shows actual proposals that can be submitted! 🎯
