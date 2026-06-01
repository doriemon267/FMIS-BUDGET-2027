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
import PeopleIcon from '@mui/icons-material/People';
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
  refreshTrigger = 0,
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
      {headerContent}

      <Paper 
        elevation={0} 
        sx={{ 
          width: "100%",
          borderRadius: '16px',
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          mt: 3
        }}
      >
        {/* Unified Table Header Bar */}
        <Box 
          sx={{ 
            p: 2.5,
            background: theme.palette.mode === 'light' 
              ? `linear-gradient(135deg, ${theme.palette.grey[100]} 0%, ${theme.palette.grey[50]} 100%)`
              : `linear-gradient(135deg, ${theme.palette.background.paper} 0%, rgba(255,255,255,0.03) 100%)`,
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <PeopleIcon sx={{ color: theme.palette.primary.main, fontSize: '1.5rem' }} />
            <Typography variant="h6" fontWeight="600">
              Employee Directory
            </Typography>
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

        <Box sx={{ p: 3 }}>
          <CustomTable
            ROWS_PER_PAGE={ROWS_PER_PAGE}
            dataListName={dataListName}
            apiPath={apiPath}
            tableContainerProps={tableContainerProps}
            onDataChange={onDataChange}
            refreshTrigger={refreshTrigger}
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