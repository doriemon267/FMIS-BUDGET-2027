import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  Box,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
} from "@mui/material";
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as FileCopyIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../config/api";
import CustomMenu from "../../global/components/CustomMenu";
import { toast } from "react-toastify";

const GroupedIncomeCategoriesTable = ({
  dataListName = "income-categories",
  schema = {},
  hasEdit = true,
  hasDelete = true,
  onRefresh,
}) => {
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [openCopyDialog, setOpenCopyDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const queryClient = useQueryClient();

  // Fetch grouped categories summary
  const { data: groupsData, isLoading, isError } = useQuery({
    queryKey: ["groupedCategories"],
    queryFn: async () => {
      const response = await api.get(
        "/income-category-groups/summary"
      );
      return response.data.groups || [];
    },
    refetchInterval: 0,
  });

  // Fetch categories for a specific group
  const { data: categoriesByGroup } = useQuery({
    queryKey: ["categoriesByGroup", expandedGroupId],
    queryFn: async () => {
      if (!expandedGroupId) return [];
      const response = await api.get(
        `/income-category-groups/${expandedGroupId}/categories`
      );
      return response.data.categories || [];
    },
    enabled: !!expandedGroupId,
  });

  // Delete category mutation
  const deleteCategory = useMutation({
    mutationFn: async (categoryId) => {
      await api.delete(`/income-categories/${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupedCategories"] });
      queryClient.invalidateQueries({ queryKey: ["categoriesByGroup"] });
      toast.success("Category deleted successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to delete category");
    },
  });

  // Copy category mutation
  const copyCategory = useMutation({
    mutationFn: async ({ sourceId, newName, groupId, fiscalYears }) => {
      const response = await api.post(
        `/income-categories/${sourceId}/copy`,
        {
          newName,
          groupId,
          fiscalYears,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupedCategories"] });
      queryClient.invalidateQueries({ queryKey: ["categoriesByGroup"] });
      toast.success("Category copied successfully");
      setOpenCopyDialog(false);
      setNewCategoryName("");
      setSelectedCategory(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to copy category");
    },
  });

  const handleExpandGroup = (groupId) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
  };

  const handleOpenCopyDialog = (category) => {
    setSelectedCategory(category);
    setNewCategoryName("");
    setOpenCopyDialog(true);
  };

  const handleCloseCopyDialog = () => {
    setOpenCopyDialog(false);
    setSelectedCategory(null);
    setNewCategoryName("");
  };

  const handleCopyConfirm = () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a name for the new category");
      return;
    }

    copyCategory.mutate({
      sourceId: selectedCategory._id,
      newName: newCategoryName.trim(),
      groupId: selectedCategory.groupId,
      fiscalYears: selectedCategory.fiscalYears,
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography>Loading categories...</Typography>
      </Box>
    );
  }

  if (isError || !groupsData) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography color="error">
          Failed to load categories. Please refresh the page.
        </Typography>
      </Box>
    );
  }

  if (groupsData.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography>No category groups found. Create one to get started!</Typography>
      </Box>
    );
  }

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell width="50px" />
              <TableCell sx={{ fontWeight: "bold" }}>Group Name</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Budget Type</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Categories</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Fiscal Years</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groupsData.map((group) => (
              <React.Fragment key={group._id}>
                {/* Group Header Row */}
                <TableRow
                  sx={{
                    backgroundColor:
                      expandedGroupId === group._id ? "#f9f9f9" : "white",
                    "&:hover": { backgroundColor: "#fafafa" },
                  }}
                >
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleExpandGroup(group._id)}
                    >
                      {expandedGroupId === group._id ? (
                        <KeyboardArrowUpIcon />
                      ) : (
                        <KeyboardArrowDownIcon />
                      )}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {group.groupName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        group.fiscalYears && group.fiscalYears.length > 0
                          ? [...new Set(group.fiscalYears.map(fy => fy.budgetType))].join(", ")
                          : "None"
                      }
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${group.categoriesCount || 0} items`}
                      size="small"
                      variant="filled"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {group.fiscalYears && group.fiscalYears.length > 0 ? (
                        group.fiscalYears.map((fy) => (
                          <Chip
                            key={fy._id}
                            label={fy.fiscalYear}
                            size="small"
                            variant="outlined"
                          />
                        ))
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          None linked
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>

                {/* Expanded Categories */}
                <TableRow>
                  <TableCell colSpan={5} sx={{ p: 0 }}>
                    <Collapse
                      in={expandedGroupId === group._id}
                      timeout="auto"
                      unmountOnExit
                    >
                      <Box sx={{ p: 2, backgroundColor: "#fafafa" }}>
                        {!categoriesByGroup || categoriesByGroup.length === 0 ? (
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            sx={{ textAlign: "center", py: 2 }}
                          >
                            No categories in this group
                          </Typography>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: "bold" }}>
                                  Category Name
                                </TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>
                                  Description
                                </TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>
                                  Fiscal Years
                                </TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>
                                  Actions
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {categoriesByGroup.map((category) => (
                                <TableRow key={category._id}>
                                  <TableCell>{category.name}</TableCell>
                                  <TableCell>{category.description}</TableCell>
                                  <TableCell>
                                    <Box
                                      sx={{
                                        display: "flex",
                                        gap: 0.5,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      {category.fiscalYears &&
                                      category.fiscalYears.length > 0 ? (
                                        category.fiscalYears.map((fy) => (
                                          <Chip
                                            key={fy._id}
                                            label={fy.year}
                                            size="small"
                                          />
                                        ))
                                      ) : (
                                        <Typography
                                          variant="caption"
                                          color="textSecondary"
                                        >
                                          None
                                        </Typography>
                                      )}
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Box
                                      sx={{
                                        display: "flex",
                                        gap: 0.5,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <IconButton
                                        size="small"
                                        title="Copy category"
                                        onClick={() =>
                                          handleOpenCopyDialog(category)
                                        }
                                        color="primary"
                                      >
                                        <FileCopyIcon fontSize="small" />
                                      </IconButton>
                                      {hasDelete && (
                                        <IconButton
                                          size="small"
                                          title="Delete category"
                                          onClick={() =>
                                            deleteCategory.mutate(category._id)
                                          }
                                          color="error"
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      )}
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Copy Category Dialog */}
      <Dialog
        open={openCopyDialog}
        onClose={handleCloseCopyDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Copy Category</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Template:</strong> {selectedCategory?.name}
              </Typography>
              {selectedCategory?.description && (
                <Typography variant="body2" color="textSecondary">
                  {selectedCategory.description}
                </Typography>
              )}
            </Box>

            <TextField
              fullWidth
              label="New Category Name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Enter new category name"
              autoFocus
            />

            {selectedCategory?.fiscalYears &&
              selectedCategory.fiscalYears.length > 0 && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }} gutterBottom>
                    Fiscal Years to Link:
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {selectedCategory.fiscalYears.map((fy) => (
                      <Chip
                        key={fy._id}
                        label={fy.fiscalYearCode}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCopyDialog}>Cancel</Button>
          <Button
            onClick={handleCopyConfirm}
            variant="contained"
            disabled={copyCategory.isPending}
          >
            {copyCategory.isPending ? "Copying..." : "Copy"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GroupedIncomeCategoriesTable;