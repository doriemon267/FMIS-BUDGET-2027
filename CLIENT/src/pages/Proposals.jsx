import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import ProposalCustomPage from "../components/proposals/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import { useUser } from "../context/UserContext";
import { hasPermission } from "../utils/permissions";
import api from "../config/api";
import logger from "../utils/logger";

const Proposals = () => {
  const { currentUser } = useUser();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [blockedBySubmission, setBlockedBySubmission] = useState(false);

  const userRoles = useMemo(
    () => (currentUser?.Roles || []).map((role) => String(role).toUpperCase()),
    [currentUser]
  );

  const canOpenCreateProposalPage = useMemo(() => {
    const hasCreatePermission =
      hasPermission(currentUser, "CreateProposals") ||
      hasPermission(currentUser, "EditOwnProposals");

    const hasDisallowedWorkflowRole =
      userRoles.includes("BUDGET MANAGER") ||
      userRoles.includes("BUDGET_MANAGER") ||
      userRoles.includes("BUDGET OFFICER") ||
      userRoles.includes("BUDGET_OFFICER") ||
      userRoles.includes("BUDGET APPROVER") ||
      userRoles.includes("BUDGET_APPROVER") ||
      userRoles.includes("BUDGET REVIEWER") ||
      userRoles.includes("BUDGET_REVIEWER") ||
      userRoles.includes("BUDGET PLANNING ANALYST") ||
      userRoles.includes("BUDGET_PLANNING_ANALYST");

    return hasCreatePermission && !hasDisallowedWorkflowRole;
  }, [currentUser, userRoles]);

  useEffect(() => {
    let isMounted = true;

    const checkSubmittedProposals = async () => {
      if (!currentUser || !canOpenCreateProposalPage) {
        if (isMounted) setCheckingAccess(false);
        return;
      }

      try {
        const response = await api.get("/allproposal/proposals", {
          params: { page: 1, limit: 100 },
        });

        const proposals = Array.isArray(response?.data?.proposals)
          ? response.data.proposals
          : [];

        const hasSubmittedProposal = proposals.some((proposal) => {
          const statusUpper = String(proposal?.status || "").toUpperCase();
          return statusUpper && statusUpper !== "DRAFT";
        });

        if (isMounted) {
          setBlockedBySubmission(hasSubmittedProposal);
        }
      } catch (error) {
        logger.warn("Failed to validate /proposal access", error);
      } finally {
        if (isMounted) setCheckingAccess(false);
      }
    };

    checkSubmittedProposals();

    return () => {
      isMounted = false;
    };
  }, [currentUser, canOpenCreateProposalPage]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (checkingAccess) {
    return null;
  }

  if (!canOpenCreateProposalPage || blockedBySubmission) {
    return <Navigate to="/not-authorized" replace />;
  }

  const testSchema = {
    title: {
      type: "text",
      label: "Title",
      required: true,
      searchable: true,
      show: true,
    },
    description: {
      type: "textarea",
      label: "Description",
      searchable: true,
      show: true,
    },
    likes: {
      type: "number",
      label: "Likes",
      default: 0,
      customRender: (row) => <TextSearchable columnName={row.likes} />,
      show: true,
    },
    isPublish: {
      type: "boolean",
      label: "Published",
      default: true,
      show: true,
    },
    createdAt: {
      type: "date",
      label: "Created At",
      show: true,
    },
    action: {
      type: "action",
      label: "Actions",
    },
  };
  return <ProposalCustomPage dataListName="tests" schema={testSchema} />;
};

export default Proposals;
