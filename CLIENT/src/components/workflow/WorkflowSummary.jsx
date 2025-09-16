import React, { useState, useEffect } from "react";
import api from "../../config/api";

/**
 * Workflow Summary Component
 * 
 * Shows pending workflow items based on user role
 */
const WorkflowSummary = ({ userInfo }) => {
  const [pendingSummary, setPendingSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userInfo) {
      fetchPendingSummary();
    }
  }, [userInfo]);

  const fetchPendingSummary = async () => {
    setLoading(true);
    try {
      const userLevel = userInfo?.assignmentLevel;
      const workflowRoles = userInfo?.workflowRoles || [];
      
      let endpoints = [];

      // Department users can see pending verifications and ready to submit
      if (userLevel === "DEPARTMENT" && workflowRoles.includes("departmentConsolidator")) {
        endpoints = [
          { key: "pendingVerification", endpoint: "/api/submission-workflow/department/pending-verification" },
          { key: "readyToSubmit", endpoint: "/api/submission-workflow/department/ready-to-submit" }
        ];
      }

      // Region users can see pending approvals and ready to finalize
      if (userLevel === "REGION" && workflowRoles.includes("regionFinalVerifier")) {
        endpoints = [
          { key: "pendingApproval", endpoint: "/api/submission-workflow/region/pending-approval" },
          { key: "readyToFinalize", endpoint: "/api/submission-workflow/region/ready-to-finalize" }
        ];
      }

      const summaryData = {};
      
      for (const { key, endpoint } of endpoints) {
        try {
          const response = await api.get(`${endpoint}?entity=personnel`);
          summaryData[key] = response.data.pendingCount || response.data.readyCount || 0;
        } catch (error) {
          console.error(`Failed to fetch ${key}:`, error);
          summaryData[key] = 0;
        }
      }

      setPendingSummary(summaryData);
    } catch (error) {
      console.error("Failed to fetch pending summary:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!userInfo || loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="text-blue-600">Loading workflow summary...</div>
      </div>
    );
  }

  const userLevel = userInfo?.assignmentLevel;
  const hasWorkflowRoles = userInfo?.workflowRoles?.length > 0;

  if (!hasWorkflowRoles) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="text-gray-600">No workflow roles assigned</div>
      </div>
    );
  }

  if (!pendingSummary) {
    return null;
  }

  const getSummaryCards = () => {
    const cards = [];

    if (userLevel === "DEPARTMENT") {
      cards.push(
        {
          title: "Pending Verification",
          count: pendingSummary.pendingVerification || 0,
          color: "bg-yellow-100 border-yellow-300 text-yellow-800",
          icon: "📋"
        },
        {
          title: "Ready to Submit",
          count: pendingSummary.readyToSubmit || 0,
          color: "bg-blue-100 border-blue-300 text-blue-800",
          icon: "📤"
        }
      );
    }

    if (userLevel === "REGION") {
      cards.push(
        {
          title: "Pending Approval",
          count: pendingSummary.pendingApproval || 0,
          color: "bg-purple-100 border-purple-300 text-purple-800",
          icon: "👍"
        },
        {
          title: "Ready to Finalize",
          count: pendingSummary.readyToFinalize || 0,
          color: "bg-green-100 border-green-300 text-green-800",
          icon: "🏆"
        }
      );
    }

    return cards;
  };

  const summaryCards = getSummaryCards();

  if (summaryCards.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">
        📊 Workflow Summary - {userLevel} Level
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <div 
            key={index}
            className={`border rounded-lg p-3 ${card.color}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{card.title}</p>
                <p className="text-2xl font-bold">{card.count}</p>
              </div>
              <div className="text-2xl">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-sm text-gray-600">
        <button
          onClick={fetchPendingSummary}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Refresh Summary
        </button>
      </div>
    </div>
  );
};

export default WorkflowSummary;