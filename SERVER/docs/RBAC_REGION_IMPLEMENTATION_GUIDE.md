# 🔐 Region-Based Access Control (RBAC) Implementation Guide

## Overview

This implementation provides strict region-based access control for the FMIS Budget system. Users can only transact (create, read, update, delete) in regions they are explicitly assigned to through the `UserOrganizationalAssignment` system.

## 🎯 Key Features

### ✅ Implemented Features
- **Strict Region Enforcement**: Users can only access data from assigned regions
- **Operation-level Control**: Different permissions for create, read, update, delete operations
- **Automatic Filtering**: Read operations automatically filter by user's assigned regions
- **Admin Bypass**: SUPER_ADMIN and BUDGET_MANAGER roles have full access
- **Audit Logging**: All access attempts are logged for security monitoring
- **Flexible Configuration**: Support for different access scopes (FULL, REGION, DEPARTMENT, etc.)

### 🛡️ Security Benefits
- **Data Isolation**: Users cannot access data outside their assigned regions
- **Transaction Control**: Write operations are strictly validated
- **Role-based Permissions**: Operations are controlled by user role capabilities
- **Audit Trail**: Complete logging of access attempts and violations

## 📋 Implementation Files

### Core Files Created:
1. **`/SERVER/middleware/regionBasedAccessControl.js`** - Main RBAC middleware
2. **`/SERVER/controllers/regionBasedTransactionController.js`** - Transaction controller with RBAC
3. **`/SERVER/routers/regionBasedAccessRoutes.js`** - Example routes with RBAC implementation

### Key Existing Files Used:
- **`/SERVER/models/UserOrganizationalAssignment.js`** - User-region assignment model
- **`/SERVER/middleware/securityMiddleware.js`** - Base security middleware
- **`/SERVER/models/Region.js`** - Region model

## 🚀 Quick Start Guide

### 1. Basic Implementation

Replace basic authentication with region-based access control:

```javascript
// Before (basic authentication)
router.get('/proposals', checkToken, getProposals);

// After (region-based access control)
const { strictRegionControl, regionBasedAccessControl } = require('../middleware/regionBasedAccessControl');

// For read operations (automatic filtering)
router.get('/proposals', ...authenticatedRoute(), regionBasedAccessControl('read'), getProposals);

// For write operations (strict validation)
router.post('/proposals', ...authenticatedRoute(), strictRegionControl('create'), createProposals);
router.put('/proposals/:id', ...authenticatedRoute(), strictRegionControl('update'), updateProposal);
router.delete('/proposals/:id', ...authenticatedRoute(), strictRegionControl('delete'), deleteProposal);
```

### 2. Controller Implementation

Update controllers to use the RBAC filters:

```javascript
const getProposals = async (req, res) => {
  try {
    // Region filters are automatically applied by middleware
    const regionFilters = req.regionFilters || {};
    const accessibleRegions = req.accessibleRegions || [];
    
    // Apply filters to your database query
    const proposals = await Proposal.find({
      ...regionFilters,  // Automatically includes region restrictions
      ...req.query       // Other query parameters
    });
    
    res.json({
      success: true,
      proposals,
      appliedFilters: regionFilters,
      accessibleRegions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### 3. User-Region Assignment

Assign regions to users using the existing system:

```javascript
// Assign regions to a user (Admin only)
const assignment = await UserOrganizationalAssignment.create({
  userId: "user123",
  userName: "John Doe",
  email: "john@example.com",
  accessScope: "REGION",
  regions: [regionId1, regionId2], // MongoDB ObjectIds
  rolePermissions: {
    canCreateProposals: true,
    canEditOwnProposals: true,
    canEditAllProposals: false,
    canDeleteProposals: false,
    canApproveProposals: false,
    canViewReports: true
  }
});
```

## 🎭 User Roles & Region Access

### SUPER_ADMIN / BUDGET_MANAGER
- ✅ **Full Access**: Can transact in ALL regions
- ✅ **Bypass RBAC**: Region restrictions don't apply
- ✅ **User Management**: Can assign regions to other users

### BUDGET_OFFICER
- 🔒 **Region-Limited**: Can only access assigned regions
- ✅ **Read Operations**: Can view data from assigned regions
- ❌ **Limited Write**: May have restricted create/update/delete permissions

### USER (Regular User)
- 🔒 **Region-Limited**: Can only access assigned regions
- ✅ **Own Data**: Can create and edit own proposals in assigned regions
- ❌ **No Admin**: Cannot manage other users or assign regions

## 📚 API Endpoints

### User Access Information
```
GET /api/rbac/my-region-access          # Get user's accessible regions
POST /api/rbac/validate-region-access   # Validate access for specific region/operation
```

### Protected Transactions
```
GET /api/rbac/transactions              # Get transactions (auto-filtered by region)
POST /api/rbac/transactions             # Create transaction (region validated)
PUT /api/rbac/transactions/:id          # Update transaction (region validated)
DELETE /api/rbac/transactions/:id       # Delete transaction (region validated)
```

### Proposal Examples
```
GET /api/rbac/proposals                 # Get proposals (region-filtered)
POST /api/rbac/proposals                # Create proposal (region-validated)
```

### Admin Endpoints
```
POST /api/hierarchical-rbac/assignments     # Create or update hierarchical assignment
GET  /api/hierarchical-rbac/assignments      # Get all hierarchical assignments (admin)
GET  /api/hierarchical-rbac/assignments/:userId # Get one user's assignment
DELETE /api/hierarchical-rbac/assignments/:userId # Remove one user's assignment
GET  /api/hierarchical-rbac/my-access        # Current user's access info
```

### Testing & Debug
```
POST /api/rbac/test/region-access       # Test region access for different operations
```

## 🔧 Configuration Options

### Middleware Options

```javascript
// Basic region access control
regionBasedAccessControl('read')

