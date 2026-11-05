import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CustomMenu from '../pspermanent/PersonnelCustomMenu';
import PropTypes from 'prop-types';
import {
  Button,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Checkbox,
  Paper,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  useTheme,
} from '@mui/material';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../../config/api';
import { useRegion } from '../../context/RegionContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import RefreshIcon from '@mui/icons-material/Refresh';
import { updatePersonnelChargedToIncome } from '../../services/personnelSubsidyService';
import { useSearch } from '../../context/SearchContext';
import dayjs from 'dayjs';
import formatCurrency from '../../utils/formatCurrency';

const PersonnelChargedToIncomeTable = ({
  dataListName,
  schema,
  hasEdit = true,
  hasDelete = true,
  customEditElement = null,
  additionalMenuOptions = [],
  ROWS_PER_PAGE = 20,
  locked = false,
  proposalId = null,
}) => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filteredRows, setFilteredRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [chargedToIncomeDialog, setChargedToIncomeDialog] = useState({
    open: false,
    mode: 'remove',
    amount: '',
    notes: '',
  });
  const [chargedToIncomeLoading, setChargedToIncomeLoading] = useState(false);
  const [order] = useState('desc');
  const [orderBy] = useState('createdAt');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();
  const { searchValue } = useSearch();

  const apiPath = useMemo(() => '/personnelServices', []);

  // Initialize column visibility
  useEffect(() => {
    const initialVisibility = {};
    Object.keys(schema).forEach(key => {
      initialVisibility[key] = schema[key].show !== false;
    });
    setColumnVisibility(initialVisibility);
  }, [schema]);

  // Active settings for fiscal year (for list/reset scope)
  const { data: activeSettings } = useQuery({
    queryKey: ['settings', 'active'],
    queryFn: () => api.get('/settings/active').then(r => r.data),
  });
  const fiscalYearForScope = activeSettings?.fiscalYear || '';
  const regionForScope =
    activeRegion?.name || activeRegion?.regionName || activeRegion?.Region || '';

  // List charged-to-income (count + total) for info and reset
  const { data: chargedListData, refetch: refetchChargedList } = useQuery({
    queryKey: ['chargedToIncomeList', fiscalYearForScope, regionForScope, proposalId],
    queryFn: () => {
      const params = {};
      if (fiscalYearForScope) params.fiscalYear = fiscalYearForScope;
      if (regionForScope) params.region = regionForScope;
      if (proposalId) params.proposalId = proposalId;
      return api.get('/personnelServices/charged-to-income/list', { params }).then(r => r.data);
    },
    enabled: true,
  });
  const chargedListCount = chargedListData?.count ?? 0;
  const chargedListTotal = chargedListData?.totalAmount ?? 0;

  const [resetLoading, setResetLoading] = useState(false);
  const handleResetAllChargedToIncome = useCallback(async () => {
    if (chargedListCount === 0) {
      toast.info('Walang record na naka-charged to income.');
      return;
    }
    if (
      !window.confirm(
        `I-reset ang lahat ng ${chargedListCount} record(s) na naka-charged to income? Ibabalik sila sa Personnel Services.`
      )
    )
      return;
    setResetLoading(true);
    try {
      const body = {};
      if (fiscalYearForScope) body.fiscalYear = fiscalYearForScope;
      if (regionForScope) body.region = regionForScope;
      if (proposalId) body.proposalId = proposalId;
      const res = await api.post('/personnelServices/charged-to-income/reset', body);
      toast.success(res.data?.message || 'Na-reset na ang charged-to-income.');
      await queryClient.invalidateQueries({ queryKey: [dataListName, 'chargedToIncome'] });
      await queryClient.invalidateQueries({ queryKey: ['chargedToIncomeList'] });
      await queryClient.invalidateQueries({ queryKey: ['calculated-budgetary-support'] });
      await queryClient.invalidateQueries({ queryKey: ['proposals'] });
      await queryClient.invalidateQueries({ queryKey: ['workflowProposals'] });
      refetch();
      refetchChargedList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hindi na-reset.');
    } finally {
      setResetLoading(false);
    }
  }, [
    chargedListCount,
    fiscalYearForScope,
    regionForScope,
    queryClient,
    dataListName,
    refetchChargedList,
  ]);

  // Fetch charged to income personnel data
  const { data, isLoading, refetch } = useQuery({
    queryKey: [dataListName, 'chargedToIncome', page, rowsPerPage, orderBy, order, searchValue, proposalId],
    queryFn: async () => {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        orderBy,
        order,
        chargedToIncomeEligible: true,
      };

      if (searchValue) {
        params.search = searchValue;
      }

      if (proposalId) {
        params.proposalId = proposalId;
      }

      Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
      // console.log("DEBUG: Fetching charged to income with params:", { dataListName, params });
      const res = await api.get(apiPath, { params });
      // console.log("DEBUG: Full API response:", res.data);
      // console.log("DEBUG: Received data from API:", { totalRecords: res.data?.total, dataLength: res.data?.data?.length, keys: Object.keys(res.data || {}) });
      return res.data;
    },
    staleTime: 10000,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (data) {
      // Handle both response structures:
      // 1. { data: [...], total: X } - standard structure
      // 2. { personnelServices: [...], totalRecords: X, totalPages: X, currentPage: X } - API structure
      const personnel = data.data || data.personnelServices || [];
      // console.log("DEBUG: Setting filteredRows with", personnel.length, "records");
      setFilteredRows(personnel);
    }
  }, [data]);

  const handleOpenRemoveDialog = useCallback(() => {
    if (!selectedRows.length) {
      toast.error('No personnel selected.');
      return;
    }
    setChargedToIncomeDialog({ open: true, mode: 'remove', amount: '', notes: '' });
  }, [selectedRows]);

  const handleOpenAllocationDialog = useCallback(() => {
    if (!selectedRows.length) {
      toast.error('No personnel selected.');
      return;
    }
    const selectedAmounts = filteredRows
      .filter((row) => selectedRows.includes(row._id))
      .map((row) => Number(row.chargedToIncomeMonthlyAmount) || 0)
      .filter((amount) => amount > 0);
    const uniqueAmounts = [...new Set(selectedAmounts)];

    setChargedToIncomeDialog({
      open: true,
      mode: 'update',
      amount: uniqueAmounts.length === 1 ? String(uniqueAmounts[0]) : '',
      notes: '',
    });
  }, [filteredRows, selectedRows]);

  const handleCloseRemoveDialog = () => {
    setChargedToIncomeDialog({ open: false, mode: 'remove', amount: '', notes: '' });
  };

  const handleConfirmAllocation = async () => {
    const monthlyAllocation = Number(chargedToIncomeDialog.amount);
    if (!Number.isFinite(monthlyAllocation) || monthlyAllocation <= 0) {
      toast.error('Enter a valid monthly Income allocation greater than zero.');
      return;
    }

    setChargedToIncomeLoading(true);
    try {
      const response = await updatePersonnelChargedToIncome({
        items: selectedRows.map((id) => ({
          _id: id,
          chargedToIncomeMonthlyAmount: monthlyAllocation,
          chargedToIncomeAmount: monthlyAllocation * 12,
        })),
        chargedToIncomeEligible: true,
        notes: chargedToIncomeDialog.notes.trim() || undefined,
      });

      const skipped = response?.data?.skipped || [];
      if (skipped.length) {
        toast.warning(`${response.data.updatedCount} updated, ${skipped.length} skipped: ${skipped[0].reason}`);
      } else {
        toast.success(`Income allocation updated for ${selectedRows.length} employee(s)`);
      }
      setSelectedRows([]);
      handleCloseRemoveDialog();
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['proposals'] });
      await queryClient.invalidateQueries({ queryKey: ['calculated-budgetary-support'] });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update Income allocation');
    } finally {
      setChargedToIncomeLoading(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!selectedRows.length) {
      toast.error('No personnel selected.');
      return;
    }

    setChargedToIncomeLoading(true);
    try {
      const payload = {
        items: selectedRows.map(id => ({ _id: id })),
        chargedToIncomeEligible: false,
      };

      const response = await updatePersonnelChargedToIncome(payload);
      const result = response?.data || {};
      const skipped = Array.isArray(result.skipped) ? result.skipped : [];
      const updatedCount = Number(result.updatedCount) || 0;

      if (updatedCount === 0) {
        const reason = skipped[0]?.reason;
        toast.warning(reason ? `Walang naalis: ${reason}` : 'Walang personnel na naalis sa Charged to Income.');
        return;
      }

      const skippedIds = new Set(skipped.map(item => String(item.id || '')).filter(Boolean));
      setSelectedRows(selectedRows.filter(id => skippedIds.has(String(id))));
      setChargedToIncomeDialog({ open: false, mode: 'remove', amount: '', notes: '' });

      if (skipped.length > 0) {
        toast.warning(`${updatedCount} naalis; ${skipped.length} hindi naalis: ${skipped[0].reason || 'Hindi pinayagan ng server.'}`);
      } else {
        toast.success(`${updatedCount} employee(s) moved back to Personnel Services`);
      }

      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['chargedToIncomeList'] });
      await queryClient.invalidateQueries({ queryKey: ['calculated-budgetary-support'] });
      await queryClient.invalidateQueries({ queryKey: ['proposals'] });
      await queryClient.invalidateQueries({ queryKey: ['workflowProposals'] });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove charged to income tag');
    } finally {
      setChargedToIncomeLoading(false);
    }
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = event => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSelectRow = id => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = event => {
    if (event.target.checked) {
      setSelectedRows(filteredRows.map(row => row._id));
    } else {
      setSelectedRows([]);
    }
  };

  const renderCellValue = (row, fieldName) => {
    const fieldSchema = schema[fieldName];
    if (!fieldSchema) return '';

    const value = row[fieldName];

    if (fieldSchema.customRender) {
      return fieldSchema.customRender(row);
    }

    if (fieldSchema.type === 'number') {
      return typeof value === 'number' ? formatCurrency(value) : value || 0;
    }

    if (fieldSchema.type === 'date' && value) {
      return dayjs(value).format('MM/DD/YYYY');
    }

    return value || '';
  };

  const enhancedMenuOptions = useMemo(() => {
    const defaultMenuOptions = [];
    if (additionalMenuOptions) {
      defaultMenuOptions.push(...additionalMenuOptions);
    }
    return defaultMenuOptions;
  }, [additionalMenuOptions]);

  return (
    <>
      {chargedListCount > 0 && (
        <Card sx={{ mb: 2, bgcolor: '#fff8e1', border: '1px solid #ffc107' }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              There are <strong>{chargedListCount}</strong> record(s) charged to Income (Total:{' '}
              {formatCurrency(chargedListTotal)}). If you didn't mean to do that, you can reset
              everything to move it back to Personnel Services.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={handleResetAllChargedToIncome}
              disabled={resetLoading}
            >
              {resetLoading ? 'Resetting...' : 'Reset all (return to Personnel Services)'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleOpenAllocationDialog}
          disabled={selectedRows.length === 0 || locked}
        >
          UPDATE INCOME ALLOCATION
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<RefreshIcon />}
          onClick={handleOpenRemoveDialog}
          disabled={selectedRows.length === 0}
        >
          REMOVE FROM CHARGED TO INCOME
        </Button>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
          REFRESH
        </Button>
      </Box>

      {!isLoading && filteredRows.length === 0 && (
        <Alert severity="info">
          No personnel charged to Income. Set the Salary Income Allocation in PS-Permanent
          to automatically apply it to permanent personnel. For casual personnel, use "Charge to Income" in PS-Casual.
        </Alert>
      )}

      <Dialog
        open={chargedToIncomeDialog.open}
        onClose={handleCloseRemoveDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {chargedToIncomeDialog.mode === 'update'
            ? 'Update CPCS2 Income Allocation'
            : 'Remove Charged to Income Tag'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {chargedToIncomeDialog.mode === 'update'
              ? `Set the monthly Income-funded salary for ${selectedRows.length.toLocaleString('en-US')} selected personnel. The remaining Personnel Services cost stays under Subsidy.`
              : `Remove ${selectedRows.length.toLocaleString('en-US')} personnel from Charged to Income?`}
          </Typography>
          {chargedToIncomeDialog.mode === 'update' && (
            <>
              <TextField
                autoFocus
                required
                fullWidth
                type="number"
                label="Monthly Income Allocation"
                value={chargedToIncomeDialog.amount}
                onChange={(event) => setChargedToIncomeDialog((previous) => ({
                  ...previous,
                  amount: event.target.value,
                }))}
                inputProps={{ min: 0, step: '0.01' }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                }}
                helperText={`Annual Income charge: ${formatCurrency((Number(chargedToIncomeDialog.amount) || 0) * 12)}`}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Notes (optional)"
                value={chargedToIncomeDialog.notes}
                onChange={(event) => setChargedToIncomeDialog((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRemoveDialog} disabled={chargedToIncomeLoading}>
            Cancel
          </Button>
          <Button
            onClick={chargedToIncomeDialog.mode === 'update' ? handleConfirmAllocation : handleConfirmRemove}
            variant="contained"
            color={chargedToIncomeDialog.mode === 'update' ? 'primary' : 'error'}
            disabled={chargedToIncomeLoading}
          >
            {chargedToIncomeLoading
              ? 'Processing...'
              : chargedToIncomeDialog.mode === 'update'
                ? 'Save Allocation'
                : 'Confirm Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table sx={{ minWidth: 900 }}>
          <TableHead sx={{ bgcolor: headerBg }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                <Checkbox
                  checked={selectedRows.length === filteredRows.length && filteredRows.length > 0}
                  indeterminate={
                    selectedRows.length > 0 && selectedRows.length < filteredRows.length
                  }
                  onChange={handleSelectAll}
                  sx={{ color: 'white' }}
                />
              </TableCell>
              {Object.keys(schema)
                .filter(
                  key =>
                    columnVisibility[key] !== false &&
                    (schema[key].show === true || key === 'action')
                )
                .map(key => (
                  <TableCell
                    key={key}
                    sx={{
                      color: 'white',
                      fontWeight: 'bold',
                      ...(key === 'employeeFullName' && {
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        backgroundColor: headerBg,
                        minWidth: 220,
                      }),
                    }}
                  >
                    {schema[key].label}
                  </TableCell>
                ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`loading-${idx}`}>
                  <TableCell
                    colSpan={
                      Object.keys(schema).filter(key => columnVisibility[key] !== false).length + 1
                    }
                    sx={{ height: 50 }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        bgcolor: '#f0f0f0',
                        animation: 'pulse 1s infinite',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredRows.length > 0 ? (
              filteredRows.map(row => (
                <TableRow key={row._id} hover>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.includes(row._id)}
                      onChange={() => handleSelectRow(row._id)}
                    />
                  </TableCell>
                  {Object.keys(schema)
                    .filter(
                      key =>
                        columnVisibility[key] !== false &&
                        (schema[key].show === true || key === 'action')
                    )
                    .map(key => (
                      <TableCell
                        key={key}
                        sx={key === 'employeeFullName' ? {
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          backgroundColor: 'background.paper',
                          minWidth: 220,
                        } : undefined}
                      >
                        {key === 'action' ? (
                          <CustomMenu
                            additionalMenuOptions={enhancedMenuOptions}
                            customEditElement={customEditElement}
                            hasEdit={hasEdit}
                            hasDelete={hasDelete}
                            row={row}
                            schema={schema}
                            endpoint={apiPath}
                            dataListName={dataListName}
                            disableEdit={row.status === 'Submitted' || row.status === 'Approved'}
                            disableDelete={row.status === 'Submitted' || row.status === 'Approved'}
                          />
                        ) : (
                          renderCellValue(row, key)
                        )}
                      </TableCell>
                    ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={
                    Object.keys(schema).filter(key => columnVisibility[key] !== false).length + 1
                  }
                  sx={{ textAlign: 'center', py: 3 }}
                >
                  <Typography color="textSecondary">No personnel found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 20, 50]}
        component="div"
        count={data?.total || data?.totalRecords || 0}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />

    </>
  );
};

PersonnelChargedToIncomeTable.propTypes = {
  dataListName: PropTypes.string.isRequired,
  schema: PropTypes.objectOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      show: PropTypes.bool,
      searchable: PropTypes.bool,
      customRender: PropTypes.func,
      default: PropTypes.any,
      alignRight: PropTypes.bool,
    })
  ).isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  hasEdit: PropTypes.bool,
  hasDelete: PropTypes.bool,
  customEditElement: PropTypes.elementType,
  additionalMenuOptions: PropTypes.array,
  ROWS_PER_PAGE: PropTypes.number,
  locked: PropTypes.bool,
  proposalId: PropTypes.string,
};

export default PersonnelChargedToIncomeTable;
