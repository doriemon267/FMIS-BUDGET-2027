import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import ProposalCustomPage from "../components/proposals/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import { useUser } from "../context/UserContext";
import api from "../config/api";
import logger from "../utils/logger";

const Proposals = () => {
  const { currentUser } = useUser();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [blockedBySubmission, setBlockedBySubmission] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkSubmittedProposals = async () => {
      if (!currentUser) {
        if (isMounted) setCheckingAccess(false);
        return;
      }

      try {
        const response = await api.get(
          "/allproposal/proposals/preparer-create-access"
        );

        const hasInProcessProposal =
          response?.data?.hasInProcessProposal === true;

        if (isMounted) {
          setBlockedBySubmission(hasInProcessProposal);
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
  }, [currentUser]);

  const testSchema = useMemo(
    () => ({
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
    }),
    []
  );

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (checkingAccess) {
    return null;
  }

  if (blockedBySubmission) {
    return <Navigate to="/not-authorized" replace />;
  }
  return <ProposalCustomPage dataListName="tests" schema={testSchema} />;
};

export default Proposals;
