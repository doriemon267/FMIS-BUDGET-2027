import React from "react";
import CustomPage from "../components/subsistenceallowancemds/SubsistenceAllowanceCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import SubsistenceAllowanceDialog from "../components/subsistenceallowancemds/SubsistenceAllowanceDialog";

const SubsistenceAllowanceMDSPage = () => {
  const schema = {
    action: {
      type: "action",
      label: "Actions",
    },
    employeeNumber: {
      type: "text",
      label: "Employee Number",
      searchable: true,
    },
    // status: {
    //   type: "text",
    //   label: "Status",
    //   show: true,
    // },
    employeeFullName: {
      type: "text",
      label: "Full Name",
      required: true,
      searchable: true,
      show: true,
    },
    positionTitle: {
      type: "text",
      label: "Position Title",
      show: true,
      searchable: true,
    },
    department: {
      type: "text",
      label: "Department",
      show: true,
      searchable: true,
    },
    division: {
      type: "text",
      label: "Division",
      show: true,
      searchable: true,
    },
    region: {
      type: "text",
      label: "Region",
      show: true,
      searchable: true,
    },
    Amount: {
      type: "number",
      label: "AMOUNT",
      required: true,
      searchable: true,
      show: true,
    },
    processBy: {
      type: "text",
      label: "Processed By",
      searchable: true,
    },
    processDate: {
      type: "date",
      label: "Processed Date",
    },
    fiscalYear: {
      type: "text",
      label: "Fiscal Year",
      searchable: true,
    },
    budgetType: {
      type: "text",
      label: "Budget Type",
    
    },
    createdAt: {
      type: "date",
      label: "Created At",
    },
  };

  return (
    <CustomPage
      dataListName="subsistence-allowance-mds"
      schema={schema}
      hasAdd={true}
      hasEdit={false}
      hasDelete={true}
      customAddElement={
        <SubsistenceAllowanceDialog
          schema={schema}
          endpoint="/subsistence-allowance-mds"
          dataListName="subsistence-allowance-mds"
        />
      }
      additionalMenuOptions={[
        ({ row, endpoint, dataListName }) => (
          <SubsistenceAllowanceDialog
            row={row}
            schema={schema}
            endpoint={endpoint}
            dataListName={dataListName}
          />
        ),
      ]}
    />
  );
};

export default SubsistenceAllowanceMDSPage;
