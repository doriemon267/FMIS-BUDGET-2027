# 📊 REGION-BASED WORKFLOW - VISUAL GUIDE

## Sample Scenario: MARIIS Region Budget Cycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BUDGET PROCESSING FOR MARIIS REGION                   │
└─────────────────────────────────────────────────────────────────────────┘

STEP 1: BUDGET PREPARER (MARIIS Region)
├─ User: Juan dela Cruz
├─ Region: MARIIS
├─ Action: Creates budget proposal
├─ Data: 
│  {
│    _id: "proposal_001",
│    description: "MARIIS Office Equipment",
│    region: "MARIIS",           ← Region is set here
│    createdByUserId: "user_123",
│    status: "Draft"
│  }
└─ Forwards To: BUDGET REVIEWER
   
   ↓↓↓ PROPOSAL ROUTING ↓↓↓
   
STEP 2: BUDGET REVIEWER (MARIIS Region)
├─ User: Maria Santos
├─ Region: MARIIS
├─ Visibility: Can see proposal
│  └─ Because: Same division + status matching
├─ Action: Reviews the proposal
└─ Forwards To: BUDGET APPROVER
   
   ↓↓↓ PROPOSAL ROUTING ↓↓↓
   
STEP 3: BUDGET APPROVER (MARIIS Region)
├─ User: Roberto Reyes
├─ Region: MARIIS
├─ Visibility: Can see proposal
│  └─ Because: Same division + workflow status
├─ Action: Approves the proposal
└─ Forwards To: BUDGET_PLANNING_ANALYST
   │
   │ ⚠️  CRITICAL FILTERING POINT ⚠️
   │
   ├─ Scenario A: ANALYST assigned to MARIIS only
   │  ├─ Assignment: { isNIAWide: false, assignedRegions: ['MARIIS'] }
   │  ├─ Proposal region: 'MARIIS'
   │  └─ Result: ✅ ANALYST CAN SEE PROPOSAL
   │
   └─ Scenario B: ANALYST assigned to CALABARZON only
      ├─ Assignment: { isNIAWide: false, assignedRegions: ['CALABARZON'] }
      ├─ Proposal region: 'MARIIS'
      └─ Result: ❌ ANALYST CANNOT SEE PROPOSAL
   
   ↓↓↓ ASSUMING ANALYST ASSIGNED TO MARIIS ↓↓↓
   
STEP 4: BUDGET_PLANNING_ANALYST (MARIIS Assignment)
├─ User: Dr. Antonio Alvarez
├─ Assignment:
│  {
│    userRole: "BUDGET_PLANNING_ANALYST",
│    isNIAWide: false,
│    assignedRegions: ["MARIIS"]
│  }
├─ Visibility: Can see proposals from MARIIS ONLY
│  └─ Filter Applied:
│     {
│       region: { $in: ["MARIIS"] },
│       $or: [ /* workflow visibility rules */ ]
│     }
├─ Can See:
│  ✅ Proposals from MARIIS region
│  ❌ Proposals from CALABARZON region
│  ❌ Proposals from other regions
├─ Action: Performs technical analysis
└─ Forwards To: BUDGET_OFFICER
   
   ↓↓↓ PROPOSAL ROUTING (No more region filtering) ↓↓↓
   
STEP 5: BUDGET_OFFICER
├─ User: Diane de los Reyes
├─ Region Filtering: NONE - Can see all regions
├─ Visibility: Can see proposal from ANY region
├─ Action: Provides operational approval
└─ Forwards To: OVERALL_BUDGET_APPROVER
   
   ↓↓↓ PROPOSAL ROUTING ↓↓↓
   
