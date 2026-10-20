import React, { useState, useMemo } from 'react';
import { 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  CircularProgress,
  Box,
  Typography
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../config/api';

const IncomeTableTest = () => {
  // Basic state
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [budgetType, setBudgetType] = useState("REGULAR");

  // Fetch income items
  const { 
    data: incomeItems = [], 
    isLoading: loadingItems
  } = useQuery({
    queryKey: ["income-items", fiscalYear, budgetType],
    queryFn: async () => {
      try {
        const response = await api.get("/income", {
          params: { fiscalYear, budgetType }
        });
        return Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        console.error("Error fetching income items:", error);
        return [];
      }
    },
    enabled: !!fiscalYear && !!budgetType
  });

  // Fetch income categories
  const { 
    data: incomeCategories = [], 
    isLoading: loadingCategories
  } = useQuery({
    queryKey: ["income-categories"],
    queryFn: async () => {
      try {
        const response = await api.get("/income-categories");
        let categoriesArray = [];
        if (Array.isArray(response.data)) {
          categoriesArray = response.data;
        } else if (response.data && Array.isArray(response.data.categories)) {
          categoriesArray = response.data.categories;
        }
        return categoriesArray;
      } catch (error) {
        console.error("Error fetching income categories:", error);
        return [];
      }
    }
  });

  // Simple groupedItems calculation
  const groupedItems = useMemo(() => {
    const result = {};
    
    // Add categories first
    if (Array.isArray(incomeCategories)) {
      incomeCategories.forEach(category => {
        if (category && category.incomeCategoryName) {
          const name = category.incomeCategoryName.trim();
          result[name] = {
            subtotal: 0,
            subcategories: category.incomeSubcategoryName || [],
            categoryId: category._id
          };
        }
      });
    }

    // Add items to categories
    if (Array.isArray(incomeItems)) {
      incomeItems.forEach(item => {
        if (item.category) {
          const categoryName = typeof item.category === 'object' ? item.category.name : item.category;
          if (categoryName && result[categoryName.trim()]) {
            result[categoryName.trim()].subtotal += Number(item.amount) || 0;
          }
        }
      });
    }

    return result;
  }, [incomeItems, incomeCategories]);

  // Calculate grand total
  const grandTotal = useMemo(() => {
    return Object.values(groupedItems).reduce((sum, category) => {
      return sum + (category.subtotal || 0);
    }, 0);
  }, [groupedItems]);

  if (loadingCategories || loadingItems) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Income Table Test - Grand Total: ₱{grandTotal.toLocaleString()}
      </Typography>
      
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(groupedItems).map(([categoryName, category]) => (
              <TableRow key={categoryName}>
                <TableCell>{categoryName}</TableCell>
                <TableCell align="right">
                  ₱{(category.subtotal || 0).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default IncomeTableTest;
