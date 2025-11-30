import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  TablePagination,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  Grid,
  Divider,
  Button,
  Card,
  CardContent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import api from '../../config/api';
import { displayUacs } from '../../utils/uacsDisplayHelper';
import { getUserInfo } from '../../utils/auth';
import WorkflowActionsRefactored from './WorkflowActionsRefactored';
import ProposalAttachments from './ProposalAttachments';

const ProposalDetailsPage = () => {
  const theme = useTheme();
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [proposal, setProposal] = useState(location.state?.proposal || null);
  const [loading, setLoading] = useState(!proposal);
  const [tabValue, setTabValue] = useState(0);
  const [personnelData, setPersonnelData] = useState([]);
  const [mooeData, setMooeData] = useState([]);
  const [capitalOutlayData, setCapitalOutlayData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);
  const [tabLoading, setTabLoading] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [pagination, setPagination] = useState({
    personnel: 0,
    mooe: 0,
    capitalOutlay: 0,
    income: 0
  });
  const itemsPerPage = 10;

  // Load user info on mount
  useEffect(() => {
    const user = getUserInfo();
    setUserInfo(user);
  }, []);

  // Fetch proposal if not passed via state
  useEffect(() => {
    if (proposal || !proposalId) return;

    const fetchProposalFromList = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/my-proposals/all?limit=100');
        const allProposals = [];

        if (response.data?.personnel) allProposals.push(...response.data.personnel);
        if (response.data?.mooe) allProposals.push(...response.data.mooe);
        if (response.data?.capitalOutlay) allProposals.push(...response.data.capitalOutlay);
        if (response.data?.income) allProposals.push(...response.data.income);
        if (response.data?.drafts) allProposals.push(...response.data.drafts);

        const found = allProposals.find(p => String(p._id) === String(proposalId));
        if (found) {
          // Fetch detailed proposal to include attachments and full metadata
          try {
            const details = await api.get(`/api/proposals/${proposalId}`);
            if (details?.data) setProposal(details.data);
            else setProposal(found);
          } catch (err) {
            console.warn('Failed to fetch full proposal details, falling back to minimal result', err?.message);
            setProposal(found);
          }
        }
        else setError('Proposal not found');
      } catch (err) {
        setError('Failed to load proposal details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProposalFromList();
  }, [proposalId, proposal]);

  const fetchFullProposal = async () => {
    if (!proposalId) return;
    try {
      const res = await api.get(`/api/proposals/${proposalId}`);
      if (res?.data) setProposal(res.data);
    } catch (err) {
      console.warn('Failed to re-fetch full proposal details', err?.message);
    }
  };

  // Fetch tab data
  useEffect(() => {
    if (!proposal?.fiscalYear || !proposal?.region || (!proposal?.budgetType && !proposal?.modelType)) return;

    switch (tabValue) {
      case 0: fetchPersonnelServices(); break;
      case 1: fetchMooeData(); break;
      case 2: fetchCapitalOutlayData(); break;
      case 3: fetchIncomeData(); break;
      default: break;
    }
  }, [tabValue, proposal?.fiscalYear, proposal?.region, proposal?.budgetType, proposal?.modelType]);

  const fetchPersonnelServices = async () => {
    try {
      setTabLoading(prev => ({ ...prev, 0: true }));
      const response = await api.get('/getpersonnels/byParams', {
        params: { 
          proposalId: proposal._id,
          fiscalYear: proposal.fiscalYear, 
          region: proposal.region, 
          budgetType: proposal.modelType || proposal.budgetType
        }
      });
      setPersonnelData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Personnel fetch error:', err);
      setPersonnelData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, 0: false }));
    }
  };

  const fetchMooeData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, 1: true }));
      const response = await api.get('/mooe/getByParams', {
        params: { 
          proposalId: proposal._id,
          fiscalYear: proposal.fiscalYear, 
          region: proposal.region, 
          budgetType: proposal.modelType || proposal.budgetType
        }
      });
      setMooeData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('MOOE fetch error:', err);
      setMooeData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, 1: false }));
    }
  };

  const fetchCapitalOutlayData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, 2: true }));
      const response = await api.get('/capital-outlay/getByParams', {
        params: { 
          proposalId: proposal._id,
          fiscalYear: proposal.fiscalYear, 
          region: proposal.region, 
          budgetType: proposal.modelType || proposal.budgetType
        }
      });
      setCapitalOutlayData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Capital Outlay fetch error:', err);
      setCapitalOutlayData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, 2: false }));
    }
  };

  const fetchIncomeData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, 3: true }));
      const response = await api.get('/income/getByParams', {
        params: { 
          proposalId: proposal._id,
          fiscalYear: proposal.fiscalYear, 
          region: proposal.region, 
          budgetType: proposal.modelType || proposal.budgetType  // Use modelType for new workflow, fallback to budgetType for legacy
        }
      });
      setIncomeData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Income fetch error:', err);
      setIncomeData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, 3: false }));
    }
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(num);
  };

  // Memoized Totals
  const personnelTotals = useMemo(() => {
    return personnelData.reduce((acc, item) => ({
      monthly: acc.monthly + (Number(item.monthlySalary) || 0),
      annual: acc.annual + (Number(item.annualSalary) || 0)
    }), { monthly: 0, annual: 0 });
  }, [personnelData]);

  const mooeTotals = useMemo(() => {
    return mooeData.reduce((acc, item) => ({
      amount: acc.amount + (Number(item.amount) || 0),
      income: acc.income + (Number(item.income) || 0),
      subsidy: acc.subsidy + (Number(item.subsidy) || 0)
    }), { amount: 0, income: 0, subsidy: 0 });
  }, [mooeData]);

  const capitalOutlayTotals = useMemo(() => {
    return capitalOutlayData.reduce((acc, item) => {
      const income = Number(item.income) || 0;
      const subsidy = Number(item.subsidy) || 0;
      const cost = item.cost != null ? Number(item.cost) : (income + subsidy);
      return {
        income: acc.income + income,
        subsidy: acc.subsidy + subsidy,
        cost: acc.cost + cost
      };
    }, { income: 0, subsidy: 0, cost: 0 });
  }, [capitalOutlayData]);

  const incomeTotals = useMemo(() => {
    return incomeData.reduce((acc, item) => ({
      amount: acc.amount + (Number(item.amount || item.income) || 0)
    }), { amount: 0 });
  }, [incomeData]);

  const getPaginatedData = (data, page) => {
    const start = page * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !proposal) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} variant="outlined"
          sx={{ borderColor: theme.palette.secondary.main, color: theme.palette.secondary.main, fontWeight: 600, mb: 2 }}>
          Back
        </Button>
        <Alert severity="error" sx={{ borderRadius: '8px', fontWeight: 500 }}>
          {error || 'Proposal not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Tabs - Sticky at top of scrollable content */}
      <Paper sx={{ 
        position: 'sticky', 
        top: 0, 
        bgcolor: theme.palette.secondary.main, 
        borderRadius: 0,
        boxShadow: 3,
        zIndex: 50
      }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}
          sx={{
            '& .MuiTab-root': {
              color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'none',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' },
              '&.Mui-selected': { color: '#fff', bgcolor: theme.palette.primary.main }
            }
          }}>
          <Tab label="Personnel Services" />
          <Tab label="MOOE" />
          <Tab label="Capital Outlay" />
          <Tab label="Income" />
        </Tabs>
      </Paper>

      {/* Scrollable Content Area */}
      <Box sx={{ 
        flex: 1,
        overflow: 'auto',
        py: 3, 
        px: { xs: 1, sm: 2, md: 3 }
      }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} variant="outlined"
          sx={{ borderColor: theme.palette.secondary.main, color: theme.palette.secondary.main, fontWeight: 600 }}>
          Back
        </Button>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Proposal Details
          </Typography>
          <Typography variant="body2" color="textSecondary">
            FY {proposal.fiscalYear} | {proposal.region} | {proposal.modelType || proposal.budgetType}
          </Typography>
        </Box>
        <Box sx={{ width: 100 }} />
      </Box>

      {/* Summary Card */}
      <Card sx={{ mb: 3, boxShadow: 3, borderTop: `4px solid ${theme.palette.secondary.main}` }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Proposal Number
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                {proposal.proposalNumber || proposal._id?.slice(-8).toUpperCase()}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Status
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#fff', bgcolor: theme.palette.secondary.main, px: 1, py: 0.5, borderRadius: '4px', display: 'inline-block' }}>
                {proposal.status || 'Draft'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Created
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {proposal.createdAt ? new Date(proposal.createdAt).toLocaleDateString() : '—'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Updated
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {proposal.updatedAt ? new Date(proposal.updatedAt).toLocaleDateString() : '—'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Workflow Actions */}
      {userInfo && proposal && (
        <Box sx={{ mb: 3 }}>
          <WorkflowActionsRefactored 
            proposal={proposal} 
            userInfo={userInfo}
            onRefresh={() => {
              // Refresh proposal data if needed
              if (proposalId) {
                const fetchProposalFromList = async () => {
                  try {
                    const response = await api.get('/api/my-proposals/all?limit=100');
                    const allProposals = [];

                    if (response.data?.personnel) allProposals.push(...response.data.personnel);
                    if (response.data?.mooe) allProposals.push(...response.data.mooe);
                    if (response.data?.capitalOutlay) allProposals.push(...response.data.capitalOutlay);
                    if (response.data?.income) allProposals.push(...response.data.income);
                    if (response.data?.drafts) allProposals.push(...response.data.drafts);

                    const found = allProposals.find(p => String(p._id) === String(proposalId));
                    if (found) setProposal(found);
                  } catch (err) {
                    console.error('Failed to refresh proposal:', err);
                  }
                };
                fetchProposalFromList();
              }
            }}
          />
        </Box>
      )}

      {/* Tab Content */}
      <Paper sx={{ p: 2, boxShadow: 3 }}>
        {/* Personnel */}
        {tabValue === 0 && (
          <Box>
            <ProposalAttachments proposal={proposal} moduleName="personnel" userInfo={userInfo} onChange={() => {
              // Refresh data and proposal after attachments change
              fetchPersonnelServices();
              fetchFullProposal();
            }} />
            {tabLoading[0] ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> :
             personnelData.length === 0 ? <Alert severity="info">No personnel data</Alert> :
             <>
               <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                 <Table>
                   <TableHead sx={{ 
                     bgcolor: theme.palette.secondary.main,
                     position: 'sticky',
                     top: 0,
                     zIndex: 5
                   }}>
                     <TableRow>
                       <TableCell sx={{ width: 50 }}></TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Name</TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Position</TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Monthly</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Annual</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Total</TableCell>
                     </TableRow>
                   </TableHead>
                   <TableBody>
                     {getPaginatedData(personnelData, pagination.personnel).map((item, idx) => {
                       const realIdx = pagination.personnel * itemsPerPage + idx;
                       const monthly = Number(item.monthlySalary) || 0;
                       const annual = Number(item.annualSalary) || 0;
                       const total = monthly + annual;

                       return (
                         <React.Fragment key={realIdx}>
                           <TableRow hover>
                             <TableCell>
                               <IconButton size="small" onClick={() => setExpandedRows(prev => ({ ...prev, [`ps-${realIdx}`]: !prev[`ps-${realIdx}`] }))}>
                                 {expandedRows[`ps-${realIdx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                               </IconButton>
                             </TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>{item.employeeFullName || item.name || '—'}</TableCell>
                             <TableCell>{item.positionTitle || '—'}</TableCell>
                             <TableCell>{item.statusOfAppointment || '—'}</TableCell>
                             <TableCell align="right">{formatCurrency(monthly)}</TableCell>
                             <TableCell align="right">{formatCurrency(annual)}</TableCell>
                             <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', borderLeft: `3px solid ${theme.palette.secondary.main}` }}>
                               {formatCurrency(total)}
                             </TableCell>
                           </TableRow>
                           <TableRow>
                             <TableCell colSpan={7} sx={{ p: 0 }}>
                               <Collapse in={expandedRows[`ps-${realIdx}`]} timeout="auto" unmountOnExit>
                                 <Box sx={{ p: 3, bgcolor: '#f9fafb', borderLeft: `4px solid ${theme.palette.secondary.main}` }}>
                                   <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: theme.palette.primary.main }}>
                                     📋 Compensation Details
                                   </Typography>
                                   <Grid container spacing={2}>
                                     {monthly > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Monthly:</strong> {formatCurrency(monthly)}</Typography></Grid>}
                                     {annual > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Annual:</strong> {formatCurrency(annual)}</Typography></Grid>}
                                     {item.RATA > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>RATA:</strong> {formatCurrency(item.RATA)}</Typography></Grid>}
                                     {item.PERA > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>PERA:</strong> {formatCurrency(item.PERA)}</Typography></Grid>}
                                     {item.gsisPremium > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>GSIS:</strong> {formatCurrency(item.gsisPremium)}</Typography></Grid>}
                                     {item.philhealthPremium > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>PhilHealth:</strong> {formatCurrency(item.philhealthPremium)}</Typography></Grid>}
                                     {item.pagibigPremium > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Pag-IBIG:</strong> {formatCurrency(item.pagibigPremium)}</Typography></Grid>}
                                     {item.uniformALLOWANCE > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Uniform:</strong> {formatCurrency(item.uniformALLOWANCE)}</Typography></Grid>}
                                     {item.productivityIncentive > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Productivity:</strong> {formatCurrency(item.productivityIncentive)}</Typography></Grid>}
                                     {item.midyearBonus > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Midyear Bonus:</strong> {formatCurrency(item.midyearBonus)}</Typography></Grid>}
                                     {item.yearEndBonus > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Year-End Bonus:</strong> {formatCurrency(item.yearEndBonus)}</Typography></Grid>}
                                     {item.medical > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Medical:</strong> {formatCurrency(item.medical)}</Typography></Grid>}
                                     {item.meal > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Meal:</strong> {formatCurrency(item.meal)}</Typography></Grid>}
                                     {item.childrenAllowance > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Children Allowance:</strong> {formatCurrency(item.childrenAllowance)}</Typography></Grid>}
                                     {item.cashGift > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Cash Gift:</strong> {formatCurrency(item.cashGift)}</Typography></Grid>}
                                     {item.loyaltyAward > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Loyalty Award:</strong> {formatCurrency(item.loyaltyAward)}</Typography></Grid>}
                                     {item.overtimePay > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Overtime:</strong> {formatCurrency(item.overtimePay)}</Typography></Grid>}
                                     {item.hazardPay > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Hazard Pay:</strong> {formatCurrency(item.hazardPay)}</Typography></Grid>}
                                     {item.subsistenceAllowance > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Subsistence:</strong> {formatCurrency(item.subsistenceAllowance)}</Typography></Grid>}
                                     {item.honoraria > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Honoraria:</strong> {formatCurrency(item.honoraria)}</Typography></Grid>}
                                     {item.earnedLeaves > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Earned Leaves:</strong> {formatCurrency(item.earnedLeaves)}</Typography></Grid>}
                                     {item.retirementBenefits > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Retirement:</strong> {formatCurrency(item.retirementBenefits)}</Typography></Grid>}
                                     {item.terminalLeave > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Terminal Leave:</strong> {formatCurrency(item.terminalLeave)}</Typography></Grid>}
                                     {item.courtAppearance > 0 && <Grid item xs={12} sm={6}><Typography variant="body2"><strong>Court Appearance:</strong> {formatCurrency(item.courtAppearance)}</Typography></Grid>}
                                   </Grid>
                                 </Box>
                               </Collapse>
                             </TableCell>
                           </TableRow>
                         </React.Fragment>
                       );
                     })}
                   </TableBody>
                   <TableFooter sx={{ 
                     position: 'sticky',
                     bottom: 0,
                     zIndex: 4
                   }}>
                     <TableRow sx={{ bgcolor: '#f9fafb' }}>
                       <TableCell colSpan={4} sx={{ fontWeight: 'bold', textAlign: 'right' }}>TOTAL</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(personnelTotals.monthly)}</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(personnelTotals.annual)}</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: theme.palette.secondary.main, color: '#fff' }}>
                         {formatCurrency(personnelTotals.monthly + personnelTotals.annual)}
                       </TableCell>
                     </TableRow>
                   </TableFooter>
                 </Table>
               </TableContainer>
               {personnelData.length > itemsPerPage && (
                 <TablePagination
                   component="div"
                   count={personnelData.length}
                   rowsPerPage={itemsPerPage}
                   page={pagination.personnel}
                   onPageChange={(_, p) => setPagination(prev => ({ ...prev, personnel: p }))}
                   rowsPerPageOptions={[10]}
                 />
               )}
             </>
            }
          </Box>
        )}

        {/* MOOE */}
        {tabValue === 1 && (
          <Box>
            <ProposalAttachments proposal={proposal} moduleName="mooe" userInfo={userInfo} onChange={() => {
              fetchMooeData();
              fetchFullProposal();
            }} />
            {tabLoading[1] ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> :
             mooeData.length === 0 ? <Alert severity="info">No MOOE data</Alert> :
             <>
               <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                 <Table>
                   <TableHead sx={{ 
                     bgcolor: theme.palette.secondary.main,
                     position: 'sticky',
                     top: 0,
                     zIndex: 5
                   }}>
                     <TableRow>
                       <TableCell sx={{ width: 50 }}></TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item</TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Description</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Amount</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Income</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Subsidy</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Total</TableCell>
                     </TableRow>
                   </TableHead>
                   <TableBody>
                     {getPaginatedData(mooeData, pagination.mooe).map((item, idx) => {
                       const realIdx = pagination.mooe * itemsPerPage + idx;
                       const amount = Number(item.amount) || 0;
                       const income = Number(item.income) || 0;
                       const subsidy = Number(item.subsidy) || 0;
                       const total = amount + income + subsidy;

                       return (
                         <React.Fragment key={realIdx}>
                           <TableRow hover>
                             <TableCell>
                               <IconButton size="small" onClick={() => setExpandedRows(prev => ({ ...prev, [`mooe-${realIdx}`]: !prev[`mooe-${realIdx}`] }))}>
                                 {expandedRows[`mooe-${realIdx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                               </IconButton>
                             </TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>{item.sublineItem || '—'}</TableCell>
                             <TableCell>{item.description || '—'}</TableCell>
                             <TableCell align="right">{formatCurrency(amount)}</TableCell>
                             <TableCell align="right">{formatCurrency(income)}</TableCell>
                             <TableCell align="right">{formatCurrency(subsidy)}</TableCell>
                             <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', borderLeft: `3px solid ${theme.palette.secondary.main}` }}>
                               {formatCurrency(total)}
                             </TableCell>
                           </TableRow>
                           <TableRow>
                             <TableCell colSpan={7} sx={{ p: 0 }}>
                               <Collapse in={expandedRows[`mooe-${realIdx}`]} timeout="auto" unmountOnExit>
                                 <Box sx={{ p: 2, bgcolor: '#f9fafb', borderLeft: `4px solid ${theme.palette.secondary.main}` }}>
                                   <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>MOOE Details</Typography>
                                   <Grid container spacing={2}>
                                     <Grid item xs={6}><strong>Amount:</strong> {formatCurrency(amount)}</Grid>
                                     <Grid item xs={6}><strong>Income:</strong> {formatCurrency(income)}</Grid>
                                     <Grid item xs={6}><strong>Subsidy:</strong> {formatCurrency(subsidy)}</Grid>
                                     <Grid item xs={6}><strong>Total:</strong> {formatCurrency(total)}</Grid>
                                   </Grid>
                                 </Box>
                               </Collapse>
                             </TableCell>
                           </TableRow>
                         </React.Fragment>
                       );
                     })}
                   </TableBody>
                   <TableFooter sx={{ 
                     position: 'sticky',
                     bottom: 0,
                     zIndex: 4
                   }}>
                     <TableRow sx={{ bgcolor: '#f9fafb' }}>
                       <TableCell colSpan={3} sx={{ fontWeight: 'bold', textAlign: 'right' }}>TOTAL</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(mooeTotals.amount)}</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(mooeTotals.income)}</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(mooeTotals.subsidy)}</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: theme.palette.secondary.main, color: '#fff' }}>
                         {formatCurrency(mooeTotals.amount + mooeTotals.income + mooeTotals.subsidy)}
                       </TableCell>
                     </TableRow>
                   </TableFooter>
                 </Table>
               </TableContainer>
               {mooeData.length > itemsPerPage && (
                 <TablePagination
                   component="div"
                   count={mooeData.length}
                   rowsPerPage={itemsPerPage}
                   page={pagination.mooe}
                   onPageChange={(_, p) => setPagination(prev => ({ ...prev, mooe: p }))}
                   rowsPerPageOptions={[10]}
                 />
               )}
             </>
            }
          </Box>
        )}

        {/* Capital Outlay */}
        {tabValue === 2 && (
          <Box>
            <ProposalAttachments proposal={proposal} moduleName="capital" userInfo={userInfo} onChange={() => {
              fetchCapitalOutlayData();
              fetchFullProposal();
            }} />
            {tabLoading[2] ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> :
             capitalOutlayData.length === 0 ? <Alert severity="info">No Capital Outlay data</Alert> :
             <>
               <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                 <Table>
                   <TableHead sx={{ 
                     bgcolor: theme.palette.secondary.main,
                     position: 'sticky',
                     top: 0,
                     zIndex: 5
                   }}>
                     <TableRow>
                       <TableCell sx={{ width: 50 }}></TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Category</TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Item</TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Title</TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>UACS</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Income</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Subsidy</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Total Cost</TableCell>
                     </TableRow>
                   </TableHead>
                   <TableBody>
                     {getPaginatedData(capitalOutlayData, pagination.capitalOutlay).map((item, idx) => {
                       const realIdx = pagination.capitalOutlay * itemsPerPage + idx;
                       const income = Number(item.income) || 0;
                       const subsidy = Number(item.subsidy) || 0;
                       const cost = item.cost != null ? Number(item.cost) : (income + subsidy);

                       return (
                         <React.Fragment key={realIdx}>
                           <TableRow hover>
                             <TableCell>
                               <IconButton size="small" onClick={() => setExpandedRows(prev => ({ ...prev, [`co-${realIdx}`]: !prev[`co-${realIdx}`] }))}>
                                 {expandedRows[`co-${realIdx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                               </IconButton>
                             </TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>{item.categoryName || item.category || '—'}</TableCell>
                             <TableCell>{item.sublineItem || '—'}</TableCell>
                             <TableCell>{item.accountingTitle || '—'}</TableCell>
                             <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{displayUacs(item.uacsCode, item.sublineItem)}</TableCell>
                             <TableCell align="right">{formatCurrency(income)}</TableCell>
                             <TableCell align="right">{formatCurrency(subsidy)}</TableCell>
                             <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', borderLeft: `3px solid ${theme.palette.secondary.main}` }}>
                               {formatCurrency(cost)}
                             </TableCell>
                           </TableRow>
                           <TableRow>
                             <TableCell colSpan={8} sx={{ p: 0 }}>
                               <Collapse in={expandedRows[`co-${realIdx}`]} timeout="auto" unmountOnExit>
                                 <Box sx={{ p: 2, bgcolor: '#f9fafb', borderLeft: `4px solid ${theme.palette.secondary.main}` }}>
                                   <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Capital Outlay Details</Typography>
                                   <Grid container spacing={2}>
                                     <Grid item xs={6}><strong>Income:</strong> {formatCurrency(income)}</Grid>
                                     <Grid item xs={6}><strong>Subsidy:</strong> {formatCurrency(subsidy)}</Grid>
                                     <Grid item xs={12}><strong>Total Cost:</strong> {formatCurrency(cost)}</Grid>
                                   </Grid>
                                 </Box>
                               </Collapse>
                             </TableCell>
                           </TableRow>
                         </React.Fragment>
                       );
                     })}
                   </TableBody>
                   <TableFooter sx={{ 
                     position: 'sticky',
                     bottom: 0,
                     zIndex: 4
                   }}>
                     <TableRow sx={{ bgcolor: '#f9fafb' }}>
                       <TableCell colSpan={5} sx={{ fontWeight: 'bold', textAlign: 'right' }}>TOTAL</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(capitalOutlayTotals.income)}</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(capitalOutlayTotals.subsidy)}</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: theme.palette.secondary.main, color: '#fff' }}>
                         {formatCurrency(capitalOutlayTotals.cost)}
                       </TableCell>
                     </TableRow>
                   </TableFooter>
                 </Table>
               </TableContainer>
               {capitalOutlayData.length > itemsPerPage && (
                 <TablePagination
                   component="div"
                   count={capitalOutlayData.length}
                   rowsPerPage={itemsPerPage}
                   page={pagination.capitalOutlay}
                   onPageChange={(_, p) => setPagination(prev => ({ ...prev, capitalOutlay: p }))}
                   rowsPerPageOptions={[10]}
                 />
               )}
             </>
            }
          </Box>
        )}

        {/* Income */}
        {tabValue === 3 && (
          <Box>
            <ProposalAttachments proposal={proposal} moduleName="income" userInfo={userInfo} onChange={() => {
              fetchIncomeData();
              fetchFullProposal();
            }} />
            {tabLoading[3] ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> :
             incomeData.length === 0 ? <Alert severity="info">No Income data</Alert> :
             <>
               <TableContainer sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                 <Table>
                   <TableHead sx={{ 
                     bgcolor: theme.palette.secondary.main,
                     position: 'sticky',
                     top: 0,
                     zIndex: 5
                   }}>
                     <TableRow>
                       <TableCell sx={{ width: 50 }}></TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Source</TableCell>
                       <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Description</TableCell>
                       <TableCell align="right" sx={{ color: '#fff', fontWeight: 'bold' }}>Amount</TableCell>
                     </TableRow>
                   </TableHead>
                   <TableBody>
                     {getPaginatedData(incomeData, pagination.income).map((item, idx) => {
                       const realIdx = pagination.income * itemsPerPage + idx;
                       const amount = Number(item.amount || item.income) || 0;

                       return (
                         <React.Fragment key={realIdx}>
                           <TableRow hover>
                             <TableCell>
                               <IconButton size="small" onClick={() => setExpandedRows(prev => ({ ...prev, [`inc-${realIdx}`]: !prev[`inc-${realIdx}`] }))}>
                                 {expandedRows[`inc-${realIdx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                               </IconButton>
                             </TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>{item.source || '—'}</TableCell>
                             <TableCell>{item.description || '—'}</TableCell>
                             <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', borderLeft: `3px solid ${theme.palette.secondary.main}` }}>
                               {formatCurrency(amount)}
                             </TableCell>
                           </TableRow>
                           <TableRow>
                             <TableCell colSpan={4} sx={{ p: 0 }}>
                               <Collapse in={expandedRows[`inc-${realIdx}`]} timeout="auto" unmountOnExit>
                                 <Box sx={{ p: 2, bgcolor: '#f9fafb', borderLeft: `4px solid ${theme.palette.secondary.main}` }}>
                                   <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Income Details</Typography>
                                   <Grid container spacing={2}>
                                     <Grid item xs={12}><strong>Source:</strong> {item.source || 'N/A'}</Grid>
                                     <Grid item xs={12}><strong>Amount:</strong> {formatCurrency(amount)}</Grid>
                                   </Grid>
                                 </Box>
                               </Collapse>
                             </TableCell>
                           </TableRow>
                         </React.Fragment>
                       );
                     })}
                   </TableBody>
                   <TableFooter sx={{ 
                     position: 'sticky',
                     bottom: 0,
                     zIndex: 4
                   }}>
                     <TableRow sx={{ bgcolor: '#f9fafb' }}>
                       <TableCell colSpan={2} sx={{ fontWeight: 'bold', textAlign: 'right' }}>TOTAL INCOME</TableCell>
                       <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: theme.palette.secondary.main, color: '#fff' }}>
                         {formatCurrency(incomeTotals.amount)}
                       </TableCell>
                     </TableRow>
                   </TableFooter>
                 </Table>
               </TableContainer>
               {incomeData.length > itemsPerPage && (
                 <TablePagination
                   component="div"
                   count={incomeData.length}
                   rowsPerPage={itemsPerPage}
                   page={pagination.income}
                   onPageChange={(_, p) => setPagination(prev => ({ ...prev, income: p }))}
                   rowsPerPageOptions={[10]}
                 />
               )}
             </>
            }
          </Box>
        )}
      </Paper>
      </Box>
    </Box>
  );
};

export default ProposalDetailsPage;
