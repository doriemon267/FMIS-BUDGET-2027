import {
  Box,
  Button,
  Checkbox,
  Chip,
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
import { useEffect, useRef, useState } from "react";
import { TiFilter } from "react-icons/ti";
import { useSearchParams } from "react-router-dom";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import TableBodyLoading from "../../global/components/TableBodyLoading";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";
import { formatDateToMDY, isValidDate } from "../../utils/formatDate";

const CustomTable = ({
  columns: initialColumns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "",
  orderByDefault = "createdAt",
  setSelectedRows,
  selectedRows,
  showBatchOptions,
  schema,
  // Optional pre-fetched data (e.g. from parent useQuery via CustomPage)
  externalData = null,
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
    field: schema?.status?.listDefaultValue ? "status" : "",
    value: schema?.status?.listDefaultValue || "",
    label: schema?.status?.listDefaultValue ? schema.status.label : "",
    operator: "=",
    filterType: "exact",
  });

  const [columns, setColumns] = useState(() =>
    setSelectedRows
      ? [
          {
            field: "select",
            label: "Select",
            width: 80,
            type: "checkbox",
            noFilter: true,
            noSort: true,
          },
          ...initialColumns.map((col) => ({ ...col, width: col.width || 150 })),
        ]
      : initialColumns.map((col) => ({ ...col, width: col.width || 150 })),
  );

  const [resizing, setResizing] = useState(null);
  const [columnHovering, setColumnHovering] = useState("");
  const tableRef = useRef(null);

  const [searchParams] = useSearchParams();
  const notificationId = searchParams.get("_id");

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
          _id: notificationId,
          filterType: fieldAndValue.filterType,
        },
      });
      return res.data;
    },
    // When externalData is provided, skip server-side fetching entirely.
    enabled: !externalData,
  });

  // Use externalData when provided; otherwise fall back to server data.
  const effectiveData = externalData
    ? {
        [dataListName]: externalData,
        totalRecords: externalData.length,
      }
    : data;
  const isEffectiveLoading = externalData ? false : isLoading;

  useEffect(() => {
    if (externalData) return; // Skip refetch logic when using external data
    if (fieldAndValue.value && fieldAndValue.field === "date") {
      setPage(0);
      setRowsPerPage(ROWS_PER_PAGE);
      if (
        isValidDate(fieldAndValue.value) ||
        fieldAndValue.filterType === "month"
      ) {
        refetch();
      }
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
  }, [searchValue, fieldAndValue, refetch, ROWS_PER_PAGE]);

  useEffect(() => {
    if (externalData) return; // Skip refetch logic when using external data
    const debouncedSearch = setTimeout(() => {
      refetch();
    }, 500);
    return () => clearTimeout(debouncedSearch);
  }, [order, orderBy, rowsPerPage, searchParams, refetch]);

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
  }, [fieldAndValue.value, setSearchValue]);

  const handleSelectAll = (event) => {
    if (!setSelectedRows) return;
    if (event.target.checked) {
      const allRows = (effectiveData?.[dataListName] || []).map((row) => row);
      setSelectedRows(allRows);
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (event, row) => {
    if (!setSelectedRows) return;
    const selectedIndex = selectedRows.findIndex((r) => r._id === row._id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = [...selectedRows, row];
    } else {
      newSelected = selectedRows.filter((r) => r._id !== row._id);
    }

    setSelectedRows(newSelected);
  };

  const isSelected = (row) =>
    setSelectedRows ? selectedRows.some((r) => r._id === row._id) : false;

  const handleMouseDown = (e, field) => {
    setResizing({
      field,
      startX: e.clientX,
      startWidth: columns.find((col) => col.field === field).width,
    });
  };

  const handleMouseMove = (e) => {
    if (!resizing) return;
    const newWidth = resizing.startWidth + (e.clientX - resizing.startX);
    setColumns((prev) =>
      prev.map((col) =>
        col.field === resizing.field
          ? { ...col, width: Math.max(50, newWidth) }
          : col,
      ),
    );
  };

  const handleMouseUp = () => {
    setResizing(null);
  };

  useEffect(() => {
    if (resizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleFilterClick = (event, columnKey, columnLabel) => {
    setFilterAnchorEl(event.currentTarget);
    const schemaField = schema?.[columnKey];
    const column = columns.find((col) => col.field === columnKey);
    setFieldAndValue({
      field: columnKey,
      value: schemaField?.listDefaultValue || column?.listDefaultValue || "",
      label: columnLabel,
      operator: "=",
    });
  };

  const handleFilterClearValue = () =>
    setFieldAndValue((prev) => ({ ...prev, value: "" }));

  const handleFilterClose = () => setFilterAnchorEl(null);

  const handleCellClick = (rowId, columnKey) => {
    setFocusedCell({ rowId, columnKey, _id: rowId });
  };

  const handleChangePage = (event, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDateChange = (e, type = "exact") => {
    let inputValue = e.target.value || "";
    if (!inputValue) {
      setFieldAndValue((prev) => ({ ...prev, value: "", filterType: type }));
      return;
    }

    if (type === "month") {
      setFieldAndValue((prev) => ({
        ...prev,
        value: inputValue,
        filterType: type,
      }));
    } else {
      const [year, month, day] = inputValue.split("-");
      const formattedValue = `${month}-${day}-${year}`;
      setFieldAndValue((prev) => ({
        ...prev,
        value: formattedValue,
        filterType: type,
      }));
    }
  };

  const getFormattedValue = () => {
    if (!fieldAndValue.value) return "";
    if (fieldAndValue.filterType === "month") {
      return fieldAndValue.value;
    }
    const [month, day, year] = fieldAndValue.value.split("-");
    return `${year}-${month}-${day}` || "";
  };

  const renderFilter = () => {
    const column = columns.find((col) => col.field === fieldAndValue.field);
    const schemaField = schema?.[fieldAndValue.field];

    if (!column) return null;

    if (schemaField?.listOptions || column.listOptions) {
      const options = schemaField?.listOptions || column.listOptions;
      return (
        <>
          <Select
            size="small"
            value={fieldAndValue.value || "all"}
            onChange={(e) => {
              const value = e.target.value === "all" ? "" : e.target.value;
              setFieldAndValue((prev) => ({ ...prev, value }));
            }}
            fullWidth
          >
            <MenuItem value="all">All</MenuItem>
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
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
    } else if (column.type === "date") {
      return (
        <>
          <Select
            size="small"
            value={fieldAndValue.filterType || "exact"}
            onChange={(e) =>
              setFieldAndValue((prev) => ({
                ...prev,
                filterType: e.target.value,
                value: "",
              }))
            }
            fullWidth
            sx={{ mb: 1 }}
          >
            <MenuItem value="exact">Exact Date</MenuItem>
            <MenuItem value="month">Month</MenuItem>
          </Select>
          {fieldAndValue.filterType === "month" ? (
            <TextField
              size="small"
              type="month"
              value={fieldAndValue.value || ""}
              onChange={(e) => handleDateChange(e, "month")}
              fullWidth
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
          ) : (
            <TextField
              size="small"
              type="date"
              value={getFormattedValue()}
              onChange={(e) => handleDateChange(e, "exact")}
              fullWidth
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
          )}
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
              Less than <b>{"<"}</b>
            </MenuItem>
            <MenuItem
              sx={{ display: "flex", justifyContent: "space-between" }}
              value=">"
            >
              Greater than <b>{">"}</b>
            </MenuItem>
            <MenuItem
              sx={{ display: "flex", justifyContent: "space-between" }}
              value="<="
            >
              Less than or Equal <b>≤</b>
            </MenuItem>
            <MenuItem
              sx={{ display: "flex", justifyContent: "space-between" }}
              value=">="
            >
              Greater than or Equal <b>≥</b>
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
              fieldAndValue.value === true
                ? "true"
                : fieldAndValue.value === false
                  ? "false"
                  : "all"
            }
            onChange={(e) => {
              const newValue =
                e.target.value === "true"
                  ? true
                  : e.target.value === "false"
                    ? false
                    : null;
              setFieldAndValue((prev) => ({ ...prev, value: newValue }));
            }}
            fullWidth
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
        </>
      );
    }

    return (
      <>
        <TextField
          size="small"
          placeholder={`Search by ${fieldAndValue.label}`}
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
  };

  const isAllSelected = () => {
    if (
      !effectiveData ||
      !effectiveData[dataListName] ||
      effectiveData[dataListName].length === 0
    )
      return false;
    return selectedRows.length === effectiveData[dataListName].length;
  };

  const isIndeterminate = () => {
    if (
      !effectiveData ||
      !effectiveData[dataListName] ||
      effectiveData[dataListName].length === 0
    )
      return false;
    return (
      selectedRows.length > 0 &&
      selectedRows.length < effectiveData[dataListName].length
    );
  };

  return (
    <Box overflow="auto" ref={tableRef}>
      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 0 }}>
        <TableContainer sx={{ height: "78vh" }}>
          <Table size="small" sx={{ borderCollapse: "collapse" }}>
            <TableHead
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <TableRow>
                {columns.map((column) =>
                  column.type === "checkbox" && setSelectedRows ? (
                    <TableCell
                      key={column.field}
                      sx={{
                        width: column.width,
                        borderRight: "1px solid",
                        borderColor: grey[500],
                      }}
                    >
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Checkbox
                          checked={isAllSelected()}
                          indeterminate={isIndeterminate()}
                          onChange={handleSelectAll}
                        />
                        {showBatchOptions}
                      </Box>
                    </TableCell>
                  ) : column.type === "action" ? (
                    <TableCell
                      key={column.field || "action"}
                      sx={{
                        width: column.width,
                        borderRight: "1px solid",
                        borderColor: grey[500],
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ) : (
                    <TableCell
                      size="small"
                      key={column.field}
                      onMouseEnter={() => setColumnHovering(column.field)}
                      onMouseLeave={() => setColumnHovering()}
                      sx={{
                        position: "relative",
                        borderRight: "1px solid",
                        borderColor: grey[500],
                        width: column.width,
                        minWidth: 50,
                        userSelect: "none",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          position: "relative",
                        }}
                      >
                        {column.noSort ? (
                          <Box sx={{ flex: 1 }}>
                            {schema?.[column.field]?.listDefaultValue
                              ? `${column.label} (${
                                  schema[column.field].listDefaultValue
                                })`
                              : column.listDefaultValue
                                ? `${column.label} (${column.listDefaultValue})`
                                : column.label}
                          </Box>
                        ) : (
                          <TableSortLabel
                            active={orderBy === column.field}
                            direction={orderBy === column.field ? order : "asc"}
                            onClick={() => handleRequestSort(column.field)}
                            sx={{ flex: 1 }}
                          >
                            {schema?.[column.field]?.listDefaultValue
                              ? `${column.label} (${
                                  schema[column.field].listDefaultValue
                                })`
                              : column.listDefaultValue
                                ? `${column.label} (${column.listDefaultValue})`
                                : column.label}
                          </TableSortLabel>
                        )}
                        {!column.noFilter && (
                          <Tooltip title={`Filter ${column.label}`}>
                            <IconButton
                              size="small"
                              onClick={(event) =>
                                handleFilterClick(
                                  event,
                                  column.field,
                                  column.label,
                                )
                              }
                            >
                              <TiFilter color="lightgray" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Box
                          sx={{
                            position: "absolute",
                            right: -5,
                            top: 0,
                            bottom: 0,
                            width: 3,
                            cursor: "col-resize",
                            backgroundColor:
                              columnHovering === column.field
                                ? grey[400]
                                : "transparent",
                            "&:hover": { backgroundColor: grey[300] },
                          }}
                          onMouseDown={(e) => handleMouseDown(e, column.field)}
                        />
                      </Box>
                    </TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            {isEffectiveLoading ? (
              <TableBodyLoading numCell={columns.length} />
            ) : (
              <TableBody>
                {!effectiveData?.[dataListName] || effectiveData[dataListName].length === 0 ? (
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
                  effectiveData[dataListName].map((row, rowIndex) => {
                    const isRecentlyUpdated =
                      row.updatedAt &&
                      dayjs(row.updatedAt).isAfter(TEN_SECONDS_AGO);
                    const isRowSelected = isSelected(row);

                    return (
                      <TableRow
                        key={row._id}
                        sx={{
                          backgroundColor: isRowSelected
                            ? green[200]
                            : isRecentlyUpdated
                              ? green[50]
                              : rowIndex % 2 === 0
                                ? blueGrey[50]
                                : "#ffffff",
                        }}
                      >
                        {columns.map((column, i) =>
                          column.type === "checkbox" && setSelectedRows ? (
                            <TableCell
                              key={column.field}
                              sx={{ width: column.width }}
                            >
                              <Checkbox
                                checked={isRowSelected}
                                onChange={(event) =>
                                  handleSelectRow(event, row)
                                }
                              />
                            </TableCell>
                          ) : (
                            <TableCell
                              key={column.field}
                              onClick={() =>
                                handleCellClick(row._id, column.field)
                              }
                              sx={{
                                width: column.width,
                                maxWidth: column.width,
                                whiteSpace: "normal",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                fontWeight: "500",
                                ...(focusedCell &&
                                  focusedCell._id === row._id &&
                                  focusedCell.rowId === row._id &&
                                  focusedCell.columnKey === column.field && {
                                    outline: "2px solid lightblue",
                                  }),
                                borderLeft:
                                  i !== 0
                                    ? rowIndex % 2 === 0 && !isRowSelected
                                      ? "1px solid white"
                                      : `1px solid ${grey[200]}`
                                    : focusedCell &&
                                      focusedCell._id === row._id &&
                                      focusedCell.rowId === row._id &&
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
                                    column.isChip ? (
                                      <Chip
                                        size="small"
                                        label="Yes"
                                        color="success"
                                      />
                                    ) : (
                                      <span
                                        style={{
                                          color: "green",
                                          fontWeight: "bold",
                                        }}
                                      >
                                        Yes
                                      </span>
                                    )
                                  ) : column.isChip ? (
                                    <Chip
                                      size="small"
                                      label="No"
                                      color="error"
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        color: "red",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      No
                                    </span>
                                  )
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
                          ),
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            )}
          </Table>
        </TableContainer>

        {!isEffectiveLoading && (
          <TablePagination
            rowsPerPageOptions={[10, ROWS_PER_PAGE, 50]}
            component="div"
            count={effectiveData?.totalRecords || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
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
      </Paper>
    </Box>
  );
};

export default CustomTable;