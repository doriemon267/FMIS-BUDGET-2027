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
} from "@mui/material";
import { blueGrey, green, grey } from "@mui/material/colors";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useEffect, useState, useCallback } from "react";
import { TiFilter } from "react-icons/ti";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import TableBodyLoading from "../../global/components/TableBodyLoading";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";
import { formatDateToMDY, isValidDate } from "../../utils/formatDate";

const CustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "",
  orderByDefault = "updatedAt",
  onDataChange, // Add onDataChange prop
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
    operator: "=", // for number type
  });
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [totals, setTotals] = useState({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: [dataListName, page],
    queryFn: async () => {
      const res = await api.get(apiPath, {
        params: {
          page: page + 1, // API expects page starting from 1
          limit: rowsPerPage,
          search: searchValue,
          [fieldAndValue.field]: fieldAndValue.value,
          orderBy,
          order,
          operator: fieldAndValue.operator,
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
  }, [searchValue]); // Depend only on searchValue to prevent looping

  useEffect(() => {
    if (fieldAndValue.value && searchValue) {
      setSearchValue("");
    }
  }, [fieldAndValue.value]); // Depend only on fieldAndValue.value

  // Update the totals calculation to include totalExpenses and totalIncome
  const calculateTotals = useCallback(() => {
    if (data && data.grandTotals) {
      setTotals(data.grandTotals);
      return;
    }
    
    // Fallback to current page calculation if backend doesn't provide grand totals
    const newTotals = {};
    if (data && Array.isArray(data[dataListName])) {
      data[dataListName].forEach((row) => {
        columns.forEach((column) => {
          if (column.type === 'number') {
            const value = parseFloat(row[column.field]) || 0;
            newTotals[column.field] = (newTotals[column.field] || 0) + value;
          }
        });
      });
    }
    
    setTotals(newTotals);
  }, [data, columns, dataListName]);

  // Make sure this runs when data or columns change
  useEffect(() => {
    calculateTotals();
  }, [data, columns, calculateTotals]);

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

  // _id from mongoDB
  const handleCellClick = (rowIndex, columnKey, _id) => {
    // console.log(_id);
    setFocusedCell({ rowIndex, columnKey, _id });
  };

  const handleChangePage = (event, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to page 0 when rows per page changes
  };

  const handleDateChange = (e) => {
    let inputValue = e.target.value; // YYYY-MM-DD
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

  // Function to render inline filter
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

  return (
    <Box overflow="auto">
      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 0 }}>
        <TableContainer sx={{ height: "60vh" }}>
          <Table size="small" sx={{ borderCollapse: "collapse" }}>
            <TableHead>
              <TableRow>
                {/* Render the headers dynamically from columns */}
                {columns.map((column) =>
                  column.type === "action" ? (
                    <TableCell key={1} sx={{ position: "sticky", top: 0, backgroundColor: "#375e38", zIndex: 1 }}>
                      {column.label}
                    </TableCell>
                  ) : (
                    <TableCell
                      size="small"
                      key={column.type === "action" ? "action" : column.field}
                      onMouseEnter={() => setHoveredColumn(column.field)}
                      onMouseLeave={() => setHoveredColumn(null)}
                      sx={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#375e38",
                        zIndex: 1,
                        borderRight: "1px solid",
                        borderColor: grey[500],
                        verticalAlign: "top", // Align top so filter inputs don't shift title
                        paddingTop: 1.5,
                        paddingBottom: 1.5,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: column.type === "number" ? "flex-end" : "flex-start",
                          minHeight: "24px", // keep height stable
                          color: "white"
                        }}
                      >
                        <TableSortLabel
                          active={orderBy === column.field}
                          direction={orderBy === column.field ? order : "asc"}
                          onClick={() => handleRequestSort(column.field)}
                          sx={{ color: "white !important", "& .MuiTableSortLabel-icon": { color: "white !important" } }}
                        >
                          {column.label}
                        </TableSortLabel>
                        {(fieldAndValue.field === column.field && fieldAndValue.value !== "") && (
                          <IconButton
                            size="small"
                            onClick={handleFilterClearValue}
                            sx={{ color: "white", ml: 1, padding: 0 }}
                          >
                            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>✕</span>
                          </IconButton>
                        )}
                      </div>
                      
                      {(hoveredColumn === column.field || (fieldAndValue.field === column.field && fieldAndValue.value !== "")) && (
                        <div onClick={(e) => e.stopPropagation()}>
                          {renderFilterInline(column)}
                        </div>
                      )}
                    </TableCell>
                  )
                )}
              </TableRow>
            </TableHead>
            {/* LOADING AND TABLE BODY */}
            {isLoading ? (
              <TableBodyLoading numCell={columns.length} />
            ) : (
              <TableBody>
                {data && data[dataListName] && data[dataListName].length === 0 ? (
                  <TableRow sx={{ height: "70vh" }}>
                    <TableCell
                      colSpan={11}
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
                  data && data[dataListName] && data[dataListName].map((row, rowIndex) => {
                    const isRecentlyUpdated =
                      row.updatedAt &&
                      dayjs(row.updatedAt).isAfter(TEN_SECONDS_AGO);
              
                    return (
                      <TableRow
                        key={rowIndex}
                        sx={{
                          backgroundColor: row.subsidyEligible
                            ? "#fffde7" // Light yellow for subsidy-tagged rows
                            : isRecentlyUpdated
                            ? green[50] // Highlight modified rows
                            : rowIndex % 2 === 0
                            ? blueGrey[50]
                            : "#ffffff",
                        }}
                      >
                        {/* Render the rows dynamically from columns */}
                        {columns.map((column, i) => (
                          <TableCell
                            key={column.field}
                            onClick={() =>
                              handleCellClick(
                                rowIndex,
                                column.field,
                                row["_id"]
                              )
                            } // Focus on click
                            sx={{
                              maxWidth: column.field === "employeeName" ? "none" : "800px", // Adjust based on your design
                              whiteSpace: column.field === "employeeName" ? "normal" : "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontWeight: "500",
                              textAlign: column.type === "number" ? "right" : "left", // Align to right if column type is number
                              ...(focusedCell &&
                                focusedCell._id === row["_id"] &&
                                focusedCell.rowIndex === rowIndex &&
                                focusedCell.columnKey === column.field && {
                                  outline: "2px solid lightblue", // Focused cell border
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
                                row[column.field] ? (
                                  "Yes"
                                ) : (
                                  "No"
                                ) // Display "Yes" for true, "No" for false
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
            <TableFooter>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.field}
                    sx={{
                      position: "sticky",
                      bottom: 0,
                      backgroundColor: "#f0f5f5",
                      zIndex: 1,
                      fontWeight: "600",
                      fontSize: 14,
                      textAlign: column.type === "number" ? "right" : "left", // Align to right if column type is number
                    }}
                  >
                    {column.type === "number" ? formatCurrency(totals[column.field]) : ""}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>

        {/* PAGINATION AREA */}
        {!isLoading ? (
          <TablePagination
            rowsPerPageOptions={[...new Set([10, ROWS_PER_PAGE, 50])]}
            component="div"
            count={data ? data.totalRecords : 0} // Update this if your backend provides a total count
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        ) : undefined}

      </Paper>
    </Box>
  );
};

export default CustomTable;
