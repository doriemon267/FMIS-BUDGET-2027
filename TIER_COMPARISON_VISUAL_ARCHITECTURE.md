# Tier Comparison Feature - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              TierComparisonPage.jsx                             │ │
│  │                                                                 │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐     │ │
│  │  │   Filters    │  │  Summary     │  │   Tab Panel     │     │ │
│  │  │   - Region   │  │   Cards      │  │   - Tier 1 Tab  │     │ │
│  │  │   - FY       │  │   - Totals   │  │   - Tier 2 Tab  │     │ │
│  │  │   - Budget   │  │   - Adjust   │  │                 │     │ │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘     │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐    │ │
│  │  │   Tier 1 Table          │  │   Tier 2 Table          │    │ │
│  │  │   (Read-Only)           │  │   (Editable)            │    │ │
│  │  │   - Categories          │  │   - Edit Actions        │    │ │
│  │  │   - Status: Finalized   │  │   - Delete Actions      │    │ │
│  │  └─────────────────────────┘  └─────────────────────────┘    │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │              Edit Dialog (Tier 2 Only)                   │ │ │
│  │  │  - Title, Description, Amount                            │ │ │
│  │  │  - Remarks, Priority, Status                             │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────── │ │
└───────────────────────┬──────────────────────────────────────────── ┘
                        │
                        │ HTTP Requests (axios/api)
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                        │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         tierComparisonRoutes.js (API Layer)                  │   │
│  │                                                               │   │
│  │  GET    /api/tier-comparison/tier1/finalized                 │   │
│  │  GET    /api/tier-comparison/tier2                          │   │
│  │  POST   /api/tier-comparison/tier2/copy-from-tier1          │   │
│  │  PUT    /api/tier-comparison/tier2/:id                      │   │
│  │  DELETE /api/tier-comparison/tier2/:id                      │   │
│  │  GET    /api/tier-comparison/regions                        │   │
│  └────────────────────┬──────────────────────────────────────────┘  │
│                       │                                               │
│                       │ Mongoose ORM                                  │
│                       │                                               │
└───────────────────────▼───────────────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────────────────┐
│                    DATABASE (MongoDB)                                 │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              TIER 1 DATA (Read-Only)                        │    │
│  │                                                              │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │    │
│  │  │ PersonnelSvc   │  │ MooeProposal   │  │ CapitalOutlay│ │    │
│  │  │ (Finalized)    │  │ (Finalized)    │  │ (Finalized)  │ │    │
│  │  └────────────────┘  └────────────────┘  └──────────────┘ │    │
│  │                                                              │    │
│  │  ┌────────────────┐  ┌────────────────┐                    │    │
│  │  │ Income         │  │ BudgetSupport  │                    │    │
│  │  │ (Finalized)    │  │ (Finalized)    │                    │    │
│  │  └────────────────┘  └────────────────┘                    │    │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│                       ▼ Copy Operation                                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              TIER 2 DATA (Editable)                          │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │         tier2proposals Collection                     │   │   │
│  │  │                                                        │   │   │
│  │  │  - tier1References[] (source tracking)               │   │   │
│  │  │  - tier1Amount (original)                            │   │   │
│  │  │  - tier2Amount (adjusted) ◄── EDITABLE               │   │   │
│  │  │  - adjustmentAmount (calculated)                     │   │   │
│  │  │  - adjustmentPercentage (calculated)                 │   │   │
│  │  │  - tier2Status (Draft/Approved/Finalized)            │   │   │
│  │  │  - priority (High/Medium/Low/Critical)               │   │   │
│  │  │  - tier2Remarks (justification)                      │   │   │
│  │  │  - tier2ApprovalHistory[] (audit trail)              │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Sequence

```
USER ACTION                    SYSTEM RESPONSE
───────────────────────────────────────────────────────────────────

1. Select Region (NCR)  ──────► Fetch Regions API
                                 │
                                 ▼
                        Return: [NCR, Region I, Region II, ...]

2. Click Refresh  ──────────────► GET /tier1/finalized?region=NCR
                                 │
                                 ▼
                        Query MongoDB:
                        - PersonnelServices (status=Finalized)
                        - MooeProposal (status=Finalized)
                        - CapitalOutlay (status=Finalized)
                        - Income (status=Finalized)
                        - BudgetarySupport (status=Finalized)
                                 │
                                 ▼
                        Return: { data, totals, metadata }
                                 │
                                 ▼
                        Display in Tier 1 Tab (Read-Only)

3. Click "Copy to Tier 2"  ────► POST /tier2/copy-from-tier1
                                 │
                                 ▼
                        1. Fetch all Tier 1 finalized data
                        2. Group by category
                        3. Create Tier 2 documents:
                           - tier1Amount = sum(category)
                           - tier2Amount = tier1Amount
                           - adjustmentAmount = 0
                        4. Insert into tier2proposals
                                 │
                                 ▼
                        Return: { success, data, metadata }
                                 │
                                 ▼
                        Display in Tier 2 Tab (Editable)

4. Click Edit on Tier 2  ───────► Open Edit Dialog
                                 │
                                 ▼
                        Load proposal data into form

5. Modify Amount  ──────────────► Update local state
                        (₱50M → ₱55M)

6. Enter Remarks  ──────────────► Update local state
   "Critical projects"

7. Set Priority = High  ────────► Update local state

8. Click Save  ─────────────────► PUT /tier2/:id
                                 │
                                 ▼
                        1. Validate input
                        2. Calculate adjustments:
                           - adjustmentAmount = 55M - 50M = 5M
                           - adjustmentPercentage = (5M/50M)*100 = 10%
                        3. Update tier2proposals document
                        4. Add to approvalHistory
                        5. Update lastModifiedBy
                                 │
                                 ▼
                        Return: { success, updated data }
                                 │
                                 ▼
                        1. Close dialog
                        2. Refresh Tier 2 table
                        3. Show success toast
                        4. Update summary cards

9. View Adjustments  ───────────► Display:
                        - Tier 1: ₱50,000,000
                        - Tier 2: ₱55,000,000
                        - Adjustment: +₱5,000,000 (10%) [GREEN]
```

