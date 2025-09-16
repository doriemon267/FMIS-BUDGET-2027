import React, { useState } from "react";
import { toast } from "react-toastify";
import api from "../../config/api";

/**
 * Workflow Actions Component
 * 
 * Provides action buttons for the 6-step workflow based on user role and current status:
 * Draft → Division Submitted → Department Verified → Department Submitted → Region Approved → Finalized
 */
const WorkflowActions = ({ proposal, userInfo, onRefresh }) => {
  const [loading, setLoading] = useState(false);

  // Helper function to determine entity type based on proposal modelType
  const getEntityType = (proposal) => {
    switch (proposal.modelType) {
      case 'mooe':
        return 'mooe';
      case 'capital':
        return 'capital';
      case 'income':
        return 'income';
      case 'personnel':
        return 'personnel';
      default:
        return 'personnel'; // fallback
    }
  };

  // Determine what actions are available based on user role and proposal status
  const getAvailableActions = () => {
    const actions = [];
    const userLevel = userInfo?.assignmentLevel;
    const status = proposal?.status;
    const workflowRoles = userInfo?.workflowRoles || [];

    // Debug: log the values to see what's happening
    console.log('WorkflowActions Debug:', {
      userLevel,
      status,
      workflowRoles,
      proposalId: proposal?._id,
      departmentConsolidator: workflowRoles.includes("departmentConsolidator")
    });

    // Division Level Actions
    if (userLevel === "DIVISION" && workflowRoles.includes("divisionCreator")) {
      if (status === "Draft") {
        actions.push({
          label: "Submit to Department",
          action: "division-submit",
          color: "bg-blue-500 hover:bg-blue-600",
          icon: "📤",
          description: "Submit to Department for verification"
        });
      }
    }

    // Department Level Actions
    if (userLevel === "DEPARTMENT" && workflowRoles.includes("departmentConsolidator")) {
      if (status === "Division Submitted" || status === "DIVISION SUBMITTED") {
        actions.push({
          label: "Verify",
          action: "department-verify",
          color: "bg-green-500 hover:bg-green-600",
          icon: "✅",
          description: "Verify and approve the division submission"
        });
        actions.push({
          label: "Return",
          action: "department-return",
          color: "bg-red-500 hover:bg-red-600",
          icon: "↩️",
          description: "Return submission to division for revisions"
        });
      }
      if (status === "Department Verified" || status === "DEPARTMENT VERIFIED") {
        actions.push({
          label: "Submit to Region",
          action: "department-submit",
          color: "bg-purple-500 hover:bg-purple-600",
          icon: "📋",
          description: "Submit to Region for approval"
        });
      }
    }

    // Region Level Actions
    if (userLevel === "REGION" && workflowRoles.includes("regionFinalVerifier")) {
      if (status === "Department Submitted" || status === "DEPARTMENT SUBMITTED") {
        actions.push({
          label: "Approve Submission",
          action: "region-approve",
          color: "bg-green-500 hover:bg-green-600",
          icon: "👍",
          description: "Approve the submission"
        });
      }
      if (status === "Region Approved" || status === "REGION APPROVED") {
        actions.push({
          label: "Finalize",
          action: "region-finalize",
          color: "bg-emerald-500 hover:bg-emerald-600",
          icon: "🏆",
          description: "Finalize the submission"
        });
      }
    }

    return actions;
  };

  // Execute workflow action
  const executeWorkflowAction = async (action) => {
    setLoading(true);
    
    try {
      let endpoint = "";
      let noteField = "";
      let successMessage = "";

      switch (action) {
        case "division-submit":
          endpoint = "/api/submission-workflow/division/submit-to-department";
          noteField = "submissionNote";
          successMessage = "Successfully submitted to Department for verification";
          break;
        case "department-verify":
          endpoint = "/api/submission-workflow/department/verify-submission";
          noteField = "verificationNote";
          successMessage = "Successfully verified division submission";
          break;
        case "department-submit":
          endpoint = "/api/submission-workflow/department/submit-to-region";
          noteField = "approvalNote";
          successMessage = "Successfully submitted to Region for approval";
          break;
        case "region-approve":
          endpoint = "/api/submission-workflow/region/approve-submission";
          noteField = "regionApprovalNote";
          successMessage = "Successfully approved submission";
          break;
        case "region-finalize":
          endpoint = "/api/submission-workflow/region/finalize-submission";
          noteField = "finalizationNote";
          successMessage = "Successfully finalized submission";
          break;
        case "department-return":
          endpoint = "/api/submission-workflow/department/return-to-division";
          noteField = "returnNote";
          successMessage = "Successfully returned submission to division for revisions";
          break;
        default:
          throw new Error("Unknown workflow action");
      }

      const response = await api.post(endpoint, {
        ids: [proposal._id],
        entity: getEntityType(proposal), // Dynamic entity type based on proposal
        [noteField]: `Workflow action performed on ${new Date().toLocaleString()}`
      });

      console.log('Workflow API Call Debug:', {
        endpoint,
        requestData: {
          ids: [proposal._id],
          entity: getEntityType(proposal),
          [noteField]: `Workflow action performed on ${new Date().toLocaleString()}`
        },
        proposal: {
          _id: proposal._id,
          modelType: proposal.modelType,
          status: proposal.status,
          originalLevel: proposal.originalLevel
        }
      });

      console.log('Workflow API Response:', response.data);

      // Check for success - be flexible with response format
      const isSuccess = response.data.success !== false && 
                       (response.data.modified > 0 || response.data.modifiedCount > 0 || 
                        response.data.message?.includes('Successfully'));

      if (isSuccess) {
        toast.success(successMessage);
        onRefresh(); // Refresh the proposals list
      } else {
        throw new Error(response.data.message || "Workflow action failed");
      }
    } catch (error) {
      console.error("Workflow action error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        endpoint: endpoint,
        proposalId: proposal._id
      });

      // Show more specific error messages
      let errorMessage = "Failed to execute workflow action";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle action click with confirmation
  const handleActionClick = (action, label) => {
    if (loading) return;

    const confirmed = window.confirm(`Are you sure you want to perform: ${label}?`);
    if (confirmed) {
      executeWorkflowAction(action);
    }
  };

  const availableActions = getAvailableActions();

  if (availableActions.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No workflow actions available
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {availableActions.map((actionConfig, index) => (
        <button
          key={index}
          onClick={() => handleActionClick(actionConfig.action, actionConfig.label)}
          disabled={loading}
          className={`
            flex items-center gap-1 px-2 py-1 rounded text-white text-xs font-medium
            transition-all duration-200 hover:shadow-md border-none
            ${actionConfig.color}
            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
          `}
          title={actionConfig.description}
          style={{ 
            minWidth: '70px',
            height: '32px'
          }}
        >
          <span className="text-sm">{actionConfig.icon}</span>
          <span className="hidden sm:inline">{loading ? 'Wait...' : actionConfig.label}</span>
        </button>
      ))}
    </div>
  );
};

export default WorkflowActions;