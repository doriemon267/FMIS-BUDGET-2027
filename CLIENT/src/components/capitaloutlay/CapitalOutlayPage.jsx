import React from "react";
import CustomPage from "./CapitalOutlayCustompage";
import TextSearchable from "../../global/components/TextSearchable";

const CapitalOutlayPage = () => {
  const capitalOutlaySchema = {
    itemName: {
      type: "text",
      label: "Item Name",
      required: true,
      searchable: true,
      show: true,
    },
    amount: {
      type: "number",
      label: "Amount",
      required: true,
      searchable: true,
      show: true,
    },
    category: {
      type: "text",
      label: "Category",
      required: true,
      searchable: true,
      show: true,
    },
    purchaseDate: {
      type: "date",
      label: "Purchase Date",
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

  return <CustomPage dataListName="capital-outlays" schema={capitalOutlaySchema} />;
};

export default CapitalOutlayPage;
