import React, { useEffect, useState } from "react";
import { useRegion } from "../../context/RegionContext";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Popover,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
  Zoom,
  Fade,
  CircularProgress,
} from "@mui/material";
import {
  blueGrey,
  green,
  grey
} from "@mui/material/colors";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { TiFilter } from "react-icons/ti";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import TableBodyLoading from "../../global/components/TableBodyLoading";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";
import { formatDateToMDY, isValidDate } from "../../utils/formatDate";

const PermanentCustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "",
  orderByDefault = "updatedAt",
  onDataChange,
  selectedRows = [],
  onRowSelectionChange,
}) => {
  const { searchValue, setSearchValue } = useSearch();
  const TEN_SECONDS_AGO = dayjs().subtract(10, "second");

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState(orderByDefault);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [focusedCell, setFocusedCell] = useState(null);
  const [fieldAndValue, setFieldAndValue] = useState({
    field: "",
    value: "",
    label: "",
    operator: "=",
  });
  const [totals, setTotals] = useState({});
  const [grandTotal, setGrandTotal] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [dataListName, page, rowsPerPage, orderBy, order, fieldAndValue, searchValue],
    queryFn: async () => {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        orderBy,
        order,
        statusOfAppointment: "PERMANENT",
      };
      
      // Only add search if it has a value
      if (searchValue) {
        params.search = searchValue;
      }
      
      // Only add field filter and operator if field is specified
      if (fieldAndValue.field) {
        params[fieldAndValue.field] = fieldAndValue.value || undefined;
        params.operator = fieldAndValue.operator;
      }
      
      // Clean undefined to avoid sending "undefined" strings
      Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
      const res = await api.get(apiPath, { params });
      return res.data;
    },
    staleTime: 10000,
    keepPreviousData: true,
  });

  useEffect(() => {
    const handleRefetch = () => {
      if (fieldAndValue.value && fieldAndValue.field === "date") {
        setPage(0);
        setRowsPerPage(ROWS_PER_PAGE);
        if (isValidDate(fieldAndValue.value)) refetch();
      } else if (searchValue && searchValue.split("-").length === 3) {
        if (isValidDate(searchValue)) refetch();
      } else {
        setPage(0);
        setRowsPerPage(ROWS_PER_PAGE);
        const debouncedSearch = setTimeout(() => {
          refetch();
        }, 500);
        return () => clearTimeout(debouncedSearch);
      }
    };
    handleRefetch();
  }, [searchValue, fieldAndValue]);

  useEffect(() => {
    const debouncedSearch = setTimeout(() => {
      refetch();
    }, 500);
    return () => clearTimeout(debouncedSearch);
  }, [order, orderBy, rowsPerPage]);

  useEffect(() => {
    if (searchValue && (fieldAndValue.field || fieldAndValue.label || fieldAndValue.value)) {
      setFieldAndValue({ field: "", label: "", value: "" });
    }
  }, [searchValue]);

  useEffect(() => {
    if (fieldAndValue.value && searchValue) {
      setSearchValue("");
    }
  }, [fieldAndValue.value]);

  useEffect(() => {
    if (data && data[dataListName]) {
      const newTotals = columns.reduce((acc, column) => {
        if (column.type === "number") {
          acc[column.field] = data[dataListName].reduce(
            (sum, row) => sum + (row[column.field] || 0),
            0
          );
        }
        return acc;
      }, {});
      setTotals(newTotals);
      if (onDataChange) {
        onDataChange(data[dataListName]);
      }
    }
  }, [data, columns, dataListName, onDataChange]);

  // Get the active region
  const { activeRegion } = useRegion();
  const [regionFilter, setRegionFilter] = useState("");
  
  // Update region filter when active region changes
  useEffect(() => {
    if (activeRegion) {
      const regionName = activeRegion.name || activeRegion.regionName;
      setRegionFilter(regionName);
    } else {
      setRegionFilter("Central Office");
    }
  }, [activeRegion]);

  useEffect(() => {
    const fetchGrandTotal = async () => {
      try {
        // Build params mirroring table filters to keep totals in sync
        const params = new URLSearchParams();
        if (regionFilter) params.append('region', regionFilter);
        if (searchValue) params.append('search', searchValue);
        if (fieldAndValue?.field && fieldAndValue?.value) {
          params.append(fieldAndValue.field, fieldAndValue.value);
          if (fieldAndValue.operator) params.append('operator', fieldAndValue.operator);
        }
        if (orderBy) params.append('orderBy', orderBy);
        if (order) params.append('order', order);

        const response = await api.get(`/grandtotalPermanent?${params.toString()}`);
        setGrandTotal(response.data.grandTotal || 0);
      } catch (error) {
        console.error("Error fetching grand total:", error);
      }
    };
    fetchGrandTotal();
  }, [page, rowsPerPage, orderBy, order, fieldAndValue, searchValue, regionFilter]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleFilterClick = (event, columnKey, columnLabel) => {
    setFilterAnchorEl(event.currentTarget);
    if (fieldAndValue.field !== columnKey)
      setFieldAndValue({ field: columnKey, value: "", label: columnLabel });
  };

  const handleFilterClearValue = () =>
    setFieldAndValue((prev) => ({ ...prev, value: "" }));
  const handleFilterClose = () => setFilterAnchorEl(null);

  const handleCellClick = (rowIndex, columnKey, _id) => {
    setFocusedCell({ rowIndex, columnKey, _id });
  };

  // Row selection handlers - Select ALL records, not just visible ones
  const handleSelectAllClick = async (event) => {
    if (event.target.checked) {
      try {
        // Fetch all permanent personnel IDs
        const response = await api.get(apiPath, {
          params: {
            statusOfAppointment: "PERMANENT",
            limit: 10000, // Get all records
            selectFields: "_id" // Only get IDs for performance
          }
        });

        if (response.data && response.data[dataListName]) {
          const allIds = response.data[dataListName].map(row => row._id);
          onRowSelectionChange && onRowSelectionChange(allIds);
        } else {
          // Fallback to visible data if API doesn't support selectFields
          const newSelected = tableData.map((row) => row._id);
          onRowSelectionChange && onRowSelectionChange(newSelected);
        }
      } catch (error) {
        console.error("Error fetching all records for selection:", error);
        // Fallback to visible data
        const newSelected = tableData.map((row) => row._id);
        onRowSelectionChange && onRowSelectionChange(newSelected);
      }
    } else {
      onRowSelectionChange && onRowSelectionChange([]);
    }
  };

  const handleRowClick = (event, id) => {
    if (event.target.type === 'checkbox') return; // Don't trigger on checkbox click

    const selectedIndex = selectedRows.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedRows, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedRows.slice(1));
    } else if (selectedIndex === selectedRows.length - 1) {
      newSelected = newSelected.concat(selectedRows.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedRows.slice(0, selectedIndex),
        selectedRows.slice(selectedIndex + 1),
      );
    }

    onRowSelectionChange && onRowSelectionChange(newSelected);
  };

  const isSelected = (id) => selectedRows.indexOf(id) !== -1;

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDateChange = (e) => {
    let inputValue = e.target.value;
    if (!inputValue) return;
    const [year, month, day] = inputValue.split("-");
    const formattedValue = `${month}-${day}-${year}`;
    setFieldAndValue((prev) => ({ ...prev, value: formattedValue }));
  };

  const getFormattedValue = () => {
    if (!fieldAndValue.value) return "";
    const [month, day, year] = fieldAndValue.value.split("-");
    return `${year}-${month}-${day}`;
  };

  const renderFilter = () => {
    const column = columns.find((col) => col.field === fieldAndValue.field);
    if (!column) return null;

    const commonProps = {
      size: "small",
      fullWidth: true,
    };

    switch (column.type) {
      case "date":
        return (
          <>
            <TextField
              {...commonProps}
              type="date"
              value={getFormattedValue()}
              onChange={handleDateChange}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
            {fieldAndValue.value && (
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={handleFilterClearValue}
                sx={{ my: 1 }}
              >
                Clear
              </Button>
            )}
          </>
        );
      case "number":
        return (
          <>
            <Select
              {...commonProps}
              value={fieldAndValue.operator || "="}
              onChange={(e) =>
                setFieldAndValue((prev) => ({
                  ...prev,
                  operator: e.target.value,
                }))
              }
            >
              {["=", "<", ">", "<=", ">="].map((op) => (
                <MenuItem
                  key={op}
                  sx={{ display: "flex", justifyContent: "space-between" }}
                  value={op}
                >
                  {op === "=" ? "Equal to" : op === "<" ? "Less than" : op === ">" ? "Greater than" : op === "<=" ? "Less than or Equal" : "Greater than or Equal"} <b>{op}</b>
                </MenuItem>
              ))}
            </Select>
            <TextField
              {...commonProps}
              type="number"
              placeholder={`Enter ${fieldAndValue.label}`}
              value={fieldAndValue.value || ""}
              onChange={(e) =>
                setFieldAndValue((prev) => ({ ...prev, value: e.target.value }))
              }
            />
            {fieldAndValue.value && (
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={handleFilterClearValue}
                sx={{ my: 1 }}
              >
                Clear
              </Button>
            )}
          </>
        );
      case "boolean":
        return (
          <>
            <Select
              {...commonProps}
              value={fieldAndValue.value !== undefined ? fieldAndValue.value : ""}
              onChange={(e) =>
                setFieldAndValue((prev) => ({
                  ...prev,
                  value: e.target.value === "true",
                }))
              }
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
            {fieldAndValue.value !== undefined && fieldAndValue.value !== "" && (
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={handleFilterClearValue}
                sx={{ my: 1 }}
              >
                Clear
              </Button>
            )}
          </>
        );
      default:
        return (
          <>
            <TextField
              {...commonProps}
              placeholder={`Search by ${fieldAndValue.label}`}
              value={fieldAndValue.value}
              onChange={(e) =>
                setFieldAndValue((prev) => ({ ...prev, value: e.target.value }))
              }
            />
            {fieldAndValue.value && (
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={handleFilterClearValue}
                sx={{ my: 1 }}
              >
                Clear
              </Button>
            )}
          </>
        );
    }
  };

  const tableData = data && data[dataListName] ? data[dataListName] : [];

  return (
    <>
      {/* Main Table with Zoom Animation */}
      <Zoom in={true} timeout={600}>
        <Box overflow="auto" sx={{ border: "solid thin #fff" }}>
          <Paper sx={{
            width: "100%",
            overflow: "hidden",
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
          }}>
          <TableContainer sx={{
            height: "60vh",
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#c1c1c1',
              borderRadius: '4px',
              '&:hover': {
                background: '#a8a8a8',
              },
            },
          }}>
            <Table size="small" sx={{ borderCollapse: "collapse" }}>
              <TableHead>
                <TableRow>
                  {/* Checkbox column header */}
                  {onRowSelectionChange && (
                    <TableCell
                      sx={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#375e38",
                        zIndex: 1,
                        borderRight: "1px solid",
                        borderColor: grey[500],
                        width: 48,
                        padding: "4px 8px",
                      }}
                    >
                      <Checkbox
                        color="primary"
                        indeterminate={selectedRows.length > 0 && selectedRows.length < (data?.totalRecords || tableData.length)}
                        checked={selectedRows.length > 0 && (selectedRows.length === (data?.totalRecords || tableData.length))}
                        onChange={handleSelectAllClick}
                        sx={{
                          color: "#fff",
                          '&.Mui-checked': {
                            color: "#fff",
                          },
                          '&.MuiCheckbox-indeterminate': {
                            color: "#fff",
                          }
                        }}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.field}
                      sx={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#375e38",
                        zIndex: 1,
                        borderRight: "1px solid",
                        borderColor: grey[500],
                        textAlign: column.type === "number" ? "right" : "left",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <TableSortLabel
                          active={orderBy === column.field}
                          direction={orderBy === column.field ? order : "asc"}
                          onClick={() => handleRequestSort(column.field)}
                          sx={{ flex: 1 }}
                        >
                          {column.label}
                        </TableSortLabel>
                        <Tooltip title={`Filter ${column.label}`}>
                          <IconButton
                            size="small"
                            onClick={(event) =>
                              handleFilterClick(event, column.field, column.label)
                            }
                          >
                            <TiFilter color="lightgray" />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              {isLoading ? (
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={columns.length + (onRowSelectionChange ? 1 : 0)} sx={{ textAlign: 'center', py: 8 }}>
                      <Fade in={isLoading}>
                        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                          <CircularProgress size={40} sx={{ color: '#375e38' }} />
                          <Typography variant="body2" color="text.secondary">
                            Loading personnel data...
                          </Typography>
                        </Box>
                      </Fade>
                    </TableCell>
                  </TableRow>
                </TableBody>
              ) : (
                <TableBody>
                  {tableData.length === 0 ? (
                    <TableRow sx={{ height: "70vh" }}>
                      <TableCell
                        colSpan={columns.length}
                        sx={{ textAlign: "center", fontWeight: "500" }}
                      >
                        {searchValue ? (
                          <>
                            No results found for <b>"{searchValue}"</b>.
                          </>
                        ) : (
                          "No rows found."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableData.map((row, rowIndex) => {
                      const isRecentlyUpdated =
                        row.updatedAt &&
                        dayjs(row.updatedAt).isAfter(TEN_SECONDS_AGO);
                      const isRowSelected = isSelected(row._id);

                      return (
                        <TableRow
                          key={row._id || row.employeeNumber || rowIndex}
                          hover
                          onClick={(event) => handleRowClick(event, row._id)}
                          role="checkbox"
                          aria-checked={isRowSelected}
                          tabIndex={-1}
                          selected={isRowSelected}
                          sx={{
                            backgroundColor: isRowSelected
                              ? "rgba(25, 118, 210, 0.08)"
                              : isRecentlyUpdated
                              ? green[50]
                              : rowIndex % 2 === 0
                              ? blueGrey[50]
                              : "#ffffff",
                            cursor: onRowSelectionChange ? "pointer" : "default",
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: isRowSelected
                                ? "rgba(25, 118, 210, 0.12)"
                                : isRecentlyUpdated
                                ? green[100]
                                : rowIndex % 2 === 0
                                ? blueGrey[100]
                                : "rgba(0, 0, 0, 0.04)",
                              transform: 'translateY(-1px)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }
                          }}
                        >
                          {/* Checkbox column */}
                          {onRowSelectionChange && (
                            <TableCell
                              padding="checkbox"
                              sx={{
                                borderLeft: "1px solid white",
                              }}
                            >
                              <Checkbox
                                color="primary"
                                checked={isRowSelected}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handleRowClick(event, row._id);
                                }}
                              />
                            </TableCell>
                          )}
                          {columns.map((column, i) => (
                            <TableCell
                              key={column.field}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCellClick(rowIndex, column.field, row["_id"]);
                              }}
                              sx={{
                                maxWidth: column.field === "employeeName" ? "none" : "800px",
                                whiteSpace: column.field === "employeeName" ? "normal" : "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                fontWeight: "500",
                                textAlign: column.type === "number" ? "right" : "left",
                                ...(focusedCell &&
                                  focusedCell._id === row["_id"] &&
                                  focusedCell.rowIndex === rowIndex &&
                                  focusedCell.columnKey === column.field && {
                                    outline: "2px solid lightblue",
                                  }),
                                borderLeft:
                                  i !== 0 || onRowSelectionChange
                                    ? rowIndex % 2 === 0
                                      ? "1px solid white"
                                      : `1px solid ${grey[200]}`
                                    : focusedCell &&
                                      focusedCell._id === row["_id"] &&
                                      focusedCell.rowIndex === rowIndex &&
                                      focusedCell.columnKey === column.field,
                              }}
                            >
                              {column.render ? (
                                column.render(row)
                              ) : !column.searchable ? (
                                column.type === "date" ? (
                                  formatDateToMDY(row[column.field])
                                ) : column.type === "number" ? (
                                  formatCurrency(row[column.field])
                                ) : column.type === "boolean" ? (
                                  row[column.field] ? "Yes" : "No"
                                ) : (
                                  row[column.field]
                                )
                              ) : (
                                <TextSearchable
                                  columnName={
                                    column.type === "date"
                                      ? formatDateToMDY(row[column.field])
                                      : column.type === "number"
                                      ? formatCurrency(row[column.field])
                                      : column.type === "boolean"
                                      ? row[column.field]
                                        ? "Yes"
                                        : "No"
                                      : row[column.field]
                                  }
                                />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}

                  {/* Totals Row */}
                  {tableData.length > 0 && (
                    <TableRow
                      sx={{
                        backgroundColor: "#375e38",
                        "& .MuiTableCell-root": {
                          color: "#fff",
                          fontWeight: "bold",
                          borderTop: "2px solid #fff",
                        },
                      }}
                    >
                      {/* Checkbox column for totals row */}
                      {onRowSelectionChange && (
                        <TableCell
                          sx={{
                            backgroundColor: "#375e38",
                            color: "#fff",
                            fontWeight: "bold",
                            textAlign: "center",
                          }}
                        >
                          {selectedRows.length > 0 ? (
                            <Typography variant="caption" sx={{ color: "#fff", fontSize: "10px" }}>
                              {selectedRows.length} / {data?.totalRecords || tableData.length} selected
                            </Typography>
                          ) : (
                            <Typography variant="caption" sx={{ color: "#fff", fontSize: "10px" }}>
                              Select All
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      {columns.map((column, index) => (
                        <TableCell
                          key={column.field}
                          sx={{
                            backgroundColor: "#375e38",
                            color: "#fff",
                            fontWeight: "bold",
                            textAlign: column.type === "number" ? "right" : index === 0 ? "left" : "center",
                          }}
                        >
                          {index === 0 ? (
                            "TOTAL:"
                          ) : column.type === "number" ? (
                            totals[column.field] ? totals[column.field].toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            }) : "0.00"
                          ) : column.field === "action" ? (
                            `${tableData.length} records`
                          ) : (
                            ""
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Paper>
        {!isLoading && (
          <TablePagination
            rowsPerPageOptions={[...new Set([10, ROWS_PER_PAGE, 50])]}
            component="div"
            count={data ? data.totalRecords : 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              backgroundColor: "#375e38",
              "& .MuiTablePagination-root, & .MuiTablePagination-toolbar, & .MuiTablePagination-selectLabel, & .MuiTablePagination-input, & .MuiTablePagination-displayedRows":
                {
                  color: "#fff",
                  fontWeight: 1000,
                  fontSize: 14,
                },
              "& .MuiTablePagination-actions": {
                color: "#fff",
              },
              "& .MuiIconButton-root": {
                color: "#fff",
              },
              "& .MuiSelect-icon": {
                color: "#fff",
              },
            }}
          />
        )}
        <Popover
          open={Boolean(filterAnchorEl)}
          anchorEl={filterAnchorEl}
          onClose={handleFilterClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1 }}>
            <Box sx={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
              Filter by {fieldAndValue.label}
            </Box>
            {renderFilter()}
          </Box>
        </Popover>
        </Box>
      </Zoom>

      {/* Grand Total Footer with Fade Animation */}
      <Fade in={true} timeout={1000}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mt: 0,
            gap: 1,
            justifyContent: "flex-end",
            backgroundColor: "#375e38",
            padding: "8px 16px",
            borderRadius: "0 0 4px 4px",
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
          }}
        >
          <Typography
            sx={{
              color: "#fff",
              fontWeight: "bold",
              textAlign: "right",
            }}
          >
            TOTAL :
          </Typography>
          <Typography
            sx={{
              color: "#fff",
              fontWeight: "bold",
              textAlign: "right",
            }}
          >
            {grandTotal.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Typography>
        </Box>
      </Fade>
    </>
  );
};

export default PermanentCustomTable;