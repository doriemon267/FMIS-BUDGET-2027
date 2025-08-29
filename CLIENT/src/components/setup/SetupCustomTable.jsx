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
} from "@mui/material";
import { blueGrey, green, grey } from "@mui/material/colors";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { TiFilter } from "react-icons/ti";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import TableBodyLoading from "../../global/components/TableBodyLoading";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";

// Simple helper function to validate date
const isValidDate = (date) => {
  return !isNaN(new Date(date).getTime());
};

const SetupCustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "",
  orderByDefault = "updatedAt",
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

  const { data, isLoading, refetch, error } = useQuery({
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

  // Check for "fromDate" or "toDate" in filtering logic
  useEffect(() => {
    if (
      fieldAndValue.value &&
      (fieldAndValue.field === "fromDate" || fieldAndValue.field === "toDate")
    ) {
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
    setFocusedCell({ rowIndex, columnKey, _id });
  };

  const handleChangePage = (event, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDateChange = (e) => {
    let inputValue = e.target.value; // YYYY-MM-DD
    if (!inputValue) return;
    const [year, month, day] = inputValue.split("-");
    const formattedValue = `${year}-${month}-${day}`;
    setFieldAndValue((prev) => ({ ...prev, value: formattedValue }));
  };

  const getFormattedValue = () => {
    if (!fieldAndValue.value) return "";
    const [year, month, day] = fieldAndValue.value.split("-");
    return `${year}-${month}-${day}`;
  };

  // Function to render filters based on column type
  const renderFilter = () => {
    const column = columns.find((col) => col.field === fieldAndValue.field);
    if (column) {
      if (column.type === "date") {
        return (
          <>
            <TextField
              size="small"
              type="date"
              value={getFormattedValue()}
              onChange={handleDateChange}
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: "8px" },
              }}
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
      } else if (column.type === "number") {
        return (
          <>
            <Select
              size="small"
              value={fieldAndValue.operator || "="}
              onChange={(e) =>
                setFieldAndValue((prev) => ({ ...prev, operator: e.target.value }))
              }
              fullWidth
            >
              <MenuItem sx={{ display: "flex", justifyContent: "space-between" }} value="=">
                Equal to <b>=</b>
              </MenuItem>
              <MenuItem sx={{ display: "flex", justifyContent: "space-between" }} value="<">
                Less than <b>&lt;</b>
              </MenuItem>
              <MenuItem sx={{ display: "flex", justifyContent: "space-between" }} value=">">
                Greater than <b>&gt;</b>
              </MenuItem>
              <MenuItem sx={{ display: "flex", justifyContent: "space-between" }} value="<=">
                Less than or Equal <b>&le;</b>
              </MenuItem>
              <MenuItem sx={{ display: "flex", justifyContent: "space-between" }} value=">=">
                Greater than or Equal <b>&ge;</b>
              </MenuItem>
            </Select>
            <TextField
              size="small"
              type="number"
              placeholder={`Enter ${fieldAndValue.label}`}
              value={fieldAndValue.value || ""}
              onChange={(e) =>
                setFieldAndValue((prev) => ({ ...prev, value: e.target.value }))
              }
              fullWidth
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
      } else if (column.type === "boolean") {
        return (
          <>
            <Select
              size="small"
              value={fieldAndValue.value !== undefined ? fieldAndValue.value : ""}
              onChange={(e) =>
                setFieldAndValue((prev) => ({
                  ...prev,
                  value: e.target.value === "true",
                }))
              }
              fullWidth
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
            {fieldAndValue.value !== undefined &&
              fieldAndValue.value !== "" && (
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
    }
    return (
      <>
        <TextField
          size="small"
          placeholder={`Search by ${fieldAndValue.label}`}
          value={fieldAndValue.value}
          onChange={(e) =>
            setFieldAndValue((prev) => ({ ...prev, value: e.target.value }))
          }
          fullWidth
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
  };

  return (
    <Box overflow="auto">
      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 0 }}>
        <TableContainer sx={{ height: "78vh" }}>
          <Table size="small" sx={{ borderCollapse: "collapse" }}>
            <TableHead>
              <TableRow>
                {columns.map((column) =>
                  column.type === "action" ? (
                    <TableCell key={1}>{column.label}</TableCell>
                  ) : (
                    <TableCell
                      size="small"
                      key={column.type === "action" ? "action" : column.field}
                      sx={{
                        position: "relative",
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
                  )
                )}
              </TableRow>
            </TableHead>
            {isLoading ? (
              <TableBodyLoading numCell={columns.length} />
            ) : (
              <TableBody>
                {data &&
                data[dataListName] &&
                data[dataListName].length === 0 ? (
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
                  data &&
                  data[dataListName] &&
                  data[dataListName].map((row, rowIndex) => {
                    const isRecentlyUpdated =
                      row.updatedAt && dayjs(row.updatedAt).isAfter(TEN_SECONDS_AGO);
                    return (
                      <TableRow
                        key={rowIndex}
                        sx={{
                          backgroundColor: isRecentlyUpdated
                            ? green[50]
                            : rowIndex % 2 === 0
                            ? blueGrey[50]
                            : "#ffffff",
                        }}
                      >
                        {columns.map((column, i) => (
                          <TableCell
                            key={column.field}
                            onClick={() =>
                              handleCellClick(rowIndex, column.field, row["_id"])
                            }
                            sx={{
                              maxWidth: "150px",
                              whiteSpace: "nowrap",
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
                                // Fallback: try row[column.field]; if not, check deadlines array
                                (() => {
                                  let value = row[column.field];
                                  if ((value === undefined || value === null) && row.deadlines && row.deadlines.length > 0) {
                                    value = row.deadlines[0][column.field];
                                  }
                                  return value
                                    ? isValidDate(value)
                                      ? new Date(value).toLocaleDateString()
                                      : "Invalid Date"
                                    : "N/A";
                                })()
                              ) : column.type === "number" ? (
                                formatCurrency(row[column.field])
                              ) : column.type === "boolean" ? (
                                row[column.field] ? "Yes" : "No"
                              ) : column.type === "array" ? (
                                row[column.field].map((item, index) => (
                                  <div key={index}>
                                    {Object.entries(item).map(([key, value]) => (
                                      <div key={key}>
                                        <strong>{key}:</strong> {String(value)}
                                      </div>
                                    ))}
                                  </div>
                                ))
                              ) : (
                                row[column.field]
                              )
                            ) : (
                              <TextSearchable
                                columnName={
                                  column.type === "date"
                                    ? (() => {
                                        let value = row[column.field];
                                        if ((value === undefined || value === null) && row.deadlines && row.deadlines.length > 0) {
                                          value = row.deadlines[0][column.field];
                                        }
                                        return value
                                          ? isValidDate(value)
                                            ? new Date(value).toLocaleDateString()
                                            : "Invalid Date"
                                          : "N/A";
                                      })()
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
        {!isLoading ? (
          <TablePagination
            rowsPerPageOptions={[10, ROWS_PER_PAGE, 50]}
            component="div"
            count={data ? data.totalRecords : 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        ) : null}
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
      </Paper>
    </Box>
  );
};

export default SetupCustomTable;
