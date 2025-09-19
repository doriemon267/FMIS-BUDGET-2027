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
  TableFooter,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  Chip,
  Card,
  CardContent,
  Grid,
  Zoom,
} from "@mui/material";
import { blueGrey, grey } from "@mui/material/colors";
import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import { TiFilter } from "react-icons/ti";
import { useSearch } from "../../context/SearchContext";
import TableBodyLoading from "../../global/components/TableBodyLoading";
import TextSearchable from "../../global/components/TextSearchable";
import formatCurrency from "../../utils/formatCurrency";
import { formatDateToMDY } from "../../utils/formatDate";
import { 
  Assessment as AssessmentIcon,
  AttachMoney as MoneyIcon,
  Gavel as GavelIcon,
} from "@mui/icons-material";

const CustomTable = ({
  columns,
  ROWS_PER_PAGE = 20,
  apiPath,
  dataListName = "data",
  overrideRows = null, // New prop for override data
}) => {
  const { searchValue, setSearchValue } = useSearch();
  const TEN_SECONDS_AGO = dayjs().subtract(10, "second");

  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("updatedAt");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [fieldAndValue, setFieldAndValue] = useState({
    field: "",
    value: "",
    label: "",
    operator: "=",
  });

  // When overrideRows are used, we rely on client‑side pagination.
  const allRows = overrideRows || [];
  let filteredRows = allRows;
  if (searchValue) {
    filteredRows = filteredRows.filter((row) => {
      return columns.some((col) => {
        const cell = row[col.field];
        return cell && cell.toString().toLowerCase().includes(searchValue.toLowerCase());
      });
    });
  }
  if (fieldAndValue.field && fieldAndValue.value) {
    filteredRows = filteredRows.filter((row) => {
      const cell = row[fieldAndValue.field];
      if (cell === undefined || cell === null) return false;
      if (typeof cell === "number") {
        const value = Number(fieldAndValue.value);
        switch (fieldAndValue.operator) {
          case "=":
            return cell === value;
          case "<":
            return cell < value;
          case ">":
            return cell > value;
          case "<=":
            return cell <= value;
          case ">=":
            return cell >= value;
          default:
            return false;
        }
      }
      return cell.toString().toLowerCase().includes(fieldAndValue.value.toLowerCase());
    });
  }
  const rows = filteredRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  // Compute totals for multiple columns
  const totals = useMemo(() => {
    return {
      courtAppearanceAmount: filteredRows.reduce((sum, row) => sum + (row.courtAppearanceAmount || 0), 0),
      noOfCourtAppearance: filteredRows.reduce((sum, row) => sum + (row.noOfCourtAppearance || 0), 0),
      totalRecords: filteredRows.length
    };
  }, [filteredRows]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleFilterClick = (event, columnKey, columnLabel) => {
    setFilterAnchorEl(event.currentTarget);
    setFieldAndValue({ field: columnKey, value: "", label: columnLabel, operator: "=" });
  };

  const handleFilterClearValue = () =>
    setFieldAndValue((prev) => ({ ...prev, value: "" }));

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
              setFieldAndValue((prev) => ({ ...prev, value: e.target.value }))
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
            setFieldAndValue((prev) => ({ ...prev, value: e.target.value }))
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

  return (
    <Box overflow="auto" sx={{ pb: 3 }}>
      {/* Summary Statistics */}
      {filteredRows.length > 0 && (
        <Paper sx={{ 
          p: 2, 
          mb: 2, 
          mx: 2, 
          borderRadius: 2, 
          boxShadow: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
            backgroundColor: '#fafafa'
          }
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold" color="#375e38">
              Court Appearance Summary
            </Typography>
            <Box>
              {searchValue && (
                <Chip
                  label={`Filtered by: "${searchValue}"`}
                  color="warning"
                  variant="outlined"
                  size="small"
                  onDelete={() => setSearchValue('')}
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
          </Box>

          {/* Summary Statistics Cards */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                sx={{ 
                  backgroundColor: '#e8f5e9', 
                  borderLeft: '4px solid #4caf50',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 20px rgba(76, 175, 80, 0.2)',
                    backgroundColor: '#d7f0da',
                  }
                }}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AssessmentIcon 
                      sx={{ 
                        color: '#4caf50',
                        fontSize: '2rem',
                        transition: 'transform 0.3s ease',
                        '.MuiCard-root:hover &': {
                          transform: 'scale(1.2)',
                        }
                      }} 
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Records</Typography>
                      <Typography variant="h6" fontWeight="bold">{totals.totalRecords}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                sx={{ 
                  backgroundColor: '#fff3e0', 
                  borderLeft: '4px solid #ff9800',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 20px rgba(255, 152, 0, 0.2)',
                    backgroundColor: '#ffe8cc',
                  }
                }}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <GavelIcon 
                      sx={{ 
                        color: '#ff9800',
                        fontSize: '2rem',
                        transition: 'transform 0.3s ease',
                        '.MuiCard-root:hover &': {
                          transform: 'scale(1.2)',
                        }
                      }} 
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Court Appearances</Typography>
                      <Typography variant="h6" fontWeight="bold">{totals.noOfCourtAppearance.toLocaleString()}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                sx={{ 
                  backgroundColor: '#e3f2fd', 
                  borderLeft: '4px solid #2196f3',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 20px rgba(33, 150, 243, 0.2)',
                    backgroundColor: '#d0e8fc',
                  }
                }}
              >
                <CardContent sx={{ py: 1 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <MoneyIcon 
                      sx={{ 
                        color: '#2196f3',
                        fontSize: '2rem',
                        transition: 'transform 0.3s ease',
                        '.MuiCard-root:hover &': {
                          transform: 'scale(1.2)',
                        }
                      }} 
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {formatCurrency(totals.courtAppearanceAmount)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Main Table with Zoom Animation */}
      <Zoom in={true} timeout={600}>
        <Paper sx={{ 
          width: "calc(100% - 32px)", 
          overflow: "hidden", 
          borderRadius: 2, 
          mx: 2, 
          boxShadow: 3,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }
        }}>
        <TableContainer sx={{ height: "78vh", borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#375e38",
                  zIndex: 2,
                  '& th:first-of-type': {
                    borderTopLeftRadius: 8,
                  },
                  '& th:last-child': {
                    borderTopRightRadius: 8,
                  },
                }}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.field}
                    sx={{
                      borderRight: "1px solid",
                      borderColor: "rgba(255, 255, 255, 0.3)",
                      textAlign: column.type === "number" ? "right" : "left",
                      padding: "12px 16px",
                      color: "white",
                      fontWeight: "bold",
                    }}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <TableSortLabel
                        active={orderBy === column.field}
                        direction={orderBy === column.field ? order : "asc"}
                        onClick={() => handleRequestSort(column.field)}
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
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            {filteredRows.length === 0 ? (
              <TableBody>
                <TableRow sx={{ height: "70vh" }}>
                  <TableCell colSpan={columns.length} align="center">
                    {searchValue ? (
                      <>No results found for <b>"{searchValue}"</b>.</>
                    ) : (
                      "No rows found."
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {rows.map((row, rowIndex) => (
                  <TableRow
                    key={row._id || rowIndex}
                    sx={{
                      backgroundColor: row.isModified
                        ? "#fff3e0"
                        : rowIndex % 2 === 0
                        ? blueGrey[50]
                        : "#fff",
                      '&:hover': {
                        backgroundColor: row.isModified
                          ? "#ffe0b2"
                          : "#e8f4f8",
                      },
                      transition: 'background-color 0.2s ease',
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
                            textAlign: column.type === "number" ? "right" : "left",
                            padding: "10px 16px",
                            borderBottom: "1px solid rgba(224, 224, 224, 0.5)",
                          }}
                        >
                          {column.render
                            ? column.render(row, rowIndex)
                            : column.type === "date"
                            ? formatDateToMDY(cellValue)
                            : column.type === "number"
                            ? formatCurrency(cellValue)
                            : column.type === "boolean"
                            ? cellValue
                              ? "Yes"
                              : "No"
                            : cellValue}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            )}

            <TableFooter>
              <TableRow
                sx={{
                  position: "sticky",
                  bottom: 0,
                  backgroundColor: "#375e38",
                  zIndex: 2,
                  '& td:first-of-type': {
                    borderBottomLeftRadius: 8,
                  },
                  '& td:last-child': {
                    borderBottomRightRadius: 8,
                  },
                }}
              >
                <TableCell
                  colSpan={columns.length - 2}
                  sx={{
                    textAlign: "right",
                    fontWeight: "bold",
                    color: "#fff",
                    borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                    padding: "12px 16px",
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#fff' }}>
                      Total Records: {totals.totalRecords}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 'bold' }}>
                      TOTALS:
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell
                  sx={{
                    textAlign: "right",
                    fontWeight: "bold",
                    color: "#fff",
                    borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                    padding: "12px 16px",
                  }}
                >
                  {totals.noOfCourtAppearance.toLocaleString()}
                </TableCell>
                <TableCell
                  sx={{
                    textAlign: "right",
                    fontWeight: "bold",
                    color: "#fff",
                    padding: "12px 16px",
                  }}
                >
                  {formatCurrency(totals.courtAppearanceAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[...new Set([10, ROWS_PER_PAGE, 50])]}
          component="div"
          count={filteredRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            borderTop: '1px solid #e0e0e0',
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            '& .MuiTablePagination-toolbar': {
              padding: '8px 16px',
            },
          }}
        />
        <Popover
          open={Boolean(filterAnchorEl)}
          anchorEl={filterAnchorEl}
          onClose={handleFilterClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1 }}>
            <Box sx={{ fontSize: 14, fontWeight: 600 }}>
              Filter by {fieldAndValue.label}
            </Box>
            {renderFilter()}
          </Box>
        </Popover>
      </Paper>
      </Zoom>
    </Box>
  );
};

export default CustomTable;
