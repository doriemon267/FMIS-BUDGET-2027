import React, { useState } from "react";
import CustomCreateUpdateDialog from "../employee/EmployeeCustomAdd";
import CustomMenu from "../../global/components/CustomMenu";
import CustomTable from "../employee/EmployeeCustomTable";
import DashboardHeader from "../../global/components/DashboardHeader";
import PropTypes from "prop-types";
import { 
  Checkbox, 
  Box, 
  Paper, 
  Typography, 
  useTheme, 
  useMediaQuery,
  Collapse,
  IconButton,
  Tooltip,
  Divider
} from "@mui/material";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InfoIcon from '@mui/icons-material/Info';
import { useThemeContext } from "../../context/ThemeContext";

const EmployeeCustomPage = ({
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
  tableContainerProps = {},
  footerElement = null,
  headerContent = null,
  onDataChange = null,
}) => {
  const theme = useTheme();
  const { mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showInfo, setShowInfo] = useState(false);
  
  const pageTitle =
    title || dataListName.charAt(0).toUpperCase() + dataListName.slice(1);
  const pageDescription = description || `Manage ${dataListName}`;
  const apiPath = `/${dataListName}`;

  return (
    <>
      <Paper 
        elevation={2} 
        sx={{ 
          borderRadius: '12px',
          overflow: 'hidden',
          mb: 3,
          transition: 'box-shadow 0.3s',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
          }
        }}
      >
        <Box 
          sx={{ 
            p: 3,
            bgcolor: theme.palette.mode === 'light' ? '#fff' : theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.mode === 'light' ? '#e0e0e0' : '#424242'}`
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box>
              <Typography 
                variant="h5" 
                component="h1" 
                fontWeight="bold"
                color="primary"
                gutterBottom
              >
                {pageTitle}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    maxWidth: isMobile ? '100%' : '80%'
                  }}
                >
                  {pageDescription}
                </Typography>
                
                <Tooltip title={showInfo ? "Hide details" : "Show more details"}>
                  <IconButton 
                    size="small" 
                    onClick={() => setShowInfo(!showInfo)}
                    sx={{ ml: 0.5 }}
                  >
                    {showInfo ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            <Box>
              {customAddElement ? (
                React.cloneElement(customAddElement, { onDataChange })
              ) : hasAdd ? (
                <CustomCreateUpdateDialog
                  endpoint={apiPath}
                  schema={schema}
                  dataListName={dataListName}
                />
              ) : null}
            </Box>
          </Box>
          
          <Collapse in={showInfo}>
            <Box 
              sx={{ 
                mt: 2, 
                p: 2, 
                bgcolor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: `1px solid ${theme.palette.mode === 'light' ? '#e0e0e0' : '#424242'}`
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <InfoIcon color="info" sx={{ mt: 0.5 }} />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    About Employee Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    This page allows you to manage all employee records in the system. You can add new employees, 
                    edit existing records, and update employee status. Use the search and filter options to quickly 
                    find specific employees.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Tips:</strong> Click on column headers to sort the data. Use the filter icon next to column 
                    headers to filter by specific values. Toggle the status switch to activate or deactivate employees.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Collapse>
        </Box>
        
        <DashboardHeader
          title=""
          description=""
          searchable={searchable}
          childElement={null}
          sx={{ 
            px: 3, 
            py: 2, 
            borderBottom: `1px solid ${theme.palette.mode === 'light' ? '#e0e0e0' : '#424242'}`,
            boxShadow: 'none',
            bgcolor: theme.palette.primary.main,
            color: '#fff',
            '& .MuiInputBase-root': {
              bgcolor: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.25)',
              },
              '& .MuiInputAdornment-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              }
            }
          }}
        />
        
        {headerContent && (
          <Box sx={{ px: 3 }}>
            {headerContent}
          </Box>
        )}

        <Box sx={{ p: 3 }}>
          <CustomTable
            ROWS_PER_PAGE={ROWS_PER_PAGE}
            dataListName={dataListName}
            apiPath={apiPath}
            tableContainerProps={tableContainerProps}
            columns={[
              {
                field: "select",
                label: "Select",
                render: (row) => (
                  <Checkbox 
                    disabled={row.employeeStatus === "Inactive"} 
                    size="small"
                  />
                ),
              },
              ...Object.keys(schema)
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
                      <CustomMenu
                        additionalMenuOptions={additionalMenuOptions}
                        customEditElement={customEditElement}
                        hasEdit={hasEdit}
                        hasDelete={hasDelete}
                        row={row}
                        schema={schema}
                        endpoint={apiPath}
                        dataListName={dataListName}
                        onDataChange={onDataChange}
                      />
                    );
                  }

                  if (fieldSchema.customRender) {
                    column.render = (row) => fieldSchema.customRender(row);
                  }

                  return column;
                }),
            ]}
          />
          
          {footerElement && (
            <Box sx={{ mt: 2 }}>
              {footerElement}
            </Box>
          )}
        </Box>
      </Paper>
    </>
  );
};

EmployeeCustomPage.propTypes = {
  dataListName: PropTypes.string.isRequired,
  schema: PropTypes.objectOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      show: PropTypes.bool,
      searchable: PropTypes.bool,
      customRender: PropTypes.func,
      default: PropTypes.any,
    })
  ).isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  searchable: PropTypes.bool,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  hasAdd: PropTypes.bool,
  customAddElement: PropTypes.element,
  customEditElement: PropTypes.element,
  additionalMenuOptions: PropTypes.arrayOf(PropTypes.elementType),
  ROWS_PER_PAGE: PropTypes.number,
  tableContainerProps: PropTypes.object,
  footerElement: PropTypes.node,
  headerContent: PropTypes.node,
};

export default EmployeeCustomPage;