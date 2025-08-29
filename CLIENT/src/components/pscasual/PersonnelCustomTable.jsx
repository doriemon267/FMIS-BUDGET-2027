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
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  Zoom,
  Fade,
  CircularProgress,
} from "@mui/material";
import { blueGrey, green, grey } from "@mui/material/colors";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { useRegion } from "../../context/RegionContext";
import { TiFilter } from "react-icons/ti";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import TableBodyLoading from "../../global/components/TableBodyLoading";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";
import { formatDateToMDY, isValidDate } from "../../utils/formatDate";

const CasualCustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "",
  orderByDefault = "updatedAt",
  onDataChange,
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
    queryKey: [dataListName, page],
    queryFn: async () => {
      const res = await api.get(apiPath, {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: searchValue,
          [fieldAndValue.field]: fieldAndValue.value,
          orderBy,
          order,
          operator: fieldAndValue.operator,
          statusOfAppointment: "CASUAL",
        },
      });
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
      setRegionFilter("");
    }
  }, [activeRegion]);

  useEffect(() => {
    const fetchGrandTotal = async () => {
      try {
        // Include region filter in the API request
        const params = new URLSearchParams();
        if (regionFilter) {
          params.append('region', regionFilter);
        }
        
        const response = await api.get(`/grandtotalCasual?${params.toString()}`);
        setGrandTotal(response.data.grandTotal || 0);
      } catch (error) {
        console.error("Error fetching grand total:", error);
      }
    };
    fetchGrandTotal();
  }, [data, regionFilter]); // Ensure this effect runs when personnel data or region changes

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
                    <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 8 }}>
                      <Fade in={isLoading}>
                        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                          <CircularProgress size={40} sx={{ color: '#375e38' }} />
                          <Typography variant="body2" color="text.secondary">
                            Loading casual personnel data...
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
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Paper>
        {!isLoading && (
          <TablePagination
            rowsPerPageOptions={[10, ROWS_PER_PAGE, 50]}
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

export default CasualCustomTable;
