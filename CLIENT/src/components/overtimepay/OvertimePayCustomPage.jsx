import React from "react";
import CustomTable from "../overtimepay/OvertimePayCustomTable";
import PropTypes from "prop-types";
import { Box, Paper, Typography, Chip, Zoom } from "@mui/material";
import { Schedule as ScheduleIcon } from "@mui/icons-material";

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
  debug = false,
}) => {
  const pageTitle =
    title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1);
  const pageDescription = description || `Manage ${dataListName}`;
  const apiPath = `/${dataListName}`;

  return (
    <Box sx={{ p: 0 }}>
      {/* Enhanced Header */}
      <Paper sx={{
        p: 3,
        mb: 3,
        mx: 3,
        borderRadius: 2,
        background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
          transform: 'translateY(-2px)',
        }
      }}>
        <Box display="flex" alignItems="center" gap={2}>
          <ScheduleIcon sx={{ 
            fontSize: '2rem',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'rotate(20deg) scale(1.2)',
            }
          }} />
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              {pageTitle}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {pageDescription}
            </Typography>
            <Box display="flex" gap={1} mt={2}>
              <Chip
                label="Inline Editing"
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 'bold',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    transform: 'scale(1.05)',
                  }
                }}
              />
              <Chip
                label="Real-time Calculations"
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 'bold',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    transform: 'scale(1.05)',
                  }
                }}
              />
              <Chip
                label="Export Ready"
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 'bold',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    transform: 'scale(1.05)',
                  }
                }}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ mx: 3 }}>
        {/* Main Table with Zoom Animation */}
        <Zoom in={true} timeout={600}>
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
              const column = {
                field: key,
                label: fieldSchema.label,
                type: fieldSchema.type,
                searchable: fieldSchema.searchable || false,
              };

              if (fieldSchema.type === "action") {
                column.render = (row) => (
                  <div>
                    {additionalMenuOptions.map((MenuOption, index) => (
                      <div key={index}>
                        <MenuOption
                          row={row}
                          endpoint={apiPath}
                          dataListName={dataListName}
                        />
                      </div>
                    ))}
                  </div>
                );
              }
              if (fieldSchema.customRender) {
                column.render = (row) => fieldSchema.customRender(row);
              }
              return column;
            })}
            />
          </Paper>
        </Zoom>
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
  additionalMenuOptions: PropTypes.arrayOf(PropTypes.func),
  ROWS_PER_PAGE: PropTypes.number,
  debug: PropTypes.bool,
};

export default CustomPage;
