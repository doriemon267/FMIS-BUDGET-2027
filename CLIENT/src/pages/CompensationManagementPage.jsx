import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress
} from "@mui/material";
import {
  MdAddCircle,
  MdEdit,
  MdDelete,
  MdLink,
  MdRefresh,
  MdMoreVert,
  MdAttachMoney,
  MdWarning,
  MdCalendarToday
} from "react-icons/md";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../config/api";
import { toast } from "react-hot-toast";
import CompensationStandaloneDialog from "../components/settings/CompensationStandaloneDialog";
import LinkCompensationToFiscalYearsDialog from "../components/settings/LinkCompensationToFiscalYearsDialog";

const CompensationManagementPage = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedForLinking, setSelectedForLinking] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch all compensation settings
  const { data: compensationList = [], isLoading, refetch } = useQuery({
    queryKey: ["compensationList"],
    queryFn: async () => {
      try {
        const response = await api.get("/compensation");
        // Handle multiple response formats from backend
        let data = response.data?.compensationSettings || response.data?.data || response.data || [];
        console.log("Compensation data fetched:", data);
        
        // Ensure linkedFiscalYears and linkedBudgetTypes exist for all records
        if (Array.isArray(data)) {
          data = data.map(item => ({
            ...item,
            linkedFiscalYears: item.linkedFiscalYears || [],
            linkedBudgetTypes: item.linkedBudgetTypes || [] // ✅ Include linkedBudgetTypes
          }));
        }
        
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Failed to fetch compensation settings:", error);
        return [];
      }
    }
  });

  // Delete compensation
  const deleteMutation = useMutation({
    mutationFn: async (compensationId) => {
      return api.delete(`/compensation/${compensationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["compensationList"]);
      toast.success("Compensation deleted successfully");
      setDeleteConfirmOpen(false);
      setToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to delete compensation");
    }
  });

  const handleAddCompensation = () => {
    setSelectedData(null);
    setDialogOpen(true);
  };

  const handleEditCompensation = (data) => {
    setSelectedData(data);
    setDialogOpen(true);
  };

  const handleLinkFiscalYears = (compensation) => {
    setSelectedForLinking(compensation);
    setLinkDialogOpen(true);
  };

  const handleDeleteCompensation = (compensation) => {
    setToDelete(compensation);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (toDelete) {
      deleteMutation.mutate(toDelete._id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedData(null);
    refetch();
  };

  const handleLinkDialogClose = () => {
    setLinkDialogOpen(false);
    setSelectedForLinking(null);
    refetch();
  };



  // Summary Cards
  const SummaryCards = () => {
    const linkedCount = compensationList.filter(c => c.linkedFiscalYears?.length > 0).length;
    const totalFYLinks = compensationList.reduce((sum, c) => sum + (c.linkedFiscalYears?.length || 0), 0);

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Total Compensation Settings
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="primary">
                  {compensationList.length}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Linked to Fiscal Years
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {linkedCount}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Total FY Links
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="info.main">
                  {totalFYLinks}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Not Yet Linked
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="warning.main">
                  {compensationList.length - linkedCount}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: "white"
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <MdAttachMoney size={32} />
              Compensation Management
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Create and manage reusable compensation settings. Link them to multiple fiscal years.
            </Typography>
          </Box>

          <Stack direction="row" spacing={2}>
            <Tooltip title="Refresh Data">
              <IconButton
                onClick={() => refetch()}
                sx={{
                  color: "white",
                  backgroundColor: alpha("#fff", 0.1),
                  "&:hover": { backgroundColor: alpha("#fff", 0.2) }
                }}
              >
                <MdRefresh />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Summary Cards */}
      {!isLoading && <SummaryCards />}

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Workflow:</strong> Create compensation settings independently (no fiscal year required),
          then link them to one or more fiscal years. You can reuse the same compensation for multiple fiscal years.
        </Typography>
      </Alert>

      {/* Add Compensation Button */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<MdAddCircle />}
          onClick={handleAddCompensation}
          sx={{
            background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
            boxShadow: `0 3px 5px 2px ${alpha(theme.palette.primary.main, 0.3)}`
          }}
        >
          ADD COMPENSATION SETTINGS
        </Button>
      </Stack>

      {/* Compensation Table */}
      <Paper sx={{ p: 0, borderRadius: 2, overflow: "hidden" }}>
        {isLoading ? (
          <Box sx={{ p: 3, textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
            <CircularProgress />
          </Box>
        ) : compensationList.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <MdWarning size={48} color={theme.palette.warning.main} style={{ margin: "0 auto 16px" }} />
            <Typography variant="body2" color="text.secondary">
              No compensation settings created yet. Click "ADD COMPENSATION SETTINGS" to create one.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table sx={{ minWidth: 650 }}>
                <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>PERA</TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>Medical Allowance</TableCell>
                    <TableCell align="center" sx={{ fontWeight: "bold" }}>PhilHealth %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: "bold" }}>Budget Type</TableCell>
                    <TableCell align="center" sx={{ fontWeight: "bold" }}>Linked FY</TableCell>
                    <TableCell align="center" sx={{ fontWeight: "bold" }}>Created</TableCell>
                    <TableCell align="center" sx={{ fontWeight: "bold" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {compensationList
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((row) => (
                      <TableRow
                        key={row._id}
                        sx={{
                          "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
                          borderBottom: `1px solid ${theme.palette.divider}`
                        }}
                      >
                        <TableCell>
                          <Stack spacing={0.5}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {row.name}
                            </Typography>
                            {row.description && (
                              <Typography variant="caption" color="text.secondary">
                                {row.description}
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          ₱{(row.PERA || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right">
                          ₱{(row.medicalAllowance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center">
                          {((row.philhealthPremium || 0) * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell align="center">
                          {(row.linkedBudgetTypes && row.linkedBudgetTypes.length > 0) ? (
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", justifyContent: "center" }}>
                              {row.linkedBudgetTypes.map((bt, idx) => (
                                <Chip
                                  key={idx}
                                  label={bt}
                                  color="secondary"
                                  variant="outlined"
                                  size="small"
                                />
                              ))}
                            </Box>
                          ) : (
                            <Chip
                              label="Not Linked"
                              color="default"
                              variant="outlined"
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {(() => {
                            const count = (Array.isArray(row.linkedFiscalYears) && row.linkedFiscalYears.length) || 0;
                            return (
                              <Chip
                                icon={<MdCalendarToday />}
                                label={count === 0 ? "Not linked" : `${count} FY`}
                                color={count === 0 ? "default" : "primary"}
                                variant={count === 0 ? "outlined" : "filled"}
                                size="small"
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell align="center">
                          {new Date(row.createdAt).toLocaleDateString('en-PH')}
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Edit Compensation">
                              <IconButton
                                size="small"
                                onClick={() => handleEditCompensation(row)}
                                sx={{
                                  color: theme.palette.primary.main,
                                  "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.1) }
                                }}
                              >
                                <MdEdit size={18} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Link to Fiscal Years">
                              <IconButton
                                size="small"
                                onClick={() => handleLinkFiscalYears(row)}
                                sx={{
                                  color: theme.palette.success.main,
                                  "&:hover": { backgroundColor: alpha(theme.palette.success.main, 0.1) }
                                }}
                              >
                                <MdLink size={18} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Delete Compensation">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteCompensation(row)}
                                sx={{
                                  color: theme.palette.error.main,
                                  "&:hover": { backgroundColor: alpha(theme.palette.error.main, 0.1) }
                                }}
                              >
                                <MdDelete size={18} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={compensationList.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Paper>

      {/* Create/Edit Compensation Dialog */}
      <CompensationStandaloneDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editData={selectedData}
        onSaved={handleDialogClose}
      />

      {/* Link Fiscal Years Dialog */}
      {selectedForLinking && (
        <LinkCompensationToFiscalYearsDialog
          open={linkDialogOpen}
          onClose={handleLinkDialogClose}
          compensationId={selectedForLinking._id}
          compensationName={selectedForLinking.name}
          onSaved={handleLinkDialogClose}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{toDelete?.name}</strong>?
          </Typography>
          {Array.isArray(toDelete?.linkedFiscalYears) && toDelete.linkedFiscalYears.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This compensation is linked to {toDelete.linkedFiscalYears.length} fiscal year(s).
              They will be unlinked automatically.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CompensationManagementPage;