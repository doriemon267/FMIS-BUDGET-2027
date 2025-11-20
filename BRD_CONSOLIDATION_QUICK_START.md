# BRD Consolidation - Quick Start Guide

## 📋 What is BRD Consolidation?

Automatic folder structure that organizes proposals by Region/Division when they reach the **Budget Planning Analyst (BRD)** level.

```
Regional Proposals:                  Central Office Proposals:
NCR/                                Central Office/
├── Finance Division                ├── Human Resources
├── Procurement Division            ├── Finance Department
└── Admin Division                  └── Legal Department

Region II/
├── Engineering Division
└── Operations Division
```

---

## 🔄 How It Works

**Step 1:** Proposal created and routed through workflow  
**Step 2:** Budget Approver submits to Budget Planning Analyst  
**Step 3:** ✅ **Automatic consolidation triggered!**  
**Step 4:** Proposal appears in BRD Consolidation structure  

---

## 👁️ Viewing Consolidation

### From Menu
1. Navigate to: **BRD Level Consolidation** (in sidebar menu)
2. View dashboard with all organized proposals

### Dashboard Features
- **Summary Cards**: Total proposals, amount, regions, departments
- **Regional Tab**: View all regions and their divisions
  - Click region row to expand and see divisions
  - Shows proposal count and total amount per division
- **Central Office Tab**: View all departments
  - Click department row to expand details
  - Shows proposal count and total amount

---

## 📊 API Endpoints (for Developers)

### 1. Get All Consolidation Folders
```bash
GET /api/new-proposal-workflow/consolidation/folders?fiscalYear=2025
```
Returns: List of all consolidation paths with metadata

### 2. Get Regional Structure
```bash
GET /api/new-proposal-workflow/consolidation/regions?fiscalYear=2025
```
Returns: Hierarchical region → division → proposals

### 3. Get Central Office Structure
```bash
GET /api/new-proposal-workflow/consolidation/central-office?fiscalYear=2025
```
Returns: Department → proposals

### 4. Get Consolidation Summary
```bash
GET /api/new-proposal-workflow/consolidation/summary?fiscalYear=2025
```
Returns: Statistics (total proposals, amounts, distribution by type)

### 5. Get Proposals in Specific Folder
```bash
GET /api/new-proposal-workflow/consolidation/folders/NCR%2FFinance%20Division/proposals
```
Returns: All proposals in that consolidation folder

---

## 💡 Key Features

✅ **Automatic** - No manual setup needed  
✅ **Hierarchical** - Region/Division or CO/Department structure  
✅ **By Fiscal Year** - Filter by year  
✅ **Real-time** - Updates as proposals transition through workflow  
✅ **Analytics** - Summary statistics and distribution  
✅ **Non-blocking** - Doesn't impact workflow if consolidation fails  

---

## 📝 Data Captured

When a proposal is consolidated, the following is captured:

| Field | Value | Example |
|-------|-------|---------|
| Proposal ID | Link to workflow | ObjectId(...) |
| Title | Proposal name | "Equipment Purchase" |
| Amount | Budget amount | ₱500,000 |
| Region | Organization unit | "NCR" |
| Division | Sub-unit | "Finance Division" |
| Department | CO department | "Human Resources" |
| Path | Folder structure | "NCR/Finance Division" |
| Fiscal Year | Budget year | 2025 |
| Model Type | Type of proposal | "Initial", "NEP", "GAA" |

---

## 🔍 Example Workflow

### Regional Proposal Example

**Scenario:** Finance Division in NCR submits equipment purchase proposal

```
Status Flow:
Draft 
  ↓
Forwarded to Reviewer (Region)
  ↓
Forwarded to Approver (Region)
  ↓
Forwarded to BRD Analyst 🔔 CONSOLIDATION HAPPENS HERE
  │
  └─→ BRDConsolidation record created
      Path: "NCR/Finance Division"
  
Forwarded to BRD Officer
  ↓
Forwarded to BRD Manager
  ↓
Finalized
```

**View in Dashboard:**
```
Regional Structure Tab
├── NCR (expanded)
│   ├── Finance Division (1 proposal) ₱500,000 ✓
│   └── Other divisions...
└── Other regions...
```

---

### Central Office Proposal Example

**Scenario:** Human Resources submits HR policy proposal

```
Status Flow:
Draft
  ↓
Forwarded to Reviewer (Central)
  ↓
Forwarded to Approver (Central)
  ↓
Forwarded to BRD Analyst 🔔 CONSOLIDATION HAPPENS HERE
  │
  └─→ BRDConsolidation record created
      Path: "Central Office/Human Resources"

Forwarded to BRD Officer
  ↓
Forwarded to BRD Manager
  ↓
Finalized
```

**View in Dashboard:**
```
Central Office Tab
├── Human Resources (1 proposal) ₱250,000 ✓
├── Finance Department (3 proposals) ₱2,000,000
└── Legal Department...
```

---

## 🛠️ Troubleshooting

### Q: I don't see my proposal in consolidation
**A:** Check if proposal has reached **FORWARDED_TO_BRD_ANALYST** status
- Go to NewProposalWorkflowPage
- Check "Pending Review" or "Monitoring" tabs
- If still DRAFT, FORWARDED_TO_REVIEWER, or FORWARDED_TO_APPROVER, it hasn't been consolidated yet

### Q: Consolidation path looks wrong
**A:** Check the region/division/department assignments
- Verify proposal's region is correctly set
- Ensure division/department names match organizational structure
- Check database for Region collection if using ObjectId references

### Q: Different fiscal year proposals mixed
**A:** Filter by fiscal year in the dashboard
- Use the fiscal year selector (defaults to current year)
- Consolidation tracks fiscal year for each proposal

### Q: Why is Central Office separate from Regions?
**A:** By design - Central Office proposals organize by Department, not Division
- Provides clearer view of headquarters-level budget consolidation
- Prevents mixing regional and central office proposals

---

## 📱 Integration Checklist

- [x] Backend: Model, Service, Controller created
- [x] Backend: Auto-trigger added to workflow
- [x] Backend: API endpoints created
- [x] Frontend: BRDConsolidationPage component created
- [ ] Frontend: Add to routing (Next step)
- [ ] Frontend: Add menu item (Next step)
- [ ] Frontend: Link from NewProposalWorkflowPage (Next step)

---

## 🚀 Next Steps for Integration

1. **Add BRDConsolidationPage to Routes**
   ```javascript
   import BRDConsolidationPage from './pages/BRDConsolidationPage';
   // Add to route config: path="/brd-consolidation", component: BRDConsolidationPage
   ```

2. **Add Menu Item**
   - Add to sidebar/navigation menu
   - Icon: StorageIcon or FolderIcon
   - Label: "BRD Consolidation" or "Consolidation Structure"

3. **Link from NewProposalWorkflowPage**
   - Add button "View Consolidation Structure" in monitoring tab
   - Redirect BRD staff to consolidation page

4. **Test End-to-End**
   - Create test proposal
   - Route to Budget Planning Analyst
   - Verify appears in consolidation
   - Check all API endpoints

---

## 📞 Questions?

For technical details, see: `BRD_CONSOLIDATION_IMPLEMENTATION.md`

For API examples, see: API Endpoints section above

For debugging, check console logs with prefix: `[BRD_CONSOLIDATION]`