// With options
regionBasedAccessControl('create', {
  strictMode: true,    // Deny access when no assignments exist
  logAccess: true      // Log all access attempts
})

// Convenience wrapper for strict control
strictRegionControl('create')  // Equivalent to above with strict options
```

### Access Scopes

```javascript
// User assignment with different access scopes
{
  accessScope: 'FULL',      // Access to all regions (Admin only)
  accessScope: 'REGION',    // Access to assigned regions only
  accessScope: 'DEPARTMENT', // Access to assigned departments
  accessScope: 'DIVISION',  // Access to assigned divisions  
  accessScope: 'OWN_ONLY'   // Access to own records only
}
```

## 🧪 Testing the Implementation

### 1. User Setup Test
```bash
# Check user's region access
curl -X GET "http://localhost:5005/api/rbac/my-region-access" \
  -H "Authorization: Bearer USER_JWT_TOKEN"
```

### 2. Transaction Test
```bash
# Try to create transaction in assigned region (should succeed)
curl -X POST "http://localhost:5005/api/rbac/transactions" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"region": "NCR", "transactionData": {"amount": 100000}, "transactionType": "PROPOSAL"}'

# Try to create transaction in unassigned region (should fail)
curl -X POST "http://localhost:5005/api/rbac/transactions" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"region": "REGION_VII", "transactionData": {"amount": 100000}, "transactionType": "PROPOSAL"}'
```

### 3. Access Validation Test
```bash
# Validate access to specific region
curl -X POST "http://localhost:5005/api/rbac/validate-region-access" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"region": "NCR", "operation": "create"}'
```

## 🔍 Monitoring & Logging

The system provides comprehensive logging:

```
🔍 RBAC Access Check: User john_doe (user123) attempting create operation
✅ RBAC: Create operation granted to john_doe for region: NCR
❌ RBAC: Create operation denied to jane_doe for region: REGION_VII
```

Monitor these logs for:
- **Access Violations**: Users trying to access unauthorized regions
- **Permission Denials**: Users lacking required operation permissions
- **Usage Patterns**: Which regions and operations are most frequently accessed

## 🚨 Security Considerations

### ⚠️ Important Notes
1. **Always validate regions** in both middleware and controllers
2. **Log access attempts** for security monitoring
3. **Regularly audit** user-region assignments
4. **Test thoroughly** with different user roles and scenarios
5. **Backup region assignments** before making changes

### 🛡️ Best Practices
- Assign users to the **minimum necessary regions**
- **Regularly review** and update region assignments
- Use **role-based permissions** in addition to region restrictions
- **Monitor logs** for suspicious access patterns
- **Test RBAC** thoroughly before production deployment

## 📈 Migration from Basic Authentication

### Step 1: Identify Transaction Endpoints
```javascript
// Find all endpoints that handle sensitive operations
const transactionEndpoints = [
  'POST /proposals',
  'PUT /proposals/:id', 
  'DELETE /proposals/:id',
  'GET /proposals',
  'POST /budget',
  // ... etc
];
```

### Step 2: Replace Middleware
```javascript
// Before
router.post('/proposals', checkToken, createProposal);

// After  
router.post('/proposals', ...authenticatedRoute(), strictRegionControl('create'), createProposal);
```

### Step 3: Update Controllers
```javascript
// Add region filter support
const getProposals = async (req, res) => {
  const regionFilters = req.regionFilters || {};
  const proposals = await Proposal.find({ ...regionFilters, ...req.query });
  // ... rest of controller
};
```

### Step 4: Test & Validate
- Test with users having different region assignments
- Verify that unauthorized access is properly blocked
- Confirm that authorized operations work correctly

## 🎯 Next Steps

1. **Deploy RBAC** to existing endpoints progressively
2. **Configure user-region assignments** for all users
3. **Train administrators** on region assignment management
4. **Monitor usage** and adjust permissions as needed
5. **Extend to departments/divisions** when models are available

## 📞 Support

For questions or issues with the RBAC implementation:
1. Check the logs for specific error messages
2. Review user-region assignments in the database
3. Test with the debug endpoints (`/api/rbac/test/region-access`)
4. Verify that the UserOrganizationalAssignment model has proper data

---

**🔐 Remember: Security is only as strong as its implementation. Always test thoroughly and monitor actively!**
