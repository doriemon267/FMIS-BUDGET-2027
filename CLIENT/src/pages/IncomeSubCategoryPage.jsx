import React from "react";
import {
  Box,
  Paper,
  Typography,
  Alert,
  Stack,
  useTheme,
  IconButton,
  Tooltip,
  alpha,
} from "@mui/material";
import { MdCategory } from "react-icons/md";
import PesoIcon from "../components/icons/PesoIcon";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import IncomeSubCategoriesCustomPage from "../components/incomesubcategories/IncomeSubCategoriesCustomPage";
import TextSearchable from "../global/components/TextSearchable";
import RegionMappingButton from "../components/incomesubcategories/RegionMappingButton";

const IncomeSubCategoryPage = () => {
  const theme = useTheme();

  const IncomeSubCategorySchema = {
    action: {
      type: "action",
      label: "Actions",
    },
    incomeSubcategoryName: {
      type: "text",
      label: "Income SubCategory Name",
      required: true,
      searchable: true,
      show: true,
    },
    name: {
      type: "text",
      label: "Name",
      required: false,
      searchable: false,
      show: false, // Hidden field that will be synced with incomeSubcategoryName
    },
    isGlobal: {
      label: "Global",
      type: "boolean",
      show: true,
      searchable: true,
      default: false,
      customRender: (row) => row.isGlobal ? "Yes" : "No"
    },
    regions: {
      label: "Regions",
      type: "array",
      show: true,
      searchable: false,
      default: [],
      customRender: (row) => {
        if (row.isGlobal) return "All Regions";
        
        const regions = row.regions || [];
        
        if (regions.length === 0) return "None";
        if (regions.length <= 3) return regions.join(", ");
        return `${regions.slice(0, 2).join(", ")} +${regions.length - 2} more`;
      }
    },
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Enhanced Header Section */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: "white",
          borderRadius: "16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <MdCategory size={40} />
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Income Subcategories
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                Create and manage income subcategories for detailed revenue
                classification and budget planning
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Data">
              <IconButton
                sx={{
                  color: "white",
                  backgroundColor: alpha("#fff", 0.1),
                  "&:hover": {
                    backgroundColor: alpha("#fff", 0.2),
                    transform: "scale(1.05)",
                  },
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="View Analytics">
              <IconButton
                sx={{
                  color: "white",
                  backgroundColor: alpha("#fff", 0.1),
                  "&:hover": {
                    backgroundColor: alpha("#fff", 0.2),
                    transform: "scale(1.05)",
                  },
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <TrendingUpIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Enhanced Information Alert */}
      <Alert
        severity="info"
        sx={{
          mb: 3,
          borderRadius: "12px",
          border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
          bgcolor: alpha(theme.palette.info.main, 0.05),
          "& .MuiAlert-icon": {
            color: theme.palette.info.main,
          },
        }}
        icon={<PesoIcon />}
      >
        <Typography variant="body2" fontWeight={500}>
          Create income subcategories here, then use them in{" "}
          <strong>Income Categories</strong> to organize your revenue streams.
          Examples: Tax Revenue, Service Fees, Grants, Interest Income, etc.
        </Typography>
      </Alert>

      {/* Enhanced Main Content */}
      <Paper
        elevation={4}
        sx={{
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
        }}
      >
        <IncomeSubCategoriesCustomPage
          dataListName="incomeSubcategories"
          schema={IncomeSubCategorySchema}
          title=""
          description=""
          searchable={false}
          additionalMenuOptions={[RegionMappingButton]}
        />
      </Paper>
    </Box>
  );
};

export default IncomeSubCategoryPage;
