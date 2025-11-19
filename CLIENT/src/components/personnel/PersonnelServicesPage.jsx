import React from "react";
import CustomPageTable from "./PersonnelCustomPageTable";
//import CustomPage from "../../global/components/CustomPage";
import { Button, Box } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-hot-toast";

const PersonnelServicesPage = () => {
  const personnelServicesSchema = {
    action: {
      type: "action",
      label: "ACTIONS",
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

    employeeFullName: {
      type: "text",
      label: "EMPLOYEE NAME",
      searchable: true,
      show: true,
    },
    noOfDependent: {
      type: "number",
      label: "NO. OF DEPENDENTS",
      show: true,
      customRender: (row) => row.noOfDependent || 0,
    },
    monthlySalary: {
      type: "number",
      label: "MONTHLY SALARY",
      show: true,
    },
   
    subsistenceAllowance: {
      type: "number",
      label: "SUBSISTENCE ALLOWANCE",
      show: true,
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
    hazardPay: {
      type: "number",
      label: "HAZARD PAY",
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
    gsisPremium: {
      type: "number",
      label: "GSIS PREMIUM",
      show: true,
    },
    pagibigPremium: {
      type: "number",
      label: "PAG-IBIG PREMIUM",
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
    loyaltyAward: {
      type: "number",
      label: "LOYALTY AWARD",
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

    subsidyAmount: {
      type: "number",
      label: "PROJECTED SUBSIDY",
      show: true,
    },

    Total: {
      type: "number",
      label: "TOTAL",
      show: true,
    },
  };

  const queryClient = useQueryClient();

  const syncMealAllowances = useMutation({
    mutationFn: async () => {
      return axios.post("/personnelServices/sync-meal-allowances");
    },
    onSuccess: (data) => {
      toast.success(`Meal allowances synced successfully: ${data.data.message}`);
      queryClient.invalidateQueries({ queryKey: ["personnelServices"] });
    },
    onError: (error) => {
      toast.error(`Error syncing meal allowances: ${error.response?.data?.message || error.message}`);
    }
  });

  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => syncMealAllowances.mutate()}
          disabled={syncMealAllowances.isPending}
        >
          {syncMealAllowances.isPending ? "Syncing..." : "Sync Meal Allowances"}
        </Button>
      </Box>
      
      <CustomPageTable
        dataListName="personnelServices"
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
