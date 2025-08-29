# 🏢 Budget Manager Organizational Selection System

## Overview
The Budget Manager Organizational Selection system allows **BUDGET MANAGERS** and **SUPER ADMINS** to:
- ✅ **Choose any organizational unit** (Region/Department/Division) for transactions
- ✅ **Test data segregation** by switching between different organizational contexts
- ✅ **Validate organizational isolation** to ensure proper data separation
- ✅ **Audit organizational selections** for compliance and tracking

## 🎯 Key Features

### 1. **Flexible Organizational Selection**
Budget Managers can select ANY organizational unit for their transactions:
- **Regions**: NCR, Region I, Region II, etc.
- **Departments**: Finance, Operations, Engineering, etc.
- **Divisions**: Administrative, Planning, IT, etc.

### 2. **Data Segregation Testing**
- Create proposals for specific organizational units
- View data filtered by selected organizational context
- Switch between different organizational units
- Validate that data is properly isolated

### 3. **Audit Trail**
- All organizational selections are logged
- Track which Budget Manager selected which organizational unit
- Timestamp all organizational context switches
- Maintain compliance records

## 🔧 API Endpoints

### Get Available Organizational Units
```http
GET /budget-manager/organizational-units
Authorization: Bearer BUDGET_MANAGER_TOKEN
```

**Response:**
```json
{
  "regions": [
    {"id": "obj123", "name": "NCR", "type": "region"},
    {"id": "obj124", "name": "Region I", "type": "region"}
  ],
  "departments": [
    {"id": "obj125", "name": "Finance Department", "type": "department"},
    {"id": "obj126", "name": "Operations Department", "type": "department"}
  ],
  "divisions": [
    {"id": "admin", "name": "Administrative Division", "type": "division"},
    {"id": "finance", "name": "Finance Division", "type": "division"}
  ],
  "userInfo": {
    "canSelectAnyOrg": true,
    "message": "As a Budget Manager, you can select any organizational unit"
  }
}
```

### Validate Organizational Selection
```http
POST /budget-manager/validate-org-selection
Authorization: Bearer BUDGET_MANAGER_TOKEN
Content-Type: application/json

{
  "region": "NCR",
  "department": "Finance Department",
  "division": "Administrative Division"
}
```

**Response:**
```json
{
  "region": {"id": "obj123", "name": "NCR", "valid": true},
  "department": {"id": "obj125", "name": "Finance Department", "valid": true},
  "division": {"name": "Administrative Division", "valid": true},
  "isValid": true,
  "errors": []
}
```

### Test Organizational Segregation
```http
GET /budget-manager/test-segregation?region=NCR&department=Finance
Authorization: Bearer BUDGET_MANAGER_TOKEN
```

**Response:**
```json
{
  "selectedOrganization": {
    "region": "NCR",
    "department": "Finance",
    "division": "Not specified"
  },
  "segregationTest": {
    "dataIsolation": true,
    "accessControl": true,
    "transactionSegregation": true,
    "reportingSegregation": true
  },
  "expectedBehavior": [
    "Proposals filtered by selected organizational unit",
    "Reports show only data from selected unit",
    "Transactions tagged with selected organizational context"
  ],
  "testPassed": true
}
```

## 🎮 Usage Examples

### Example 1: Create Proposal for Specific Region
```http
POST /proposals
Authorization: Bearer BUDGET_MANAGER_TOKEN
Content-Type: application/json

{
  "region": "NCR",
  "department": "Finance Department",
  "division": "Administrative Division",
  "proposalData": {
    "title": "Q1 Budget Proposal",
    "amount": 500000,
    "description": "Quarterly budget for NCR Finance"
  }
}
```

**What happens:**
1. ✅ Budget Manager context is applied
2. ✅ Proposal is tagged with NCR region
3. ✅ Transaction is logged with organizational selection
4. ✅ Data segregation is enforced

### Example 2: View Proposals by Department
```http
GET /proposals?department=Engineering Department
Authorization: Bearer BUDGET_MANAGER_TOKEN
```

**What happens:**
1. ✅ Only Engineering Department proposals are returned
2. ✅ Other departments' data is filtered out
3. ✅ Budget Manager can see segregated data
4. ✅ Organizational selection is logged

### Example 3: Switch Organizational Context
```http
POST /budget-manager/switch-organization
Authorization: Bearer BUDGET_MANAGER_TOKEN
Content-Type: application/json

{
  "newRegion": "Region IV-A",
  "newDepartment": "Operations Department",
  "newDivision": "Engineering Division"
}
```

