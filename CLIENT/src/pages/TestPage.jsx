import React from "react";
import TestCustomPage from "../components/test/TestCustomPage";
import TextSearchable from "../global/components/TextSearchable";

const TestPage = () => {
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
  return <TestCustomPage 
  dataListName="tests" 
  schema={testSchema}
   
  />;
};

export default TestPage;
