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
import { MdCategory, MdList, MdAttachMoney } from "react-icons/md";
import IncomeCategoriesCustomPage from "../components/incomecategories/IncomeCategoriesCustomPage";
import IncomeCategoriesCustomCreateUpdateDialog from "../components/incomecategories/IncomeCategoriesCustomCreateUpdateDialog";
import api from "../config/api";

const IncomeCategoryPage = () => {
  const theme = useTheme();
  const [subcategoriesOptions, setSubcategoriesOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubcategories = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get("/income-subcategories");
        const subcategories = res.data.incomeSubcategories || [];

        // console.log(`Fetched ${subcategories.length} income subcategories:`, subcategories);

        // Extract subcategory names
        const subcategoryNames = subcategories.map(sub => sub.incomeSubcategoryName || sub.name);
        setSubcategoriesOptions(subcategoryNames);

        if (subcategoryNames.length === 0) {
          setError("No income subcategories available. Please add some subcategories first.");
        }
      } catch (err) {
        console.error("Failed to fetch subcategories", err);
        setError("Failed to load income subcategories. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchSubcategories();
  }, []);

const schema = {
  action: {
    type: "action",
    label: "Actions",
    show: true,
  },
  incomeCategoryName: {
    type: "text",
    label: "Category Name",
    searchable: true,
    show: true,
  },
  description: {
    type: "text",
    label: "Description",
    searchable: true,
    show: true,
  },
  incomeSubcategoryName: {
    type: "multi-select",
    label: "SubCategory Name",
    searchable: true,
    options: subcategoriesOptions.map((item) => ({ label: item, value: item })),
    show: true,

    customRender: (row) => (
      <Box sx={{ maxWidth: 400 }}>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {(row.incomeSubcategoryName || []).map((item, index) => (
            <Chip
              key={index}
              label={item}
              size="small"
              color="secondary"
              variant="outlined"
              icon={<MdAttachMoney />}
              sx={{
                mb: 0.5,
                fontSize: '0.75rem',
                height: 24
              }}
            />
          ))}
          {(!row.incomeSubcategoryName || row.incomeSubcategoryName.length === 0) && (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              No subcategories selected
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
          background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`,
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <MdAttachMoney size={32} />
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Income Categories
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Manage income categories and their associated subcategories for budget proposals
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Subcategories Info */}
      {!loading && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          icon={<MdList />}
        >
          <Typography variant="body2">
            <strong>{subcategoriesOptions.length} income subcategories available</strong> for selection when creating categories.
            These include various income sources and revenue streams.
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
          <Typography>Loading income subcategories...</Typography>
        </Paper>
      )}

      {/* Main Content */}
      {!loading && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <IncomeCategoriesCustomPage
            dataListName="income-categories"
            schema={schema}
            title=""
            description=""
            searchable={false}
            hasAdd={true}
            hasEdit={false}
            hasDelete={true}
            customAddElement={
              <IncomeCategoriesCustomCreateUpdateDialog
                schema={schema}
                endpoint="/income-categories"
                dataListName="income-categories"
              />
            }
            additionalMenuOptions={[
              ({ row, endpoint, dataListName }) => (
                <IncomeCategoriesCustomCreateUpdateDialog
                  row={row}
                  schema={schema}
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

export default IncomeCategoryPage;