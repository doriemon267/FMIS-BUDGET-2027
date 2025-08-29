# 🏢 Hierarchical Role-Based Access Control (RBAC) System

## Overview

The Hierarchical RBAC system implements a **Division → Department → Region** consolidation model where:

- **Division users** submit proposals that are consolidated to their **Department** records
- **Department users** submit proposals that are consolidated to their **Region** records  
- **Region users** submit proposals directly to their **Region** records
- All data ultimately rolls up to the **Region level** for centralized reporting

## 🎯 Key Features

### ✅ Hierarchical Data Consolidation
- **Automatic Rollup**: Lower-level submissions automatically consolidate to higher levels
- **Audit Trail**: Complete tracking of original submission level and consolidation path
- **Metadata Preservation**: Original organizational context is preserved alongside consolidated data

### ✅ Access Scope Management
- **DIVISION**: Can create/edit division data, view consolidated department data
- **DEPARTMENT**: Can create/edit department data, view consolidated region data  
- **REGION**: Can create/edit/view all region data
- **FULL**: Admin access to all organizational levels
- **OWN_ONLY**: Restricted to own records only

### ✅ Intelligent Filtering
- **Read Operations**: Automatically filter data based on user's hierarchical access
- **Write Operations**: Validate organizational boundaries and apply consolidation
- **Reporting**: Region-centric reports with proper hierarchical aggregation

## 📋 Implementation Files

### Core System Files
```
SERVER/
├── middleware/
│   ├── hierarchicalAccessControl.js      # Main hierarchical RBAC middleware
│   └── regionBasedAccessControl.js       # Original region-based system (enhanced)
├── controllers/
│   └── HierarchicalUserAssignmentController.js  # User assignment management
├── models/
│   └── UserOrganizationalAssignment.js   # Enhanced with consolidation methods
├── routers/
│   └── hierarchicalRBACRoutes.js         # API routes for hierarchical system
└── scripts/
    └── hierarchicalRBACDemo.js           # Demonstration and testing script
```

### Documentation Files
```
DOCUMENTATION/
├── HIERARCHICAL_RBAC_IMPLEMENTATION.md   # This file - complete guide
├── RBAC_IMPLEMENTATION_SUMMARY.md        # Original RBAC documentation
└── API_HIERARCHICAL_RBAC.md              # API documentation (generated)
```

## 🚀 Quick Start Guide

### 1. Setup User Assignments

```javascript
// Create a Division user assignment
const divisionAssignment = await UserOrganizationalAssignment.create({
  userId: "div_user_123",
  userName: "John Division Manager", 
  email: "john@company.com",
  accessScope: "DIVISION",
  regions: [regionObjectId],
  departments: [departmentObjectId], 
  divisions: ["Software Development Division"],
  rolePermissions: {
    canCreateProposals: true,
    canEditOwnProposals: true,
    canEditAllProposals: false,
    canViewReports: true
  }
});

// Create a Department user assignment  
const departmentAssignment = await UserOrganizationalAssignment.create({
  userId: "dept_user_456",
  userName: "Jane Department Head",
  email: "jane@company.com", 
  accessScope: "DEPARTMENT",
  regions: [regionObjectId],
  departments: [departmentObjectId],
  divisions: [],
  rolePermissions: {
    canCreateProposals: true,
    canEditOwnProposals: true,
    canEditAllProposals: true,
    canApproveProposals: true,
    canViewReports: true
  }
});
```

### 2. Apply Hierarchical Middleware to Routes

```javascript
const { hierarchicalAccessControl, strictHierarchicalControl } = require('../middleware/hierarchicalAccessControl');

// Read operations (automatic filtering)
router.get('/proposals', 
  ...authenticatedRoute(),
  hierarchicalAccessControl('read'),
  getProposals
);

// Write operations (with consolidation)
router.post('/proposals',
  ...authenticatedRoute(), 
  strictHierarchicalControl('create'),
  createProposal
);

router.put('/proposals/:id',
  ...authenticatedRoute(),
  strictHierarchicalControl('update'), 
  updateProposal
);
```

