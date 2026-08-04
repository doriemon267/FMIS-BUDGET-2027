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
  CircularProgress,
  Zoom,
  Fade,
} from "@mui/material";
import { blueGrey, green, grey, blue } from "@mui/material/colors";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { TiFilter } from "react-icons/ti";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import { useRegion } from "../../context/RegionContext";
import TableBodyLoading from "../loyaltypay/LoyaltyTableBodyLoading";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";
import { formatDateToMDY, isValidDate } from "../../utils/formatDate";

const CustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "data",
  orderByDefault = "updatedAt",
}) => {
  const { searchValue, setSearchValue } = useSearch();
  const TEN_SECONDS_AGO = dayjs().subtract(10, "second");
  // Use the region context
  const { activeRegion } = useRegion();

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState(orderByDefault);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);

  useEffect(() => {
    setPage(0);
  }, [activeRegion]);

  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [focusedCell, setFocusedCell] = useState(null);
  const [fieldAndValue, setFieldAndValue] = useState({
    field: "",
    value: "",
    label: "",
    operator: "=", // for number type
  });

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: [
      dataListName,
      page,
      rowsPerPage,
      searchValue,
      fieldAndValue,
      orderBy,
      order,
      activeRegion,
    ],
    queryFn: async () => {
      const activeRegionName = activeRegion?.name || activeRegion?.regionName || "";
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchValue,
        [fieldAndValue.field]: fieldAndValue.value,
        orderBy,
        order,
        operator: fieldAndValue.operator,
      };

      if (activeRegionName) {
        params.region = activeRegionName;
      }

      const res = await api.get(apiPath, { params });
      return res.data;
    },
  });

  useEffect(() => {
    const debouncedSearch = setTimeout(() => refetch(), 500);
    return () => clearTimeout(debouncedSearch);
  }, [order, orderBy, rowsPerPage]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterClick = (event, field, label) => {
    setFilterAnchorEl(event.currentTarget);
    setFieldAndValue((prev) => ({
      ...prev,
      field,
      label,
    }));
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleFilterApply = () => {
    refetch();
    handleFilterClose();
  };

  const handleFilterClear = () => {
    setFieldAndValue({
      field: "",
      value: "",
      label: "",
      operator: "=",
    });
    refetch();
    handleFilterClose();
  };

  const renderFilter = () => {
    const column = columns.find((col) => col.field === fieldAndValue.field);
    if (!column) return null;

    switch (column.type) {
      case "text":
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <TextField
              size="small"
              value={fieldAndValue.value}
              onChange={(e) =>
                setFieldAndValue((prev) => ({
                  ...prev,
                  value: e.target.value,
                }))
              }
              placeholder="Filter value..."
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleFilterApply}
              >
                Apply
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleFilterClear}
              >
                Clear
              </Button>
            </Box>
          </Box>
        );
      case "number":
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Select
              size="small"
              value={fieldAndValue.operator}
              onChange={(e) =>
                setFieldAndValue((prev) => ({
                  ...prev,
                  operator: e.target.value,
                }))
              }
            >
              <MenuItem value="=">=</MenuItem>
              <MenuItem value="<">{"<"}</MenuItem>
              <MenuItem value=">">{">"}</MenuItem>
              <MenuItem value="<=">{"<="}</MenuItem>
              <MenuItem value=">=">{">="}</MenuItem>
            </Select>
            <TextField
              size="small"
              type="number"
              value={fieldAndValue.value}
              onChange={(e) =>
                setFieldAndValue((prev) => ({
                  ...prev,
                  value: e.target.value,
                }))
              }
              placeholder="Filter value..."
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleFilterApply}
              >
                Apply
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleFilterClear}
              >
                Clear
              </Button>
            </Box>
          </Box>
        );
      case "date":
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <TextField
              size="small"
              type="date"
              value={fieldAndValue.value}
              onChange={(e) =>
                setFieldAndValue((prev) => ({
                  ...prev,
                  value: e.target.value,
                }))
              }
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleFilterApply}
              >
                Apply
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleFilterClear}
              >
                Clear
              </Button>
            </Box>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Paper sx={{
        width: "100%",
        mb: 2,
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
        <Table
          sx={{ minWidth: 750 }}
          aria-labelledby="tableTitle"
          size="medium"
        >
          <TableHead sx={{ position: "sticky", top: 0, backgroundColor: "#375e38", zIndex: 1 }}>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.type === "action" ? "action" : column.field}
                  sx={{
                    color: "white",
                    fontWeight: "bold",
                    borderRight: "1px solid",
                    borderColor: grey[500],
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <TableSortLabel
                      active={orderBy === column.field}
                      direction={orderBy === column.field ? order : "asc"}
                      onClick={() => handleRequestSort(column.field)}
                    >
                      {column.label}
                    </TableSortLabel>
                    {column.searchable && (
                      <Tooltip title={`Filter by ${column.label}`}>
                        <IconButton
                          size="small"
                          onClick={(e) =>
                            handleFilterClick(
                              e,
                              column.field,
                              column.label
                            )
                          }
                        >
                          <TiFilter />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
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
                        Loading retiree data...
                      </Typography>
                    </Box>
                  </Fade>
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {data && data[dataListName] && data[dataListName].length > 0 ? (
                data[dataListName].map((row, rowIndex) => {
                  const isRecentlyUpdated =
                    row.updatedAt &&
                    dayjs(row.updatedAt).isAfter(TEN_SECONDS_AGO);

                  return (
                    <TableRow
                      key={rowIndex}
                      hover
                      sx={{
                        backgroundColor: isRecentlyUpdated
                          ? green[50] // Highlight modified rows
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
                            : "rgba(55, 94, 56, 0.04)",
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      {columns.map((column, colIndex) => {
                        const cellValue = row[column.field];
                        const isFocused =
                          focusedCell &&
                          focusedCell.rowIndex === rowIndex &&
                          focusedCell.colIndex === colIndex;

                        return (
                          <TableCell
                            key={colIndex}
                            align={
                              column.type === "number" ? "right" : "left"
                            }
                            sx={{
                              backgroundColor: isFocused
                                ? "#e3f2fd"
                                : "inherit",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                            onClick={() =>
                              setFocusedCell({ rowIndex, colIndex })
                            }
                          >
                            {column.render ? (
                              column.render(row)
                            ) : column.type === "date" && isValidDate(cellValue) ? (
                              formatDateToMDY(cellValue)
                            ) : column.type === "number" ? (
                              formatCurrency(cellValue)
                            ) : (
                              <TextSearchable columnName={cellValue} />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              ) : (
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
              )}
            </TableBody>
          )}
        </Table>
      </TableContainer>

      {!isLoading && (
        <TablePagination
          rowsPerPageOptions={[...new Set([10, ROWS_PER_PAGE, 50])]}
          component="div"
          count={data?.totalRecords || 0}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            borderTop: '1px solid rgba(224, 224, 224, 1)',
            backgroundColor: '#fafafa'
          }}
        />
      )}

      <Popover
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={handleFilterClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#375e38" }}>
            Filter by {fieldAndValue.label}
          </Typography>
          {renderFilter()}
        </Box>
      </Popover>
    </Paper>
  </Box>
  );
};

export default CustomTable;