**What happens:**
1. ✅ Previous organizational context is saved
2. ✅ New organizational context is applied
3. ✅ Switch is logged for audit
4. ✅ Future transactions use new context

## 🛡️ Security & Access Control

### Who Can Use This System?
- ✅ **BUDGET MANAGER** - Full organizational selection capabilities
- ✅ **SUPER ADMIN** - Full organizational selection capabilities
- ❌ **BUDGET OFFICER** - Limited to assigned organizational units only
- ❌ **USER** - Limited to assigned organizational units only

### Security Features
- **Authentication Required**: All endpoints require valid JWT token
- **Role Validation**: Only Budget Managers and Super Admins can access
- **Organizational Validation**: Selected organizational units must exist
- **Audit Logging**: All selections are logged for compliance
- **Data Segregation**: Ensures proper isolation of organizational data

## 🧪 Testing Data Segregation

### Test Scenario 1: Regional Segregation
```bash
# Step 1: Create proposal for NCR
curl -X POST http://localhost:5005/proposals \
  -H "Authorization: Bearer BUDGET_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"region":"NCR","title":"NCR Proposal"}'

# Step 2: Create proposal for Region IV-A  
curl -X POST http://localhost:5005/proposals \
  -H "Authorization: Bearer BUDGET_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"region":"Region IV-A","title":"Region IV-A Proposal"}'

# Step 3: View NCR proposals only
curl -X GET "http://localhost:5005/proposals?region=NCR" \
  -H "Authorization: Bearer BUDGET_MANAGER_TOKEN"

# Expected: Only NCR proposals returned
```

### Test Scenario 2: Department Segregation
```bash
# Step 1: Create proposal for Finance Department
curl -X POST http://localhost:5005/proposals \
  -H "Authorization: Bearer BUDGET_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"department":"Finance Department","title":"Finance Proposal"}'

# Step 2: View Finance Department proposals only
curl -X GET "http://localhost:5005/proposals?department=Finance Department" \
  -H "Authorization: Bearer BUDGET_MANAGER_TOKEN"

# Expected: Only Finance Department proposals returned
```

## 📊 Audit & Logging

### Organizational Selection Logs
Every organizational selection is logged with:
```json
{
  "userId": "bm-001",
  "userRole": ["BUDGET MANAGER"],
  "selectedRegion": "NCR",
  "selectedDepartment": "Finance Department",
  "selectedDivision": "Administrative Division",
  "operation": "POST /proposals",
  "timestamp": "2024-01-15T10:30:00Z",
  "success": true
}
```

### Audit Trail Benefits
- **Compliance**: Track all organizational selections for audits
- **Security**: Monitor Budget Manager activities
- **Debugging**: Troubleshoot data segregation issues
- **Analytics**: Understand organizational unit usage patterns

## 🎯 Benefits for Testing

### 1. **Validate Data Segregation**
- Budget Manager can create test data for different organizational units
- Verify that data is properly isolated between units
- Ensure reports show correct organizational filtering

### 2. **Test User Access Controls**
- Create proposals for different organizational units
- Test that regular users can only see their assigned units
- Validate that Budget Officers have limited access

### 3. **Verify System Integrity**
- Ensure organizational boundaries are respected
- Test switching between organizational contexts
- Validate audit logging is working correctly

## 🚀 Implementation Status

### ✅ Completed Features
- Budget Manager organizational selection middleware
- API endpoints for organizational unit management
- Validation of organizational selections
- Audit logging of organizational context switches
- Integration with proposal creation/viewing

### 🔄 Next Steps
1. **Frontend Integration** - Create UI for organizational selection
2. **Enhanced Division Model** - Implement proper division database model
3. **Reporting Integration** - Add organizational filtering to reports
4. **Performance Optimization** - Cache organizational unit data

## 📝 Usage Guidelines

### For Budget Managers
1. **Always specify organizational context** when creating transactions
2. **Test data segregation** by switching between organizational units
3. **Validate organizational selections** before creating important data
4. **Review audit logs** to ensure proper organizational tracking

### For System Administrators
1. **Monitor organizational selection logs** for unusual activity
2. **Ensure organizational units exist** before assigning to users
3. **Regular testing** of data segregation functionality
4. **Backup audit logs** for compliance requirements

---

**Ang Budget Manager Organizational Selection system ay ready na para sa testing! 🎉**

Budget Managers can now select any organizational unit and test na talagang nase-segregate ang data per region/department/division!
