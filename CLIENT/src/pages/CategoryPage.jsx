import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Alert,
  Chip,
  Stack,
  useTheme,
  alpha
} from "@mui/material";
import { MdCategory, MdList } from "react-icons/md";
import CustomPage from "../components/category/CategoryCustomPage";
import CustomCreateUpdateDialog from "../components/category/CategoryCustomCreateUpdateDialog";
import api from "../config/api";

const CategoryPage = () => {
  const theme = useTheme();
  const [sublineOptions, setSublineOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSublineItems = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get("/categories/subline-items");
        const items = res.data.sublineItems || [];

        // console.log(`Fetched ${items.length} subline items:`, items);
        setSublineOptions(items);

        if (items.length === 0) {
          setError("No subline items available. Please check the database.");
        }
      } catch (err) {
        console.error("Failed to fetch subline items", err);
        setError("Failed to load subline items. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchSublineItems();
  }, []);

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
      {/* Header Section */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <MdCategory size={32} />
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Capital Outlay Categories
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Manage capital outlay categories and their associated subline items for budget proposals
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Subline Items Info */}
      {!loading && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          icon={<MdList />}
        >
          <Typography variant="body2">
            <strong>{sublineOptions.length} subline items available</strong> for selection when creating categories.
            These include infrastructure, buildings, machinery, transportation, furniture, land, and other capital outlay items.
          </Typography>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Paper sx={{ p: 3, textAlign: 'center', mb: 3 }}>
          <Typography>Loading subline items...</Typography>
        </Paper>
      )}

      {/* Main Content */}
      {!loading && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <CustomPage
            dataListName="categories"
            schema={categorySchema}
            title=""
            description=""
            hasAdd={true}
            hasEdit={false}
            hasDelete={true}
            customAddElement={
              <CustomCreateUpdateDialog
                schema={categorySchema}
                endpoint="/categories"
                dataListName="categories"
              />
            }
            additionalMenuOptions={[
              ({ row, endpoint, dataListName }) => (
                <CustomCreateUpdateDialog
                  row={row}
                  schema={categorySchema}
                  endpoint={endpoint}
                  dataListName={dataListName}
                />
              ),
            ]}
          />
        </Paper>
      )}
    </Box>
  );
};

export default CategoryPage;
