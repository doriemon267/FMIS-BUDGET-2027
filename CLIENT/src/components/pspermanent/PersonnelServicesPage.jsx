import React from "react";
import CustomPageTable from "./PersonnelCustomPageTable";
import { Box, Button } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../config/api";

const PersonnelServicesPage = () => {
  const queryClient = useQueryClient();

  const syncMealAllowances = useMutation({
    mutationFn: async () => {
      return api.post("/personnelServices/sync-meal-allowances");
    },
    onSuccess: (data) => {
      toast.success(`Meal allowances synced successfully: ${data.data.message}`);
      queryClient.invalidateQueries({ queryKey: ["personnelServices"] });
    },
    onError: (error) => {
      toast.error(`Error syncing meal allowances: ${error.response?.data?.message || error.message}`);
    }
  });
  const personnelServicesSchema = {
    action: {
      type: "action",
      label: "ACTIONS",
    },
    employeeFullName: {
      type: "text",
      label: "EMPLOYEE NAME",
      searchable: true,
      show: true,
    },
    positionTitle: {
      type: "text",
      label: "POSITION TITLE",
      searchable: true,
      show: true,
    },
    statusOfAppointment: {
      type: "text",
      label: "STATUS OF APPOINTMENT",
      show: false,
    },
    gradelevel_SG: {
      type: "text",
      label: "SG",
      show: true,
    },
    gradelevel_PG: {
      type: "text",
      label: "PG",
      show: true,
    },
    step: {
      type: "text",
      label: "STEP",
      show: true,
    },
    gradelevel_JG: {
      type: "text",
      label: "JG",
      show: true,
    },
   
    monthlySalary: {
      type: "number",
      label: "MONTHLY SALARY",
      show: true,
    },
    chargedToIncomeMonthlyAmount: { type: "number", label: "MONTHLY SALARY / INCOME", show: true, readOnly: true },
    salarySubsidyMonthlyAmount: { type: "number", label: "MONTHLY SALARY / SUBSIDY", show: true, readOnly: true },
    cpcs1MonthlySalary: { type: "number", label: "CPCS 1 MONTHLY / SUBSIDY", show: true, readOnly: true },
    cpcs2MonthlySalary: { type: "number", label: "CPCS 2 MONTHLY", show: true, readOnly: true },
    monthlySalaryIncrement: {
      type: "number",
      label: "MONTHLY SALARY INCREASE",
      readOnly: true,
      show: true,
      default: 0,
      customRender: (row) => (Number(row.monthlySalaryIncrement) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
     annualSalary: {
      type: "number",
      label: "ANNUAL SALARY",
      show: true,
    },
    RATA: {
      type: "number",
      label: "RATA",
      show: true,
    },
    PERA: {
      type: "number",
      label: "PERA",
      show: true,
    },
    uniformALLOWANCE: {
      type: "number",
      label: "UNIFORM ALLOWANCE",
      show: true,
    },
    productivityIncentive: {
      type: "number",
      label: "PRODUCTIVITY INCENTIVE",
      show: true,
    },
    honoraria: {
      type: "number",
      label: "HONORARIA",
      show: true,
    },
    medical: {
      type: "number",
      label: "MEDICAL ALLOWANCE",
      show: true,
    },
     noOfDependent: {
      type: "number",
      label: "NO. OF DEPENDENTS",
      show: true,
      customRender: (row) => row.noOfDependent || 0,
    },
    childrenAllowance: {
      type: "number",
      label: "CHILDREN ALLOWANCE",
      show: true,
    },
    meal: {
      type: "number",
      label: "MEAL ALLOWANCE",
      show: true,
    },
    additionalMedical: {
      type: "number",
      label: "ADDITIONAL MEDICAL",
      show: true,
    },
    subsistenceAllowance: {
      type: "number",
      label: "SUBSISTENCE ALLOWANCE",
      show: true,
    },
    subsistenceAllowanceMDS: {
      type: "number",
      label: "SUBSISTENCE ALLOWANCE MDS",
      show: true,
    },
    subsistenceAllowanceST: {
      type: "number",
      label: "SUBSISTENCE ALLOWANCE ST",
      show: true,
    },
     cashGift: {
      type: "number",
      label: "CASH GIFT",
      show: true,
    },
midyearBonus: {
      type: "number",
      label: "MIDYEAR BONUS",
      show: true,
    },
    yearEndBonus: {
      type: "number",
      label: "YEAR END BONUS",
      show: true,
    },

    loyaltyAward: {
      type: "number",
      label: "LOYALTY AWARD",
      show: true,
    },
    overtimePay: {
      type: "number",
      label: "OVERTIME PAY",
      show: true,
    },
   
    gsisPremium: {
      type: "number",
      label: "GSIS PREMIUM",
      show: true,
    },
    providentFund: {
      type: "number",
      label: "PROVIDENT FUND",
      show: true,
    },
    pagibigPremium: {
      type: "number",
      label: "PG (PAG-IBIG)",
      show: true,
    },
    philhealthPremium: {
      type: "number",
      label: "PHILHEALTH PREMIUM",
      show: true,
    },

    employeeCompensation: {
      type: "number",
      label: "EMPLOYEE COMPENSATION",
      show: true,
    },


earnedLeaves: {
      type: "number",
      label: "EARNED LEAVES",
      show: true,
    },
    retirementBenefits: {
      type: "number",
      label: "RETIREMENT BENEFITS",
      show: true,
    },
    terminalLeave: {
      type: "number",
      label: "TERMINAL LEAVE",
      show: true,
    },

    hazardPay: {
      type: "number",
      label: "HAZARD PAY",
      show: true,
    },
   
  
   
    courtAppearance: {
      type: "number",
      label: "COURT APPEARANCE",
      show: true,
    },

    
    subsidyEligible: {
      type: "text",
      label: "SUBSIDY TAG",
      show: false,
      customRender: (row) => (row.subsidyEligible ? "Tagged" : "—"),
    },
    subsidyAmount: {
      type: "number",
      label: "SUBSIDY (₱)",
      show: false,
      customRender: (row) =>
        row.subsidyEligible
          ? (Number(row.subsidyAmount) || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "—",
    },
    // courtAppearance: {
    //       type: "number",
    //       label: "COURT APPEARANCE",
    //       show: true,
    //     },
    Total: {
      type: "number",
      label: "SUBTOTAL",
      show: true,
    },
  };

  return (
    // <CustomPageTable
    //   dataListName="personnelServicesAll"
    //   title="Personnel Services"
    //   description="This is the Personnel Services Table"
    //   schema={personnelServicesSchema}
    //   searchable={true}
    //   hasEdit={true}
    //   hasDelete={false}
    //   ROWS_PER_PAGE={20}
    // />

    <>
      {/* <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => syncMealAllowances.mutate()}
          disabled={syncMealAllowances.isPending}
        >
          {syncMealAllowances.isPending ? "Syncing..." : "Sync Meal Allowances"}
        </Button>
      </Box> */}
      <CustomPageTable
        dataListName="personnelServices" // router, response controller
        title="Personnel Services"
        description="This is the Personnel Services Table"
        schema={personnelServicesSchema}
        searchable={true}
        hasEdit={true}
        hasDelete={false}
        ROWS_PER_PAGE={10}
      />
    </>
  );
};

export default PersonnelServicesPage;
