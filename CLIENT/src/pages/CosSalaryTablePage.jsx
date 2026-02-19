import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
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
import ScienceIcon from "@mui/icons-material/Science";
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

const CosSalaryTablePage = () => {
  const theme = useTheme();
  const { mode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [tableRows, setTableRows] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [settings, setSettings] = useState({
    useCPCSForEmployeeAdd: false,
    cosUsesCPCSIIRate: true,
  });
  const [loading, setLoading] = useState(true);
  const [seedLoading, setSeedLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState({ salaryGrade: "" });
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

  const activeFiltersCount = filters.salaryGrade ? 1 : 0;

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

      const res = await api.get("/cos-salary/table", { params });
      setTableRows(Array.isArray(res.data.rows) ? res.data.rows : []);
      setTotalRecords(res.data.totalRecords ?? 0);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load COS salary table");
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
        useCPCSForEmployeeAdd: res.data.useCPCSForEmployeeAdd ?? false,
        cosUsesCPCSIIRate: res.data.cosUsesCPCSIIRate !== false,
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

  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      await api.get("/cos-salary/table/seed");
      toast.success("COS salary table seeded successfully.");
      loadTable();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Seed failed");
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await api.put("/cpcs-salary/settings", {
        useCPCSForEmployeeAdd: settings.useCPCSForEmployeeAdd,
        cosUsesCPCSIIRate: settings.cosUsesCPCSIIRate,
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
    setFilters({ salaryGrade: "" });
    setFilterMenuAnchor(null);
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
      const res = await api.put(`/cos-salary/table/${rowId}`, { [stepKey]: num });
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
                COS Salary Table (SSL4)
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Manage salary grades for COS employees. Fourth-Tranche Salary Standardization Law (Effective January 1, 2019). Uses Salary Grade + Step.
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
            bgcolor: theme.palette.secondary.main,
            color: "#fff",
          }}
        >
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
            <TextField
              size="small"
              placeholder="Search Salary Grade, CPCS Grades..."
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
              <MenuItem sx={{ flexDirection: "column", alignItems: "stretch", py: 1 }}>
                <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>Salary Grade</Typography>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  value={filters.salaryGrade || ""}
                  onChange={(e) => handleFilterChange("salaryGrade", e.target.value)}
                  InputProps={{
                    endAdornment: filters.salaryGrade && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => handleClearFilter("salaryGrade")} edge="end"><ClearIcon fontSize="small" /></IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </MenuItem>
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
                <FormControlLabel
                  control={<Switch checked={settings.useCPCSForEmployeeAdd} onChange={(e) => setSettings((s) => ({ ...s, useCPCSForEmployeeAdd: e.target.checked }))} />}
                  label="Use SSL4 table for COS when adding employees (individual or bulk)"
                />
                <FormControlLabel
                  sx={{ mt: 1, display: "block" }}
                  control={<Switch checked={settings.cosUsesCPCSIIRate} onChange={(e) => setSettings((s) => ({ ...s, cosUsesCPCSIIRate: e.target.checked }))} />}
                  label="COS uses this table (SSL4)"
                />
                <Button variant="contained" onClick={handleSaveSettings} disabled={settingsSaving} sx={{ mt: 2 }}>
                  {settingsSaving ? "Saving…" : "Save settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Box sx={{ px: 3, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6">COS Salary Table</Typography>
            <Chip label="SSL4" color="success" size="small" sx={{ fontWeight: 600 }} />
            <Typography variant="caption" color="text.secondary">(Fourth Tranche)</Typography>
          </Box>
          {totalRecords === 0 && (
            <Button variant="outlined" startIcon={seedLoading ? <CircularProgress size={16} /> : <ScienceIcon />} onClick={handleSeed} disabled={seedLoading}>
              Seed table (33 rows from Fourth-Tranche PDF)
            </Button>
          )}
        </Box>

        <Paper sx={{ mx: 3, mb: 2, borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <TableContainer sx={{ maxHeight: "55vh" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", cursor: "pointer" }} onClick={() => handleSort("salaryGrade")}>
                    Salary Grade {sortField === "salaryGrade" && (sortDir === "asc" ? "▲" : "▼")}
                  </TableCell>
                  {STEP_COLS.map((s) => (
                    <TableCell key={s} align="right" sx={{ fontWeight: "bold" }}>Step {s}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((row) => (
                    <TableRow key={row._id} hover>
                      <TableCell>{row.salaryGrade}</TableCell>
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
              No data. Click &quot;Seed table (33 rows from Fourth-Tranche PDF)&quot; to create the COS table.
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

export default CosSalaryTablePage;
