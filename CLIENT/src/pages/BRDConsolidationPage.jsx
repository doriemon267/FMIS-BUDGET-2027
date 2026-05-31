import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Chip,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FolderOpen as FolderOpenIcon,
  LocationOn as LocationOnIcon,
  StorageRounded as StorageRoundedIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import api from '../config/api';
import OrganizationalInfoEditor from '../components/OrganizationalInfoEditor';

/** Format date for display */
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * BRD Consolidation Page
 * Displays the folder structure for BRD Level proposals organized by Region/Division or Department
 */

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`consolidation-tabpanel-${index}`}
      aria-labelledby={`consolidation-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Shared table layout styles for consistency
const tableHeaderCell = { fontWeight: 700, whiteSpace: 'nowrap', py: 1.5, px: 2, color: 'white' };
const tableBodyCell = { py: 1.25, px: 2 };

export default function BRDConsolidationPage() {
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const highlightBg = theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : '#f1f8ed';
  const titleColor = theme.palette.mode === 'dark' ? '#a5d6a7' : '#2d5016';

  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [regionalStructure, setRegionalStructure] = useState([]);
  const [centralOfficeStructure, setCentralOfficeStructure] = useState([]);
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [expandedDept, setExpandedDept] = useState(null);
  const [expandedDivision, setExpandedDivision] = useState(null);
  const [pageRegional, setPageRegional] = useState(0);
  const [rowsPerPageRegional, setRowsPerPageRegional] = useState(5);
  const [pageCO, setPageCO] = useState(0);
  const [rowsPerPageCO, setRowsPerPageCO] = useState(5);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedConsolidationId, setSelectedConsolidationId] = useState(null);

  const handleViewProposal = (proposalId) => (e) => {
    e?.stopPropagation?.();
    if (proposalId) navigate(`/allproposal?tab=all-proposals&proposalId=${proposalId}`);
  };

  // Handle opening the organizational info editor
  const handleEditOrgInfo = (consolidationId) => {
    setSelectedConsolidationId(consolidationId);
    setEditorOpen(true);
  };

  // Handle closing the editor
  const handleEditorClose = () => {
    setEditorOpen(false);
    setSelectedConsolidationId(null);
  };

  // Handle when organizational info is saved - refresh data
  const handleOrgInfoSaved = () => {
    // Re-fetch consolidation data to show updated org values
    fetchConsolidationData();
  };

  // Initialize with available fiscal years
  useEffect(() => {
    const initializeFiscalYears = async () => {
      try {
        const summaryRes = await api.get('/api/allproposal/consolidation/summary');
        const data = summaryRes.data?.data;
        if (data?.byFiscalYear && typeof data.byFiscalYear === 'object') {
          const years = Object.keys(data.byFiscalYear)
            .map(Number)
            .filter((n) => !Number.isNaN(n))
            .sort((a, b) => b - a);
          setAvailableFiscalYears(years);
          if (years.length > 0) {
            setFiscalYear(years[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching available fiscal years:', err);
      }
    };
    initializeFiscalYears();
  }, []);

  // Fetch all consolidation data
  useEffect(() => {
    fetchConsolidationData();
  }, [fiscalYear]);

  const fetchConsolidationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary
      const summaryRes = await api.get('/api/allproposal/consolidation/summary', {
        params: { fiscalYear }
      });
      setSummary(summaryRes.data?.data ?? null);

      // Fetch regional structure (only non–Central Office regions)
      const regionalRes = await api.get('/api/allproposal/consolidation/regions', {
        params: { fiscalYear }
      });
      const regionalData = Array.isArray(regionalRes.data?.data) ? regionalRes.data.data : [];
      setRegionalStructure(regionalData.filter((r) => (r.region || '').trim() !== 'Central Office'));

      // Fetch central office structure (Central Office only)
      const coRes = await api.get('/api/allproposal/consolidation/central-office', {
        params: { fiscalYear }
      });
      setCentralOfficeStructure(Array.isArray(coRes.data?.data) ? coRes.data.data : []);
    } catch (err) {
      console.error('Error fetching consolidation data:', err);
      setError(err.response?.data?.message || 'Failed to fetch consolidation data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRegionToggle = (regionName) => {
    setExpandedRegion(expandedRegion === regionName ? null : regionName);
  };

  const handleDeptToggle = (deptName) => {
    setExpandedDept(expandedDept === deptName ? null : deptName);
  };

  const handleChangePageRegional = (event, newPage) => {
    setPageRegional(newPage);
  };

  const handleChangeRowsPerPageRegional = (event) => {
    setRowsPerPageRegional(parseInt(event.target.value, 10));
    setPageRegional(0);
  };

  const handleChangePageCO = (event, newPage) => {
    setPageCO(newPage);
  };

  const handleChangeRowsPerPageCO = (event) => {
    setRowsPerPageCO(parseInt(event.target.value, 10));
    setPageCO(0);
  };

  if (error) {
    return (
      <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, md: 3 } }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => { setError(null); fetchConsolidationData(); }}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  const fallbackYears = [2024, 2025, 2026, 2027, 2028];
  const fiscalYearOptions = availableFiscalYears.length > 0 ? availableFiscalYears : fallbackYears;

  return (
    <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, md: 3 } }}>
      {/* Page Header */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center' }}>
            <StorageRoundedIcon sx={{ mr: 1.5, fontSize: 32, color: 'primary.main' }} />
            BRD Level Consolidation
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Proposals by Region/Division (Regional) and Central Office/Department (CO)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="fiscal-year-label">Fiscal Year</InputLabel>
            <Select
              labelId="fiscal-year-label"
              label="Fiscal Year"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            >
              {fiscalYearOptions.map((year) => (
                <MenuItem key={year} value={year}>{year}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton
            onClick={() => fetchConsolidationData()}
            disabled={loading}
            title="Refresh data"
            sx={{ bgcolor: 'action.hover' }}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Skeleton variant="rectangular" width="25%" height={100} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width="25%" height={100} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width="25%" height={100} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width="25%" height={100} sx={{ borderRadius: 1 }} />
          </Box>
        </Box>
      )}

      {!loading && (
        <>
      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ minHeight: 120, display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="overline" color="text.secondary" gutterBottom>
                  Total Proposals
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {summary.totalProposals}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ minHeight: 120, display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="overline" color="text.secondary" gutterBottom>
                  Total Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                  ₱{(summary.totalAmount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ minHeight: 120, display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="overline" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <LocationOnIcon sx={{ fontSize: 16 }} /> Regions
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {summary.regionsCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ minHeight: 120, display: 'flex', flexDirection: 'column', boxShadow: 2, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="overline" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <BusinessIcon sx={{ fontSize: 16 }} /> Central Office
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {summary.departmentsCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs Section */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab
          icon={<LocationOnIcon />}
          iconPosition="start"
          label={`Regional (${regionalStructure.length})`}
          id="consolidation-tab-0"
        />
        <Tab
          icon={<BusinessIcon />}
          iconPosition="start"
          label={`Central Office (${centralOfficeStructure.length})`}
          id="consolidation-tab-1"
        />
      </Tabs>

        {/* Regional Structure Tab — only non–Central Office regions */}
        <TabPanel value={tabValue} index={0}>
          {regionalStructure.length === 0 ? (
            <Alert severity="info" icon={<LocationOnIcon />}>
              No regional proposals in consolidation for this fiscal year. Records from Central Office appear under the Central Office tab.
            </Alert>
          ) : (
            <TableContainer sx={{ overflow: 'auto' }}>
              <Table size="medium" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: headerBg }}>
                    <TableCell sx={{ ...tableHeaderCell, width: '40%' }}>Region</TableCell>
                    <TableCell align="center" sx={{ ...tableHeaderCell, width: '20%' }}>Divisions</TableCell>
                    <TableCell align="right" sx={{ ...tableHeaderCell, width: '20%' }}>Total Proposals</TableCell>
                    <TableCell align="right" sx={{ ...tableHeaderCell, width: '20%' }}>Total Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {regionalStructure
                    .slice(pageRegional * rowsPerPageRegional, pageRegional * rowsPerPageRegional + rowsPerPageRegional)
                    .map((region, idx) => (
                      <React.Fragment key={idx}>
                        <TableRow
                          onClick={() => handleRegionToggle(region.region)}
                          sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                        >
                          <TableCell sx={tableBodyCell}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <IconButton
                                size="small"
                                sx={{
                                  transform: expandedRegion === region.region ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.3s',
                                }}
                              >
                                <ExpandMoreIcon />
                              </IconButton>
                              <LocationOnIcon sx={{ mr: 1, color: titleColor }} />
                              <Typography sx={{ fontWeight: 600 }}>{region.region}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center" sx={tableBodyCell}>
                            <Chip label={region.divisionCount} size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell align="right" sx={tableBodyCell}>
                            <Chip
                              label={region.divisions.reduce((sum, d) => sum + d.proposalCount, 0)}
                              size="small"
                              color="primary"
                            />
                          </TableCell>
                          <TableCell align="right" sx={tableBodyCell}>
                            ₱{region.divisions.reduce((sum, d) => sum + (d.totalAmount || 0), 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                          </TableCell>
                        </TableRow>

                        {/* Division Details */}
                        <TableRow>
                          <TableCell colSpan={4} sx={{ p: 0 }}>
                            <Collapse in={expandedRegion === region.region} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : '#fcfdfa' }}>
                                <Table size="small" sx={{ minWidth: 520 }}>
                                  <TableHead>
                                    <TableRow sx={{ backgroundColor: headerBg }}>
                                      <TableCell sx={{ ...tableHeaderCell, pl: 4 }}>Division</TableCell>
                                      <TableCell align="right" sx={tableHeaderCell}>Proposals</TableCell>
                                      <TableCell align="right" sx={tableHeaderCell}>Total Amount</TableCell>
                                      <TableCell align="center" sx={{ ...tableHeaderCell, width: 80 }}>Actions</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {region.divisions.map((division, divIdx) => (
                                      <React.Fragment key={divIdx}>
                                        <TableRow sx={{ backgroundColor: '#fff', '&:hover': { backgroundColor: 'action.hover' } }}>
                                          <TableCell
                                            sx={{ ...tableBodyCell, pl: 5, cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => setExpandedDivision(
                                              expandedDivision === `${region.region}-${division.division}` ? null : `${region.region}-${division.division}`
                                            )}
                                          >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                              <ExpandMoreIcon
                                                sx={{
                                                  transform: expandedDivision === `${region.region}-${division.division}` ? 'rotate(180deg)' : 'none',
                                                  transition: 'transform 0.2s',
                                                  visibility: division.proposals?.length > 0 ? 'visible' : 'hidden'
                                                }}
                                              />
                                              {division.division}
                                            </Box>
                                          </TableCell>
                                          <TableCell align="right" sx={tableBodyCell}>{division.proposalCount}</TableCell>
                                          <TableCell align="right" sx={tableBodyCell}>
                                            ₱{(division.totalAmount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                                          </TableCell>
                                          <TableCell align="center" sx={tableBodyCell}>
                                            {division.consolidationId && (
                                              <IconButton
                                                size="small"
                                                color="primary"
                                                title="Edit organizational information"
                                                onClick={(e) => { e.stopPropagation(); handleEditOrgInfo(division.consolidationId); }}
                                              >
                                                <EditIcon fontSize="small" />
                                              </IconButton>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                        <TableRow>
                                          <TableCell colSpan={4} sx={{ p: 0, borderBottom: 'none' }}>
                                            <Collapse in={expandedDivision === `${region.region}-${division.division}`} timeout="auto" unmountOnExit>
                                              <Box sx={{ py: 1.5, px: 2, backgroundColor: theme.palette.mode === 'dark' ? 'background.default' : '#f4f7f2' }}>
                                                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                                                  Proposals ({division.proposalCount})
                                                </Typography>
                                                <TableContainer sx={{ overflow: 'auto' }}>
                                                  <Table size="small" sx={{ minWidth: 900 }}>
                                                    <TableHead>
                                                      <TableRow sx={{ backgroundColor: headerBg }}>
                                                        <TableCell sx={{ ...tableHeaderCell, pl: 6, minWidth: 200 }}>Proposal Title</TableCell>
                                                        <TableCell sx={{ ...tableHeaderCell, minWidth: 90 }}>Budget Type</TableCell>
                                                        <TableCell align="center" sx={{ ...tableHeaderCell, minWidth: 80 }}>Fiscal Year</TableCell>
                                                        <TableCell align="right" sx={{ ...tableHeaderCell, minWidth: 120 }}>Amount</TableCell>
                                                        <TableCell sx={{ ...tableHeaderCell, minWidth: 110 }}>Date Consolidated</TableCell>
                                                        <TableCell sx={{ ...tableHeaderCell, minWidth: 90 }}>Status</TableCell>
                                                        <TableCell align="center" sx={{ ...tableHeaderCell, width: 72 }}>Actions</TableCell>
                                                      </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                      {division.proposals?.map((proposal, propIdx) => (
                                                        <TableRow key={propIdx} sx={{ backgroundColor: '#fff' }}>
                                                          <TableCell sx={{ ...tableBodyCell, pl: 6 }}>{proposal.title || 'Untitled'}</TableCell>
                                                          <TableCell sx={tableBodyCell}>
                                                            <Chip label={proposal.budgetType || 'N/A'} size="small" color="primary" variant="outlined" />
                                                          </TableCell>
                                                          <TableCell align="center" sx={tableBodyCell}>{proposal.fiscalYear ?? '—'}</TableCell>
                                                          <TableCell align="right" sx={tableBodyCell}>
                                                            ₱{(proposal.amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                                                          </TableCell>
                                                          <TableCell sx={tableBodyCell}>{formatDate(proposal.consolidatedAt)}</TableCell>
                                                          <TableCell sx={tableBodyCell}>
                                                            <Chip label={proposal.status || 'ACTIVE'} size="small" variant="filled" color={proposal.status === 'ACTIVE' ? 'success' : 'default'} />
                                                          </TableCell>
                                                          <TableCell align="center" sx={tableBodyCell}>
                                                            <Tooltip title="View proposal">
                                                              <IconButton size="small" color="primary" onClick={handleViewProposal(proposal.proposalId)}>
                                                                <VisibilityIcon fontSize="small" />
                                                              </IconButton>
                                                            </Tooltip>
                                                          </TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </TableContainer>
                                              </Box>
                                            </Collapse>
                                          </TableCell>
                                        </TableRow>
                                      </React.Fragment>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={regionalStructure.length}
            rowsPerPage={rowsPerPageRegional}
            page={pageRegional}
            onPageChange={handleChangePageRegional}
            onRowsPerPageChange={handleChangeRowsPerPageRegional}
          />
        </TabPanel>

        {/* Central Office Tab — only Central Office records */}
        <TabPanel value={tabValue} index={1}>
          {centralOfficeStructure.length === 0 ? (
            <Alert severity="info" icon={<BusinessIcon />}>
              No Central Office proposals in consolidation for this fiscal year. Regional records appear under the Regional tab.
            </Alert>
          ) : (
            <TableContainer sx={{ overflow: 'auto' }}>
              <Table size="medium" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: headerBg }}>
                    <TableCell sx={{ ...tableHeaderCell, width: '40%' }}>Department</TableCell>
                    <TableCell align="right" sx={{ ...tableHeaderCell, width: '15%' }}>Proposals</TableCell>
                    <TableCell align="right" sx={{ ...tableHeaderCell, width: '25%' }}>Total Amount</TableCell>
                    <TableCell align="center" sx={{ ...tableHeaderCell, width: '20%' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {centralOfficeStructure
                    .slice(pageCO * rowsPerPageCO, pageCO * rowsPerPageCO + rowsPerPageCO)
                    .map((dept, idx) => (
                      <React.Fragment key={idx}>
                        <TableRow
                          onClick={() => handleDeptToggle(dept.department)}
                          sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                        >
                          <TableCell sx={tableBodyCell}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <IconButton
                                size="small"
                                sx={{
                                  transform: expandedDept === dept.department ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.3s',
                                  visibility: dept.proposals?.length > 0 ? 'visible' : 'hidden'
                                }}
                              >
                                <ExpandMoreIcon />
                              </IconButton>
                              <FolderOpenIcon sx={{ mr: 1, color: 'warning.main' }} />
                              <Typography sx={{ fontWeight: 600 }}>{dept.department}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={tableBodyCell}>
                            <Chip label={dept.proposalCount} size="small" color="warning" />
                          </TableCell>
                          <TableCell align="right" sx={tableBodyCell}>
                            ₱{(dept.totalAmount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell align="center" sx={tableBodyCell}>
                            {dept.consolidationId && (
                              <IconButton
                                size="small"
                                color="primary"
                                title="Edit organizational information"
                                onClick={(e) => { e.stopPropagation(); handleEditOrgInfo(dept.consolidationId); }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={4} sx={{ p: 0, borderBottom: 'none' }}>
                            <Collapse in={expandedDept === dept.department} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 1.5, px: 2, backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : '#fcfdfa' }}>
                                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                                  Proposals ({dept.proposalCount})
                                </Typography>
                                <TableContainer sx={{ overflow: 'auto' }}>
                                  <Table size="small" sx={{ minWidth: 900 }}>
                                    <TableHead>
                                      <TableRow sx={{ backgroundColor: headerBg }}>
                                        <TableCell sx={{ ...tableHeaderCell, pl: 4, minWidth: 200 }}>Proposal Title</TableCell>
                                        <TableCell sx={{ ...tableHeaderCell, minWidth: 90 }}>Budget Type</TableCell>
                                        <TableCell align="center" sx={{ ...tableHeaderCell, minWidth: 80 }}>Fiscal Year</TableCell>
                                        <TableCell align="right" sx={{ ...tableHeaderCell, minWidth: 120 }}>Amount</TableCell>
                                        <TableCell sx={{ ...tableHeaderCell, minWidth: 110 }}>Date Consolidated</TableCell>
                                        <TableCell sx={{ ...tableHeaderCell, minWidth: 90 }}>Status</TableCell>
                                        <TableCell align="center" sx={{ ...tableHeaderCell, width: 72 }}>Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {dept.proposals?.map((proposal, propIdx) => (
                                        <TableRow key={propIdx} sx={{ backgroundColor: '#fff' }}>
                                          <TableCell sx={{ ...tableBodyCell, pl: 4 }}>{proposal.title || 'Untitled'}</TableCell>
                                          <TableCell sx={tableBodyCell}>
                                            <Chip label={proposal.budgetType || 'N/A'} size="small" color="warning" variant="outlined" />
                                          </TableCell>
                                          <TableCell align="center" sx={tableBodyCell}>{proposal.fiscalYear ?? '—'}</TableCell>
                                          <TableCell align="right" sx={tableBodyCell}>
                                            ₱{(proposal.amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                                          </TableCell>
                                          <TableCell sx={tableBodyCell}>{formatDate(proposal.consolidatedAt)}</TableCell>
                                          <TableCell sx={tableBodyCell}>
                                            <Chip label={proposal.status || 'ACTIVE'} size="small" variant="filled" color={proposal.status === 'ACTIVE' ? 'success' : 'default'} />
                                          </TableCell>
                                          <TableCell align="center" sx={tableBodyCell}>
                                            <Tooltip title="View proposal">
                                              <IconButton size="small" color="primary" onClick={handleViewProposal(proposal.proposalId)}>
                                                <VisibilityIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={centralOfficeStructure.length}
            rowsPerPage={rowsPerPageCO}
            page={pageCO}
            onPageChange={handleChangePageCO}
            onRowsPerPageChange={handleChangeRowsPerPageCO}
          />
        </TabPanel>

      {/* Summary Stats */}
      {summary && (
        <Paper sx={{ p: 3, mt: 4, backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : '#fcfdfa', border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Model Type Distribution
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(summary.byModelType || {}).map(([modelType, count]) => (
              <Grid item xs={12} sm={6} md={4} key={modelType}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="textSecondary" gutterBottom>
                      {modelType}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {count}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
        </>
      )}

      {/* Organizational Info Editor Modal */}
      <OrganizationalInfoEditor
        open={editorOpen}
        consolidationId={selectedConsolidationId}
        onClose={handleEditorClose}
        onSaved={handleOrgInfoSaved}
      />
    </Container>
  );
}