### 3. Use Consolidation in Controllers

```javascript
const createProposal = async (req, res) => {
  try {
    // Hierarchical middleware has already applied consolidation
    const proposalData = req.body; // Contains consolidated data
    const originalContext = req.originalOrgContext; // Original submission context
    const consolidationMetadata = req.body.consolidationMetadata;

    // Save to database with consolidated organizational data
    const proposal = await Proposal.create({
      ...proposalData,
      createdBy: req.user.id,
      createdAt: new Date()
    });

    return res.status(201).json({
      success: true,
      proposal,
      consolidationApplied: consolidationMetadata?.consolidationApplied,
      originalContext,
      consolidatedContext: {
        region: proposalData.region,
        department: proposalData.department,
        division: proposalData.division
      }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
```

## 🎭 User Assignment Levels

### Division Level Users
```javascript
{
  accessScope: "DIVISION",
  regions: [ObjectId("region_id")],
  departments: [ObjectId("dept_id")], 
  divisions: ["Software Development Division"],
  
  // Consolidation behavior:
  // Proposals → Department records → Region rollup
  
  // Access pattern:
  // Can read: Own division + consolidated department data
  // Can write: Division proposals (saved to department level)
}
```

### Department Level Users  
```javascript
{
  accessScope: "DEPARTMENT",
  regions: [ObjectId("region_id")],
  departments: [ObjectId("dept_id")],
  divisions: [],
  
  // Consolidation behavior: 
  // Proposals → Region records (direct)
  
  // Access pattern:
  // Can read: Own department + consolidated region data
  // Can write: Department proposals (saved to region level)
}
```

### Region Level Users
```javascript
{
  accessScope: "REGION", 
  regions: [ObjectId("region_id")],
  departments: [],
  divisions: [],
  
  // Consolidation behavior:
  // Proposals → Region records (no consolidation)
  
  // Access pattern:
  // Can read: All data within assigned region
  // Can write: Region proposals (direct storage)
}
```

## 🔄 Consolidation Flow

### Division User Submission
```
Division User Creates Proposal
        ↓
Original Data: { division: "IT Division", ... }
        ↓
Consolidation Applied
        ↓
Final Data: { 
  originalLevel: "DIVISION",
  originalDivision: "IT Division", 
  department: "Technology Department",    ← Consolidated to
  region: "NCR",                         ← Ultimate region
  consolidatedFrom: "DIVISION",
  consolidationMetadata: { ... }
}
        ↓
Saved to Department Records
        ↓
Appears in Region Reports
```

### Department User Submission
```
Department User Creates Proposal
        ↓
Original Data: { department: "Technology Department", ... }
        ↓  
Consolidation Applied
        ↓
Final Data: {
  originalLevel: "DEPARTMENT",
  originalDepartment: "Technology Department",
  region: "NCR",                         ← Consolidated to
  consolidatedFrom: "DEPARTMENT", 
  consolidationMetadata: { ... }
}
        ↓
Saved to Region Records
        ↓
Appears in Region Reports
```

### Region User Submission
```
Region User Creates Proposal
        ↓
Original Data: { region: "NCR", ... }
        ↓
No Consolidation Needed
        ↓
Final Data: {
  originalLevel: "REGION",
  region: "NCR",
  consolidationMetadata: { ... }
}
        ↓
Saved to Region Records
        ↓
Appears in Region Reports
```

## 📊 Data Access Patterns

### Division Users Can Access:
- ✅ Their own division data
- ✅ Consolidated department data (from their division + others in same dept)
- ❌ Other divisions in different departments
- ❌ Direct region data (unless consolidated from their department)

### Department Users Can Access:
- ✅ Their department data (including consolidated from divisions)
- ✅ Consolidated region data (from their department + others in same region)
- ❌ Other departments in different regions
- ❌ Direct division data from other departments

