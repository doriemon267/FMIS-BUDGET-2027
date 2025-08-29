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
          <GavelIcon sx={{ 
            fontSize: '2rem',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'rotate(20deg) scale(1.2)',
            }
          }} />
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Special Counsel Allowance
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Manage court appearance allowances for legal services personnel
            </Typography>
            <Box display="flex" gap={1} mt={2}>
              <Chip
                label="Court Appearances"
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
                label="Legal Services"
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
                label="Special Allowances"
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
        {customAddElement && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            {customAddElement}
          </Box>
        )}
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
  customAddElement: PropTypes.element,
  ROWS_PER_PAGE: PropTypes.number,
  tableData: PropTypes.array,
};

export default CustomPage;
