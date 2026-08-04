import React, { Component } from "react";
import { useRegion } from "../../context/RegionContext";
import CustomCreateUpdateDialog from "./ChildrenAllowanceDialog";
import CustomMenu from "../../global/components/CustomMenu";
import CustomTable from "./ChildrenAllowanceCustomTable";
import PropTypes from "prop-types";
import { Zoom, Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  IconButton,
  Tooltip
} from "@mui/material";
import {
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  ChildCare as ChildrenIcon,
  Refresh as RefreshIcon
} from "@mui/icons-material";
import PesoIcon from "../icons/PesoIcon";
import { useQuery } from "@tanstack/react-query";
import api from "../../config/api";

// Custom Error Boundary Component
class CustomErrorBoundary extends Component {
  state = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert">
          <p>Something went wrong:</p>
          <pre>{this.state.error?.message || "Unknown error"}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const { activeRegion } = useRegion();

  const theme = useTheme();
  const titleColor = theme.palette.mode === 'dark' ? '#a5d6a7' : '#2d5016';
  const refreshBg = theme.palette.mode === 'dark' ? 'rgba(165, 214, 167, 0.1)' : 'rgba(55, 94, 56, 0.1)';
  const refreshHoverBg = theme.palette.mode === 'dark' ? 'rgba(165, 214, 167, 0.2)' : 'rgba(55, 94, 56, 0.2)';

  const pageTitle = title || "Children Allowance";
  const pageDescription = description || `Manage ${dataListName}`;
  const apiPath = `/${dataListName}`;

  // Add stats query
  const { data: stats, isLoading: statsLoading, refetch } = useQuery({
    queryKey: [dataListName, "stats", activeRegion],
    queryFn: async () => {
      const activeRegionName = activeRegion?.name || activeRegion?.regionName || "";
      const params = {};
      if (activeRegionName) {
        params.region = activeRegionName;
      }
      const response = await api.get(`${apiPath}/stats`, { params });
      return response.data;
    },
    staleTime: 60000,
  });

  const columns = [
    // Add action column first
    {
      field: "action",
      label: "Actions",
      type: "action",
      render: (row) => (
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
      ),
    },
    // Then add all other columns except action
    ...Object.keys(schema)
      .filter((key) => schema[key].show === true && key !== "action")
      .map((key) => {
        const fieldSchema = schema[key];
        return {
          field: key,
          label: fieldSchema.label,
          type: fieldSchema.type,
          searchable: fieldSchema.searchable || false,
          render: fieldSchema.customRender
            ? (row) => fieldSchema.customRender(row)
            : undefined,
        };
      }),
  ];

  return (
    <CustomErrorBoundary>
      <Box sx={{ p: 0 }}>
        {/* Enhanced Action Bar with Stats */}
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
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa'
          }
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h6" sx={{ color: titleColor, fontWeight: 'bold' }}>
                Children Allowance Management
              </Typography>

              <Tooltip title="Refresh Data">
                <IconButton
                  onClick={() => refetch()}
                  disabled={statsLoading}
                  sx={{
                    backgroundColor: refreshBg,
                    color: titleColor,
                    '&:hover': { backgroundColor: refreshHoverBg }
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {(hasAdd || customAddElement) && (
              <Box>
                {customAddElement || (
                  <CustomCreateUpdateDialog
                    endpoint={apiPath}
                    schema={schema}
                    dataListName={dataListName}
                  />
                )}
              </Box>
            )}
          </Box>

          {/* Summary Statistics - matching other pages style */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : '#e8f5e9', 
                  borderLeft: '4px solid #4caf50',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 20px rgba(76, 175, 80, 0.2)',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : '#d7f0da',
                  }
                }}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AssessmentIcon 
                      sx={{ 
                        color: '#4caf50',
                        fontSize: '2rem',
                        transition: 'transform 0.3s ease',
                        '.MuiCard-root:hover &': {
                          transform: 'scale(1.2)',
                        }
                      }} 
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Records</Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {statsLoading ? '0' : stats?.totalRecords || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.1)' : '#e3f2fd', 
                  borderLeft: '4px solid #2196f3',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 20px rgba(33, 150, 243, 0.2)',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.15)' : '#d0e8fc',
                  }
                }}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PesoIcon 
                      sx={{ 
                        color: '#2196f3',
                        fontSize: '2rem',
                        transition: 'transform 0.3s ease',
                        '.MuiCard-root:hover &': {
                          transform: 'scale(1.2)',
                        }
                      }} 
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                      <Typography variant="h6" fontWeight="bold">
                        ₱{statsLoading ? '0' : (stats?.totalAmount || 0).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : '#fff3e0', 
                  borderLeft: '4px solid #ff9800',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 20px rgba(255, 152, 0, 0.2)',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.15)' : '#ffe8cc',
                  }
                }}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <ChildrenIcon 
                      sx={{ 
                        color: '#ff9800',
                        fontSize: '2rem',
                        transition: 'transform 0.3s ease',
                        '.MuiCard-root:hover &': {
                          transform: 'scale(1.2)',
                        }
                      }} 
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Dependents</Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {statsLoading ? '0' : stats?.totalDependents || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card 
                sx={{ 
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(233, 30, 99, 0.1)' : '#fce4ec', 
                  borderLeft: '4px solid #e91e63',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 20px rgba(233, 30, 99, 0.2)',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(233, 30, 99, 0.15)' : '#f8d0e0',
                  }
                }}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PeopleIcon 
                      sx={{ 
                        color: '#e91e63',
                        fontSize: '2rem',
                        transition: 'transform 0.3s ease',
                        '.MuiCard-root:hover &': {
                          transform: 'scale(1.2)',
                        }
                      }} 
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Unique Employees</Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {statsLoading ? '0' : stats?.uniqueEmployees || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>

        <Box sx={{ mx: 3 }}>
          {/* Main Table */}
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
              columns={columns}
            />
          </Paper>
        </Box>
      </Box>
    </CustomErrorBoundary>
  );
};

CustomPage.propTypes = {
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
};

export default CustomPage;