### Region Users Can Access:
- ✅ All data within their assigned region
- ✅ All departments within their region
- ✅ All divisions within their region
- ❌ Data from other regions

## 🔧 API Endpoints

### User Assignment Management
```http
POST /api/hierarchical-rbac/assignments
GET  /api/hierarchical-rbac/assignments
GET  /api/hierarchical-rbac/assignments/:userId
PUT  /api/hierarchical-rbac/assignments/:userId
DELETE /api/hierarchical-rbac/assignments/:userId
```

### Access Information
```http
GET  /api/hierarchical-rbac/my-access
POST /api/hierarchical-rbac/validate-access
```

### Protected Operations (Examples)
```http
GET  /api/hierarchical-rbac/proposals          # Filtered by hierarchy
POST /api/hierarchical-rbac/proposals          # With consolidation
PUT  /api/hierarchical-rbac/proposals/:id      # Validated by hierarchy
```

### Organization Structure
```http
GET  /api/hierarchical-rbac/organization-structure
```

### Testing & Demo
```http
POST /api/hierarchical-rbac/test-consolidation
```

## 🧪 Testing the System

### 1. Run the Demo Script
```bash
cd SERVER
node scripts/hierarchicalRBACDemo.js
```

### 2. Create Test Assignments
```javascript
// Create division user
const response = await fetch('/api/hierarchical-rbac/assignments', {
  method: 'POST',
  headers: { 
    'Authorization': 'Bearer ' + adminToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'test_division_user',
    userName: 'Test Division User',
    email: 'test@division.com',
    assignmentLevel: 'DIVISION',
    regionId: 'region_object_id',
    departmentId: 'department_object_id', 
    divisionName: 'Test Division'
  })
});
```

### 3. Test Consolidation
```javascript
// Submit proposal as division user
const proposal = await fetch('/api/hierarchical-rbac/proposals', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + divisionUserToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Division Test Proposal',
    description: 'Testing consolidation',
    amount: 50000
  })
});

// Check if proposal was consolidated to department level
const result = await proposal.json();
console.log('Consolidation applied:', result.consolidationApplied);
console.log('Saved to level:', result.consolidatedContext);
```

### 4. Validate Access Patterns
```javascript
// Test read access with hierarchy
const proposals = await fetch('/api/hierarchical-rbac/proposals', {
  headers: { 'Authorization': 'Bearer ' + divisionUserToken }
});

// Should return only division's data + consolidated department data
const data = await proposals.json();
console.log('Accessible proposals:', data.proposals.length);
console.log('Access scope:', data.userAccess.scope);
```

## 🔍 Monitoring & Debugging

### Log Messages to Watch For
```
🏢 Hierarchical Access Check: User john_division (div_user_123) attempting create operation
✅ Hierarchical Write: create operation granted to john_division  
🔄 Consolidation applied: {"originalLevel":"DIVISION","targetLevel":"DEPARTMENT"}
📋 Hierarchical Read: jane_department granted access with scope DEPARTMENT
```

### Common Issues & Solutions

**Issue**: User can't access expected data
```javascript
// Check user's assignment
const assignment = await UserOrganizationalAssignment.findOne({ userId });
console.log('User scope:', assignment.accessScope);
console.log('Consolidation info:', assignment.getConsolidationTarget());
```

**Issue**: Consolidation not working
```javascript
// Verify middleware is applied
router.post('/proposals',
  ...authenticatedRoute(),
  strictHierarchicalControl('create'), // ← Make sure this is present
  createProposal
);
```

**Issue**: Unexpected access permissions
```javascript
// Check role permissions
console.log('User permissions:', assignment.rolePermissions);
console.log('Operation allowed:', assignment.rolePermissions.canCreateProposals);
```

## 📈 Benefits & Impact

### For Users
- ✅ **Clear Boundaries**: Users know exactly what they can access
- ✅ **Simplified Workflow**: Submit at their level, system handles consolidation
- ✅ **Relevant Data**: See only data relevant to their organizational context

