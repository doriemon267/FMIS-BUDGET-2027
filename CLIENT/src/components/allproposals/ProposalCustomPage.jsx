import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import ProposalCustomTable from "./ProposalCustomTable";
import { styled } from "@mui/material/styles";
import DashboardHeader from "../../global/components/DashboardHeader";

const StyledBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
}));

const ProposalCustomPage = ({
  dataListName,
  schema,
  title = "",
  description = "",
  searchable = true,
  hasEdit = true,
  hasDelete = true,
  hasAdd = true,
  customAddElement = null,
  customEditElement = null,
  additionalMenuOptions = [],
  ROWS_PER_PAGE = 20,
  refreshData,
  tableRef,
  apiPath,
  groupBy = null, // Make sure this prop is defined
  showTotals = false,
  totalsData = null,
}) => {
  const pageTitle =
    title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1);
  const pageDescription = description || `Manage ${dataListName}`;

  // Transform schema into columns for the table
  const columns = Object.keys(schema)
    .filter(key => schema[key].show !== false)
    .map(key => {
      const field = schema[key];
      return {
        field: key,
        label: field.label,
        type: field.type,
        render: field.customRender || (field.type === "action" ? 
          (row) => (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {additionalMenuOptions.map((ActionComponent, index) => (
                <ActionComponent key={index} row={row} refreshData={refreshData} />
              ))}
            </Box>
          ) : undefined)
      };
    });

  return (
    <>
      <DashboardHeader
        title={pageTitle}
        description={pageDescription}
        searchable={searchable}
      />

      <StyledBox>
        <ProposalCustomTable
          ref={tableRef}
          columns={columns}
          apiPath={apiPath}
          dataListName={dataListName}
          hasEdit={hasEdit}
          hasDelete={hasDelete}
          additionalMenuOptions={additionalMenuOptions}
          refreshData={refreshData}
          groupBy={groupBy} // Make sure to pass the groupBy prop
          ROWS_PER_PAGE={ROWS_PER_PAGE}
          showTotals={showTotals}
          totalsData={totalsData}
        />
      </StyledBox>
    </>
  );
};

export default ProposalCustomPage;
