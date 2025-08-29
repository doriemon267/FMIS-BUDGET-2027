# 🔐 Role-Based Access Control (RBAC) System

## Overview
The BUDGET-FMIS system now implements a comprehensive RBAC system that controls access based on:
- **User Roles** (SUPER ADMIN, BUDGET MANAGER, BUDGET OFFICER, USER)
- **Organizational Units** (Region, Department, Division)
- **Operation Types** (Create, Read, Update, Delete)
- **Data Ownership** (Own records vs All records)

## 🎭 User Roles & Permissions

### 1. **SUPER ADMIN / BUDGET MANAGER**
- ✅ **Full System Access** - Can access all data across all organizational units
- ✅ **User Management** - Can assign roles and organizational access to users
- ✅ **System Settings** - Can modify fiscal years, due dates, and system configurations
- ✅ **All Operations** - Create, Read, Update, Delete on all resources
- ✅ **Approval Authority** - Can approve/reject proposals

### 2. **BUDGET OFFICER**
- ✅ **Limited Administrative Access** - Can view and manage proposals within assigned organizational units
- ✅ **Read Operations** - Can view proposals, reports, and summaries
- ❌ **Limited Write Operations** - Cannot create/edit proposals (configurable)
- ✅ **Status Updates** - Can update proposal statuses
- ❌ **No User Management** - Cannot assign roles or manage users

### 3. **USER (Regular User)**
- ✅ **Proposal Creation** - Can create new proposals within assigned organizational units
- ✅ **Own Proposals** - Can view and edit only their own proposals
- ✅ **Limited Reports** - Can view reports related to their own data
- ❌ **No Administrative Access** - Cannot manage users or system settings

## 🏢 Organizational Access Control

### Access Scopes
1. **FULL** - Access to all organizational units (Admin only)
2. **REGION** - Access limited to assigned regions
3. **DEPARTMENT** - Access limited to assigned departments
4. **DIVISION** - Access limited to assigned divisions
5. **OWN_ONLY** - Access only to own records

### Assignment Structure
```javascript
{
  userId: "user123",
  accessScope: "REGION",
  regions: ["ObjectId1", "ObjectId2"],
  departments: ["ObjectId3"],
  divisions: ["Division A", "Division B"],
  rolePermissions: {
    canCreateProposals: true,
    canEditOwnProposals: true,
    canEditAllProposals: false,
    canDeleteProposals: false,
    canApproveProposals: false,
    canViewReports: true,
    canManageUsers: false,
    canManageSettings: false
  }
}
```

## 🛡️ Security Middleware

### 1. **authenticatedRoute()**
Basic authentication check - requires valid JWT token.

### 2. **adminRoute()**
Admin-only access - requires BUDGET_MANAGER, BUDGET_OFFICER, or SUPER_ADMIN role.

### 3. **dueDateProtectedRoute(permissionLevel, accessScope)**
Combines authentication, due date checking, role verification, and organizational access.

### 4. **ownerOnlyRoute()**
Restricts access to user's own records only.

### 5. **budgetOfficerRoute(allowedOperations)**
Budget Officer access with operation restrictions.

### 6. **proposalAccessControl(operation)**
Comprehensive proposal access control with organizational filtering.

## 📋 Implementation Examples

### Securing a Route
```javascript
// Admin only with full access
router.get('/admin-data', ...adminRoute(), getAdminData);

// Budget Officer with read access and regional filtering
router.get('/proposals', 
  ...budgetOfficerRoute(['read']),
  proposalAccessControl('read'),
  getProposals
);

// User creating proposal with organizational restrictions
router.post('/proposals', 
  ...dueDateProtectedRoute(PERMISSION_LEVELS.USER, ACCESS_SCOPE.REGION),
  proposalAccessControl('create'),
  createProposal
);

// Owner editing own proposal
router.put('/proposals/:id', 
  ...dueDateProtectedRoute(PERMISSION_LEVELS.USER),
  checkProposalOwnership(Proposal),
  updateProposal
);
```

