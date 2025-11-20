import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FolderOpen as FolderOpenIcon,
  LocationOn as LocationOnIcon,
  StorageRounded as StorageRoundedIcon,
} from '@mui/icons-material';
import api from '../config/api';

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

export default function BRDConsolidationPage() {
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

  // Fetch all consolidation data
  useEffect(() => {
    fetchConsolidationData();
  }, [fiscalYear]);

  const fetchConsolidationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary
      const summaryRes = await api.get('/api/new-proposal-workflow/consolidation/summary', {
        params: { fiscalYear }
      });
      setSummary(summaryRes.data.data);

      // Fetch regional structure
      const regionalRes = await api.get('/api/new-proposal-workflow/consolidation/regions', {
        params: { fiscalYear }
      });
      setRegionalStructure(regionalRes.data.data);

      // Fetch central office structure
      const coRes = await api.get('/api/new-proposal-workflow/consolidation/central-office', {
        params: { fiscalYear }
      });
      setCentralOfficeStructure(coRes.data.data);
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

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center' }}>
            <StorageRoundedIcon sx={{ mr: 2, fontSize: 32 }} />
            BRD Level Consolidation Structure
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Organize proposals by Region/Division and Central Office/Department
          </Typography>
        </Box>
        
        {/* Fiscal Year Filter */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Fiscal Year:
          </Typography>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px',
              cursor: 'pointer',
              backgroundColor: '#fff',
              minWidth: '120px'
            }}
          >
            {[2024, 2025, 2026, 2027, 2028].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </Box>
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#e3f2fd' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="textSecondary" gutterBottom>
                  Total Proposals
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2' }}>
                  {summary.totalProposals}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#f3e5f5' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="textSecondary" gutterBottom>
                  Total Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
                  ₱{(summary.totalAmount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#e8f5e9' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="textSecondary" gutterBottom>
                  Regions
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#388e3c' }}>
                  {summary.regionsCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#fff3e0' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="textSecondary" gutterBottom>
                  Departments (CO)
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#f57c00' }}>
                  {summary.departmentsCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs Section */}
      <Paper>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label={`Regional Structure (${regionalStructure.length} regions)`} id="consolidation-tab-0" />
          <Tab label={`Central Office (${centralOfficeStructure.length} departments)`} id="consolidation-tab-1" />
        </Tabs>

        {/* Regional Structure Tab */}
        <TabPanel value={tabValue} index={0}>
          {regionalStructure.length === 0 ? (
            <Alert severity="info">No regional proposals in consolidation</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Region</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      Divisions
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Total Proposals
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {regionalStructure
                    .slice(pageRegional * rowsPerPageRegional, pageRegional * rowsPerPageRegional + rowsPerPageRegional)
                    .map((region, idx) => (
                      <React.Fragment key={idx}>
                        <TableRow
                          onClick={() => handleRegionToggle(region.region)}
                          sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f9f9f9' } }}
                        >
                          <TableCell>
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
                              <LocationOnIcon sx={{ mr: 1, color: '#1976d2' }} />
                              <Typography sx={{ fontWeight: 600 }}>{region.region}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={region.divisionCount} size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={region.divisions.reduce((sum, d) => sum + d.proposalCount, 0)}
                              size="small"
                              color="primary"
                            />
                          </TableCell>
                        </TableRow>

                        {/* Division Details */}
                        <TableRow>
                          <TableCell colSpan={3} sx={{ p: 0 }}>
                            <Collapse in={expandedRegion === region.region} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2, backgroundColor: '#fafafa' }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ backgroundColor: '#eeeeee' }}>
                                      <TableCell sx={{ pl: 4, fontWeight: 600 }}>Division</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                                        Proposals
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                                        Total Amount
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {region.divisions.map((division, divIdx) => (
                                      <React.Fragment key={divIdx}>
                                        <TableRow sx={{ backgroundColor: '#fff', '&:hover': { backgroundColor: '#f5f5f5' } }}>
                                          <TableCell
                                            sx={{ pl: 6, cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => setExpandedDivision(
                                              expandedDivision === `${region.region}-${division.division}` 
                                                ? null 
                                                : `${region.region}-${division.division}`
                                            )}
                                          >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                              <ExpandMoreIcon
                                                sx={{
                                                  transform: expandedDivision === `${region.region}-${division.division}` ? 'rotate(180deg)' : 'none',
                                                  transition: 'transform 0.2s',
                                                  visibility: division.proposals && division.proposals.length > 0 ? 'visible' : 'hidden'
                                                }}
                                              />
                                              {division.division}
                                            </Box>
                                          </TableCell>
                                          <TableCell align="right">{division.proposalCount}</TableCell>
                                          <TableCell align="right">
                                            ₱{(division.totalAmount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                                          </TableCell>
                                        </TableRow>
                                        
                                        {/* Proposals under this division */}
                                        <TableRow>
                                          <TableCell colSpan={3} sx={{ p: 0 }}>
                                            <Collapse in={expandedDivision === `${region.region}-${division.division}`} timeout="auto" unmountOnExit>
                                              <Box sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                                  Proposals ({division.proposalCount})
                                                </Typography>
                                                <Table size="small">
                                                  <TableHead>
                                                    <TableRow sx={{ backgroundColor: '#e0e0e0' }}>
                                                      <TableCell sx={{ pl: 8, fontWeight: 600 }}>Proposal Title</TableCell>
                                                      <TableCell sx={{ fontWeight: 600 }}>Budget Type</TableCell>
                                                      <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                                                    </TableRow>
                                                  </TableHead>
                                                  <TableBody>
                                                    {division.proposals && division.proposals.map((proposal, propIdx) => (
                                                      <TableRow key={propIdx} sx={{ backgroundColor: '#fff' }}>
                                                        <TableCell sx={{ pl: 8 }}>
                                                          {proposal.title || 'Untitled'}
                                                        </TableCell>
                                                        <TableCell>
                                                          <span style={{ 
                                                            backgroundColor: '#e3f2fd', 
                                                            padding: '4px 8px', 
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            fontWeight: 500
                                                          }}>
                                                            {proposal.budgetType || 'N/A'}
                                                          </span>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                          ₱{(proposal.amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                                                        </TableCell>
                                                      </TableRow>
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

        {/* Central Office Tab */}
        <TabPanel value={tabValue} index={1}>
          {centralOfficeStructure.length === 0 ? (
            <Alert severity="info">No Central Office proposals in consolidation</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Proposals
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Total Amount
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {centralOfficeStructure
                    .slice(pageCO * rowsPerPageCO, pageCO * rowsPerPageCO + rowsPerPageCO)
                    .map((dept, idx) => (
                      <React.Fragment key={idx}>
                        <TableRow
                          onClick={() => handleDeptToggle(dept.department)}
                          sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f9f9f9' } }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <IconButton
                                size="small"
                                sx={{
                                  transform: expandedDept === dept.department ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.3s',
                                  visibility: dept.proposals && dept.proposals.length > 0 ? 'visible' : 'hidden'
                                }}
                              >
                                <ExpandMoreIcon />
                              </IconButton>
                              <FolderOpenIcon sx={{ mr: 1, color: '#f57c00' }} />
                              <Typography sx={{ fontWeight: 600 }}>{dept.department}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Chip label={dept.proposalCount} size="small" color="warning" />
                          </TableCell>
                          <TableCell align="right">
                            ₱{(dept.totalAmount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                          </TableCell>
                        </TableRow>
                        
                        {/* Proposals under this department */}
                        <TableRow>
                          <TableCell colSpan={3} sx={{ p: 0 }}>
                            <Collapse in={expandedDept === dept.department} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                  Proposals ({dept.proposalCount})
                                </Typography>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ backgroundColor: '#e0e0e0' }}>
                                      <TableCell sx={{ pl: 4, fontWeight: 600 }}>Proposal Title</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>Budget Type</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {dept.proposals && dept.proposals.map((proposal, propIdx) => (
                                      <TableRow key={propIdx} sx={{ backgroundColor: '#fff' }}>
                                        <TableCell sx={{ pl: 4 }}>
                                          {proposal.title || 'Untitled'}
                                        </TableCell>
                                        <TableCell>
                                          <span style={{ 
                                            backgroundColor: '#fff3e0', 
                                            padding: '4px 8px', 
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: 500
                                          }}>
                                            {proposal.budgetType || 'N/A'}
                                          </span>
                                        </TableCell>
                                        <TableCell align="right">
                                          ₱{(proposal.amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                                        </TableCell>
                                      </TableRow>
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
            count={centralOfficeStructure.length}
            rowsPerPage={rowsPerPageCO}
            page={pageCO}
            onPageChange={handleChangePageCO}
            onRowsPerPageChange={handleChangeRowsPerPageCO}
          />
        </TabPanel>
      </Paper>

      {/* Summary Stats */}
      {summary && (
        <Paper sx={{ p: 3, mt: 4, backgroundColor: '#f9f9f9' }}>
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
    </Container>
  );
}
