import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Alert,
  Chip,
  Stack,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  Grid,
  Card,
  CardContent,
  Button,
} from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";
import RefreshIcon from "@mui/icons-material/Refresh";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { MdList, MdAdd } from "react-icons/md";
import CustomPage from "../components/category/CategoryCustomPage";
import CustomCreateUpdateDialog from "../components/category/CategoryCustomCreateUpdateDialog";
import { useQueryClient } from "@tanstack/react-query";
import api from "../config/api";

const CategoryPage = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [sublineOptions, setSublineOptions] = useState([]);
  const [totalCategories, setTotalCategories] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sublineRes, categoriesRes] = await Promise.all([
        api.get("/categories/subline-items"),
        api.get("/categories", { params: { limit: 1 } }),
      ]);

      const items = sublineRes.data.sublineItems || [];
      const total = categoriesRes.data?.totalRecords ?? (Array.isArray(categoriesRes.data) ? categoriesRes.data.length : (categoriesRes.data?.categories || []).length);

      setSublineOptions(items);
      setTotalCategories(total);

      if (items.length === 0) {
        setError("No subline items available. Please check the database.");
      } else {
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
      setError("Failed to load data. Please try again.");
      setSublineOptions([]);
      setTotalCategories(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const categorySchema = {
    action: {
      type: "action",
      label: "Actions",
    },
    categoryName: {
      type: "text",
      label: "TITLE",
      required: true,
      searchable: true,
      show: true,
    },
    sublineItems: {
      type: "multi-select",
      label: "SUBLINE ITEMS",
      options: sublineOptions.map((item) => ({ label: item, value: item })),
      show: true,
      searchable: true,
      customRender: (row) => (
        <Box sx={{ maxWidth: 400 }}>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {(row.sublineItems || []).map((item, index) => (
              <Chip
                key={index}
                label={item}
                size="small"
                color="primary"
                variant="outlined"
                icon={<MdList />}
                sx={{
                  mb: 0.5,
                  fontSize: '0.75rem',
                  height: 24
                }}
              />
            ))}
            {(!row.sublineItems || row.sublineItems.length === 0) && (
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                No subline items selected
              </Typography>
            )}
          </Stack>
        </Box>
      ),
    },
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header - match Income Management style */}
      <Paper
        elevation={3}
        sx={{
          borderRadius: "16px",
          overflow: "hidden",
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: "white",
          transition: "box-shadow 0.3s",
          "&:hover": { boxShadow: "0 12px 28px rgba(0,0,0,0.15)" },
        }}
      >
        <Box sx={{ p: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start" flex={1}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: "12px",
                backgroundColor: alpha("#fff", 0.15),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CategoryIcon sx={{ fontSize: 36 }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Capital Outlay Categories
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 500 }}>
                Manage capital outlay categories and their associated subline items for budget proposals
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
                Categories are used to classify capital outlay items (e.g., infrastructure, buildings, machinery).
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Add category">
              <Box component="span">
                <CustomCreateUpdateDialog
                  schema={categorySchema}
                  endpoint="/categories"
                  dataListName="categories"
                  parentClose={() => setRefreshTrigger((t) => t + 1)}
                  trigger={
                    <Box
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        backgroundColor: alpha("#fff", 0.15),
                        color: "white",
                        "&:hover": { backgroundColor: alpha("#fff", 0.25) },
                        cursor: "pointer",
                      }}
                    >
                      <MdAdd size={24} />
                    </Box>
                  }
                />
              </Box>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => {
                  queryClient.invalidateQueries(["categories"]);
                  setRefreshTrigger((t) => t + 1);
                }}
                sx={{
                  backgroundColor: alpha("#fff", 0.15),
                  color: "white",
                  "&:hover": { backgroundColor: alpha("#fff", 0.25) },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>

      {/* Stats Cards */}
      {!loading && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                borderRadius: "16px",
                border: `1px solid ${theme.palette.divider}`,
                transition: "all 0.3s",
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                "&:hover": {
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  transform: "translateY(-2px)",
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "12px",
                      backgroundColor: alpha(theme.palette.primary.main, 0.15),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CategoryIcon sx={{ color: theme.palette.primary.main, fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Categories
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {totalCategories}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                borderRadius: "16px",
                border: `1px solid ${theme.palette.divider}`,
                transition: "all 0.3s",
                background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                "&:hover": {
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  transform: "translateY(-2px)",
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "12px",
                      backgroundColor: alpha(theme.palette.secondary.main, 0.15),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AccountTreeIcon sx={{ color: theme.palette.secondary.main, fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Subline Items Available
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {sublineOptions.length}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Info Alert */}
      {!loading && sublineOptions.length > 0 && (
        <Alert
          severity="info"
          icon={<MdList />}
          sx={{
            mb: 3,
            borderRadius: "16px",
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          <Typography variant="body2" gutterBottom>
            <strong>Guidelines:</strong>
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
            <Chip label={`${sublineOptions.length} subline items available`} size="small" color="primary" variant="outlined" />
            <Chip label="Assign subline items per category" size="small" variant="outlined" />
            <Chip label="Used in budget proposals" size="small" variant="outlined" />
          </Stack>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                queryClient.invalidateQueries(["categories"]);
                setRefreshTrigger((t) => t + 1);
              }}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">Loading subline items...</Typography>
        </Box>
      )}

      {/* Main Table Paper */}
      {!loading && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: "20px",
            overflow: "hidden",
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}
        >
          <Box
            sx={{
              p: 2,
              background: `linear-gradient(135deg, ${theme.palette.grey[100]} 0%, ${theme.palette.grey[50]} 100%)`,
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <CategoryIcon sx={{ color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight="600">
                Categories & Subline Items
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <CustomCreateUpdateDialog
                schema={categorySchema}
                endpoint="/categories"
                dataListName="categories"
                parentClose={() => setRefreshTrigger((t) => t + 1)}
                trigger={
                  <Button variant="contained" startIcon={<MdAdd />} size="small">
                    Add
                  </Button>
                }
              />
              <Button variant="outlined" startIcon={<RefreshIcon />} size="small" onClick={() => {
                queryClient.invalidateQueries(["categories"]);
                setRefreshTrigger((t) => t + 1);
              }}>
                Refresh
              </Button>
            </Stack>
          </Box>
          <Box sx={{ p: 2 }}>
            <CustomPage
              dataListName="categories"
              schema={categorySchema}
              title=""
              description=""
              hasAdd={false}
              hasEdit={false}
              hasDelete={true}
              additionalMenuOptions={[
                ({ row, endpoint, dataListName }) => (
                  <CustomCreateUpdateDialog
                    row={row}
                    schema={categorySchema}
                    endpoint={endpoint}
                    dataListName={dataListName}
                    parentClose={() => setRefreshTrigger((t) => t + 1)}
                  />
                ),
              ]}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default CategoryPage;