### Controller Implementation
```javascript
const getProposals = async (req, res) => {
  try {
    // Access filters are automatically added by middleware
    const filters = req.accessFilters || {};
    
    // Combine with other query filters
    const query = { ...filters, ...req.query };
    
    const proposals = await Proposal.find(query);
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

## 🔧 API Endpoints

### User Organizational Assignments
- `GET /user-organizational-assignments` - Get all assignments (Admin)
- `GET /my-organizational-assignments` - Get current user's assignments
- `POST /user-organizational-assignments` - Create/update assignment (Admin)
- `DELETE /user-organizational-assignments/:userId` - Delete assignment (Admin)

### Role Permissions
- `GET /my-role-permissions` - Get current user's permissions
- `POST /bulk-update-role-permissions` - Bulk update permissions (Admin)

## 🚀 Usage Scenarios

### Scenario 1: Regional Budget Officer
```javascript
// User assigned to Region "NCR" with BUDGET_OFFICER role
{
  accessScope: "REGION",
  regions: ["NCR"],
  rolePermissions: {
    canCreateProposals: false,
    canEditAllProposals: false,
    canViewReports: true
  }
}
// Result: Can view all proposals from NCR region, cannot create/edit
```

### Scenario 2: Department User
```javascript
// User assigned to Department "Finance" with USER role
{
  accessScope: "DEPARTMENT", 
  departments: ["Finance"],
  rolePermissions: {
    canCreateProposals: true,
    canEditOwnProposals: true
  }
}
// Result: Can create proposals for Finance department, edit own proposals only
```

### Scenario 3: Super Admin
```javascript
// User with SUPER_ADMIN role
{
  accessScope: "FULL",
  rolePermissions: {
    canCreateProposals: true,
    canEditAllProposals: true,
    canManageUsers: true,
    canManageSettings: true
  }
}
// Result: Full access to all system features and data
```

## 🔍 Testing RBAC

### 1. **Authentication Test**
```bash
# Should fail without token
curl -X GET http://localhost:5005/proposals

# Should succeed with valid token
curl -X GET http://localhost:5005/proposals \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. **Role-based Access Test**
```bash
# Admin endpoint - should fail for regular users
curl -X GET http://localhost:5005/user-organizational-assignments \
  -H "Authorization: Bearer USER_TOKEN"

# Should succeed for admin
curl -X GET http://localhost:5005/user-organizational-assignments \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 3. **Organizational Access Test**
```bash
# Should only return proposals from user's assigned regions
curl -X GET http://localhost:5005/proposals?region=NCR \
  -H "Authorization: Bearer REGIONAL_USER_TOKEN"
```

## 📝 Migration Guide

To migrate existing routes to use RBAC:

1. **Replace basic middleware**:
   ```javascript
   // Before
   router.get('/data', checkToken, getData);
   
   // After
   router.get('/data', ...authenticatedRoute(), getData);
   ```

2. **Add role restrictions**:
   ```javascript
   // Admin only
   router.post('/admin-action', ...adminRoute(), adminAction);
   
   // Budget Officer with restrictions
   router.get('/reports', ...budgetOfficerRoute(['read']), getReports);
   ```

3. **Add organizational filtering**:
   ```javascript
   router.get('/proposals', 
     ...budgetOfficerRoute(['read']),
     proposalAccessControl('read'),
     applyAccessFilters(),
     getProposals
   );
   ```

4. **Update controllers to use filters**:
   ```javascript
   const getData = async (req, res) => {
     const filters = req.accessFilters || {};
     const data = await Model.find(filters);
     res.json(data);
   };
   ```

## 🎯 Next Steps

1. **Implement Department/Division Models** - Create proper models for departments and divisions
2. **Frontend Integration** - Update client-side to respect user permissions
3. **Audit Logging** - Add logging for all RBAC-related actions
4. **Performance Optimization** - Cache user permissions for better performance
5. **Testing Suite** - Create comprehensive tests for all RBAC scenarios
