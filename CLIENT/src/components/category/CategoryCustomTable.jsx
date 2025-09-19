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
import { formatDateToMDY, isValidDate } from "../../utils/formatDate";

const CustomTable = ({
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
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                },
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
                setFieldAndValue((prev) => ({
                  ...prev,
                  operator: e.target.value,
                }))
              }
              fullWidth
            >
              <MenuItem
                sx={{ display: "flex", justifyContent: "space-between" }}
                value="="
              >
                Equal to <b>=</b>
              </MenuItem>
              <MenuItem
                sx={{ display: "flex", justifyContent: "space-between" }}
                value="<"
              >
                Less than <b>&lt;</b>
              </MenuItem>
              <MenuItem
                sx={{ display: "flex", justifyContent: "space-between" }}
                value=">"
              >
                Greater than <b>&gt;</b>
              </MenuItem>
              <MenuItem
                sx={{ display: "flex", justifyContent: "space-between" }}
                value="<="
              >
                Less than or Equal <b>&le;</b>
              </MenuItem>
              <MenuItem
                sx={{ display: "flex", justifyContent: "space-between" }}
                value=">="
              >
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
              value={
                fieldAndValue.value !== undefined ? fieldAndValue.value : ""
              }
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
                {/* Render the headers dynamically from columns */}
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
                        borderColor: grey[500], // Add border to each cell
                        textAlign: column.type === "number" ? "right" : "left", // Align to right if column type is number
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
                              handleFilterClick(
                                event,
                                column.field,
                                column.label
                              )
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
            {/* LOADING AND TABLE BODY */}
            {isLoading ? (
              <TableBodyLoading numCell={columns.length} />
            ) : (
              <TableBody>
                {data[dataListName].length === 0 ? (
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
                  data[dataListName].map((row, rowIndex) => {
                    const isRecentlyUpdated =
                      row.updatedAt &&
                      dayjs(row.updatedAt).isAfter(TEN_SECONDS_AGO);

                    return (
                      <TableRow
                        key={rowIndex}
                        sx={{
                          backgroundColor: isRecentlyUpdated
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
                              maxWidth: "150px", // Adjust based on your design
                              whiteSpace: "nowrap",
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
          </Table>
        </TableContainer>

        {/* PAGINATION AREA */}
        {!isLoading ? (
          <TablePagination
            rowsPerPageOptions={[...new Set([10, ROWS_PER_PAGE, 50])]} 
            component="div"
            count={data.totalRecords} // Update this if your backend provides a total count
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        ) : undefined}

        {/* Popover for Filtering */}
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
            {renderFilter()} {/* Render filter based on column type */}
          </Box>
        </Popover>
      </Paper>
    </Box>
  );
};

export default CustomTable;