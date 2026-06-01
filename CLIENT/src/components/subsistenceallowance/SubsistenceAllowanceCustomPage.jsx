import React from "react";
import CustomCreateUpdateDialog from "../subsistenceallowance/SubsistenceAllowanceDialog";
import CustomMenu from "../../global/components/CustomMenu";
import CustomTable from "../subsistenceallowance/SubsistenceAllowanceCustomTable";
import PropTypes from "prop-types";
import { Box, Paper, Typography, Chip, Zoom } from "@mui/material";
import { LocalDining as DiningIcon } from "@mui/icons-material";

const CustomPage = ({
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
}) => {
  const pageTitle = title || "Subsistence Allowance";
  const pageDescription = description || "Manage subsistence allowance (amount from Compensation Management monthly × 12).";
  const apiPath = `/${dataListName}`;
  return (
    <Box sx={{ p: 0 }}>
      {/* Enhanced Action Bar Header */}
      <Paper sx={{ 
        mt: 3, 
        mx: 3, 
        p: 2, 
        mb: 2, 
        borderRadius: 2, 
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa'
        }
      }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" sx={{ color: (theme) => theme.palette.mode === 'dark' ? '#a5d6a7' : '#2d5016', fontWeight: 'bold' }}>
              {pageTitle} Management
            </Typography>
          </Box>

          {(hasAdd || customAddElement) && (
            <Box>
              {customAddElement || (
                <CustomCreateUpdateDialog endpoint={apiPath} schema={schema} dataListName={dataListName} />
              )}
            </Box>
          )}
        </Box>
      </Paper>

      <Box sx={{ mx: 3 }}>
        <Paper sx={{ 
          width: "100%", 
          overflow: "hidden", 
          borderRadius: 2, 
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }
        }}>
          <CustomTable
            dataListName={dataListName}
            apiPath={apiPath}
            ROWS_PER_PAGE={ROWS_PER_PAGE}
            columns={Object.keys(schema)
              .filter((key) => schema[key].show === true || key === "action")
              .map((key) => {
                const fieldSchema = schema[key];
                const column = { field: key, label: fieldSchema.label, type: fieldSchema.type, searchable: fieldSchema.searchable || false };
                if (fieldSchema.type === "action") {
                  column.render = (row) => (
                    <CustomMenu
                      additionalMenuOptions={additionalMenuOptions}
                      customEditElement={customEditElement}
                      hasEdit={hasEdit}
                      hasDelete={hasDelete}
                      row={row}
                      schema={schema}
                      endpoint={apiPath}
                      dataListName={dataListName}
                    />
                  );
                }
                if (fieldSchema.customRender) column.render = (row) => fieldSchema.customRender(row);
                return column;
              })}
          />
        </Paper>
      </Box>
    </Box>
  );
};

CustomPage.propTypes = {
  dataListName: PropTypes.string.isRequired,
  schema: PropTypes.object.isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  searchable: PropTypes.bool,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  hasAdd: PropTypes.bool,
  customAddElement: PropTypes.element,
  customEditElement: PropTypes.element,
  additionalMenuOptions: PropTypes.arrayOf(PropTypes.elementType),
};

export default CustomPage;
