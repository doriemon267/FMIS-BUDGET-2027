import React from "react";
import CustomPage from "../global/components/CustomPage";
import CustomCreateUpdateDialog from "../global/components/CustomCreateUpdateDialog";

const PositionTitleManagementPage = () => {
  const schema = {
    action: {
      type: "action",
      label: "Actions",
    },
    PositionTitle: {
      type: "text",
      label: "Position Title",
      required: true,
      searchable: true,
      show: true,
      width: 250,
    },
    SG: {
      type: "number",
      label: "Salary Grade (SG)",
      show: true,
      searchable: true,
      width: 150,
      customRender: (row) => (row.SG !== null && row.SG !== undefined ? row.SG : "—"),
    },
    JG: {
      type: "text",
      label: "Job Grade (JG)",
      show: true,
      searchable: true,
      width: 150,
    },
    PG: {
      type: "text",
      label: "Pay Grade (PG)",
      show: true,
      searchable: true,
      width: 150,
    },
  };

  return (
    <CustomPage
      dataListName="positions"
      title="Position Titles Management"
      description="Manage position titles and their corresponding Salary Grades, Job Grades, and Pay Grades."
      schema={schema}
      hasAdd={true}
      hasEdit={true}
      hasDelete={true}
      hasClose={false}
      customAddElement={
        <CustomCreateUpdateDialog
          schema={schema}
          endpoint="/positions"
          dataListName="positions"
        />
      }
      additionalMenuOptions={[]}
    />
  );
};

export default PositionTitleManagementPage;
