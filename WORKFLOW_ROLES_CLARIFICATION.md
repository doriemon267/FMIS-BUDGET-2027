# Workflow Roles Clarification

## Role Definitions and Workflow Paths

### 1. BUDGET ANALYST
**Primary Function**: Creator/Preparer of budget proposals

**Workflow Roles** (based on Assignment Level):
- **Responsibility Center / Division Level** → `divisioncreator` or `divisionpreparer`
- **Office Level** → `officecreator`

**Workflow Paths**:

#### Path A: Division-Level Analyst (`divisioncreator`)
```
BUDGET ANALYST (divisioncreator)
    ↓ submits
BUDGET COORDINATOR (divisionapprover)
    ↓ approves/submits
BUDGET OFFICER (officeverifier)
    ↓ verifies/submits
BUDGET MANAGER (managerapprover)
    ↓ final approval
FINALIZED
```

#### Path B: Office-Level Analyst (`officecreator`)
```
BUDGET ANALYST (officecreator)
    ↓ submits DIRECTLY (skip coordinator)
BUDGET OFFICER (officeverifier)
    ↓ verifies/submits
BUDGET MANAGER (managerapprover)
    ↓ final approval
FINALIZED
```

**Key Points**:
- CAN create and edit proposals
- CAN submit proposals
- Assignment Level determines workflow role:
  - RC/Division Level → needs coordinator approval
  - Office Level → goes direct to officer

---

### 2. BUDGET COORDINATOR
**Primary Function**: Approver/Verifier for division-level proposals

**Workflow Role**: `divisionapprover` ONLY

**Responsibilities**:
- Review proposals from `divisioncreator` (BUDGET ANALYST at division level)
- CAN approve or return proposals
- CAN make edits/adjustments before forwarding
- Submit approved proposals to BUDGET OFFICER

**Key Points**:
- NOT a creator - review/approve role only
- Only receives proposals from division-level analysts
- Office-level analysts (`officecreator`) SKIP this step

---

### 3. BUDGET OFFICER
**Primary Function**: Verifier/Approver for office-level consolidation

**Workflow Roles**: 
- `officeconsolidator`
- `officefinalverifier`
- `officeverifier`

**Receives Proposals From**:
1. BUDGET COORDINATOR (division-level proposals)
2. BUDGET ANALYST with `officecreator` (office-level proposals - DIRECT)

**Responsibilities**:
- Verify/approve proposals from coordinators or office-level analysts
- CAN make final edits/adjustments
- Submit verified proposals to BUDGET MANAGER

**Key Points**:
- NOT a creator - verify/approve role only
- Receives from TWO sources (coordinator OR office analyst)
- Cannot have analyst or coordinator workflow roles simultaneously

---

### 4. BUDGET MANAGER
**Primary Function**: Final approver for budget finalization

**Workflow Roles**:
- `managerapprover`
- `regionfinalverifier`

**Responsibilities**:
- Final review and approval of proposals from BUDGET OFFICER
- CAN make final adjustments if needed
- Finalize proposals

**Key Points**:
- NOT a creator - final approval role only
- Highest level in the workflow
- Final decision maker

---

## Workflow Role Validation

### Mutual Exclusivity Rules

1. **BUDGET ANALYST** cannot be:
   - BUDGET COORDINATOR
   - BUDGET OFFICER
   - BUDGET MANAGER

2. **BUDGET COORDINATOR** cannot be:
   - BUDGET ANALYST
   - BUDGET OFFICER
   - BUDGET MANAGER

3. **BUDGET OFFICER** cannot be:
   - BUDGET ANALYST
   - BUDGET COORDINATOR
   - (But CAN be BUDGET MANAGER at regional level)

4. **BUDGET MANAGER** cannot be:
   - BUDGET ANALYST
   - BUDGET COORDINATOR
   - (But CAN be BUDGET OFFICER for verification)

---

## Assignment Level vs Workflow Role Matrix

| Assignment Level | Creator Role | First Approver | Second Approver | Final Approver |
|-----------------|--------------|----------------|-----------------|----------------|
| **Responsibility Center / Division** | divisioncreator | divisionapprover (Coordinator) | officeverifier (Officer) | managerapprover (Manager) |
| **Office** | officecreator | ~~(skip)~~ | officeverifier (Officer) | managerapprover (Manager) |
| **Department** | N/A | divisionapprover (Coordinator) | officeverifier (Officer) | managerapprover (Manager) |
| **Region** | N/A | N/A | officeverifier (Officer) | managerapprover (Manager) |

---

## Status Flow

### Division-Level Proposals
1. **Draft** (Analyst creates)
2. **Division Submitted** (Analyst submits to Coordinator)
3. **Coordinator Approved** (Coordinator approves)
4. **Office Submitted** (Coordinator submits to Officer)
5. **Officer Approved** (Officer approves)
6. **Manager Approved** (Manager approves)
7. **Finalized**

### Office-Level Proposals  
1. **Draft** (Analyst creates)
2. **Office Submitted** (Analyst submits DIRECTLY to Officer)
3. **Officer Approved** (Officer approves)
4. **Manager Approved** (Manager approves)
5. **Finalized**

---

## Code Implementation Notes

### ProposalDetailsDialog.jsx

```javascript
// Budget Analyst: includes both divisioncreator AND officecreator
const isBudgetAnalyst = normalizedWorkflowRoles.some((role) => 
  role === 'divisioncreator' || 
  role === 'divisionpreparer' ||
  role === 'officecreator'
);

// Office-level analyst (skip coordinator)
const isOfficeCreator = isBudgetAnalyst && 
  normalizedWorkflowRoles.some((role) => role === 'officecreator');

// Budget Coordinator: ONLY divisionapprover
const isBudgetCoordinator = normalizedWorkflowRoles.some((role) => 
  role === 'divisionapprover'
);

// Budget Officer: CANNOT be analyst or coordinator
const isBudgetOfficer = !isBudgetAnalyst && 
  !isBudgetCoordinator && 
  normalizedWorkflowRoles.some((role) => 
    role === 'officeconsolidator' || 
    role === 'officefinalverifier' ||
    role === 'officeverifier'
  );

// Budget Manager: Final approver
const isManagerLevel = normalizedWorkflowRoles.some((role) => 
  role === 'managerapprover' || 
  role === 'regionfinalverifier'
);
```

---

## Date: October 15, 2025