---

## Component Hierarchy

```
TierComparisonPage
│
├── Filters Section
│   ├── Region Dropdown (FormControl)
│   ├── Fiscal Year Input (TextField)
│   ├── Budget Type Dropdown (FormControl)
│   └── Action Buttons
│       ├── Refresh Button
│       └── Copy to Tier 2 Button
│
├── Summary Cards (Grid)
│   ├── Tier 1 Total Card
│   ├── Tier 2 Total Card
│   └── Adjustment Card
│
├── Tab Panel
│   ├── Tab 1: Tier 1 (Read-Only)
│   │   └── renderTier1Table()
│   │       ├── TableContainer
│   │       ├── Table Header
│   │       └── Table Body (by category)
│   │           ├── Personnel rows
│   │           ├── MOOE rows
│   │           ├── Capital Outlay rows
│   │           ├── Income rows
│   │           └── Budgetary Support rows
│   │
│   └── Tab 2: Tier 2 (Editable)
│       └── renderTier2Table()
│           ├── TableContainer
│           ├── Table Header
│           └── Table Body
│               └── Tier 2 rows
│                   ├── Edit IconButton
│                   └── Delete IconButton
│
└── Edit Dialog (Modal)
    ├── DialogTitle
    ├── DialogContent
    │   ├── Title TextField
    │   ├── Description TextField
    │   ├── Tier 2 Amount TextField
    │   ├── Remarks TextField
    │   ├── Priority Dropdown
    │   └── Status Dropdown
    └── DialogActions
        ├── Cancel Button
        └── Save Button
```

---

## State Management Flow

```
Component State (React Hooks)
──────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────┐
│              useState Hooks                     │
├─────────────────────────────────────────────────┤
│ regions[]            - List of regions          │
│ selectedRegion       - Current region           │
│ fiscalYear          - Filter value              │
│ budgetType          - Filter value              │
│ loading             - Loading state             │
│ copying             - Copy operation state      │
│ tier1Data{}         - Tier 1 proposals          │
│ tier2Data[]         - Tier 2 proposals          │
│ tier1Totals{}       - Tier 1 calculations       │
│ tier2Totals{}       - Tier 2 calculations       │
│ activeTab           - Current tab (0 or 1)      │
│ editDialogOpen      - Dialog visibility         │
│ selectedTier2       - Selected proposal         │
│ editFormData{}      - Form state                │
└─────────────────────────────────────────────────┘
         │                    │                  
         │                    │                  
         ▼                    ▼                  
    API Calls            User Actions            
    (useEffect)          (onClick, onChange)     
```

---

## Security & Authorization Flow

```
Client Request
     │
     │ JWT Token in Header
     │
     ▼
┌─────────────────────────────┐
│  authenticateToken          │
│  Middleware                 │
│  - Verify JWT               │
│  - Extract user info        │
└────────────┬────────────────┘
             │
             ▼
      Valid Token?
             │
         ┌───┴───┐
         │       │
        NO      YES
         │       │
         ▼       ▼
     401      Role Check
   Unauthorized   │
         │        │
         │    ┌───┴───────────────────────┐
         │    │ User has required role?   │
         │    │ - BUDGET_PLANNING_ANALYST │
         │    │ - budgetAnalyst          │
         │    │ - BUDGET_OFFICER         │
         │    │ - BUDGET_MANAGER         │
         │    │ - overallBudgetApprover  │
         │    │ - superAdmin             │
         │    └───┬───────────────────────┘
         │        │
         │    ┌───┴───┐
         │    │       │
         │   NO      YES
         │    │       │
         │    ▼       ▼
         └─► 403   Process Request
           Forbidden   │
                      ▼
                  Response
```

---

## Database Schema Visual

