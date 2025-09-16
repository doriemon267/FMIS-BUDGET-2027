import React from "react";

/**
 * Workflow Status Badge Component
 * 
 * Shows the current status in the 6-step workflow:
 * Draft → Division Submitted → Department Verified → Department Submitted → Region Approved → Finalized
 */
const WorkflowStatusBadge = ({ status, className = "" }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case "Draft":
        return {
          color: "bg-gray-200 text-gray-800",
          icon: "📝",
          step: "1/6"
        };
      case "Division Submitted":
        return {
          color: "bg-blue-200 text-blue-800",
          icon: "📤",
          step: "2/6"
        };
      case "Department Verified":
        return {
          color: "bg-yellow-200 text-yellow-800",
          icon: "✅",
          step: "3/6"
        };
      case "Department Submitted":
        return {
          color: "bg-purple-200 text-purple-800",
          icon: "📋",
          step: "4/6"
        };
      case "Region Approved":
        return {
          color: "bg-green-200 text-green-800",
          icon: "👍",
          step: "5/6"
        };
      case "Finalized":
        return {
          color: "bg-emerald-200 text-emerald-800",
          icon: "🏆",
          step: "6/6"
        };
      default:
        return {
          color: "bg-gray-200 text-gray-600",
          icon: "❓",
          step: "0/6"
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.color} ${className}`}>
      <span className="text-lg">{config.icon}</span>
      <span>{status || "Unknown"}</span>
      <span className="text-xs opacity-75">({config.step})</span>
    </div>
  );
};

export default WorkflowStatusBadge;