### For Administrators  
- ✅ **Centralized Control**: Manage access through organizational assignments
- ✅ **Audit Trail**: Complete visibility into who can access what
- ✅ **Flexible Structure**: Easy to adjust organizational boundaries

### For Reporting
- ✅ **Regional Consolidation**: All data ultimately aggregates to region level
- ✅ **Hierarchical Views**: Can generate reports at any organizational level
- ✅ **Data Integrity**: Automatic consolidation prevents data fragmentation

### For Security
- ✅ **Principle of Least Privilege**: Users get minimum necessary access
- ✅ **Organizational Boundaries**: Strong enforcement of org structure
- ✅ **Scalable Model**: Easily add new organizational levels

## 🚀 Production Deployment

### 1. Database Migration
```javascript
// Add indexes for performance
db.userorganizationalassignments.createIndex({ "userId": 1 });
db.userorganizationalassignments.createIndex({ "accessScope": 1 });
db.userorganizationalassignments.createIndex({ "regions": 1 });
db.userorganizationalassignments.createIndex({ "departments": 1 });
```

### 2. Environment Configuration
```env
# Enable hierarchical RBAC
HIERARCHICAL_RBAC_ENABLED=true
RBAC_LOG_ACCESS=true
RBAC_STRICT_MODE=true
```

### 3. Route Integration
```javascript
// Replace existing RBAC with hierarchical version
// OLD:
router.get('/proposals', regionBasedAccessControl('read'), getProposals);

// NEW:
router.get('/proposals', hierarchicalAccessControl('read'), getProposals);
```

### 4. Data Validation
```javascript
// Validate existing organizational assignments
const validationScript = require('./scripts/validateHierarchicalAssignments');
await validationScript.validateExistingAssignments();
```

## 🎯 Next Steps

### Phase 1: Core Implementation ✅
- [x] Hierarchical middleware development
- [x] User assignment controller
- [x] Consolidation logic
- [x] API routes
- [x] Documentation

### Phase 2: Integration (Current)
- [ ] Replace existing RBAC middleware in key routes
- [ ] Migrate existing user assignments
- [ ] Update frontend components to handle hierarchical data
- [ ] Integration testing

### Phase 3: Advanced Features
- [ ] Hierarchical reporting dashboard
- [ ] Bulk assignment management
- [ ] Cross-organizational workflows
- [ ] Performance optimization

### Phase 4: Monitoring & Optimization
- [ ] Performance monitoring
- [ ] Access pattern analysis  
- [ ] Security audit logging
- [ ] User training materials

## 📞 Support & Troubleshooting

### Common Commands
```bash
# Run demo
node scripts/hierarchicalRBACDemo.js

# Test assignments
npm run test:hierarchical-rbac

# Validate data integrity
node scripts/validateHierarchicalData.js

# Clean up test data
node scripts/cleanupHierarchicalDemo.js
```

### Log Analysis
```bash
# Find access violations
grep "❌ Hierarchical" logs/application.log

# Monitor consolidation activity
grep "🔄 Consolidation applied" logs/application.log

# Check assignment changes
grep "📝 Assignment" logs/application.log
```

### Performance Monitoring
```javascript
// Check middleware execution time
console.time('hierarchical-access-check');
await hierarchicalAccessControl('read')(req, res, next);
console.timeEnd('hierarchical-access-check');
```

---

## 📋 Summary

The Hierarchical RBAC system provides a robust solution for managing organizational access with automatic data consolidation. The **Division → Department → Region** hierarchy ensures that:

1. **Users work at their appropriate level** while data flows up the hierarchy
2. **Regional reporting is comprehensive** with all organizational data consolidated
3. **Access boundaries are clearly defined** and automatically enforced
4. **System administration is simplified** through organizational-based assignments

This implementation maintains backward compatibility while providing enhanced security, better data organization, and more intuitive user access patterns.
