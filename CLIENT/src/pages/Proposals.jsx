import React from "react";
import ProposalCustomPage from "../components/proposals/ProposalCustomPage";
import TextSearchable from "../global/components/TextSearchable";

const Proposals = () => {
  const testSchema = {
    title: {
      type: "text",
      label: "Title",
      required: true,
      searchable: true,
      show: true,
    },
    description: {
      type: "textarea",
      label: "Description",
      searchable: true,
      show: true,
    },
    likes: {
      type: "number",
      label: "Likes",
      default: 0,
      customRender: (row) => <TextSearchable columnName={row.likes} />,
      show: true,
    },
    isPublish: {
      type: "boolean",
      label: "Published",
      default: true,
      show: true,
    },
    createdAt: {
      type: "date",
      label: "Created At",
      show: true,
    },
    action: {
      type: "action",
      label: "Actions",
    },
  };
  return <ProposalCustomPage dataListName="tests" schema={testSchema} />;
};

export default Proposals;
