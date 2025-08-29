import React from "react";
import CustomPage from "../global/components/CustomPage";
import TextSearchable from "../global/components/TextSearchable";

const AppearancePage = () => {
 const schema = {
     employeeNumber: {
       type: "text",
       label: "Employee Number",
   
     },
     employeeFullName: {
       type: "text",
       label: "Full Name",
       show: true,
     },
     positionTitle: {
       type: "text",
       label: "Position Title",
       show: true,
     },
     department: {
       type: "text",
       label: "Department",
       show: true,
     },
     division: {
       type: "text",
       label: "Division",
       show: true,
     },
     region: {
       type: "text",
       label: "Region",
       show: true,
     },
    //  noOfCourtAppearance: {
    //    type: "number",
    //    label: "No. of Court Appearances",
    //    show: true,
    //    customRender: (row) => (
    //      <TextField
    //        type="number"
    //        size="small"
    //        value={row.noOfCourtAppearance || 0}
    //        onChange={(e) => handleCourtAppearanceChange(row, e.target.value)}
    //      />
    //    ),
    //  },
    //  courtAppearanceAmount: {
    //    type: "number",
    //    label: "Court Appearance Amount",
    //    show: true,
    //    customRender: (row) =>
    //      `₱${(row.courtAppearanceAmount || 0).toLocaleString(undefined, {
    //        minimumFractionDigits: 2,
    //        maximumFractionDigits: 2,
    //      })}`,
    //  },
     fiscalYear: {
       type: "text",
       label: "Fiscal Year",
    
     },
     budgetType: {
       type: "text",
       label: "Budget Type",
    
     },
   };
  return <CustomPage dataListName="personnelServices" schema={schema} />;
};

export default AppearancePage;
