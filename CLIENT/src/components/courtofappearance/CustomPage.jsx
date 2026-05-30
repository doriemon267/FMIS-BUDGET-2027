import React from "react";
import CustomTable from "../courtofappearance/CustomTable";
import PropTypes from "prop-types";
import { Box, Paper, Typography, Chip, Zoom } from "@mui/material";
import { Gavel as GavelIcon } from "@mui/icons-material";

const CustomPage = ({
  dataListName,
  schema,
  title = "",
  description = "",
  searchable = true,
  customAddElement = null,
  ROWS_PER_PAGE = 20,
  tableData, // override data
}) => {
  const pageTitle = title ||
    dataListName.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  const pageDescription = description || `Manage ${pageTitle.toLowerCase()}`;
  const apiPath = `/${dataListName}`;

  return (
    <Box sx={{ p: 0 }}>
      {customAddElement && (
        <Box sx={{ mb: 2, mx: 3, display: 'flex', justifyContent: 'flex-end' }}>
          {customAddElement}
        </Box>
      )}

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
              .filter((key) => schema[key].show === true)
              .map((key) => {
                const fieldSchema = schema[key];
                const column = {
                  field: key,
                  label: fieldSchema.label,
                  type: fieldSchema.type,
                  searchable: fieldSchema.searchable || false,
                };
                if (fieldSchema.customRender) {
                  column.render = (row, index) => fieldSchema.customRender(row, index);
                }
                return column;
              })}
            overrideRows={tableData}
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
  customAddElement: PropTypes.element,
  ROWS_PER_PAGE: PropTypes.number,
  tableData: PropTypes.array,
};

export default CustomPage;
