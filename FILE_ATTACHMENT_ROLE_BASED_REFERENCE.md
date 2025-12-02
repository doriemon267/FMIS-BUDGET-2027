# 📎 File Attachment - Role-Based Access Control (CORRECTED)

## Implementation Complete ✅

The **Supporting Documents** section in the Proposal Details dialog now supports **status-based, role-dependent file attachment** using the **ACTUAL workflow statuses** from the system.

---

## 📋 Permission Matrix

### File Upload & Delete Permissions by Status & Role

| Proposal Status | Budget Preparer | Budget Reviewer | Budget Approver | Budget Analyst | Budget Officer | Budget Manager | Super Admin |
|---|---|---|---|---|---|---|---|
| **DRAFT** | ✅ (Owner only) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **FORWARDED_TO_REVIEWER** | ✅ (Owner only) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **FORWARDED_TO_APPROVER** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **FORWARDED_TO_BRD_ANALYST** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **FORWARDED_TO_BRD_OFFICER** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **FORWARDED_TO_BRD_MANAGER** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **RETURNED_TO_PREPARER** | ✅ (Owner only) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **RETURNED_TO_REVIEWER** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **RETURNED_TO_APPROVER** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **RETURNED_TO_PLANNING_ANALYST** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **RETURNED_TO_OFFICER** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **FINALIZED** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (Read-only) |

---

## 🔄 Workflow Logic - By Role

### 1️⃣ **Budget Preparer**
- **Can attach at:** DRAFT, FORWARDED_TO_REVIEWER (owner only), RETURNED_TO_PREPARER
- **Use case:** Creating & revising proposals, preparing supporting documentation
- **Cannot attach at:** Once sent to other reviewers/approvers (unless returned)

### 2️⃣ **Budget Reviewer**
- **Can attach at:** FORWARDED_TO_REVIEWER, FORWARDED_TO_APPROVER, RETURNED_TO_REVIEWER
- **Use case:** Adding review notes, verification documents
- **Cannot attach at:** BRD levels (Analyst, Officer, Manager)

### 3️⃣ **Budget Approver**
- **Can attach at:** FORWARDED_TO_APPROVER, FORWARDED_TO_BRD_ANALYST, RETURNED_TO_APPROVER
- **Use case:** Adding approval documents, validation files
- **Cannot attach at:** Officer, Manager levels

### 4️⃣ **Budget Planning Analyst**
- **Can attach at:** FORWARDED_TO_BRD_ANALYST, RETURNED_TO_PLANNING_ANALYST
- **Use case:** Analysis documents, budget consolidation notes
- **Cannot attach at:** Initial review/approval stages

### 5️⃣ **Budget Officer**
- **Can attach at:** FORWARDED_TO_BRD_OFFICER, RETURNED_TO_OFFICER
- **Use case:** Administrative review, compliance documents
- **Cannot attach at:** Earlier stages

### 6️⃣ **Budget Manager**
- **Can attach at:** FORWARDED_TO_BRD_OFFICER, FORWARDED_TO_BRD_MANAGER
- **Use case:** Final management approval documents
- **Cannot attach at:** Earlier stages

### 7️⃣ **Super Admin**
- **Can attach at:** ANY status
- **Delete rights:** ✅ Yes, at any status

---

## 📁 File Types Supported

- **PDF** (.pdf)
- **Excel** (.xls, .xlsx)

## ⚙️ Technical Details

### Modified File
📄 `CLIENT/src/components/workflow/ProposalAttachments.jsx`

### Key Features

#### 1. Status-Based Role Checking
```jsx
const canAttachFiles = () => {
  const status = proposal?.status || '';
  
  // DRAFT - Only Budget Preparer (owner) can attach
  if (status === 'DRAFT' && isPreparer && isOwner) return true;
  
  // FORWARDED_TO_REVIEWER - Owner or Reviewer can attach
  if (status === 'FORWARDED_TO_REVIEWER' && ((isPreparer && isOwner) || isReviewer)) return true;
  
  // FORWARDED_TO_BRD_OFFICER - Officer or Manager can attach
  if (status === 'FORWARDED_TO_BRD_OFFICER' && (normalizedRoles.includes('BUDGET_OFFICER') || isManager)) return true;
  
  // ... etc for all statuses
};
```

#### 2. Role Detection (Both Formats)
```jsx
// Supports legacy roles (e.g., "BUDGET PREPARER")
const normalizedRoles = (userInfo?.Roles || []).map(r => String(r).toUpperCase());

// Supports new hierarchical roles
const workflowRoles = userInfo?.hierarchicalAccess?.workflowRoles || [];
```

#### 3. Debug Information
When attachment upload is disabled, the component shows debug info:
- Current proposal status
- User's role
- Whether they can attach

---

## 🧪 Testing Scenarios

### Test Case 1: DRAFT Status
- ✅ Budget Preparer (owner) sees "Attach File" button
- ✅ Can upload PDF/Excel
- ✅ Can delete their files
- ❌ Budget Reviewer cannot see upload button
- ❌ Any other role cannot see upload button

### Test Case 2: FORWARDED_TO_REVIEWER
- ✅ Budget Preparer (owner) can still attach
- ✅ Budget Reviewer sees "Attach File" button
- ✅ Can upload and delete
- ❌ Budget Approver cannot attach (it's still at reviewer level)

### Test Case 3: FORWARDED_TO_BRD_OFFICER
- ❌ Budget Preparer, Reviewer, Approver cannot attach
- ✅ Budget Officer sees "Attach File" button
- ✅ Budget Manager can also attach
- ✅ Can upload and delete

### Test Case 4: FINALIZED
- ❌ No one can attach (all users see read-only view)
- ✅ Everyone can download existing attachments
- ❌ No delete option except Super Admin

### Test Case 5: RETURNED_TO_APPROVER
- ❌ Budget Preparer cannot attach
- ❌ Budget Reviewer cannot attach
- ✅ Budget Approver (the one it was returned to) can attach
- ✅ Super Admin can always attach

---

## 🐛 Troubleshooting

If you don't see the "Attach File" button:

1. **Check your role** - Look at the debug info showing at the bottom of "Supporting Documents" section
2. **Check the status** - Ensure it matches one where your role can attach
3. **Check ownership** - For DRAFT, only the owner (Budget Preparer) can attach
4. **Check permissions** - Make sure your user account has the correct roles assigned

Example debug info you'll see:
```
ℹ️ Status: FORWARDED_TO_REVIEWER | Your Role: Reviewer | Can Attach: Yes
```

---

## 📌 Notes

- **Ownership Check:** Budget Preparer in DRAFT/FORWARDED_TO_REVIEWER must be the original creator
- **Role Flexibility:** Supports both legacy role format (Roles array) and new hierarchical format (workflowRoles)
- **Backend Validation:** Server should also validate permissions before accepting file uploads
- **Audit Trail:** All file uploads/deletions are logged in the attachment metadata (uploadedBy, uploadedAt, uploadedByName)
- **Module-Based:** Files can be grouped by module (income, mooe, personnel, etc.) for organization

---

**Implementation Date:** December 1, 2025  
**Last Updated:** December 1, 2025 (Corrected for actual workflow statuses)  
**Status:** ✅ COMPLETE - Ready for Testing with Actual Workflow Statuses