STEP 6: OVERALL_BUDGET_APPROVER
├─ User: Secretary of Budget
├─ Region Filtering: NONE - Can see all regions
├─ Action: Provides final executive approval
└─ Status: FINALIZED ✅
```

---

## Alternative Scenario: NIA-WIDE ANALYST

```
STEP 4: BUDGET_PLANNING_ANALYST (NIA-Wide Access)
├─ User: Dr. Antonio Alvarez (Same person, different assignment)
├─ Assignment:
│  {
│    userRole: "BUDGET_PLANNING_ANALYST",
│    isNIAWide: true,                    ← KEY DIFFERENCE
│    assignedRegions: []
│  }
├─ Visibility: Can see proposals from ALL REGIONS
│  └─ No region filter applied
├─ Can See:
│  ✅ Proposals from MARIIS region
│  ✅ Proposals from CALABARZON region
│  ✅ Proposals from REGION I
│  ✅ Proposals from ALL other regions
├─ Action: Performs technical analysis across regions
└─ Benefit: One analyst can handle all regions' technical reviews
```

---

## Region Filter Decision Tree

```
                    ┌─ User Request for Proposals ─┐
                    │  (BUDGET_PLANNING_ANALYST)    │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │ Check Hierarchical           │
                    │ Assignment                   │
                    └────────────┬─────────────────┘
                                 │
                    ┌────────────┴───────────────┐
                    │                            │
              ┌─────▼──────┐          ┌─────────▼──────┐
              │ isNIAWide  │          │ isNIAWide      │
              │ = true?    │          │ = false?       │
              └─────┬──────┘          └────────┬───────┘
                    │                         │
            ┌───────▼────────┐       ┌────────▼──────────┐
            │ Show ALL       │       │ Check assigned    │
            │ proposals      │       │ regions exist?    │
            │ from all       │       └────────┬──────────┘
            │ regions        │                │
            └────────────────┘    ┌───────────┴────────────┐
                                  │                        │
                        ┌─────────▼──────┐    ┌───────────▼──┐
                        │ Regions exist  │    │ No regions   │
                        └────────┬───────┘    │ assigned     │
                                 │           │ Show NONE    │
                        ┌────────▼────────┐  └──────────────┘
                        │ Filter proposals│
                        │ by region:      │
                        │ { region:       │
                        │   { $in: [...] }│
                        │ }               │
                        └─────────────────┘
```

---

## Database Query Examples

### Query 1: NIA-Wide ANALYST
```javascript
// ANALYST with NIA-Wide access
db.proposals.find({
  $or: [
    { currentAssigneeRole: 'BUDGET_PLANNING_ANALYST' },
    { status: 'Forwarded to Analyst' },
    { createdByUserId: '12345' },
    // ... other visibility conditions
  ]
})

// Returns: Proposals from MARIIS, CALABARZON, REGION I, etc.
// NO region filter applied
```

### Query 2: REGION-SPECIFIC ANALYST (MARIIS only)
```javascript
// ANALYST assigned to MARIIS region only
db.proposals.find({
  $and: [
    // REGION FILTER - NEW LOGIC
    { region: { $in: ['MARIIS'] } },
    
    // VISIBILITY FILTER - EXISTING LOGIC
    { $or: [
        { currentAssigneeRole: 'BUDGET_PLANNING_ANALYST' },
        { status: 'Forwarded to Analyst' },
        { createdByUserId: '12345' },
        // ... other visibility conditions
      ]
    }
  ]
})

// Returns: Proposals from MARIIS ONLY
// Filters out CALABARZON, REGION I, and other regions
```

### Query 3: REGION-SPECIFIC ANALYST (Multiple Regions)
```javascript
// ANALYST assigned to MARIIS and CALABARZON
db.proposals.find({
  $and: [
    // REGION FILTER - Multiple regions
    { region: { $in: ['MARIIS', 'CALABARZON'] } },
    
    // VISIBILITY FILTER - EXISTING LOGIC
    { $or: [
        { currentAssigneeRole: 'BUDGET_PLANNING_ANALYST' },
        { status: 'Forwarded to Analyst' },
        // ... other visibility conditions
      ]
    }
  ]
})

