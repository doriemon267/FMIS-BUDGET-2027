import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Grid,
  FormControlLabel,
  Switch,
  Chip,
  Alert,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  InputAdornment,
  Menu,
  MenuItem,
  TablePagination,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import PesoIcon from "../components/icons/PesoIcon";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import ClearIcon from "@mui/icons-material/Clear";
import api from "../config/api";
import { toast } from "react-hot-toast";
import { useThemeContext } from "../context/ThemeContext";

const STEP_COLS = [1, 2, 3, 4, 5, 6, 7, 8];
const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const EmployeeSalaryTablePage = () => {
  const theme = useTheme();
  const { mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [tableRows, setTableRows] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [settings, setSettings] = useState({
    cpcs1AppointmentTypes: ["CASUAL"],
    cpcs2AppointmentTypes: ["PERMANENT"],
    inactiveUsesCPCS1: true,
  });
  const [loading, setLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState({
    salaryGrade: "",
    jobGrade: "",
    cpcs1JobGrade: "",
    cpcs2PayGrade: "",
  });
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState("salaryGrade");
  const [sortDir, setSortDir] = useState("asc");
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingAmount, setSavingAmount] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchValue), 300);
    return () => clearTimeout(t);
  }, [searchValue]);

  const activeFiltersCount = [filters.salaryGrade, filters.jobGrade, filters.cpcs1JobGrade, filters.cpcs2PayGrade].filter(Boolean).length;

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        sortField,
        sortDir,
      };
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
      if (filters.salaryGrade) params.salaryGrade = filters.salaryGrade;
      if (filters.jobGrade) params.jobGrade = filters.jobGrade;
      if (filters.cpcs1JobGrade) params.cpcs1JobGrade = filters.cpcs1JobGrade;
      if (filters.cpcs2PayGrade) params.cpcs2PayGrade = filters.cpcs2PayGrade;

      const res = await api.get("/cpcs-salary/table", { params });
      setTableRows(Array.isArray(res.data.rows) ? res.data.rows : []);
      setTotalRecords(res.data.totalRecords ?? 0);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load salary table");
      setTableRows([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, filters, sortField, sortDir]);

  const loadSettings = async () => {
    try {
      const res = await api.get("/cpcs-salary/settings");
      setSettings({
        cpcs1AppointmentTypes: res.data.cpcs1AppointmentTypes || ["CASUAL"],
        cpcs2AppointmentTypes: res.data.cpcs2AppointmentTypes || ["PERMANENT"],
        inactiveUsesCPCS1: res.data.inactiveUsesCPCS1 !== false,
      });
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load settings");
    }
  };

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filters, rowsPerPage, sortField, sortDir]);

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await api.put("/cpcs-salary/settings", {
        cpcs1AppointmentTypes: settings.cpcs1AppointmentTypes,
        cpcs2AppointmentTypes: settings.cpcs2AppointmentTypes,
        inactiveUsesCPCS1: settings.inactiveUsesCPCS1,
      });
      toast.success("Settings saved.");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((f) => ({ ...f, [field]: value }));
  };

  const handleClearFilter = (field) => {
    setFilters((f) => ({ ...f, [field]: "" }));
  };

  const handleClearAllFilters = () => {
    setFilters({ salaryGrade: "", jobGrade: "", cpcs1JobGrade: "", cpcs2PayGrade: "" });
    setFilterMenuAnchor(null);
  };

  const handleSeedFromExcel = async () => {
    setSeedLoading(true);
    try {
      await api.post("/cpcs-salary/table/seed-from-excel");
      toast.success("Permanent & Casual table seeded from CPCS II Rate.xlsx");
      loadTable();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Seed from Excel failed");
    } finally {
      setSeedLoading(false);
    }
  };

  const handleAmountClick = (row, stepKey) => {
    setEditingCell({ rowId: row._id, stepKey });
    setEditingValue(String(row[stepKey] ?? ""));
  };

  const handleAmountSave = async (rowId, stepKey, value) => {
    const num = value === "" ? null : parseInt(String(value).replace(/,/g, ""), 10);
    if (value !== "" && isNaN(num)) {
      toast.error("Invalid amount");
      setEditingCell(null);
      return;
    }
    setSavingAmount(true);
    try {
      const res = await api.put(`/cpcs-salary/table/${rowId}`, { [stepKey]: num });
      setTableRows((prev) => prev.map((r) => (r._id === rowId ? { ...r, ...res.data } : r)));
      toast.success("Amount updated");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to update amount");
    } finally {
      setSavingAmount(false);
      setEditingCell(null);
    }
  };

  const handleAmountBlur = (row, stepKey) => {
    if (editingCell?.rowId === row._id && editingCell?.stepKey === stepKey) {
      handleAmountSave(row._id, stepKey, editingValue);
    }
  };

  const handleAmountKeyDown = (e, row, stepKey) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAmountSave(row._id, stepKey, editingValue);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  if (loading && tableRows.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          borderRadius: "12px",
          overflow: "hidden",
          mb: 3,
          transition: "box-shadow 0.3s",
          "&:hover": { boxShadow: "0 8px 24px rgba(0,0,0,0.1)" },
        }}
      >
        {/* Header Section */}
        <Paper
          sx={{
            mx: 0,
            p: 3,
            borderRadius: 0,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: "white",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <PesoIcon sx={{ fontSize: 36 }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Permanent &amp; Casual Salary Table
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Manage salary grades for Permanent and Casual employees. Use CPCS II Rate data. Assign CPCS 1 (Job Grade) or CPCS 2 (Salary Grade) via Settings.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${theme.palette.mode === "light" ? "#e0e0e0" : "#424242"}`,
            boxShadow: "none",
            bgcolor: theme.palette.primary.main,
            color: "#fff",
          }}
        >
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
            <TextField
              size="small"
              placeholder="Search Salary Grade, Job Grade..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "rgba(255,255,255,0.7)" }} />
                  </InputAdornment>
                ),
                endAdornment: searchValue && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchValue("")} sx={{ color: "rgba(255,255,255,0.8)" }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  borderRadius: 1,
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.5)" },
                },
              }}
              sx={{ minWidth: 260 }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<FilterListIcon />}
              endIcon={activeFiltersCount > 0 ? <Chip size="small" label={activeFiltersCount} sx={{ bgcolor: "rgba(255,255,255,0.3)", color: "#fff" }} /> : null}
              onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
              sx={{
                borderColor: "rgba(255,255,255,0.5)",
                color: "#fff",
                textTransform: "none",
                "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              Filters
            </Button>
            <Menu anchorEl={filterMenuAnchor} open={Boolean(filterMenuAnchor)} onClose={() => setFilterMenuAnchor(null)} PaperProps={{ sx: { width: 280, borderRadius: "8px", mt: 1.5 } }}>
              <Box sx={{ px: 2, py: 1 }}><Typography variant="subtitle2">Filter by</Typography></Box>
              <Divider />
              {["salaryGrade", "cpcs1JobGrade", "cpcs2PayGrade"].map((key) => (
                <MenuItem key={key} sx={{ flexDirection: "column", alignItems: "stretch", py: 1 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                    {key === "salaryGrade" ? "Salary Grade" : key === "cpcs1JobGrade" ? "CPCS 1 Job Grade" : "CPCS 2 Pay Grade"}
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    value={filters[key] || ""}
                    onChange={(e) => handleFilterChange(key, e.target.value)}
                    InputProps={{
                      endAdornment: filters[key] && (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => handleClearFilter(key)} edge="end"><ClearIcon fontSize="small" /></IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </MenuItem>
              ))}
              <Divider />
              <Box sx={{ p: 1, display: "flex", justifyContent: "flex-end" }}>
                <Button size="small" onClick={handleClearAllFilters} disabled={activeFiltersCount === 0}>Clear All</Button>
              </Box>
            </Menu>
            <Tooltip title="Refresh">
              <IconButton onClick={() => loadTable()} sx={{ color: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "rgba(255,255,255,0.15)" } }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", ml: "auto" }}>
              Showing {tableRows.length > 0 ? page * rowsPerPage + 1 : 0}–{Math.min((page + 1) * rowsPerPage, totalRecords)} of {totalRecords}
            </Typography>
          </Box>
        </Box>

        <Card sx={{ m: 3, mb: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <SettingsIcon /> Settings
              </Typography>
              <Button size="small" onClick={() => setShowSettings(!showSettings)}>{showSettings ? "Hide" : "Show"}</Button>
            </Box>
            {showSettings && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    CPCS 1 (Job Grade + Step) — shared salary table:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
                    {["CASUAL", "PERMANENT"].map((t) => (
                      <Chip
                        key={`cpcs1-${t}`}
                        label={t}
                        color={settings.cpcs1AppointmentTypes?.includes(t) ? "primary" : "default"}
                        variant={settings.cpcs1AppointmentTypes?.includes(t) ? "filled" : "outlined"}
                        onClick={() => {
                          const in1 = settings.cpcs1AppointmentTypes?.includes(t);
                          if (in1) {
                            setSettings((s) => ({
                              ...s,
                              cpcs1AppointmentTypes: (s.cpcs1AppointmentTypes || []).filter((x) => x !== t),
                            }));
                          } else {
                            setSettings((s) => ({
                              ...s,
                              cpcs2AppointmentTypes: (s.cpcs2AppointmentTypes || []).filter((x) => x !== t),
                              cpcs1AppointmentTypes: [...(s.cpcs1AppointmentTypes || []).filter((x) => x !== t), t],
                            }));
                          }
                        }}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    CPCS 2 (Salary Grade + Step) — shared salary table:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
                    {["CASUAL", "PERMANENT"].map((t) => (
                      <Chip
                        key={`cpcs2-${t}`}
                        label={t}
                        color={settings.cpcs2AppointmentTypes?.includes(t) ? "secondary" : "default"}
                        variant={settings.cpcs2AppointmentTypes?.includes(t) ? "filled" : "outlined"}
                        onClick={() => {
                          const in2 = settings.cpcs2AppointmentTypes?.includes(t);
                          if (in2) {
                            setSettings((s) => ({
                              ...s,
                              cpcs2AppointmentTypes: (s.cpcs2AppointmentTypes || []).filter((x) => x !== t),
                            }));
                          } else {
                            setSettings((s) => ({
                              ...s,
                              cpcs1AppointmentTypes: (s.cpcs1AppointmentTypes || []).filter((x) => x !== t),
                              cpcs2AppointmentTypes: [...(s.cpcs2AppointmentTypes || []).filter((x) => x !== t), t],
                            }));
                          }
                        }}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
                <FormControlLabel
                  sx={{ mt: 2, display: "block" }}
                  control={<Switch checked={settings.inactiveUsesCPCS1} onChange={(e) => setSettings((s) => ({ ...s, inactiveUsesCPCS1: e.target.checked }))} />}
                  label="Inactive employees (CASUAL) use CPCS 1 for rate"
                />
                <Alert severity="info" sx={{ mt: 2 }}>
                  Permanent and Casual share one table. Use chips to assign CPCS 1 (JG) or CPCS 2 (SG). COS uses a separate table — see COS Salary Table (SSL4).
                </Alert>
                <Button variant="contained" onClick={handleSaveSettings} disabled={settingsSaving} sx={{ mt: 2 }}>
                  {settingsSaving ? "Saving…" : "Save settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Box sx={{ px: 3, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6">Permanent &amp; Casual Salary Table</Typography>
            <Chip label="CPCS II" color="info" size="small" sx={{ fontWeight: 600 }} />
            {/* <Typography variant="caption" color="text.secondary">(from CPCS II Rate.xlsx)</Typography> */}
          </Box>
          {/* <Button variant="outlined" startIcon={seedLoading ? <CircularProgress size={16} /> : null} onClick={handleSeedFromExcel} disabled={seedLoading}>
            {seedLoading ? "Seeding…" : "Seed from Excel"}
          </Button> */}
        </Box>

        <Paper sx={{ mx: 3, mb: 2, borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <TableContainer sx={{ maxHeight: "55vh" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", cursor: "pointer" }} onClick={() => handleSort("salaryGrade")}>
                    Salary Grade {sortField === "salaryGrade" && (sortDir === "asc" ? "▲" : "▼")}
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", cursor: "pointer" }} onClick={() => handleSort("cpcs1JobGrade")}>
                    CPCS 1 JG {sortField === "cpcs1JobGrade" && (sortDir === "asc" ? "▲" : "▼")}
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", cursor: "pointer" }} onClick={() => handleSort("cpcs2PayGrade")}>
                    CPCS 2 PG {sortField === "cpcs2PayGrade" && (sortDir === "asc" ? "▲" : "▼")}
                  </TableCell>
                  {STEP_COLS.map((s) => (
                    <TableCell key={s} align="right" sx={{ fontWeight: "bold" }}>Step {s}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((row) => (
                    <TableRow key={row._id} hover>
                      <TableCell>{row.salaryGrade ?? "—"}</TableCell>
                      <TableCell>{row.cpcs1JobGrade ?? "—"}</TableCell>
                      <TableCell>{row.cpcs2PayGrade ?? "—"}</TableCell>
                      {STEP_COLS.map((s) => {
                        const stepKey = `step${s}`;
                        const isEditing = editingCell?.rowId === row._id && editingCell?.stepKey === stepKey;
                        return (
                          <TableCell key={s} align="right" sx={{ minWidth: 100 }}>
                            {isEditing ? (
                              <TextField
                                size="small"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={() => handleAmountBlur(row, stepKey)}
                                onKeyDown={(e) => handleAmountKeyDown(e, row, stepKey)}
                                autoFocus
                                disabled={savingAmount}
                                inputProps={{ style: { textAlign: "right" } }}
                                sx={{ "& .MuiInputBase-input": { py: 0.5 } }}
                              />
                            ) : (
                              <Box
                                component="span"
                                onClick={() => handleAmountClick(row, stepKey)}
                                sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                              >
                                {row[stepKey] != null ? Number(row[stepKey]).toLocaleString() : "—"}
                              </Box>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {!loading && tableRows.length === 0 && totalRecords === 0 && (
            <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
              No data. Click &quot;Seed from Excel&quot; to load from CPCS II Rate.xlsx (place file in SERVER/uploads).
            </Box>
          )}
          <TablePagination
            component="div"
            count={totalRecords}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            labelRowsPerPage="Rows per page:"
          />
        </Paper>
      </Paper>
    </>
  );
};

export default EmployeeSalaryTablePage;
