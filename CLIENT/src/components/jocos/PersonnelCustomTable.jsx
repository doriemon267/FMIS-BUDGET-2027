import {
  Box,
  IconButton,
  MenuItem,
  Paper,
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
  Typography,
  Fade,
  CircularProgress,
  useTheme,
} from "@mui/material";
import { blueGrey, green, grey } from "@mui/material/colors";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import { useRegion } from "../../context/RegionContext";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";
import { formatDateToMDY, isValidDate } from "../../utils/formatDate";

const COSCustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "",
  orderByDefault = "updatedAt",
  onDataChange,
  proposalId = null,
  fiscalYear = null,
  region = null,
}) => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const { searchValue, setSearchValue } = useSearch();
  const { activeRegion } = useRegion();
  const TEN_SECONDS_AGO = dayjs().subtract(10, "second");

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState(orderByDefault);
  const [regionFilter, setRegionFilter] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const [focusedCell, setFocusedCell] = useState(null);
  const [fieldAndValue, setFieldAndValue] = useState({
    field: "",
    value: "",
    label: "",
    operator: "=",
  });
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [totals, setTotals] = useState({});

  const providedRegion = typeof region === "string"
    ? region
    : region?.name || region?.regionName || region?.Region || "";

  // Update region filter when the proposal region or active region changes
  useEffect(() => {
    const regionName = providedRegion || activeRegion?.name || activeRegion?.regionName || "Central Office";
    setRegionFilter(regionName);
  }, [activeRegion, providedRegion]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [dataListName, page, rowsPerPage, orderBy, order, regionFilter, proposalId, fiscalYear, searchValue, fieldAndValue],
    enabled: Boolean(regionFilter),
    queryFn: async () => {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        orderBy,
        order,
        statusOfAppointment: "COS",
      };
      
      // Only add search if it has a value
      if (searchValue) {
        params.search = searchValue;
      }
      
      // Only add field filter and operator if field is specified
      if (fieldAndValue.field) {
        params[fieldAndValue.field] = fieldAndValue.value;
        params.operator = fieldAndValue.operator;
      }

      // Include region once available (required by backend)
      if (regionFilter) {
        params.region = regionFilter;
      }
      if (proposalId) params.proposalId = proposalId;
      if (fiscalYear) params.fiscalYear = fiscalYear;
      
      const res = await api.get(apiPath, { params });
      return res.data;
    },
  });

  useEffect(() => {
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
  }, [searchValue, fieldAndValue]);

  useEffect(() => {
    const debouncedSearch = setTimeout(() => {
      refetch();
    }, 500);
    return () => clearTimeout(debouncedSearch);
  }, [order, orderBy, rowsPerPage]);

  useEffect(() => {
    if (
      searchValue &&
      (fieldAndValue.field || fieldAndValue.label || fieldAndValue.value)
    ) {
      setFieldAndValue({ field: "", label: "", value: "" });
    }
  }, [searchValue]);

  useEffect(() => {
    if (fieldAndValue.value && searchValue) {
      setSearchValue("");
    }
  }, [fieldAndValue.value]);

  useEffect(() => {
    if (data && data.grandTotals) {
      setTotals(data.grandTotals);
      if (onDataChange) {
        onDataChange(data[dataListName]);
      }
      return;
    }
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

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleFilterClearValue = () =>
    setFieldAndValue((prev) => ({ ...prev, value: "" }));

  const handleCellClick = (rowIndex, columnKey, _id) => {
    setFocusedCell({ rowIndex, columnKey, _id });
  };

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

  // // Function to get the total amount of the table
  // const getTotalAmount = async () => {
  //   try {
  //     const response = await api.get("/grandtotalCasual");
  //     return response.data.grandTotal || 0;
  //   } catch (error) {
  //     console.error("Error fetching grand total:", error);
  //     return 0;
  //   }
  // };

  // const [grandTotal, setGrandTotal] = useState(0);

  // useEffect(() => {
  //   const fetchGrandTotal = async () => {
  //     const total = await getTotalAmount();
  //     setGrandTotal(total);
  //   };
  //   fetchGrandTotal();
  // }, []);

  const getFormattedValue = () => {
    if (!fieldAndValue.value) return "";
    const [month, day, year] = fieldAndValue.value.split("-");
    return `${year}-${month}-${day}`;
  };

  const renderFilterInline = (column) => {
    const isEditingThisColumn = fieldAndValue.field === column.field;
    const value = isEditingThisColumn ? fieldAndValue.value : "";
    const operator = isEditingThisColumn ? (fieldAndValue.operator || "=") : "=";

    const handleValueChange = (e) => {
      setFieldAndValue(prev => ({ 
        ...prev, 
        field: column.field, 
        value: e.target.value, 
        label: column.label, 
        operator 
      }));
      setPage(0);
    };

    const handleOperatorChange = (e) => {
      setFieldAndValue(prev => ({ 
        ...prev, 
        field: column.field, 
        value, 
        label: column.label, 
        operator: e.target.value 
      }));
      setPage(0);
    };

    if (column.type === "date") {
      return (
        <TextField
          size="small"
          type="date"
          value={isEditingThisColumn ? getFormattedValue() : ""}
          onChange={handleDateChange}
          fullWidth
          sx={{ mt: 1, backgroundColor: "white", borderRadius: 1 }}
        />
      );
    } else if (column.type === "number") {
      return (
        <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
          <Select
            size="small"
            value={operator}
            onChange={handleOperatorChange}
            sx={{ backgroundColor: "white", borderRadius: 1, minWidth: 50 }}
          >
            <MenuItem value="=">=</MenuItem>
            <MenuItem value="<">&lt;</MenuItem>
            <MenuItem value=">">&gt;</MenuItem>
            <MenuItem value="<=">&le;</MenuItem>
            <MenuItem value=">=">&ge;</MenuItem>
          </Select>
          <TextField
            size="small"
            type="number"
            placeholder="Search..."
            value={value || ""}
            onChange={handleValueChange}
            sx={{ backgroundColor: "white", borderRadius: 1 }}
            fullWidth
          />
        </Box>
      );
    } else if (column.type === "boolean") {
      return (
        <Select
          size="small"
          value={value !== undefined ? value : ""}
          onChange={(e) => setFieldAndValue({ field: column.field, value: e.target.value === "true" ? "true" : (e.target.value === "false" ? "false" : ""), label: column.label })}
          fullWidth
          sx={{ mt: 1, backgroundColor: "white", borderRadius: 1 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Yes</MenuItem>
          <MenuItem value="false">No</MenuItem>
        </Select>
      );
    }

    return (
      <TextField
        size="small"
        placeholder="Search..."
        value={value}
        onChange={handleValueChange}
        fullWidth
        sx={{ mt: 1, backgroundColor: "white", borderRadius: 1 }}
      />
    );
  };

  const tableData = data && data[dataListName] ? data[dataListName] : [];

  return (
    <>
      {/* Main Table with Zoom Animation */}
      <>
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
                  {columns.map((column) => (
                    <TableCell
                      key={column.field}
                      onMouseEnter={() => setHoveredColumn(column.field)}
                      onMouseLeave={() => setHoveredColumn(null)}
                      sx={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: headerBg,
                        zIndex: 1,
                        borderRight: "1px solid",
                        borderColor: grey[500],
                        verticalAlign: 'top',
                        paddingTop: 1.5,
                        paddingBottom: 1.5,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: column.type === 'number' ? 'flex-end' : 'flex-start',
                          minHeight: '24px',
                          color: 'white',
                        }}
                      >
                        <TableSortLabel
                          active={orderBy === column.field}
                          direction={
                            orderBy === column.field ? order : "asc"
                          }
                          onClick={() =>
                            handleRequestSort(column.field)
                          }
                          sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
                        >
                          {column.label}
                        </TableSortLabel>
                        {(fieldAndValue.field === column.field && fieldAndValue.value !== '') && (
                          <IconButton
                            size="small"
                            onClick={handleFilterClearValue}
                            sx={{ color: 'white', ml: 1, padding: 0 }}
                          >
                            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>✕</span>
                          </IconButton>
                        )}
                      </div>
                      
                      {(hoveredColumn === column.field || (fieldAndValue.field === column.field && fieldAndValue.value !== '')) && (
                        <div onClick={e => e.stopPropagation()}>
                          {renderFilterInline(column)}
                        </div>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              {isLoading ? (
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 8 }}>
                      <Fade in={isLoading}>
                        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                          <CircularProgress size={40} sx={{ color: headerBg }} />
                          <Typography variant="body2" color="text.secondary">
                            Loading cos personnel data...
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
                      return (
                        <TableRow
                          key={rowIndex}
                          hover
                          sx={{
                            backgroundColor: isRecentlyUpdated
                              ? green[50]
                              : rowIndex % 2 === 0
                              ? blueGrey[50]
                              : "#ffffff",
                            cursor: "pointer",
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: isRecentlyUpdated
                                ? green[100]
                                : rowIndex % 2 === 0
                                ? blueGrey[100]
                                : "rgba(0, 0, 0, 0.04)",
                              transform: 'translateY(-1px)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }
                          }}
                        >
                          {columns.map((column, i) => (
                            <TableCell
                              key={column.field}
                              onClick={() =>
                                handleCellClick(rowIndex, column.field, row["_id"])
                              }
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
                                  i !== 0
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
                  {/* Totals row */}
                  {tableData.length > 0 && (
                    <TableRow>
                      {columns.map((column, index) => (
                        <TableCell
                          key={column.field}
                          sx={{
                            backgroundColor: headerBg,
                            color: "#fff",
                            fontWeight: "bold",
                            textAlign:
                              column.type === "number"
                                ? "right"
                                : index === 0
                                ? "left"
                                : "center",
                          }}
                        >
                          {index === 0 ? (
                            "TOTAL:"
                          ) : column.type === "number" ? (
                            totals[column.field]
                              ? totals[column.field].toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })
                              : "0.00"
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
            rowsPerPageOptions={[...new Set([10, ROWS_PER_PAGE, 50, 100, 200])]}
            component="div"
            count={data ? data.totalRecords : 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              backgroundColor: headerBg,
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
        </Box>
      </>
    </>
  );
};

export default COSCustomTable;
