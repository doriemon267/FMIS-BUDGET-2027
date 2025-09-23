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
    originLevel: {
      type: "text",
      label: "ORIGIN",
      show: true,
      customRender: (row) => (
        <span className="text-xs text-gray-700">{row.originLabel || '—'}</span>
      )
    },
    currentOwner: {
      type: "text",
      label: "CURRENT LEVEL",
      show: true,
      customRender: (row) => (
        <span className="text-xs text-gray-700">{row.currentOwnerLabel || '—'}</span>
      )
    },
    approvedBy: {
      type: "text",
      label: "VERIFIED/APPROVED BY",
      show: true,
      customRender: (row) => {
        const info = row.approvalInfo || {};
        // Prefer department verifier when visible; else region approver; else last action
        const actor = info.departmentVerifiedBy || info.submittedToDepartmentBy || info.regionApprovedBy || info.submittedToRegionBy || info.lastActionBy;
        const when = info.departmentVerifiedAt || info.submittedToDepartmentAt || info.regionApprovedAt || info.submittedToRegionAt || info.lastActionDate;
        return (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-800">{actor || '—'}</span>
            {when && (
              <span className="text-[10px] text-gray-500">
                {new Date(when).toLocaleString('en-PH', { year:'numeric', month:'short', day:'numeric' })}
              </span>
            )}
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
          const amt = Number(row.amount);
          incomeAmount = Number.isFinite(amt) ? amt : 0;
        }
        // Income from MOOE and Capital Outlay
        else if (row.cobExpenditures === 'MOOE' || row.cobExpenditures === 'Capital Outlay') {
          const inc = Number(row.income);
          incomeAmount = Number.isFinite(inc) ? inc : 0;
        }
        // Fallback to totalIncome field
        else {
          const totInc = Number(row.totalIncome);
          incomeAmount = Number.isFinite(totInc) ? totInc : 0;
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
        
        // Personnel Services - use backend aggregated Total for aggregated rows; otherwise compute from fields
        if (String(row.cobExpenditures || '').toLowerCase().includes('personnel services')) {
          if (row.modelType === 'personnel') {
            const backendTotal = Number(row.Total);
            subsidyAmount = Number.isFinite(backendTotal) ? backendTotal : 0;
          } else {
            const backendTotal = Number(row.Total);
            if (Number.isFinite(backendTotal)) {
              subsidyAmount = backendTotal;
            } else {
              const psParts = [
                Number(row.annualSalary), Number(row.RATA), Number(row.PERA), Number(row.uniformALLOWANCE),
                Number(row.productivityIncentive), Number(row.medical), Number(row.childrenAllowance), Number(row.meal),
                Number(row.cashGift), Number(row.subsistenceAllowanceMDS), Number(row.subsistenceAllowanceST),
                Number(row.midyearBonus), Number(row.yearEndBonus), Number(row.gsisPremium), Number(row.philhealthPremium),
                Number(row.pagibigPremium), Number(row.employeeCompensation),
                // Additional PS components to match backend aggregation
                Number(row.loyaltyAward), Number(row.overtimePay), Number(row.earnedLeaves),
                Number(row.retirementBenefits), Number(row.terminalLeave), Number(row.courtAppearance)
              ];
              subsidyAmount = psParts.reduce((sum, val) => sum + (Number.isFinite(val) ? val : 0), 0);
            }
          }
        }
        // MOOE - use subsidy or amount field
        else if (row.cobExpenditures === 'MOOE') {
          const sub = Number(row.subsidy);
          const amt = Number(row.amount);
          subsidyAmount = Number.isFinite(sub) ? sub : (Number.isFinite(amt) ? amt : 0);
        }
        // Capital Outlay - use subsidy or cost field
        else if (row.cobExpenditures === 'Capital Outlay') {
          const sub = Number(row.subsidy);
          const cost = Number(row.cost);
          subsidyAmount = Number.isFinite(sub) ? sub : (Number.isFinite(cost) ? cost : 0);
        }
        // Fallback to totalExpenses field
        else {
          const totExp = Number(row.totalExpenses);
          subsidyAmount = Number.isFinite(totExp) ? totExp : 0;
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
        
        // Calculate subsidy (same logic as totalExpenses, prefer backend Total when available)
        if (String(row.cobExpenditures || '').toLowerCase().includes('personnel services')) {
          const backendTotal = Number(row.Total);
          if (Number.isFinite(backendTotal)) {
            subsidyAmount = backendTotal;
          } else {
            const psParts = [
              Number(row.annualSalary), Number(row.RATA), Number(row.PERA), Number(row.uniformALLOWANCE),
              Number(row.productivityIncentive), Number(row.medical), Number(row.childrenAllowance), Number(row.meal),
              Number(row.cashGift), Number(row.subsistenceAllowanceMDS), Number(row.subsistenceAllowanceST),
              Number(row.midyearBonus), Number(row.yearEndBonus), Number(row.gsisPremium), Number(row.philhealthPremium),
              Number(row.pagibigPremium), Number(row.employeeCompensation),
              // Additional PS components to match backend aggregation
              Number(row.loyaltyAward), Number(row.overtimePay), Number(row.earnedLeaves),
              Number(row.retirementBenefits), Number(row.terminalLeave), Number(row.courtAppearance)
            ];
            subsidyAmount = psParts.reduce((sum, val) => sum + (Number.isFinite(val) ? val : 0), 0);
          }
        } else if (row.cobExpenditures === 'MOOE') {
          const sub = Number(row.subsidy);
          const amt = Number(row.amount);
          subsidyAmount = Number.isFinite(sub) ? sub : (Number.isFinite(amt) ? amt : 0);
        } else if (row.cobExpenditures === 'Capital Outlay') {
          const sub = Number(row.subsidy);
          const cost = Number(row.cost);
          subsidyAmount = Number.isFinite(sub) ? sub : (Number.isFinite(cost) ? cost : 0);
        } else {
          const totExp = Number(row.totalExpenses);
          subsidyAmount = Number.isFinite(totExp) ? totExp : 0;
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
                {/* Submit All Drafts button (uses current user scope) */}
                <button
                  className={`px-3 py-2 rounded-md text-white text-sm font-medium ${submittingAll ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                  disabled={submittingAll}
                  onClick={handleSubmitAllDrafts}
                  title="Submit all Draft proposals shown in the table to the next level"
                >
                  {submittingAll ? 'Submitting…' : 'Submit All Drafts'}
                </button>
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
