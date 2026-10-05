import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../config/api';
import { useUser } from '../context/UserContext';
import { useProposalLock } from '../hooks/useProposalLock';
import { useProposalCalculations } from './ProposalOperationsHub/hooks/useProposalCalculations';
import NEPCeilingSummary from './ProposalOperationsHub/components/NEPCeilingSummary';
import NEPWorkspaceNavigation from './ProposalOperationsHub/components/NEPWorkspaceNavigation';
import NEPPersonnelComparisonTable from './ProposalOperationsHub/components/tables/NEPPersonnelComparisonTable';
import NEPFinancialComparisonTable from './ProposalOperationsHub/components/tables/NEPFinancialComparisonTable';
import {
  applyPersonnelLineAllocation,
  buildPersonnelComparisonRows,
  getPersonnelComparisonTotals,
} from './ProposalOperationsHub/components/tables/nepPersonnelComparison';
import {
  getModuleComparisonTotals,
  NEP_WORKSPACE_MODULES,
} from './ProposalOperationsHub/components/tables/nepFinancialComparison';
import ProposalAttachments from '../components/workflow/ProposalAttachments';

const EMPTY_DETAILS = { income: [], personnel: [], mooe: [], capitalOutlay: [] };

const toArray = response => {
  const raw = response?.data;
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw?.data) ? raw.data : [];
};

const cloneDetails = details => JSON.parse(JSON.stringify(details));