```
tier2proposals Collection
┌────────────────────────────────────────────────────────────┐
│ _id: ObjectId                                              │
│ ────────────────────────────────────────────────────────── │
│ tier1References: [                                         │
│   {                                                        │
│     sourceType: "personnel" | "mooe" | "capital" |        │
│                 "income" | "budgetarySupport"             │
│     sourceId: ObjectId (reference to source)              │
│   }                                                        │
│ ]                                                          │
│ ────────────────────────────────────────────────────────── │
│ title: String                                              │
│ description: String                                        │
│ ────────────────────────────────────────────────────────── │
│ region: String [INDEXED]                                   │
│ department: String                                         │
│ division: String                                           │
│ ────────────────────────────────────────────────────────── │
│ fiscalYear: String [INDEXED]                               │
│ budgetType: String                                         │
│ ────────────────────────────────────────────────────────── │
│ tier1Amount: Number (original)                             │
│ tier2Amount: Number (adjusted) ◄─── EDITABLE              │
│ adjustmentAmount: Number (calculated)                      │
│ adjustmentPercentage: Number (calculated)                  │
│ ────────────────────────────────────────────────────────── │
│ categoryBreakdown: {                                       │
│   personnelServices: Number                                │
│   mooe: Number                                             │
│   capitalOutlay: Number                                    │
│   income: Number                                           │
│   budgetarySupport: Number                                 │
│ }                                                          │
│ ────────────────────────────────────────────────────────── │
│ tier2Remarks: String ◄─── EDITABLE                         │
│ priority: "High"|"Medium"|"Low"|"Critical" ◄─ EDITABLE     │
│ tier2Status: "Draft"|"Under Review"|"Approved"|            │
│              "Rejected"|"Finalized" [INDEXED]              │
│ ────────────────────────────────────────────────────────── │
│ createdBy: {                                               │
│   userId: String [INDEXED]                                 │
│   userName: String                                         │
│   userRole: String                                         │
│ }                                                          │
│ ────────────────────────────────────────────────────────── │
│ lastModifiedBy: {                                          │
│   userId: String                                           │
│   userName: String                                         │
│   userRole: String                                         │
│   modifiedAt: Date                                         │
│ }                                                          │
│ ────────────────────────────────────────────────────────── │
│ tier2ApprovalHistory: [                                    │
│   {                                                        │
│     action: "Created"|"Edited"|"Submitted"|                │
│             "Approved"|"Rejected"|"Returned"               │
│     userId: String                                         │
│     userName: String                                       │
│     userRole: String                                       │
│     comment: String                                        │
│     timestamp: Date                                        │
│   }                                                        │
│ ]                                                          │
│ ────────────────────────────────────────────────────────── │
│ tier2Metadata: {                                           │
│   copiedFromTier1At: Date                                  │
│   lastSyncedWithTier1At: Date                             │
│   isDraft: Boolean                                         │
│   isLocked: Boolean                                        │
│ }                                                          │
│ ────────────────────────────────────────────────────────── │
│ createdAt: Date (auto)                                     │
│ updatedAt: Date (auto)                                     │
└────────────────────────────────────────────────────────────┘

Indexes:
- { region: 1, fiscalYear: 1, tier2Status: 1 }
- { 'createdBy.userId': 1 }
- { tier2Status: 1 }
```

---

## User Journey Map

```
START
  │
  ▼
┌──────────────────────┐
│ Login to System      │
│ (BRD-level user)     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Navigate to:         │
│ Budget Management    │
│   → Tier Comparison  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Select Region        │
│ Set Filters          │
│ Click Refresh        │
└──────────┬───────────┘
           │
           ▼
     ┌─────────────┐
     │ Has Tier 1  │
     │ data?       │
     └─────┬───┬───┘
          NO  YES
           │   │
           │   ▼
           │ ┌──────────────────────┐
           │ │ View Tier 1 Tab      │
           │ │ (Read-Only)          │
           │ └──────────┬───────────┘
           │            │
           │            ▼
           │      ┌─────────────┐
           │      │ Has Tier 2  │
           │      │ data?       │
           │      └─────┬───┬───┘
           │           NO  YES
           │            │   │
           ▼            ▼   ▼
      Display Error  Copy  View Tier 2
      "No finalized  Tier1 Tab (Editable)
       proposals"    to    │
           │         Tier2  │
           │            │   │
           │            └───┘
           │                │
           └────────────────┘
                            │
                            ▼
                  ┌──────────────────────┐
                  │ Edit Tier 2?         │
                  └──────────┬───────────┘
                            YES
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Click Edit Button    │
                  │ Open Edit Dialog     │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Modify:              │
                  │ - Amount             │
                  │ - Remarks            │
                  │ - Priority           │
                  │ - Status             │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Click Save           │
                  │ Auto-calculate       │
                  │ adjustments          │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ View Updated Data    │
                  │ - Adjustments shown  │
                  │ - Totals updated     │
                  └──────────┬───────────┘
                             │
                             ▼
                     ┌──────────────┐
                     │ More edits?  │
                     └──────┬───┬───┘
                           YES NO
                            │   │
                            └───┘
                                │
                                ▼
                              DONE
```

---

This visual architecture provides a comprehensive understanding of the Tier Comparison feature from multiple perspectives: system architecture, data flow, component structure, state management, security, database schema, and user journey.
