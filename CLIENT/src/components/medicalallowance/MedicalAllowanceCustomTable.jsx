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
import { useTheme } from "@mui/material/styles";
import { blueGrey, green, grey } from "@mui/material/colors";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useEffect, useState, useMemo } from "react";
import { TiFilter } from "react-icons/ti";
import api from "../../config/api";
import { useSearch } from "../../context/SearchContext";
import TableBodyLoading from "../medicalallowance/MedicalAllowanceTableBodyLoading";
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
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const highlightBg = theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : '#f1f8ed';
  const titleColor = theme.palette.mode === 'dark' ? '#a5d6a7' : '#2d5016';

  const { searchValue, setSearchValue } = useSearch();
  const TEN_SECONDS_AGO = dayjs().subtract(10, "second");

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState(orderByDefault);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [fieldAndValue, setFieldAndValue] = useState({
    field: "",
    value: "",
    label: "",
    operator: "=",
  });

  const queryKey = useMemo(
    () => [
      dataListName,
      page,
      rowsPerPage,
      searchValue,
      fieldAndValue,
      orderBy,
      order,
    ],
    [
      dataListName,
      page,
      rowsPerPage,
      searchValue,
      fieldAndValue,
      orderBy,
      order,
    ]
  );

  const { data, isLoading, refetch, error } = useQuery({
    queryKey,
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
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  useEffect(() => {
    const debouncedSearch = setTimeout(() => refetch(), 800);
    return () => clearTimeout(debouncedSearch);
  }, [queryKey, refetch]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleFilterClick = (event, columnKey, columnLabel) => {
    setFilterAnchorEl(event.currentTarget);
    if (fieldAndValue.field !== columnKey)
      setFieldAndValue({
        field: columnKey,
        value: "",
        label: columnLabel,
        operator: "=",
      });
  };

  const handleFilterClearValue = () =>
    setFieldAndValue((prev) => ({ ...prev, value: "", operator: "=" }));

  const handleFilterClose = () => setFilterAnchorEl(null);

  const handleChangePage = (event, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDateChange = (e) => {
    const [year, month, day] = e.target.value.split("-");
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

    if (column.type === "date") {
      return (
        <>
          <TextField
            size="small"
            type="date"
            value={getFormattedValue()}
            onChange={handleDateChange}
            fullWidth
          />
          {fieldAndValue.value && (
            <Button onClick={handleFilterClearValue} size="small" color="error">
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
            <MenuItem value="=">Equal (=)</MenuItem>
            <MenuItem value="<">Less than (&lt;)</MenuItem>
            <MenuItem value=">">Greater than (&gt;)</MenuItem>
            <MenuItem value="<=">Less than or Equal (≤)</MenuItem>
            <MenuItem value=">=">Greater than or Equal (≥)</MenuItem>
          </Select>
          <TextField
            size="small"
            type="number"
            value={fieldAndValue.value || ""}
            onChange={(e) =>
              setFieldAndValue((prev) => ({
                ...prev,
                value: e.target.value,
              }))
            }
            fullWidth
          />
          {fieldAndValue.value && (
            <Button onClick={handleFilterClearValue} size="small" color="error">
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
          {fieldAndValue.value !== "" && (
            <Button onClick={handleFilterClearValue} size="small" color="error">
              Clear
            </Button>
          )}
        </>
      );
    }

    return (
      <>
        <TextField
          size="small"
          placeholder={`Search by ${fieldAndValue.label}`}
          value={fieldAndValue.value}
          onChange={(e) =>
            setFieldAndValue((prev) => ({
              ...prev,
              value: e.target.value,
            }))
          }
          fullWidth
        />
        {fieldAndValue.value && (
          <Button onClick={handleFilterClearValue} size="small" color="error">
            Clear
          </Button>
        )}
      </>
    );
  };

  const rows = data?.data || [];

  return (
    <Box overflow="auto">
      <Paper sx={{
        width: "100%",
        overflow: "hidden",
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }
      }}>
        <TableContainer sx={{
          height: "60vh",
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f1f1',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#c1c1c1',
            borderRadius: '4px',
            '&:hover': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#a8a8a8',
            },
          },
        }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: headerBg }}>
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  sx={{
                    borderRight: "1px solid",
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)',
                    textAlign: column.type === "number" ? "right" : "left",
                    color: 'white',
                    fontWeight: 700,
                    py: 1.25,
                  }}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <TableSortLabel
                      active={orderBy === column.field}
                      direction={orderBy === column.field ? order : "asc"}
                      onClick={() => handleRequestSort(column.field)}
                      sx={{
                        color: 'white !important',
                        '&.Mui-active': {
                          color: 'white !important',
                        },
                        '&:hover': {
                          color: 'rgba(255, 255, 255, 0.8) !important',
                        },
                        '& .MuiTableSortLabel-icon': {
                          color: 'white !important',
                        },
                      }}
                    >
                      {column.label}
                    </TableSortLabel>
                    {column.type !== "action" && (
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
                          sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white' } }}
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
                      <CircularProgress size={40} sx={{ color: titleColor }} />
                      <Typography variant="body2" color="text.secondary">
                        Loading medical allowance data...
                      </Typography>
                    </Box>
                  </Fade>
                </TableCell>
              </TableRow>
            </TableBody>
          ) : error ? (
            <TableBody>
              <TableRow sx={{ height: "70vh" }}>
                <TableCell colSpan={columns.length} align="center">
                  Error loading data: {error.message || "Unknown error"}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {rows.length === 0 ? (
                <TableRow sx={{ height: "70vh" }}>
                  <TableCell colSpan={columns.length} align="center">
                    {searchValue || fieldAndValue.value ? (
                      <>
                        No results found for{" "}
                        {searchValue && <b>search: "{searchValue}"</b>}
                        {searchValue && fieldAndValue.value && " and "}
                        {fieldAndValue.value && (
                          <b>
                            filter: {fieldAndValue.label}{" "}
                            {fieldAndValue.operator} {fieldAndValue.value}
                          </b>
                        )}
                        .
                      </>
                    ) : (
                      "No rows found."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, rowIndex) => {
                  const isRecentlyUpdated =
                    row.updatedAt &&
                    dayjs(row.updatedAt).isAfter(TEN_SECONDS_AGO);

                  return (
                    <TableRow
                      key={row._id || rowIndex}
                      hover
                      sx={{
                        backgroundColor: isRecentlyUpdated
                          ? theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : green[50]
                          : rowIndex % 2 === 0
                          ? theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : blueGrey[50]
                          : "transparent",
                        cursor: "pointer",
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: isRecentlyUpdated
                            ? theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.25)' : green[100]
                            : rowIndex % 2 === 0
                            ? theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : blueGrey[100]
                            : theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : "rgba(55, 94, 56, 0.04)",
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      {columns.map((column) => {
                        const cellValue = row[column.field];
                        return (
                          <TableCell
                            key={column.field}
                            sx={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontWeight: 500,
                              textAlign:
                                column.type === "number" ? "right" : "left",
                            }}
                          >
                            {column.render ? (
                              column.render(row)
                            ) : column.type === "date" ? (
                              formatDateToMDY(cellValue)
                            ) : column.type === "number" ? (
                              formatCurrency(parseFloat(cellValue) || 0)
                            ) : column.type === "boolean" ? (
                              cellValue ? (
                                "Yes"
                              ) : (
                                "No"
                              )
                            ) : column.searchable ? (
                              <TextSearchable columnName={cellValue} />
                            ) : (
                              cellValue || "-"
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          )}
        </Table>
      </TableContainer>

        {!isLoading && (
          <TablePagination
            rowsPerPageOptions={[10, ROWS_PER_PAGE, 50]}
            component="div"
            count={data?.totalRecords || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              borderTop: '1px solid rgba(224, 224, 224, 1)',
              backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : '#fafafa'
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
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: titleColor }}>
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