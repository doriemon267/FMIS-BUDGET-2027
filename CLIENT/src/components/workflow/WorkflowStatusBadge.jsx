import React from "react";

/**
 * Workflow Status Badge Component
 * 
 * Shows the current status in the 5-step workflow:
 * Draft → Responsibility Center Submitted → Office Verified → Office Submitted → Finalized
 */
const WorkflowStatusBadge = ({ status, className = "" }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case "Draft":
        return {
          color: "bg-gray-200 text-gray-800",
          icon: "📝",
          step: "1/5"
        };
      case "Responsibility Center Submitted":
        return {
          color: "bg-blue-200 text-blue-800",
          icon: "📤",
          step: "2/5"
        };
      case "Office Verified":
        return {
          color: "bg-yellow-200 text-yellow-800",
          icon: "✅",
          step: "3/5"
        };
      case "Office Submitted":
        return {
          color: "bg-purple-200 text-purple-800",
          icon: "📋",
          step: "4/5"
        };
      case "Finalized":
        return {
          color: "bg-emerald-200 text-emerald-800",
          icon: "🏆",
          step: "5/5"
        };
      default:
        return {
          color: "bg-gray-200 text-gray-600",
          icon: "❓",
          step: "0/5"
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