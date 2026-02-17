import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Stack,
  alpha,
  useTheme,
} from "@mui/material";
import { MdHistory, MdRefresh, MdVisibility } from "react-icons/md";
import { format } from "date-fns";
import DashboardHeader from "../global/components/DashboardHeader";
import api from "../config/api";

// Resources that have activity logging (business data only; we do not log READs on the logs API itself)
const RESOURCES = [
  "Settings",
  "CompensationSettings",
  "Proposal",
  "WorkflowTemplate",
  "Tier",
];
const ACTIONS = ["CREATE", "UPDATE", "DELETE", "READ", "EXPORT", "CUSTOM"];

function getActionColor(action, theme) {
  switch (String(action).toUpperCase()) {
    case "CREATE":
      return theme.palette.success.main;
    case "UPDATE":
      return theme.palette.primary.main;
    case "DELETE":
      return theme.palette.error.main;
    case "READ":
      return theme.palette.info.main;
    default:
      return theme.palette.grey[600];
  }
}

const UserActivityLogsPage = () => {
  const theme = useTheme();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    userId: "",
    resource: "",
    action: "",
    resourceId: "",
    startDate: "",
    endDate: "",
  });
  const [detailLog, setDetailLog] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchLogs = useCallback(async (page = 1, limit = 25) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        ...(filters.userId && { userId: filters.userId.trim() }),
        ...(filters.resource && { resource: filters.resource }),
        ...(filters.action && { action: filters.action }),
        ...(filters.resourceId && { resourceId: filters.resourceId.trim() }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      };
      const res = await api.get("/user-activity-logs", { params });
      if (res?.data?.success) {
        setLogs(res.data.data || []);
        setPagination((prev) => ({
          ...prev,
          page: res.data.pagination?.page ?? page,
          limit: res.data.pagination?.limit ?? limit,
          total: res.data.pagination?.total ?? 0,
          pages: res.data.pagination?.pages ?? 0,
        }));
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("User activity logs fetch error:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.userId,
    filters.resource,
    filters.action,
    filters.resourceId,
    filters.startDate,
    filters.endDate,
  ]);

  useEffect(() => {
    fetchLogs(1, 25);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  const handleRefresh = () => {
    fetchLogs(pagination.page, pagination.limit);
  };
  const handleApplyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchLogs(1, pagination.limit);
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handlePageChange = (_, newPage) => {
    const nextPage = newPage + 1;
    setPagination((prev) => ({ ...prev, page: nextPage }));
    fetchLogs(nextPage, pagination.limit);
  };

  const handleRowsPerPageChange = (e) => {
    const limit = Math.min(100, Math.max(1, Number(e.target.value) || 25));
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
    fetchLogs(1, limit);
  };

  const fetchDetail = async (id) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetailLog(null);
    try {
      const res = await api.get(`/user-activity-logs/${id}`);
      if (res?.data?.success) setDetailLog(res.data.data);
    } catch (err) {
      console.error("Log detail fetch error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <DashboardHeader
        title="User Activity Logs"
        description="View system-wide user activity (Super Admin only)"
        searchable={false}
        childElement={
          <Button
            variant="contained"
            onClick={handleRefresh}
            disabled={loading}
            startIcon={<MdRefresh />}
            sx={{
              backgroundColor: theme.palette.secondary.main,
              "&:hover": { backgroundColor: theme.palette.primary.main },
            }}
          >
            Refresh
          </Button>
        }
      />

      <Paper
        sx={{
          p: 2,
          mb: 2,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Filters
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
          <TextField
            size="small"
            label="User ID"
            value={filters.userId}
            onChange={(e) => handleFilterChange("userId", e.target.value)}
            placeholder="Filter by user ID"
            sx={{ minWidth: 160 }}
          />
          <TextField
            select
            size="small"
            label="Resource"
            value={filters.resource}
            onChange={(e) => handleFilterChange("resource", e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {RESOURCES.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Action"
            value={filters.action}
            onChange={(e) => handleFilterChange("action", e.target.value)}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="">All</MenuItem>
            {ACTIONS.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Resource ID"
            value={filters.resourceId}
            onChange={(e) => handleFilterChange("resourceId", e.target.value)}
            placeholder="e.g. MongoDB ObjectId"
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            label="Start date"
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label="End date"
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <Button variant="outlined" onClick={handleApplyFilters}>
            Apply
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Date &amp; Time</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Resource</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Resource ID</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Details
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  Loading…
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }} color="text.secondary">
                  No logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell>
                    {row.timestamp
                      ? format(new Date(row.timestamp), "MMM dd, yyyy HH:mm:ss")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {row.userName || row.userId || "—"}
                    </Typography>
                    {row.userId && (
                      <Typography variant="caption" color="text.secondary">
                        {row.userId}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.action || "—"}
                      sx={{
                        bgcolor: alpha(getActionColor(row.action, theme), 0.15),
                        color: getActionColor(row.action, theme),
                        borderColor: getActionColor(row.action, theme),
                        border: "1px solid",
                      }}
                    />
                  </TableCell>
                  <TableCell>{row.resource || "—"}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" noWrap sx={{ maxWidth: 140 }}>
                      {row.resourceId || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View full log">
                      <IconButton
                        size="small"
                        onClick={() => fetchDetail(row._id)}
                        color="primary"
                      >
                        <MdVisibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page - 1}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Rows per page:"
        />
      </TableContainer>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MdHistory />
            <span>Log details</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : detailLog ? (
            <Stack spacing={1.5}>
              <Typography variant="caption" color="text.secondary">
                ID: {detailLog._id}
              </Typography>
              <Box>
                <Typography variant="caption" color="text.secondary">User</Typography>
                <Typography variant="body2">
                  {detailLog.userName || detailLog.userId} ({detailLog.userId})
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Action / Resource</Typography>
                <Typography variant="body2">
                  {detailLog.action} on {detailLog.resource}
                  {detailLog.resourceId && ` (${detailLog.resourceId})`}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                <Typography variant="body2">
                  {detailLog.timestamp
                    ? format(new Date(detailLog.timestamp), "PPpp")
                    : "—"}
                </Typography>
              </Box>
              {detailLog.method && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Method / Path</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {detailLog.method} {detailLog.path}
                  </Typography>
                </Box>
              )}
              {detailLog.details && Object.keys(detailLog.details).length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Details</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
                    <pre style={{ margin: 0, fontSize: "0.75rem", overflow: "auto" }}>
                      {JSON.stringify(detailLog.details, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
              {detailLog.snapshot && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Snapshot (before / after)</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
                    <pre style={{ margin: 0, fontSize: "0.75rem", overflow: "auto" }}>
                      {JSON.stringify(detailLog.snapshot, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
              {detailLog.userAgent && (
                <Box>
                  <Typography variant="caption" color="text.secondary">User agent</Typography>
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    {detailLog.userAgent}
                  </Typography>
                </Box>
              )}
            </Stack>
          ) : (
            <Typography color="text.secondary">No data.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserActivityLogsPage;
