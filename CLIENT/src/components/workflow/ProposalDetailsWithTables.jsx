import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Grid,
  Chip,
  Stack,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  IconButton,
  Collapse,
  Card,
  CardContent,
  Badge,
  Tooltip
} from '@mui/material';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HistoryIcon from '@mui/icons-material/History';
import CommentIcon from '@mui/icons-material/Comment';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import api from '../../config/api';
import { displayUacs } from '../../utils/uacsDisplayHelper';

const ProposalDetailsWithTables = ({ open, onClose, proposal, userInfo }) => {
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [personnelData, setPersonnelData] = useState([]);
  const [mooeData, setMooeData] = useState([]);
  const [capitalOutlayData, setCapitalOutlayData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);
  const [discountSettings, setDiscountSettings] = useState(null);
  const [tabLoading, setTabLoading] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [editHistory, setEditHistory] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setTimeout(() => setLoading(false), 300);
      
      // Determine user's role
      const roles = userInfo?.currentUser?.roles || userInfo?.currentUser?.role || [];
      const roleArray = Array.isArray(roles) ? roles : [roles];
      setCurrentUserRole(roleArray?.[0]);
      
      // Load workflow history and edit history
      if (proposal?._id) {
        loadWorkflowHistory();
        loadEditHistory();
      }
    }
  }, [open, proposal?._id, userInfo]);

  const loadWorkflowHistory = async () => {
    try {
      // Workflow history is embedded in proposal
      if (proposal?.workflowHistory) {
        setWorkflowHistory(proposal.workflowHistory);
      }
    } catch (error) {
      console.error('Error loading workflow history:', error);
    }
  };

  const loadEditHistory = async () => {
    try {
      // Edit history is embedded in proposal
      if (proposal?.editHistory) {
        setEditHistory(proposal.editHistory);
      }
    } catch (error) {
      console.error('Error loading edit history:', error);
    }
  };

  // Determine if current user can edit based on role and status
  useEffect(() => {
    if (proposal && currentUserRole) {
      const canUserEdit = checkEditPermission(currentUserRole, proposal.status);
      setCanEdit(canUserEdit);
    }
  }, [proposal, currentUserRole]);

  useEffect(() => {
    if (open && proposal?._id) {
      switch (tabValue) {
        case 0:
          fetchPersonnelServices();
          break;
        case 1:
          fetchMooeData();
          break;
        case 2:
          fetchCapitalOutlayData();
          break;
        case 3:
          fetchIncomeData();
          break;
        default:
          break;
      }
    }
  }, [tabValue, open, proposal?._id]);

  const getProposalRegionStr = () => {
    const rawRegion = proposal?.region || "";
    if (rawRegion && typeof rawRegion === 'object') {
      return rawRegion.RegionName || rawRegion.Region || rawRegion.regionName || rawRegion.region || rawRegion.name || "";
    }
    return String(rawRegion || "");
  };

  const fetchPersonnelServices = async () => {
    try {
      setTabLoading(prev => ({ ...prev, 0: true }));
      if (proposal?.isConsolidated && proposal?.personnelData?.length > 0) {
        setPersonnelData(proposal.personnelData);
        setTabLoading(prev => ({ ...prev, 0: false }));
        return;
      }
      const proposalRegion = getProposalRegionStr();
      // console.log('📍 Fetching Personnel Services for proposal:', { fiscalYear: proposal.fiscalYear, region: proposalRegion, budgetType: proposal.budgetType });
      const response = await api.get(`/api/personnel/getByParams?fiscalYear=${proposal.fiscalYear}&region=${proposalRegion}&budgetType=${proposal.budgetType}`);
      // console.log('✅ Personnel Services response:', response.data);
      // console.log('📊 First personnel record sample:', response.data?.[0]);
      // Log all field names from first record for debugging
      if (response.data?.[0]) {
        // console.log('🔍 Available fields in first record:', Object.keys(response.data[0]));
      }
      setPersonnelData(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching personnel services:', error);
      setPersonnelData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, 0: false }));
    }
  };

  const fetchCapitalOutlayData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, 2: true }));
      if (proposal?.isConsolidated && proposal?.capitalData?.length > 0) {
        setCapitalOutlayData(proposal.capitalData);
        setTabLoading(prev => ({ ...prev, 2: false }));
        return;
      }
      const proposalRegion = getProposalRegionStr();
      // console.log('📍 Fetching Capital Outlay data for proposal:', { fiscalYear: proposal.fiscalYear, region: proposalRegion, budgetType: proposal.budgetType });
      const response = await api.get(`/capital-outlay/getByParams?fiscalYear=${proposal.fiscalYear}&region=${proposalRegion}&budgetType=${proposal.budgetType}`);
      // console.log('✅ Capital Outlay response:', response.data);
      
      // Try to resolve category names if they're just IDs
      let resolved = response.data || [];
      try {
        // Fetch all categories to map IDs to names
        const categoriesResp = await api.get('/categories');
        const categoryMap = {};
        if (Array.isArray(categoriesResp.data)) {
          categoriesResp.data.forEach(cat => {
            categoryMap[cat._id] = cat.categoryName || cat.name;
          });
        }
        
        // Resolve category names in capital outlay items
        resolved = resolved.map(item => ({
          ...item,
          categoryName: categoryMap[item.category] || item.categoryName || item.category || 'N/A'
        }));
        // console.log('✅ Categories resolved:', resolved.map(r => ({ id: r.category, name: r.categoryName })));
      } catch (err) {
        console.warn('⚠️ Could not fetch categories for resolution, using raw data:', err.message);
      }
      
      setCapitalOutlayData(resolved);
    } catch (error) {
      console.error('❌ Error fetching capital outlay data:', error);
      setCapitalOutlayData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, 2: false }));
    }
  };

  const fetchMooeData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, 1: true }));
      if (proposal?.isConsolidated && proposal?.mooeData?.length > 0) {
        setMooeData(proposal.mooeData);
        setTabLoading(prev => ({ ...prev, 1: false }));
        return;
      }
      const proposalRegion = getProposalRegionStr();
      // console.log('📍 Fetching MOOE data for proposal:', { fiscalYear: proposal.fiscalYear, region: proposalRegion, budgetType: proposal.budgetType });
      const response = await api.get(`/mooe/getByParams?fiscalYear=${proposal.fiscalYear}&region=${proposalRegion}&budgetType=${proposal.budgetType}`);
      // console.log('✅ MOOE response:', response.data);
      setMooeData(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching MOOE data:', error);
      setMooeData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, 1: false }));
    }
  };

  const fetchIncomeData = async () => {
    try {
      setTabLoading(prev => ({ ...prev, 3: true }));
      if (proposal?.isConsolidated && proposal?.incomeData?.length > 0) {
        setIncomeData(proposal.incomeData);
        setTabLoading(prev => ({ ...prev, 3: false }));
        return;
      }
      const proposalRegion = getProposalRegionStr();
      // console.log('📍 Fetching Income data for proposal:', { fiscalYear: proposal.fiscalYear, region: proposalRegion, budgetType: proposal.budgetType });
      const response = await api.get(`/income/getByParams?fiscalYear=${proposal.fiscalYear}&region=${proposalRegion}&budgetType=${proposal.budgetType}`);
      // console.log('✅ Income response:', response.data);
      const incomeItems = response.data || [];
      setIncomeData(incomeItems);
      try {
        const rawRegion =
          proposal?.region ||
          incomeItems?.[0]?.region ||
          incomeItems?.[0]?.Region ||
          "";
        const regionCandidate = rawRegion && typeof rawRegion === 'object'
          ? (rawRegion.RegionName || rawRegion.Region || rawRegion.regionName || rawRegion.region || rawRegion.name || "")
          : String(rawRegion || "");
        const settingsResp = await api.get('/api/discount-settings', {
          params: {
            fiscalYear: proposal.fiscalYear,
            budgetType: proposal.budgetType,
            region: regionCandidate
          }
        });
        setDiscountSettings(settingsResp.data || null);
      } catch (settingsError) {
        console.warn('⚠️ Discount settings not available:', settingsError?.message || settingsError);
        setDiscountSettings(null);
      }
    } catch (error) {
      console.error('❌ Error fetching income data:', error);
      setIncomeData([]);
    } finally {
      setTabLoading(prev => ({ ...prev, 3: false }));
    }
  };

  const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const normalizeName = (value) => {
    if (!value) return '';
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s\-()/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const toNumber = (value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/g, '').trim());
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const incomeSummary = useMemo(() => {
    const summary = {
      irrigation: 0,
      rent: 0,
      water: 0,
      misc: 0,
      total: 0,
      irrigationLabel: 'IRRIGATION SERVICE FEES'
    };

    const items = Array.isArray(incomeData) ? incomeData : [];
    let irrigationGross = 0;
    let irrigationNetItems = 0;
    let currentAccountTotal = 0;

    items.forEach((item) => {
      const categoryName =
        item.incomecategory?.name ||
        item.incomecategory?.incomeCategoryName ||
        item.categoryName ||
        item.category ||
        item.type ||
        '';
      const normalized = normalizeName(categoryName);
      const amount = toNumber(item.amount ?? item.totalAmount ?? 0);

      if (normalized.includes('net irrigation service fees')) {
        irrigationNetItems += amount;
        return;
      }

      if (normalized.includes('irrigation service fees')) {
        irrigationGross += amount;
        const subcategory = normalizeName(item.subcategory || item.subCategory || '');
        if (subcategory.includes('current account')) {
          currentAccountTotal += amount;
        }
        return;
      }

      if (normalized.includes('rent')) {
        summary.rent += amount;
        return;
      }

      if (normalized.includes('water service fee')) {
        summary.water += amount;
        return;
      }

      summary.misc += amount;
    });

    const discountType = discountSettings?.discountType || 'percentage';
    const discountValue = toNumber(discountSettings?.discountValue || 0);
    const applyDiscount = Boolean(discountSettings?.applyDiscount);
    const rawProposalRegion = proposal?.region || "";
    const proposalRegionStr = rawProposalRegion && typeof rawProposalRegion === 'object'
      ? (rawProposalRegion.RegionName || rawProposalRegion.Region || rawProposalRegion.regionName || rawProposalRegion.region || rawProposalRegion.name || "")
      : String(rawProposalRegion || "");
    const regionMatches =
      normalizeName(discountSettings?.region) === normalizeName(proposalRegionStr);

    let irrigationNetFromDiscount = irrigationGross;
    const discountBase =
      currentAccountTotal > 0 ? currentAccountTotal : irrigationGross;
    if (applyDiscount && regionMatches && irrigationGross > 0 && discountBase > 0) {
      const discountAmount =
        discountType === 'percentage'
          ? discountBase * (discountValue / 100)
          : Math.min(discountValue, discountBase);
      irrigationNetFromDiscount = irrigationGross - discountAmount;
    }

    const useNet = irrigationNetItems > 0 || (applyDiscount && regionMatches);
    summary.irrigation = useNet
      ? (irrigationNetItems > 0 ? irrigationNetItems : irrigationNetFromDiscount)
      : irrigationGross;
    summary.irrigationLabel = useNet ? 'NET IRRIGATION SERVICE FEES' : 'IRRIGATION SERVICE FEES';

    summary.total =
      summary.irrigation + summary.rent + summary.water + summary.misc;

    return summary;
  }, [incomeData, discountSettings, proposal?.region]);

  const checkEditPermission = (userRole, status) => {
    // Can't edit if status is Finalized
    if (status === 'Finalized') {
      return false;
    }
    
    // Map roles that can edit at each status
    const editableRoles = ['REVIEWER', 'APPROVER', 'BUDGET OFFICER', 'OVERALL BUDGET APPROVER', 'BUDGET PLANNING ANALYST'];
    return editableRoles.includes(userRole?.toUpperCase());
  };

  const getActionIcon = (action) => {
    if (action?.includes('RETURN')) return <WarningIcon fontSize="small" />;
    if (action?.includes('APPROVE')) return <CheckCircleIcon fontSize="small" />;
    if (action?.includes('SUBMIT')) return <EditIcon fontSize="small" />;
    return <EditIcon fontSize="small" />;
  };

  const getActionColor = (action) => {
    if (action?.includes('RETURN')) return 'error';
    if (action?.includes('APPROVE')) return 'success';
    if (action?.includes('SUBMIT')) return 'info';
    return 'primary';
  };

  const TabPanel = (props) => {
    const { children, value, index, ...other } = props;
    return (
      <div role="tabpanel" hidden={value !== index} {...other}>
        {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
      </div>
    );
  };

  if (!proposal) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>Proposal Details</Box>
        <Button onClick={onClose} size="small" color="inherit">
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}
        {!loading && (
          <Stack spacing={2.5}>
            {/* Summary Section */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1.5 }}>
                {proposal.title}
              </Typography>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={3}>
                  <Typography variant="caption" color="textSecondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <WorkflowStatusBadge status={proposal.status} />
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="caption" color="textSecondary">Fiscal Year</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{proposal.fiscalYear}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="caption" color="textSecondary">Region</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{getProposalRegionStr() || '—'}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="caption" color="textSecondary">Budget Type</Typography>
                  <Chip label={proposal.budgetType} size="small" />
                </Grid>
              </Grid>

              {/* Budget Totals */}
              {/* Budget totals section minimized - only show summary line */}
              <Box sx={{ p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, mb: 2 }}>
                <Typography variant="caption" color="textSecondary">
                  Total Budget: {formatCurrency(proposal.proposedBudget)} 
                  {proposal.projectedCorporateIncome > 0 && ` | Income: ${formatCurrency(proposal.projectedCorporateIncome)}`}
                  {proposal.projectedSubsidy > 0 && ` | Subsidy: ${formatCurrency(proposal.projectedSubsidy)}`}
                </Typography>
              </Box>
            </Box>

            <Divider />

            {/* Tabs for Budget Components */}
            <Box>
              <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                <Tab label={`PERSONNEL SERVICES (${personnelData.length})`} />
                <Tab label={`MOOE (${mooeData.length})`} />
                <Tab label={`CAPITAL OUTLAY (${capitalOutlayData.length})`} />
                <Tab label={`INCOME (${incomeData.length})`} />
                <Tab icon={<HistoryIcon />} label="WORKFLOW HISTORY" />
                <Tab icon={<CommentIcon />} label="CHANGE TRACKER" />
              </Tabs>

              {/* Personnel Services Tab */}
              <TabPanel value={tabValue} index={0}>
                {tabLoading[0] ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : personnelData.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                          <TableCell sx={{ width: 50 }}></TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Employee Name</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Position</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Monthly Salary</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Annual Salary</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {personnelData.map((item, idx) => {
                          const employeeName = item.employeeFullName || item.employeeName || item.name || item.employee || item.designation || '—';
                          const position = item.positionTitle || item.position || item.positionName || item.designation || '—';
                          const monthlySalary = item.monthlySalary || item.salary || item.basicSalary || 0;
                          const annualSalary = item.annualSalary || (monthlySalary * 12) || 0;
                          
                          return (
                            <React.Fragment key={idx}>
                              <TableRow hover>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      setExpandedRows((prev) => ({
                                        ...prev,
                                        [`ps-${idx}`]: !prev[`ps-${idx}`]
                                      }))
                                    }
                                  >
                                    {expandedRows[`ps-${idx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  </IconButton>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 500 }}>
                                  {employeeName}
                                </TableCell>
                                <TableCell>{position}</TableCell>
                                <TableCell align="right">{formatCurrency(monthlySalary)}</TableCell>
                                <TableCell align="right">{formatCurrency(annualSalary)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f0f0f0' }}>
                                  {formatCurrency(item.Total || annualSalary)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={6} sx={{ p: 0 }}>
                                  <Collapse in={expandedRows[`ps-${idx}`]} timeout="auto" unmountOnExit>
                                    <Box sx={{ p: 2, bgcolor: '#fafafa' }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                                        Complete Compensation Details
                                      </Typography>
                                      <Grid container spacing={2}>
                                        {/* Main Salary */}
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Monthly Salary</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '1rem' }}>
                                            {formatCurrency(monthlySalary)}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Annual Salary</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '1rem' }}>
                                            {formatCurrency(annualSalary)}
                                          </Typography>
                                        </Grid>

                                        {/* Government Contributions */}
                                        <Grid item xs={12}><Divider><Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>Government Contributions</Typography></Divider></Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">GSIS Premium</Typography>
                                          <Typography variant="body2">{formatCurrency(item.gsisPremium || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">PhilHealth Premium</Typography>
                                          <Typography variant="body2">{formatCurrency(item.philhealthPremium || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">PAG-IBIG Premium</Typography>
                                          <Typography variant="body2">{formatCurrency(item.pagibigPremium || 0)}</Typography>
                                        </Grid>

                                        {/* Special Allowances */}
                                        <Grid item xs={12}><Divider><Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>Special Allowances</Typography></Divider></Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">RATA (Travel & Accommodation)</Typography>
                                          <Typography variant="body2">{formatCurrency(item.RATA || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">PERA (Productivity Allowance)</Typography>
                                          <Typography variant="body2">{formatCurrency(item.PERA || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Uniform/Clothing Allowance</Typography>
                                          <Typography variant="body2">{formatCurrency(item.uniformALLOWANCE || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Productivity Incentive</Typography>
                                          <Typography variant="body2">{formatCurrency(item.productivityIncentive || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Medical Allowance</Typography>
                                          <Typography variant="body2">{formatCurrency(item.medical || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Meal Allowance</Typography>
                                          <Typography variant="body2">{formatCurrency(item.meal || 0)}</Typography>
                                        </Grid>

                                        {/* Bonuses & Subsidies */}
                                        <Grid item xs={12}><Divider><Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>Bonuses & Subsidies</Typography></Divider></Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Mid-Year Bonus</Typography>
                                          <Typography variant="body2">{formatCurrency(item.midyearBonus || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Year-End Bonus</Typography>
                                          <Typography variant="body2">{formatCurrency(item.yearEndBonus || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Subsistence (MDS)</Typography>
                                          <Typography variant="body2">{formatCurrency(item.subsistenceAllowanceMDS || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Subsistence (Special Travel)</Typography>
                                          <Typography variant="body2">{formatCurrency(item.subsistenceAllowanceST || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Children's Allowance</Typography>
                                          <Typography variant="body2">{formatCurrency(item.childrenAllowance || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Cash Gift</Typography>
                                          <Typography variant="body2">{formatCurrency(item.cashGift || 0)}</Typography>
                                        </Grid>

                                        {/* Other Benefits */}
                                        <Grid item xs={12}><Divider><Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>Other Benefits</Typography></Divider></Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Overtime Pay</Typography>
                                          <Typography variant="body2">{formatCurrency(item.overtimePay || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Earned Leaves Conversion</Typography>
                                          <Typography variant="body2">{formatCurrency(item.earnedLeaves || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Retirement Benefits</Typography>
                                          <Typography variant="body2">{formatCurrency(item.retirementBenefits || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Terminal Leave</Typography>
                                          <Typography variant="body2">{formatCurrency(item.terminalLeave || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Loyalty Award</Typography>
                                          <Typography variant="body2">{formatCurrency(item.loyaltyAward || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Court Appearance</Typography>
                                          <Typography variant="body2">{formatCurrency(item.courtAppearance || 0)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Employee Compensation</Typography>
                                          <Typography variant="body2">{formatCurrency(item.employeeCompensation || 0)}</Typography>
                                        </Grid>

                                        {/* Status & ID */}
                                        <Grid item xs={12}><Divider /></Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Status of Appointment</Typography>
                                          <Typography variant="body2">{item.statusOfAppointment || 'Regular'}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary">Total Compensation</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main', fontSize: '1rem' }}>
                                            {formatCurrency(item.Total || 0)}
                                          </Typography>
                                        </Grid>
                                      </Grid>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">No personnel services data found</Alert>
                )}
              </TabPanel>

              {/* MOOE Tab */}
              <TabPanel value={tabValue} index={1}>
                {tabLoading[1] ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : mooeData.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                          <TableCell sx={{ width: 50 }}></TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Subline Item</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Accounting Title</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>UACS Code</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Income</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Subsidy</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {mooeData.map((item, idx) => (
                          <React.Fragment key={idx}>
                            <TableRow hover>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setExpandedRows((prev) => ({
                                      ...prev,
                                      [`mooe-${idx}`]: !prev[`mooe-${idx}`]
                                    }))
                                  }
                                >
                                  {expandedRows[`mooe-${idx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 500 }}>
                                {item.sublimeItem || item.sublineItem || '—'}
                              </TableCell>
                              <TableCell>{item.accountingTitle || item.particular || '—'}</TableCell>
                              <TableCell>{displayUacs(item.uacsCode, item.sublineItem)}</TableCell>
                              <TableCell align="right">{formatCurrency(item.amount || 0)}</TableCell>
                              <TableCell align="right">{formatCurrency(item.income || 0)}</TableCell>
                              <TableCell align="right">{formatCurrency(item.subsidy || 0)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f0f0f0' }}>
                                {formatCurrency((item.amount || 0) + (item.income || 0) + (item.subsidy || 0))}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={8} sx={{ p: 0 }}>
                                <Collapse in={expandedRows[`mooe-${idx}`]} timeout="auto" unmountOnExit>
                                  <Box sx={{ p: 2, bgcolor: '#fafafa' }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                      Details
                                    </Typography>
                                    <Grid container spacing={2}>
                                      <Grid item xs={6}>
                                        <Typography variant="caption" color="textSecondary">Status</Typography>
                                        <Typography variant="body2">{item.status || 'Active'}</Typography>
                                      </Grid>
                                      <Grid item xs={6}>
                                        <Typography variant="caption" color="textSecondary">Description</Typography>
                                        <Typography variant="body2">{item.description || 'N/A'}</Typography>
                                      </Grid>
                                    </Grid>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">No MOOE data found</Alert>
                )}
              </TabPanel>

              {/* Capital Outlay Tab */}
              <TabPanel value={tabValue} index={2}>
                {tabLoading[2] ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : capitalOutlayData.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                          <TableCell sx={{ width: 50 }}></TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Category/Title</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Subline Item</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Accounting Title</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>UACS Code</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Income</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Subsidy</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Cost</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {capitalOutlayData.map((item, idx) => {
                          const categoryName = item.categoryName || item.category || item.type || item.categoryId || '—';
                          const income = Number(item.income || 0);
                          const subsidy = Number(item.subsidy || 0);
                          const cost = item.cost != null ? Number(item.cost) : income + subsidy;
                          return (
                            <React.Fragment key={idx}>
                              <TableRow hover>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      setExpandedRows((prev) => ({
                                        ...prev,
                                        [`co-${idx}`]: !prev[`co-${idx}`]
                                      }))
                                    }
                                  >
                                    {expandedRows[`co-${idx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  </IconButton>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                                  {categoryName}
                                </TableCell>
                                <TableCell>{item.sublineItem || item.sublimeItem || '—'}</TableCell>
                                <TableCell>{item.accountingTitle || item.particulars || '—'}</TableCell>
                                <TableCell sx={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                  {displayUacs(item.uacsCode, item.sublineItem)}
                                </TableCell>
                                <TableCell align="right">{formatCurrency(income)}</TableCell>
                                <TableCell align="right">{formatCurrency(subsidy)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f0f0f0' }}>
                                  {formatCurrency(cost)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={8} sx={{ p: 0 }}>
                                  <Collapse in={expandedRows[`co-${idx}`]} timeout="auto" unmountOnExit>
                                    <Box sx={{ p: 2.5, bgcolor: '#fafafa' }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
                                        Capital Outlay Details
                                      </Typography>
                                      <Grid container spacing={2.5}>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Category</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                                            {categoryName}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Subline Item</Typography>
                                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            {item.sublineItem || item.sublimeItem || 'N/A'}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Accounting Title</Typography>
                                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            {item.accountingTitle || item.particulars || 'N/A'}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>UACS Code</Typography>
                                          <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                                            {displayUacs(item.uacsCode, item.sublineItem)}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12}><Divider /></Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Income</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main', fontSize: '0.95rem', mt: 0.5 }}>
                                            {formatCurrency(income)}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Subsidy</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'info.main', fontSize: '0.95rem', mt: 0.5 }}>
                                            {formatCurrency(subsidy)}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Total Cost</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '1rem', mt: 0.5 }}>
                                            {formatCurrency(cost)}
                                          </Typography>
                                        </Grid>
                                      </Grid>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">No capital outlay data found</Alert>
                )}
              </TabPanel>

              {/* Income Tab */}
              <TabPanel value={tabValue} index={3}>
                {tabLoading[3] ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : incomeData.length > 0 ? (
                  <>
                    <TableContainer component={Paper} sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>{incomeSummary.irrigationLabel}</TableCell>
                            <TableCell align="right">{formatCurrency(incomeSummary.irrigation)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>RENT INCOME</TableCell>
                            <TableCell align="right">{formatCurrency(incomeSummary.rent)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>WATER SERVICE FEE</TableCell>
                            <TableCell align="right">{formatCurrency(incomeSummary.water)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>MISCELLANEOUS INCOME</TableCell>
                            <TableCell align="right">{formatCurrency(incomeSummary.misc)}</TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>TOTAL</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(incomeSummary.total)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <TableContainer>
                      <Table size="small">
                      <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                          <TableCell sx={{ width: 50 }}></TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Item</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {incomeData.map((item, idx) => (
                          <React.Fragment key={idx}>
                            <TableRow hover>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setExpandedRows((prev) => ({
                                      ...prev,
                                      [`income-${idx}`]: !prev[`income-${idx}`]
                                    }))
                                  }
                                >
                                  {expandedRows[`income-${idx}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 500 }}>
                                {item.particulars || item.itemName || item.title || '—'}
                              </TableCell>
                              <TableCell>{item.description || '—'}</TableCell>
                              <TableCell>
                                {item.categoryName || item.category || item.type || '—'}
                              </TableCell>
                              <TableCell align="right">{formatCurrency(item.amount || 0)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f0f0f0' }}>
                                {formatCurrency(item.amount || 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={6} sx={{ p: 0 }}>
                                <Collapse in={expandedRows[`income-${idx}`]} timeout="auto" unmountOnExit>
                                  <Box sx={{ p: 2, bgcolor: '#fafafa' }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                      Additional Details
                                    </Typography>
                                    <Grid container spacing={2}>
                                      <Grid item xs={6}>
                                        <Typography variant="caption" color="textSecondary">Status</Typography>
                                        <Typography variant="body2">{item.status || 'Active'}</Typography>
                                      </Grid>
                                      <Grid item xs={6}>
                                        <Typography variant="caption" color="textSecondary">Source/Reference</Typography>
                                        <Typography variant="body2">{item.source || item.reference || 'N/A'}</Typography>
                                      </Grid>
                                      <Grid item xs={12}>
                                        <Typography variant="caption" color="textSecondary">Full Description</Typography>
                                        <Typography variant="body2">{item.fullDescription || item.remarks || 'N/A'}</Typography>
                                      </Grid>
                                    </Grid>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  </>
                ) : (
                  <Alert severity="info">No income data found</Alert>
                )}
              </TabPanel>

              {/* Workflow History Tab */}
              <TabPanel value={tabValue} index={4}>
                {workflowHistory && workflowHistory.length > 0 ? (
                  <Box sx={{ mt: 2 }}>
                    <Stack spacing={2}>
                      {workflowHistory.map((entry, idx) => (
                        <Card key={idx} sx={{ position: 'relative', pl: 3 }}>
                          {/* Timeline dot indicator */}
                          <Box
                            sx={{
                              position: 'absolute',
                              left: -18,
                              top: 20,
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              bgcolor: getActionColor(entry.action) + '.main',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '20px',
                              boxShadow: 2
                            }}
                          >
                            {getActionIcon(entry.action)}
                          </Box>

                          {/* Timeline connector line */}
                          {idx < workflowHistory.length - 1 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: -1,
                                top: 56,
                                width: 2,
                                height: 'calc(100% + 8px)',
                                bgcolor: getActionColor(entry.action) + '.light'
                              }}
                            />
                          )}

                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: getActionColor(entry.action) + '.main' }}>
                                  {entry.action?.replace(/_/g, ' ')}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {entry.userName || 'System'} • {new Date(entry.timestamp).toLocaleString()}
                                </Typography>
                              </Box>
                              <Chip 
                                label={entry.newStatus || entry.action}
                                size="small"
                                color={getActionColor(entry.action)}
                                variant="outlined"
                              />
                            </Box>
                            
                            {entry.previousStatus && entry.newStatus && (
                              <Box sx={{ my: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                <Typography variant="caption" color="textSecondary">
                                  <strong>Status Change:</strong> {entry.previousStatus} → {entry.newStatus}
                                </Typography>
                              </Box>
                            )}
                            
                            {entry.comment && (
                              <Box sx={{ my: 1, p: 1.5, bgcolor: '#fff3e0', borderRadius: 1, borderLeft: '3px solid #ff9800' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#f57c00' }}>
                                  💬 Feedback / Comments:
                                </Typography>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#333' }}>
                                  {entry.comment}
                                </Typography>
                              </Box>
                            )}
                            
                            {entry.targetRole && (
                              <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1 }}>
                                👤 Forwarded to: {entry.targetRole}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <Alert severity="info">No workflow history available</Alert>
                )}
              </TabPanel>

              {/* Change Tracker Tab */}
              <TabPanel value={tabValue} index={5}>
                {editHistory && editHistory.length > 0 ? (
                  <Box sx={{ mt: 2 }}>
                    <Stack spacing={2}>
                      {editHistory.map((entry, idx) => (
                        <Card key={idx} sx={{ p: 0 }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1.5 }}>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                  ✏️ Edit #{entry.version || idx + 1}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {entry.editedByName || 'Unknown User'} ({entry.editedByRole}) • {new Date(entry.editedAt).toLocaleString()}
                                </Typography>
                              </Box>
                              <Chip
                                icon={<EditIcon />}
                                label={entry.editedByRole || 'EDIT'}
                                size="small"
                                variant="outlined"
                                color="primary"
                              />
                            </Box>

                            {entry.previousStatus && entry.newStatus && (
                              <Box sx={{ my: 1, p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                                <Typography variant="caption" color="primary">
                                  <strong>Status:</strong> {entry.previousStatus} → {entry.newStatus}
                                </Typography>
                              </Box>
                            )}

                            {entry.changesDescription && (
                              <Box sx={{ my: 1, p: 1.5, bgcolor: '#f0f4ff', borderRadius: 1, borderLeft: '3px solid #2196f3' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#1565c0' }}>
                                  Changes Made:
                                </Typography>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#333', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                  {entry.changesDescription}
                                </Typography>
                              </Box>
                            )}

                            {entry.reason && (
                              <Box sx={{ mt: 1, p: 1, bgcolor: '#f3e5f5', borderRadius: 1 }}>
                                <Typography variant="caption" color="textSecondary">
                                  <strong>Reason:</strong> {entry.reason}
                                </Typography>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <Alert severity="info">No edit history available</Alert>
                )}
              </TabPanel>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProposalDetailsWithTables;
