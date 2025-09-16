import api from "../config/api";

/**
 * Authentication and User Information Utilities
 */

// Get current user information including workflow roles
export const getUserInfo = async () => {
  try {
    const response = await api.get("/api/hierarchical-rbac/my-access");
    return response.data.accessInfo;
  } catch (error) {
    console.error("Failed to get user info:", error);
    throw error;
  }
};

// Check if user has specific workflow role
export const hasWorkflowRole = (userInfo, role) => {
  return userInfo?.workflowRoles?.includes(role) || false;
};

// Get user's assignment level
export const getUserAssignmentLevel = (userInfo) => {
  return userInfo?.assignmentLevel || null;
};

// Check if user can perform workflow actions
export const canPerformWorkflowAction = (userInfo, requiredLevel, requiredRole) => {
  const userLevel = getUserAssignmentLevel(userInfo);
  const hasRole = hasWorkflowRole(userInfo, requiredRole);
  
  return userLevel === requiredLevel && hasRole;
};

// Workflow role check functions
export const canDivisionSubmit = (userInfo) => {
  return canPerformWorkflowAction(userInfo, "DIVISION", "divisionCreator");
};

export const canDepartmentVerify = (userInfo) => {
  return canPerformWorkflowAction(userInfo, "DEPARTMENT", "departmentConsolidator");
};

export const canDepartmentSubmit = (userInfo) => {
  return canPerformWorkflowAction(userInfo, "DEPARTMENT", "departmentConsolidator");
};

export const canRegionApprove = (userInfo) => {
  return canPerformWorkflowAction(userInfo, "REGION", "regionFinalVerifier");
};

export const canRegionFinalize = (userInfo) => {
  return canPerformWorkflowAction(userInfo, "REGION", "regionFinalVerifier");
};

// Get available workflow actions for current user and proposal status
export const getAvailableWorkflowActions = (userInfo, proposalStatus) => {
  const actions = [];

  // Division actions
  if (canDivisionSubmit(userInfo) && proposalStatus === "Draft") {
    actions.push("division-submit");
  }

  // Department actions
  if (canDepartmentVerify(userInfo) && proposalStatus === "Division Submitted") {
    actions.push("department-verify");
  }
  if (canDepartmentSubmit(userInfo) && proposalStatus === "Department Verified") {
    actions.push("department-submit");
  }

  // Region actions
  if (canRegionApprove(userInfo) && proposalStatus === "Department Submitted") {
    actions.push("region-approve");
  }
  if (canRegionFinalize(userInfo) && proposalStatus === "Region Approved") {
    actions.push("region-finalize");
  }

  return actions;
};

export default {
  getUserInfo,
  hasWorkflowRole,
  getUserAssignmentLevel,
  canPerformWorkflowAction,
  canDivisionSubmit,
  canDepartmentVerify,
  canDepartmentSubmit,
  canRegionApprove,
  canRegionFinalize,
  getAvailableWorkflowActions
};