// Returns: Proposals from MARIIS OR CALABARZON
// Filters out other regions
```

---

## Data Structure Example

### BUDGET_PLANNING_ANALYST Hierarchical Assignment

```javascript
// Document in hierarchicaluserassignments collection
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  userId: "12345",
  userName: "Dr. Antonio Alvarez",
  email: "antonio.alvarez@nia.gov.ph",
  userRole: "BUDGET_PLANNING_ANALYST",
  assignmentLevel: "RESPONSIBILITY_CENTER",
  
  // REGION ASSIGNMENT - NEW FIELDS
  isNIAWide: false,
  assignedRegions: ["MARIIS", "CALABARZON"],
  
  // Other fields
  rolePermissions: {
    CreateProposals: false,
    EditOwnProposals: false,
    EditAllProposals: true,
    ApproveProposals: false,
    ViewReports: true
  },
  createdAt: ISODate("2025-11-04T10:30:00Z"),
  updatedAt: ISODate("2025-11-04T10:30:00Z")
}
```

### Proposal Document (with region field)

```javascript
// Document in proposals collection
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  description: "MARIIS Office Equipment Budget",
  
  // REGION - Matched during filtering
  region: "MARIIS",
  
  // Other fields
  status: "Forwarded to Analyst",
  currentAssigneeRole: "BUDGET_PLANNING_ANALYST",
  createdByUserId: "user_123",
  division: "Budget Division",
  createdAt: ISODate("2025-11-04T09:00:00Z")
}
```

---

## User Interface Flow

### In HierarchicalUserAssignmentPage.jsx

**Step 1: Select Role**
```
[User Role Dropdown]
  Selected: BUDGET_PLANNING_ANALYST
```

**Step 2: Region Selection Appears**
```
┌─ Region Assignment for Budget Planning Analyst ─────────────┐
│                                                              │
│ ⓘ Choose whether this analyst can access proposals from      │
│   all regions (NIA-Wide) or from specific regions only.      │
│                                                              │
│ [✓ NIA-Wide / All Regions] [Specific Regions]              │
│  Access proposals from all regions                           │
│                                                              │
│ (or if "Specific Regions" selected:)                         │
│                                                              │
│ [Autocomplete: Search and select regions...]                 │
│  ☑ MARIIS                                                    │
│  ☑ CALABARZON                                                │
│  ☐ REGION I                                                  │
│  ☐ CAR                                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Step 3: Save Assignment**
```
[Create Assignment]
  ✅ BUDGET_PLANNING_ANALYST assigned to: MARIIS, CALABARZON
```

---

## Workflow Status Progression

```
All steps up to STEP 3 (BUDGET APPROVER) have NO region restrictions
↓
All users in STEPS 1-3 are naturally in the same region
  (they work for the same organization)

STEP 4 - CRITICAL FILTERING ★
├─ BUDGET_PLANNING_ANALYST with NIA-Wide
│  └─ ✅ Can see proposals from ANY region
├─ BUDGET_PLANNING_ANALYST with MARIIS
│  ├─ ✅ Can see: MARIIS proposals
│  └─ ❌ Cannot see: Other region proposals
└─ BUDGET_PLANNING_ANALYST with no assignment
   └─ ❌ Cannot see: Any proposals (safety measure)

STEPS 5-6 - NO region restrictions
├─ BUDGET_OFFICER can see all regions
└─ OVERALL_BUDGET_APPROVER can see all regions
```

---

## Testing the Implementation

### Test Case 1: MARIIS-only ANALYST
```
1. Create BUDGET_PLANNING_ANALYST:
   - Name: Test Analyst
   - Region Assignment: MARIIS only
   - Save ✅

2. Submit proposals from different regions:
   - Proposal A: MARIIS region
   - Proposal B: CALABARZON region

3. Login as Test Analyst
4. Navigate to "All Proposals"
5. Expected: See Proposal A (MARIIS)
   Expected: NOT see Proposal B (CALABARZON)
```

### Test Case 2: NIA-Wide ANALYST
```
1. Create BUDGET_PLANNING_ANALYST:
   - Name: Test Analyst 2
   - Region Assignment: NIA-Wide
   - Save ✅

2. Same proposals as Test Case 1

3. Login as Test Analyst 2
4. Navigate to "All Proposals"
5. Expected: See BOTH Proposal A and Proposal B
   Reason: NIA-Wide access shows all regions
```

---

## ✅ Implementation Status

- [x] Region assignment UI in HierarchicalUserAssignmentPage
- [x] Database fields (isNIAWide, assignedRegions) stored
- [x] Middleware filtering logic implemented
- [x] Query filtering by region working
- [x] NIA-Wide toggle working
- [x] Multiple region selection working
- [x] Logging for debugging added
- [ ] End-to-end testing (user should test)
- [ ] Production deployment ready

---

**Last Updated**: November 4, 2025
**Status**: ✅ Ready for Testing
