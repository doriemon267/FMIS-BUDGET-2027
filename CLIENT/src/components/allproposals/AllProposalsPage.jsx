import React, { useRef, useState, useEffect } from "react";
import CustomPage from "../../src/components/myproposal/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import {
  ViewMenuItem,
  ApproveMenuItem,
  RejectMenuItem,
} from "../../src/components/myproposal/ProposalActions";
import WorkflowStatusBadge from "../workflow/WorkflowStatusBadge";
import WorkflowActions from "../workflow/WorkflowActions";
import WorkflowSummary from "../workflow/WorkflowSummary";
import { getUserInfo } from "../../utils/auth";

const AllProposalsPage = () => {
  const tableRef = useRef(null); // Reference to the CustomTable
  const [userInfo, setUserInfo] = useState(null);

  // Get user info on component mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const info = await getUserInfo();
        setUserInfo(info);
      } catch (error) {
        console.error("Failed to get user info:", error);
      }
    };
    fetchUserInfo();
  }, []);

  // Function to refresh the table data
  const refreshData = () => {
    if (tableRef.current) {
      tableRef.current.refetch();
    }
  };

  const orgLabel = (userInfo?.assignmentLevel || '').toUpperCase() === 'DIVISION'
    ? 'DIVISION'
    : (userInfo?.assignmentLevel || '').toUpperCase() === 'DEPARTMENT'
      ? 'DEPARTMENT'
      : 'REGION';

  const proposalSchema = {
    cobExpenditures: {
      type: "text",
      label: "EXPENDITURE TYPE",
      searchable: true,
      show: true,
      customRender: (row) => (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {row.cobExpenditures || "Unknown"}
        </span>
      ),
    },
    region: {
      type: "text",
      label: orgLabel,
      searchable: true,
      show: true,
      customRender: (row) => {
        // Prefer exact scope match: Division > Department > Region
        const division = (row.division || '').trim();
        const department = (row.department || '').trim();
        const region = (row.region || '').trim();

        let badgeLabel = orgLabel; // DIVISION / DEPARTMENT / REGION based on user
        let displayValue = region || 'CENTRAL OFFICE';

        if (orgLabel === 'DIVISION' && division) {
          displayValue = division;
        } else if (orgLabel === 'DEPARTMENT' && department) {
          displayValue = department;
        } else if (division) {
          // Fallback to best available
          badgeLabel = 'DIVISION';
          displayValue = division;
        } else if (department) {
          badgeLabel = 'DEPARTMENT';
          displayValue = department;
        }

        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
              {badgeLabel}
            </span>
            <span className="font-medium text-gray-800 truncate max-w-[220px]" title={`${badgeLabel}: ${displayValue}`}>
              {displayValue}
            </span>
          </div>
        );
      }
    },
    fiscalYear: {
      type: "text", 
      label: "FISCAL YEAR",
      show: true,
      customRender: (row) => (
        <span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
          {row.fiscalYear}
        </span>
      ),
    },
    budgetType: {
      type: "text",
      label: "BUDGET TYPE", 
      searchable: true,
      show: true,
      customRender: (row) => {
        const color = row.budgetType === "Initial" ? "green" : "orange";
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium bg-${color}-100 text-${color}-800`}>
            {row.budgetType}
          </span>
        );
      },
    },
    status: {
      type: "text",
      label: "STATUS",
      searchable: true,
      show: true,
      customRender: (row) => (
        <WorkflowStatusBadge status={row.status} />
      ),
    },
    submittedDate: {
      type: "date",
      label: "SUBMITTED DATE",
      show: true,
      customRender: (row) => {
        // Check for various date fields that indicate submission
        const submissionDate = row.submittedDate || 
                               row.processDate || 
                               row.createdAt || 
                               (row.divisionApproved?.at) ||
                               (row.departmentSubmitted?.at) ||
                               (row.updatedAt);
        
        if (!submissionDate) return <span className="text-gray-400 italic">N/A</span>;
        
        try {
          return (
            <span className="text-sm text-gray-600">
              {new Date(submissionDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          );
        } catch (error) {
          return <span className="text-red-400 text-xs">Invalid Date</span>;
        }
      }
    },
    totalIncome: {
      type: "number",
      label: "PROJECTED CORPORATE INCOME",
      show: true,
      customRender: (row) => {
        let incomeAmount = 0;
        
        // Corporate Income entries
        if (row.cobExpenditures === 'Corporate Income') {
          incomeAmount = row.amount || 0;
        }
        // Income from MOOE and Capital Outlay
        else if (row.cobExpenditures === 'MOOE' || row.cobExpenditures === 'Capital Outlay') {
          incomeAmount = row.income || 0;
        }
        // Fallback to totalIncome field
        else {
          incomeAmount = row.totalIncome || 0;
        }
        
        const formattedAmount = `₱${incomeAmount.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
        
        const colorClass = incomeAmount > 0 ? "text-green-600 font-semibold" : "text-gray-400";
        
        return (
          <TextSearchable 
            columnName={
              <span className={colorClass}>
                {formattedAmount}
              </span>
            }
          />
        );
      },
    },
    totalExpenses: {
      type: "number", 
      label: "PROJECTED SUBSIDY",
      show: true,
      customRender: (row) => {
        let subsidyAmount = 0;
        
        // Personnel Services - calculate total from individual fields
        if (row.cobExpenditures && row.cobExpenditures.includes('Personnel Services')) {
          subsidyAmount = (row.annualSalary || 0) + 
                          (row.RATA || 0) + 
                          (row.PERA || 0) + 
                          (row.uniformALLOWANCE || 0) + 
                          (row.productivityIncentive || 0) + 
                          (row.medical || 0) + 
                          (row.childrenAllowance || 0) + 
                          (row.meal || 0) + 
                          (row.cashGift || 0) + 
                          (row.subsistenceAllowanceMDS || 0) + 
                          (row.subsistenceAllowanceST || 0) + 
                          (row.midyearBonus || 0) + 
                          (row.yearEndBonus || 0) + 
                          (row.gsisPremium || 0) + 
                          (row.philhealthPremium || 0) + 
                          (row.pagibigPremium || 0) + 
                          (row.employeeCompensation || 0) ||
                          row.Total || 0; // Fallback to Total field if individual fields not available
        }
        // MOOE - use subsidy or amount field
        else if (row.cobExpenditures === 'MOOE') {
          subsidyAmount = row.subsidy || row.amount || 0;
        }
        // Capital Outlay - use subsidy or cost field
        else if (row.cobExpenditures === 'Capital Outlay') {
          subsidyAmount = row.subsidy || row.cost || 0;
        }
        // Fallback to totalExpenses field
        else {
          subsidyAmount = row.totalExpenses || 0;
        }
        
        const formattedAmount = `₱${subsidyAmount.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
        
        const colorClass = subsidyAmount > 0 ? "text-blue-600 font-semibold" : "text-gray-400";
        
        return (
          <TextSearchable 
            columnName={
              <span className={colorClass}>
                {formattedAmount}
              </span>
            }
          />
        );
      },
    },
    proposedBudget: {
      type: "number",
      label: "PROPOSED BUDGET",
      show: true,
      customRender: (row) => {
        let incomeAmount = 0;
        let subsidyAmount = 0;
        
        // Calculate income (same logic as totalIncome column)
        if (row.cobExpenditures === 'Corporate Income') {
          incomeAmount = row.amount || 0;
        } else if (row.cobExpenditures === 'MOOE' || row.cobExpenditures === 'Capital Outlay') {
          incomeAmount = row.income || 0;
        } else {
          incomeAmount = row.totalIncome || 0;
        }
        
        // Calculate subsidy (same logic as totalExpenses column)
        if (row.cobExpenditures && row.cobExpenditures.includes('Personnel Services')) {
          subsidyAmount = (row.annualSalary || 0) + 
                          (row.RATA || 0) + 
                          (row.PERA || 0) + 
                          (row.uniformALLOWANCE || 0) + 
                          (row.productivityIncentive || 0) + 
                          (row.medical || 0) + 
                          (row.childrenAllowance || 0) + 
                          (row.meal || 0) + 
                          (row.cashGift || 0) + 
                          (row.subsistenceAllowanceMDS || 0) + 
                          (row.subsistenceAllowanceST || 0) + 
                          (row.midyearBonus || 0) + 
                          (row.yearEndBonus || 0) + 
                          (row.gsisPremium || 0) + 
                          (row.philhealthPremium || 0) + 
                          (row.pagibigPremium || 0) + 
                          (row.employeeCompensation || 0) ||
                          row.Total || 0; // Fallback to Total field if individual fields not available
        } else if (row.cobExpenditures === 'MOOE') {
          subsidyAmount = row.subsidy || row.amount || 0;
        } else if (row.cobExpenditures === 'Capital Outlay') {
          subsidyAmount = row.subsidy || row.cost || 0;
        } else {
          subsidyAmount = row.totalExpenses || 0;
        }
        
        const total = incomeAmount + subsidyAmount;
        const formattedTotal = `₱${total.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
        
        return (
          <TextSearchable 
            columnName={
              <span className="font-bold text-purple-600">
                {formattedTotal}
              </span>
            }
          />
        );
      },
    },
    workflowActions: {
      type: "custom",
      label: "ACTIONS",
      customRender: (row) => (
        <div className="flex items-center justify-center">
          <WorkflowActions 
            proposal={row} 
            userInfo={userInfo} 
            onRefresh={refreshData} 
          />
        </div>
      ),
      show: true,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">All Proposals</h1>
                <p className="mt-1 text-sm text-gray-500">
                  View and manage all submitted proposals with 6-step workflow
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {userInfo && (
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {userInfo.firstName} {userInfo.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {userInfo.assignmentLevel} Level
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Workflow Summary */}
        <div className="mb-6">
          <WorkflowSummary userInfo={userInfo} />
        </div>
        
        {/* Proposals Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Proposal List</h3>
            <p className="mt-1 text-sm text-gray-600">
              Showing proposals based on your workflow level and permissions
            </p>
          </div>
          <CustomPage
            dataListName="proposals"
            schema={proposalSchema}
            hasEdit={false}
            hasDelete={false}
            additionalMenuOptions={[ViewMenuItem, ApproveMenuItem, RejectMenuItem]}
            refreshData={refreshData}
            tableRef={tableRef}
            extraParams={
              (userInfo?.assignmentLevel || '').toUpperCase() === 'DEPARTMENT'
                ? { submittedOnly: true }
                : {}
            }
          />
        </div>
      </div>
    </div>
  );
};

export default AllProposalsPage;
