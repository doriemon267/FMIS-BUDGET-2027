import React, { useState, useEffect, useCallback, useMemo } from "react";
import CustomTable from "../pspermanent/PersonnelCustomTable";
import CustomMenu from "../pspermanent/PersonnelCustomMenu";
import PropTypes from "prop-types";
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
  CircularProgress,
  Checkbox,
  Paper,
} from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "../../config/api";
import { useRegion } from "../../context/RegionContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { invalidateDataList } from "../../utils/queryClientHelpers";
import RefreshIcon from '@mui/icons-material/Refresh';
import { updatePersonnelChargedToIncome } from "../../services/personnelSubsidyService";
import { useSearch } from "../../context/SearchContext";
import dayjs from "dayjs";
import formatCurrency from "../../utils/formatCurrency";

const PersonnelChargedToIncomeTable = ({
  dataListName,
  schema,
  title = "",
  description = "",
  hasEdit = true,
  hasDelete = true,
  customEditElement = null,
  additionalMenuOptions = [],
  ROWS_PER_PAGE = 20,
  locked = false,
}) => {
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filteredRows, setFilteredRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [chargedToIncomeDialog, setChargedToIncomeDialog] = useState({ open: false, mode: "remove" });
  const [chargedToIncomeLoading, setChargedToIncomeLoading] = useState(false);
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("createdAt");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();
  const { searchValue } = useSearch();

  const pageTitle = useMemo(() => title || "Personnel Services - Charged to Income", [title]);
  const pageDescription = useMemo(() => description || "Personnel tagged as Charged to Income", [description]);
  const apiPath = useMemo(() => "/personnelServices", []);

  // DEBUG: Log what we're receiving
  useEffect(() => {
    console.log("DEBUG PersonnelChargedToIncomeTable:", {
      dataListName,
      schemaKeys: Object.keys(schema).length,
      title,
      apiPath,
    });
  }, [dataListName, schema, title, apiPath]);

  // Initialize column visibility
  useEffect(() => {
    const initialVisibility = {};
    Object.keys(schema).forEach(key => {
      initialVisibility[key] = schema[key].show !== false;
    });
    setColumnVisibility(initialVisibility);
  }, [schema]);

  const refreshPersonnelData = useCallback(async () => {
    try {
      await invalidateDataList(queryClient, dataListName);
      // Also invalidate the chargedToIncome specific query
      await queryClient.invalidateQueries({
        queryKey: [dataListName, "chargedToIncome"],
      });
    } catch (error) {
      toast.error("Error refreshing data.");
    }
  }, [queryClient, dataListName]);

  // Fetch charged to income personnel data
  const { data, isLoading, refetch } = useQuery({
    queryKey: [dataListName, "chargedToIncome", page, rowsPerPage, orderBy, order, searchValue],
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
      
      Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
      console.log("DEBUG: Fetching charged to income with params:", { dataListName, params });
      const res = await api.get(apiPath, { params });
      console.log("DEBUG: Full API response:", res.data);
      console.log("DEBUG: Received data from API:", { totalRecords: res.data?.total, dataLength: res.data?.data?.length, keys: Object.keys(res.data || {}) });
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
      console.log("DEBUG: Setting filteredRows with", personnel.length, "records");
      setFilteredRows(personnel);
    }
  }, [data]);

  const handleOpenRemoveDialog = useCallback(() => {
    if (!selectedRows.length) {
      toast.error("No personnel selected.");
      return;
    }
    setChargedToIncomeDialog({ open: true, mode: "remove" });
  }, [selectedRows]);

  const handleCloseRemoveDialog = () => {
    setChargedToIncomeDialog({ open: false, mode: "remove" });
  };

  const handleConfirmRemove = async () => {
    if (!selectedRows.length) {
      toast.error("No personnel selected.");
      return;
    }

    setChargedToIncomeLoading(true);
    try {
      const payload = {
        items: selectedRows.map((id) => ({ _id: id })),
        chargedToIncomeEligible: false,
      };

      await updatePersonnelChargedToIncome(payload);
      toast.success(`${selectedRows.length} employee(s) moved back to Personnel Services`);
      setSelectedRows([]);
      setChargedToIncomeDialog({ open: false, mode: "remove" });
      
      // Refresh personnel data
      refetch();
      
      // Invalidate proposal queries so budget totals update
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove charged to income tag");
    } finally {
      setChargedToIncomeLoading(false);
    }
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSelectRow = (id) => {
    setSelectedRows(prev =>
      prev.includes(id)
        ? prev.filter(rowId => rowId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = (event) => {
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
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="error"
          startIcon={<RefreshIcon />}
          onClick={handleOpenRemoveDialog}
          disabled={selectedRows.length === 0}
        >
          REMOVE FROM CHARGED TO INCOME
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
        >
          REFRESH
        </Button>
      </Box>

      {!isLoading && filteredRows.length === 0 && (
        <Alert severity="info">
          No personnel tagged as Charged to Income. Select personnel from PS-Permanent or PS-Casual tabs and use "Charge to Income" button to move them here.
        </Alert>
      )}

      <Dialog
        open={chargedToIncomeDialog.open}
        onClose={handleCloseRemoveDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Remove Charged to Income Tag</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Remove ${selectedRows.length.toLocaleString('en-US')} personnel from Charged to Income?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRemoveDialog} disabled={chargedToIncomeLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmRemove}
            variant="contained"
            color="error"
            disabled={chargedToIncomeLoading}
          >
            {chargedToIncomeLoading ? "Processing..." : "Confirm Remove"}
          </Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#2b4a2c' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                <Checkbox
                  checked={selectedRows.length === filteredRows.length && filteredRows.length > 0}
                  indeterminate={selectedRows.length > 0 && selectedRows.length < filteredRows.length}
                  onChange={handleSelectAll}
                  sx={{ color: 'white' }}
                />
              </TableCell>
              {Object.keys(schema)
                .filter((key) => columnVisibility[key] !== false && (schema[key].show === true || key === "action"))
                .map((key) => (
                  <TableCell key={key} sx={{ color: 'white', fontWeight: 'bold' }}>
                    {schema[key].label}
                  </TableCell>
                ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`loading-${idx}`}>
                  <TableCell colSpan={Object.keys(schema).filter((key) => columnVisibility[key] !== false).length + 1} sx={{ height: 50 }}>
                    <Box sx={{ width: '100%', height: '100%', bgcolor: '#f0f0f0', animation: 'pulse 1s infinite' }} />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredRows.length > 0 ? (
              filteredRows.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.includes(row._id)}
                      onChange={() => handleSelectRow(row._id)}
                    />
                  </TableCell>
                  {Object.keys(schema)
                    .filter((key) => columnVisibility[key] !== false && (schema[key].show === true || key === "action"))
                    .map((key) => (
                      <TableCell key={key}>
                        {key === "action" ? (
                          <CustomMenu
                            additionalMenuOptions={enhancedMenuOptions}
                            customEditElement={customEditElement}
                            hasEdit={hasEdit}
                            hasDelete={hasDelete}
                            row={row}
                            schema={schema}
                            endpoint={apiPath}
                            dataListName={dataListName}
                            disableEdit={row.status === "Submitted" || row.status === "Approved"}
                            disableDelete={row.status === "Submitted" || row.status === "Approved"}
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
                <TableCell colSpan={Object.keys(schema).filter((key) => columnVisibility[key] !== false).length + 1} sx={{ textAlign: 'center', py: 3 }}>
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

      <ToastContainer />
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
};

export default PersonnelChargedToIncomeTable;
