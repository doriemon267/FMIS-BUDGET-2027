import React from "react";
import CustomPage from "../components/setup/SetupCustomPage";

/**
 * This schema defines each column of your table.
 * 
 * - We give fromDate, toDate, isFinished a custom "render" 
 *   function to read from row.deadlines[0].
 * - If the deadlines array is empty, we safely return "N/A".
 */
const SetupPage = () => {
  const setupSchema = {
    action: {
      type: "action",
      label: "Actions",
    },
    fromDate: {
      type: "date",
      label: "From Date",
      show: true,
      // "render" overrides the default row[fromDate]
      render: (row) => {
        if (!row.deadlines || row.deadlines.length === 0) {
          return "N/A";
        }
        const dateValue = row.deadlines[0].fromDate;
        // Safely create a Date object and convert to locale string
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) {
          return "Invalid Date";
        }
        return d.toLocaleDateString(); 
      },
    },
    toDate: {
      type: "date",
      label: "To Date",
      show: true,
      render: (row) => {
        if (!row.deadlines || row.deadlines.length === 0) {
          return "N/A";
        }
        const dateValue = row.deadlines[0].toDate;
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) {
          return "Invalid Date";
        }
        return d.toLocaleDateString();
      },
    },
    isFinished: {
      type: "boolean",
      label: "Is Finished",
      show: true,
      render: (row) => {
        if (!row.deadlines || row.deadlines.length === 0) {
          return "N/A";
        }
        return row.deadlines[0].isFinished ? "Yes" : "No";
      },
    },
    proposalType: {
      type: "text",
      label: "Proposal Type",
      required: true,
      searchable: true,
      show: true,
    },
    year: {
      type: "text",
      label: "Year",
      required: true,
      show: true,
    },
    currentYear: {
      type: "boolean",
      label: "Current Year",
      default: false,
      show: true,
    },
  };

  return (
    <CustomPage
      dataListName="setups"
      schema={setupSchema}
    />
  );
};

export default SetupPage;