const normalizeRoles = roles =>
  (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .map(role => String(role).trim().toUpperCase().replace(/\s+/g, '_'));

const NEPProposalPage = () => {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { calculateProjectedIncome, calculateProjectedSubsidy } = useProposalCalculations();
  const { lockStatus, acquireLock, releaseLock, hasLock } = useProposalLock(proposalId);
  const [proposal, setProposal] = useState(null);
  const [ceilingContext, setCeilingContext] = useState(null);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [editableItems, setEditableItems] = useState(EMPTY_DETAILS);
  const [changedCategories, setChangedCategories] = useState(new Set());
  const [activeTab, setActiveTab] = useState('income');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const roles = useMemo(() => normalizeRoles(currentUser?.Roles), [currentUser?.Roles]);
  const userId = String(
    currentUser?.Username || currentUser?.userId || currentUser?.Id || currentUser?.id || ''
  );
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isPreparer = roles.some(role => ['PREPARER', 'BUDGET_PREPARER'].includes(role));
  const isPlanningAnalyst = roles.some(role =>
    ['BUDGET_PLANNING_ANALYST', 'BUDGET_ANALYST'].includes(role)
  );

  const assignmentAllowsEdit = useMemo(() => {
    if (!proposal) return false;
    if (isSuperAdmin) return true;
    if (proposal.nepAdjustmentMode === 'BRD') return isPlanningAnalyst;
    const assigned = proposal.assignedPreparerUserIds || [];
    return isPreparer && (!assigned.length || assigned.some(id => String(id) === userId));
  }, [isPlanningAnalyst, isPreparer, isSuperAdmin, proposal, userId]);

  const editableStatuses = new Set([
    'DRAFT',
    'RETURNED_TO_PREPARER',
    'FORWARDED_TO_BRD_ANALYST',
    'RETURNED_TO_PLANNING_ANALYST',
  ]);
  const canEdit =
    assignmentAllowsEdit &&
    editableStatuses.has(String(proposal?.status || '').toUpperCase()) &&
    (!lockStatus?.isLocked || hasLock);

  const liveDetails = useMemo(() => ({ ...details, ...editableItems }), [details, editableItems]);
  const liveIncome = useMemo(
    () => calculateProjectedIncome(liveDetails, proposal),
    [calculateProjectedIncome, liveDetails, proposal]
  );
  const liveSubsidy = useMemo(
    () => calculateProjectedSubsidy(liveDetails, proposal),
    [calculateProjectedSubsidy, liveDetails, proposal]
  );
  const liveTotals = useMemo(
    () => ({
      projectedCorporateIncome: liveIncome,
      projectedSubsidy: liveSubsidy,
      proposedBudget: liveIncome + liveSubsidy,
      totalExpenses: liveIncome + liveSubsidy,
      personnelServices: editableItems.personnel.reduce(
        (sum, item) => sum + (Number(item.Total) || 0),
        0
      ),
      mooe: editableItems.mooe.reduce(
        (sum, item) => sum + (Number(item.income) || 0) + (Number(item.subsidy) || 0),
        0
      ),
      capitalOutlay: editableItems.capitalOutlay.reduce(
        (sum, item) => sum + (Number(item.income) || 0) + (Number(item.subsidy) || 0),
        0
      ),
    }),
    [editableItems, liveIncome, liveSubsidy]
  );
  const targetCeiling = Number(ceilingContext?.ceiling?.amount || 0);
  const difference = Math.round((targetCeiling - liveTotals.proposedBudget) * 100) / 100;
  const isMatched = Math.abs(difference) <= 0.01;

  const financialModuleTotals = useMemo(
    () => ({
      income: getModuleComparisonTotals({
        moduleKey: 'income',
        initialItems: details.income,
        currentItems: editableItems.income,
      }),
      mooe: getModuleComparisonTotals({
        moduleKey: 'mooe',
        initialItems: details.mooe,
        currentItems: editableItems.mooe,
      }),
      capital: getModuleComparisonTotals({
        moduleKey: 'capital',
        initialItems: details.capitalOutlay,
        currentItems: editableItems.capitalOutlay,
      }),
    }),
    [details, editableItems]
  );
  const personnelModuleTotals = useMemo(() => {
    const totals = getPersonnelComparisonTotals(
      buildPersonnelComparisonRows(editableItems.personnel)
    );
    return {
      initial: totals.initialIncome + totals.initialSubsidy,
      proposed: totals.nepIncome + totals.nepSubsidy,
    };
  }, [editableItems.personnel]);
  const moduleTotals = useMemo(
    () => ({
      income: financialModuleTotals.income,
      personnel: personnelModuleTotals,
      mooe: financialModuleTotals.mooe,
      capital: financialModuleTotals.capital,
    }),
    [financialModuleTotals, personnelModuleTotals]
  );
  const workspaceModules = useMemo(
    () =>
      NEP_WORKSPACE_MODULES.map(module => ({
        ...module,
        total: moduleTotals[module.key].proposed,
      })),
    [moduleTotals]
  );
  const activeModuleTotals = moduleTotals[activeTab] || moduleTotals.income;
  const activeCategoryCap = Number(
    activeTab === 'personnel'
      ? ceilingContext?.compliance?.caps?.personnelServices ||
          ceilingContext?.ceiling?.personnelServices
      : activeTab === 'mooe'
        ? ceilingContext?.compliance?.caps?.mooe || ceilingContext?.ceiling?.mooe
        : activeTab === 'capital'
          ? ceilingContext?.compliance?.caps?.capitalOutlay ||
            ceilingContext?.ceiling?.capitalOutlay
          : 0
  );
  const activeRemaining = activeCategoryCap - Number(activeModuleTotals.proposed || 0);
  const activeSummary = {
    initial: activeModuleTotals.initial,
    proposed: activeModuleTotals.proposed,
    ...(activeTab === 'income'
      ? {
          ceilingLabel: 'Collection only',
          ceilingHelper: 'Not added to the expense allocation total',
          ceilingTone: 'info',
        }
      : activeCategoryCap > 0
        ? {
            ceilingLabel: activeRemaining < -0.01 ? 'Above category ceiling' : 'Within category ceiling',
            ceilingHelper: `${Math.abs(activeRemaining).toLocaleString('en-PH', {
              style: 'currency',
              currency: 'PHP',
            })} ${activeRemaining < 0 ? 'over' : 'remaining'}`,
            ceilingTone: activeRemaining < -0.01 ? 'error' : 'success',
          }
        : {
            ceilingLabel: 'No category ceiling',
            ceilingHelper: 'Validated against the overall target',
            ceilingTone: 'info',
          }),
  };

  const loadProposal = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const proposalResponse = await api.get(`/api/allproposal/proposals/${proposalId}`);
      const loadedProposal =
        proposalResponse.data?.proposal || proposalResponse.data?.data || proposalResponse.data;
      if (String(loadedProposal?.modelType || loadedProposal?.budgetType).toUpperCase() !== 'NEP') {
        throw new Error('The selected record is not an NEP proposal.');
      }

      const params = {
        proposalId,
        fiscalYear: String(loadedProposal.fiscalYear || ''),
        budgetType: 'NEP',
        division: loadedProposal.division || loadedProposal.responsibilityCenter || '',
        _t: Date.now(),
      };
      const [income, personnel, mooe, capital, ceiling] = await Promise.all([
        api.get('/income/getByParams', { params }),
        api.get('/getpersonnels/byParams', { params }),
        api.get('/mooe/getByParams', { params }),
        api.get('/capital-outlay/getByParams', { params }),
        api.get(`/api/budget-ceiling/proposal/${proposalId}`),
      ]);
      const loadedDetails = {
        income: toArray(income),
        personnel: toArray(personnel),
        mooe: toArray(mooe),
        capitalOutlay: toArray(capital),
      };
      setProposal(loadedProposal);
      setCeilingContext(ceiling.data?.data || null);
      setDetails(loadedDetails);
      setEditableItems(cloneDetails(loadedDetails));
      setChangedCategories(new Set());
    } catch (loadError) {
      setError(
        loadError.response?.data?.message || loadError.message || 'Unable to load NEP proposal.'
      );
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    loadProposal();
  }, [loadProposal]);

  useEffect(() => {
    setActiveTab('income');
  }, [proposalId]);

  useEffect(() => {
    if (proposalId && assignmentAllowsEdit) acquireLock();
    return () => releaseLock();
  }, [acquireLock, assignmentAllowsEdit, proposalId, releaseLock]);

  const handleEditItemAmount = (category, index, newAmount, fieldType = null, fieldName = null) => {
    if (!canEdit) return;
    const indices = Array.isArray(index) ? index : [index];
    setEditableItems(previous => {
      const updated = cloneDetails(previous);
      indices.forEach((itemIndex, position) => {
        const item = updated[category]?.[itemIndex];
        if (!item) return;
        const value = position === 0 ? Number(newAmount) || 0 : 0;
        if (fieldType === 'income' || fieldType === 'subsidy') {
          item[fieldType] = value;
          const total = (Number(item.income) || 0) + (Number(item.subsidy) || 0);
          if ('amount' in item) item.amount = total;
          if ('cost' in item) item.cost = total;
        } else if (fieldName) {
          item[fieldName] = value;
          if (fieldName === 'chargedToIncomeMonthlyAmount') {
            item.chargedToIncomeAmount = value * 12;
            item.chargedToSubsidyAmount = Math.max(
              0,
              (Number(item.Total) || 0) - item.chargedToIncomeAmount
            );
          }
        } else if ('amount' in item) item.amount = value;
        else if ('Total' in item) item.Total = value;
        else if ('cost' in item) item.cost = value;
      });
      return updated;
    });
    setChangedCategories(previous => new Set(previous).add(category));
  };

  const handlePersonnelAllocationChange = useCallback(
    (row, funding, newAmount) => {
      if (!canEdit) return;
      setEditableItems(previous => ({
        ...previous,
        personnel: applyPersonnelLineAllocation(previous.personnel, row, funding, newAmount),
      }));
      setChangedCategories(previous => new Set(previous).add('personnel'));
    },
    [canEdit]
  );

  const resetUnsavedChanges = () => {
    if (!canEdit || changedCategories.size === 0) return;
    setEditableItems(cloneDetails(details));
    setChangedCategories(new Set());
    toast.info('Unsaved NEP changes were reset.');
  };

  const saveChanges = async () => {
    if (!canEdit || changedCategories.size === 0) return;
    setSaving(true);
    try {
      const config = { headers: { 'X-Workflow-Ref': proposalId } };
      const requests = [];
      const withProposal = category =>
        editableItems[category].map(item => ({
          ...item,
          proposalId: item.proposalId || proposalId,
        }));
      if (changedCategories.has('income')) {
        requests.push(api.put('/income/bulk-update', { items: withProposal('income') }, config));
      }
      if (changedCategories.has('personnel')) {
        requests.push(
          api.put('/api/personnel/bulk-update', { items: withProposal('personnel') }, config)
        );
      }
      if (changedCategories.has('mooe')) {
        requests.push(api.put('/mooe/bulk-update', { items: withProposal('mooe') }, config));
      }
      if (changedCategories.has('capitalOutlay')) {
        requests.push(
          api.put('/capital-outlay/bulk-update', { items: withProposal('capitalOutlay') }, config)
        );
      }
      await Promise.all(requests);
      toast.success('NEP Income and Subsidy changes saved.');
      await loadProposal();
    } catch (saveError) {
      toast.error(saveError.response?.data?.message || 'Unable to save NEP changes.');
    } finally {
      setSaving(false);
    }
  };

  const submitProposal = async () => {
    if (!isMatched || changedCategories.size > 0) return;
    const action =
      proposal.nepAdjustmentMode === 'BRD' ? 'forward-to-officer' : 'submit-to-reviewer';
    setSubmitting(true);
    try {
      const { createWorkflowDigitalSignature } = await import('../utils/digitalSignature');
      const digitalSignature = await createWorkflowDigitalSignature({
        proposal,
        workflowAction: action,
        comment: 'NEP Income and Subsidy matched to the approved Target Ceiling.',
        userInfo: currentUser,
      });
      await api.post(`/api/allproposal/proposals/${proposalId}/action`, {
        action,
        comment: 'NEP Income and Subsidy matched to the approved Target Ceiling.',
        ...(digitalSignature ? { digitalSignature } : {}),
      });
      toast.success('NEP proposal submitted successfully.');
      await loadProposal();
    } catch (submitError) {
      toast.error(
        submitError.response?.data?.message || submitError.message || 'Submission failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label="Loading NEP proposal" />
      </Box>
    );
  }

  if (error || !proposal) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">
          <AlertTitle>NEP proposal unavailable</AlertTitle>
          {error}
        </Alert>
        <Button
          sx={{ mt: 2 }}
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/allproposal')}
        >
          Back to proposals
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/allproposal')}>
            All Proposals
          </Button>
          <Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>
            NEP Proposal
          </Typography>
          <Typography color="text.secondary">{proposal.title}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={
              proposal.nepAdjustmentMode === 'BRD' ? 'BRD Planning Analyst' : 'Budget Preparer'
            }
          />
          <Chip label={proposal.status} variant="outlined" />
        </Stack>
      </Stack>

      {lockStatus?.isLocked && !hasLock && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          This proposal is locked by {lockStatus.lockedBy?.userName || 'another user'} and is
          read-only.
        </Alert>
      )}
      {!assignmentAllowsEdit && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You may view this NEP proposal, but adjustment belongs to the assigned{' '}
          {proposal.nepAdjustmentMode === 'BRD' ? 'BRD Planning Analyst' : 'Budget Preparer'}.
        </Alert>
      )}

      <NEPWorkspaceNavigation
        proposal={proposal}
        modules={workspaceModules}
        activeModule={activeTab}
        onModuleChange={setActiveTab}
        canEdit={canEdit}
        summary={activeSummary}
      />

      <Paper variant="outlined" sx={{ mt: 1.5, p: { xs: 1.25, md: 2 } }}>
        {activeTab === 'income' && (
          <NEPFinancialComparisonTable
            moduleKey="income"
            initialItems={details.income}
            currentItems={editableItems.income}
            canEdit={canEdit}
            hasChanges={changedCategories.has('income')}
            emptyLabel="No Corporate Income records available"
            onEdit={(indices, value) => handleEditItemAmount('income', indices, value)}
          />
        )}
          {activeTab === 'personnel' && (
            <NEPPersonnelComparisonTable
              personnel={editableItems.personnel}
              canEdit={canEdit}
              hasChanges={changedCategories.has('personnel')}
              onAllocationChange={handlePersonnelAllocationChange}
            />
          )}
        {activeTab === 'mooe' && (
          <NEPFinancialComparisonTable
            moduleKey="mooe"
            initialItems={details.mooe}
            currentItems={editableItems.mooe}
            canEdit={canEdit}
            hasChanges={changedCategories.has('mooe')}
            emptyLabel="No MOOE records available"
            onEdit={(indices, value, field) =>
              handleEditItemAmount('mooe', indices, value, field)
            }
          />
        )}
        {activeTab === 'capital' && (
          <NEPFinancialComparisonTable
            moduleKey="capital"
            initialItems={details.capitalOutlay}
            currentItems={editableItems.capitalOutlay}
            canEdit={canEdit}
            hasChanges={changedCategories.has('capitalOutlay')}
            emptyLabel="No Capital Outlay records available"
            onEdit={(indices, value, field) =>
              handleEditItemAmount('capitalOutlay', indices, value, field)
            }
          />
        )}
      </Paper>

      <Paper variant="outlined" sx={{ mt: 1.5, p: { xs: 1.25, md: 2 } }}>
        <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 850 }}>
          Attachments &amp; Supporting Documents
        </Typography>
        <ProposalAttachments
          key={activeTab}
          proposal={proposal}
          moduleName={activeTab}
          userInfo={currentUser}
        />
      </Paper>

      <Accordion key={proposalId} defaultExpanded={false} variant="outlined" sx={{ mt: 2 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          id="nep-ceiling-summary"
          aria-controls="nep-ceiling-details"
        >
          <Box>
            <Typography sx={{ fontWeight: 800 }}>NEP Ceiling Alignment</Typography>
            <Typography variant="body2" color="text.secondary">
              View ceiling breakdown and category limits
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p: { xs: 1, md: 2 }, pt: 0 }}>
          <NEPCeilingSummary
            proposal={proposal}
            liveTotals={liveTotals}
            hasUnsavedChanges={changedCategories.size > 0}
            readOnly={!canEdit}
          />
        </AccordionDetails>
      </Accordion>

      <Paper variant="outlined" sx={{ mt: 2, p: 2, position: 'sticky', bottom: 12, zIndex: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography sx={{ fontWeight: 800 }}>
              {isMatched
                ? 'Target Ceiling matched'
                : difference > 0
                  ? 'Below Target Ceiling'
                  : 'Above Target Ceiling'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Difference: ₱
              {Math.abs(difference).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="text"
              startIcon={<RestartAltIcon />}
              disabled={!canEdit || changedCategories.size === 0 || saving}
              onClick={resetUnsavedChanges}
            >
              Reset
            </Button>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              disabled={!canEdit || changedCategories.size === 0 || saving}
              onClick={saveChanges}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              disabled={!canEdit || !isMatched || changedCategories.size > 0 || submitting}
              onClick={submitProposal}
            >
              {submitting
                ? 'Submitting…'
                : proposal.nepAdjustmentMode === 'BRD'
                  ? 'Forward to BRD Officer'
                  : 'Submit to Reviewer'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
};

export default NEPProposalPage;
