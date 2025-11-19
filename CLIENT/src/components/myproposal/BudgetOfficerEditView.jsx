import { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Button,
  Alert,
  CircularProgress,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import toast from 'react-hot-toast';
import { saveDraftEdit, submitEdit } from '../../services/budgetOfficerEditService';
import EditableIncomeTable from './tables/EditableIncomeTable';
import EditablePersonnelTable from './tables/EditablePersonnelTable';
import EditableMOOETable from './tables/EditableMOOETable';
import EditableCapitalOutlayTable from './tables/EditableCapitalOutlayTable';

const BudgetOfficerEditView = forwardRef(({
  proposalData,
  proposal,
  onSaveSuccess,
  variant = 'officer',
  allowSubmit = true,
  showTables = true,
  readOnly = false,
  showSaveDraftButton = true
}, ref) => {
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState('');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitTarget, setSubmitTarget] = useState('BUDGET APPROVER');
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const submitConfirmationCopy = useMemo(() => {
    switch (variant) {
      case 'analyst':
        return {
          title: 'Submit to Budget Officer',
          message: 'This will send your analyzed proposal to the Budget Officer for approval. You will not be able to edit again until it is returned.',
          confirmLabel: 'Submit to Budget Officer'
        };
      case 'preparer':
        return {
          title: 'Submit to Budget Reviewer',
          message: 'This will submit your proposal to the Budget Reviewer for approval. You will not be able to edit again until it is returned.',
          confirmLabel: 'Submit to Budget Reviewer'
        };
      case 'approver':
        return {
          title: 'Submit to Budget Planning Analyst',
          message: 'This will submit the proposal to the Budget Planning Analyst for review and analysis.',
          confirmLabel: 'Submit to Budget Planning Analyst'
        };
      case 'officer':
        return {
          title: 'Submit to Budget Manager',
          message: 'This will forward your reviewed proposal to the Budget Manager for final approval. Ensure all edits are finalized before proceeding.',
          confirmLabel: 'Submit to Budget Manager'
        };
      default:
        return {
          title: 'Confirm Submission',
          message: 'Send your updates to the next workflow reviewer?',
          confirmLabel: 'Submit'
        };
    }
  }, [variant]);
  
  // State for each table
  const [incomeData, setIncomeData] = useState([]);
  const [personnelData, setPersonnelData] = useState([]);
  const [chargedToIncomeData, setChargedToIncomeData] = useState([]);
  const [mooeData, setMooeData] = useState([]);
  const [capitalOutlayData, setCapitalOutlayData] = useState([]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    getCurrentEditData: () => ({
      editedIncome: incomeData,
      editedPersonnelServices: personnelData,
      editedChargedToIncome: chargedToIncomeData,
      editedMOOE: mooeData,
      editedCapitalOutlay: capitalOutlayData,
      comments: comments.trim() || undefined
    })
  }));

  useEffect(() => {
    if (proposalData) {
      console.log('🔄 BudgetOfficerEditView - proposalData received:', {
        hasProposalData: !!proposalData,
        hasExistingEdit: proposalData.hasExistingEdit,
        hasEditedData: !!proposalData.editedData,
        incomeCount: proposalData.income?.length,
        personnelCount: proposalData.personnelServices?.length,
        mooeCount: proposalData.mooe?.length,
        capitalOutlayCount: proposalData.capitalOutlay?.length,
        editedIncomeCount: proposalData.editedData?.income?.length,
        editedPersonnelCount: proposalData.editedData?.personnelServices?.length,
        editedMooeCount: proposalData.editedData?.mooe?.length,
        editedCapitalOutlayCount: proposalData.editedData?.capitalOutlay?.length,
        editComments: proposalData.editComments,
        editStatus: proposalData.editStatus
      });
      
      // If there's existing edited data, use it but merge with fresh data to get categoryName and details
      if (proposalData.hasExistingEdit && proposalData.editedData) {
        console.log('✅ Using EDITED data because hasExistingEdit=true and editedData exists');
        console.log('📋 EDITED DATA DETAILS:', {
          editedIncome: proposalData.editedData.income?.map(i => ({ id: i._id, amount: i.amount })),
          editedPersonnel: proposalData.editedData.personnelServices?.map(p => ({ id: p._id, Total: p.Total })),
          editedMOOE: proposalData.editedData.mooe?.map(m => ({ id: m._id, amount: m.amount })),
          editedCapitalOutlay: proposalData.editedData.capitalOutlay?.map(c => ({ id: c._id, cost: c.cost }))
        });
        
        // Merge edited data with fresh data for Capital Outlay
        const mergedCapitalOutlay = (proposalData.editedData.capitalOutlay || []).map(editedItem => {
          // Find the corresponding fresh item by originalId or _id
          const freshItem = (proposalData.capitalOutlay || []).find(
            fresh => fresh._id.toString() === (editedItem.originalId || editedItem._id).toString()
          );
          
          // Merge: keep edited values but add categoryName, details, and combined particulars from fresh data
          const merged = {
            ...editedItem,
            categoryName: freshItem?.categoryName || editedItem.categoryName,
            details: freshItem?.details || editedItem.details || [],
            category: freshItem?.category || editedItem.category
          };
          
          // If particulars wasn't edited by user, use the fresh combined particulars
          // (Check if editedItem.particulars is different from original, if not, use fresh)
          if (freshItem && (!editedItem.particulars || editedItem.particulars === freshItem.particulars)) {
            merged.particulars = freshItem.particulars;
          }
          
          return merged;
        });
        
        console.log('📊 Setting state with edited data:', {
          incomeRows: proposalData.editedData.income?.length,
          personnelRows: proposalData.editedData.personnelServices?.length,
          mooeRows: proposalData.editedData.mooe?.length,
          capitalOutlayRows: mergedCapitalOutlay.length
        });
        
        // Split personnel data into regular and charged to income
        const allPersonnel = proposalData.editedData.personnelServices || [];
        const regularPersonnel = allPersonnel.filter(p => !p.chargedToIncomeEligible);
        const chargedPersonnel = allPersonnel.filter(p => p.chargedToIncomeEligible);
        
        setIncomeData(proposalData.editedData.income || []);
        setPersonnelData(regularPersonnel);
        setChargedToIncomeData(chargedPersonnel);
        setMooeData(proposalData.editedData.mooe || []);
        setCapitalOutlayData(mergedCapitalOutlay);
        setComments(proposalData.editComments || ''); // Load existing comments
      } else {
        // No existing edit, use fresh data
        console.log('ℹ️ Using FRESH data - no existing edits (hasExistingEdit=' + proposalData.hasExistingEdit + ')');
        console.log('📊 Setting state with fresh data:', {
          incomeRows: proposalData.income?.length,
          personnelRows: proposalData.personnelServices?.length,
          mooeRows: proposalData.mooe?.length,
          capitalOutlayRows: proposalData.capitalOutlay?.length
        });
        console.log('📋 FRESH DATA (first item from each):', {
          firstIncome: proposalData.income?.[0],
          firstPersonnel: proposalData.personnelServices?.[0],
          firstMOOE: proposalData.mooe?.[0],
          firstCapitalOutlay: proposalData.capitalOutlay?.[0]
        });
        
        // Split personnel data into regular and charged to income
        const allPersonnel = proposalData.personnelServices || [];
        const regularPersonnel = allPersonnel.filter(p => !p.chargedToIncomeEligible);
        const chargedPersonnel = allPersonnel.filter(p => p.chargedToIncomeEligible);
        
        setIncomeData(proposalData.income || []);
        setPersonnelData(regularPersonnel);
        setChargedToIncomeData(chargedPersonnel);
        setMooeData(proposalData.mooe || []);
        setCapitalOutlayData(proposalData.capitalOutlay || []);
        setComments(''); // Clear comments for new edit
      }
    }
  }, [proposalData]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const calculateModuleTotal = (data, fieldName) => {
    if (!Array.isArray(data) || data.length === 0) return 0;
    return data.reduce((sum, item) => {
      const val = Number(item[fieldName] || 0);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);
  };

  const validateBeforeSubmit = () => {
    try {
      // Calculate totals for each module
      const personnelTotal = calculateModuleTotal(personnelData, 'Total');
      const mooeTotal = calculateModuleTotal(mooeData, 'amount');
      const capitalTotal = calculateModuleTotal(capitalOutlayData, 'cost');
      const incomeTotal = calculateModuleTotal(incomeData, 'amount');

      console.log('🔍 CLIENT-SIDE VALIDATION STARTED:', {
        personnelTotal,
        mooeTotal,
        capitalTotal,
        incomeTotal,
        personnelCount: personnelData.length,
        mooeCount: mooeData.length,
        capitalCount: capitalOutlayData.length,
        incomeCount: incomeData.length
      });

      // Determine if regional or central office
      const regionName = (proposal.region || '').toUpperCase();
      const isCentralOffice = regionName.includes('CENTRAL') && regionName.includes('OFFICE');

      const missingModules = [];

      // All modules must have positive amounts (STRICTLY GREATER THAN 0)
      if (personnelTotal <= 0) {
        missingModules.push(`Personnel Services (Total: ${personnelTotal})`);
        console.log('❌ VALIDATION FAILED: Personnel Services total is:', personnelTotal);
      }
      if (mooeTotal <= 0) {
        missingModules.push(`MOOE (Total: ${mooeTotal})`);
        console.log('❌ VALIDATION FAILED: MOOE total is:', mooeTotal);
      }
      if (capitalTotal <= 0) {
        missingModules.push(`Capital Outlay (Total: ${capitalTotal})`);
        console.log('❌ VALIDATION FAILED: Capital Outlay total is:', capitalTotal);
      }
      
      // Income is required for regional proposals only
      if (!isCentralOffice && incomeTotal <= 0) {
        missingModules.push(`Income (Total: ${incomeTotal})`);
        console.log('❌ VALIDATION FAILED: Income total is:', incomeTotal, '(Regional Proposal)');
      }

      if (missingModules.length > 0) {
        const requirement = isCentralOffice
          ? 'Central Office proposals require Personnel Services, MOOE, and Capital Outlay with positive amounts.'
          : 'Regional proposals require all four modules (Personnel Services, MOOE, Capital Outlay, and Income) with positive amounts.';
        
        const summaryLines = [
          requirement,
          '',
          '❌ Missing or incomplete modules:',
          ...missingModules,
          '',
          '📊 Module Totals:',
          `  Personnel Services: ₱${personnelTotal.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
          `  MOOE: ₱${mooeTotal.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
          `  Capital Outlay: ₱${capitalTotal.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
          `  Income: ₱${incomeTotal.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
        ];
        
        toast.error(summaryLines.join('\n'));
        console.log('🛑 SUBMISSION BLOCKED BY CLIENT VALIDATION');
        return false;
      }

      console.log('✅ CLIENT-SIDE VALIDATION PASSED');
      return true;
    } catch (error) {
      console.error('⚠️ ERROR IN VALIDATION LOGIC:', error);
      toast.error('Validation error: ' + error.message);
      return false;
    }
  };

  const prepareEditData = () => {
    // Combine personnel and charged to income data for submission
    const allPersonnel = [...personnelData, ...chargedToIncomeData];
    
    return {
      proposalId: proposal._id,
      editedIncome: incomeData,
      editedPersonnelServices: allPersonnel,
      editedMOOE: mooeData,
      editedCapitalOutlay: capitalOutlayData,
      comments: comments.trim() || undefined // Optional comments field
    };
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const editData = prepareEditData();
      await saveDraftEdit(editData);
      toast.success(
        `✅ Draft saved successfully!\n💾 Your changes are preserved`,
        { duration: 3000 }
      );
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error(error.response?.data?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitClick = () => {
    // For BUDGET_COORDINATOR, show dialog to choose submit target
    if (variant === 'reviewer') {
      setShowSubmitDialog(true);
    } else {
      // For other roles, ask for confirmation before submitting
      setConfirmSubmitOpen(true);
    }
  };

  const handleConfirmSubmit = async () => {
    // 🔍 VALIDATE BEFORE SUBMITTING
    if (!validateBeforeSubmit()) {
      return; // Validation failed, don't proceed
    }

    setShowSubmitDialog(false);
    setSubmitting(true);
    try {
      const editData = prepareEditData();
      // Add the submit target for BUDGET_COORDINATOR
      if (variant === 'reviewer') {
        editData.submitTargetRole = submitTarget;
      }
      const res = await submitEdit(editData);

      const routedRole = res?.data?.displayCurrentAssigneeRole || 'NEXT_APPROVER';
      const forwardedCount = res?.data?.forwardedToUsersCount;
      
      let targetLabel = 'Next Approver';
      let extraHint = '';
      
      if (routedRole === 'BUDGET PLANNING ANALYST') {
        extraHint = `You can track it under statuses like "Forwarded to Analyst" or "Under Review by Analyst" in All Proposals.`;
      } else if (routedRole === 'BUDGET OFFICER') {
        extraHint = `You can track it under statuses like "Forwarded to Officer" or "Under Review by Officer" in All Proposals.`;
      } else if (routedRole === 'OVERALL BUDGET APPROVER') {
        extraHint = `You can track it under statuses like "Forwarded to Manager" or "Under Review by Manager" in All Proposals.`;
      }

      const recipientsNote = typeof forwardedCount === 'number'
        ? ` Notified recipients: ${forwardedCount}.`
        : '';

      toast.success(
        `✅ Submitted to ${targetLabel}. Now pending with: ${routedRole}. ${recipientsNote}\n${extraHint}`,
        { duration: 6000 }
      );
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error submitting edits:', error);
      toast.error(error.response?.data?.message || 'Failed to submit edits');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    // 🔍 VALIDATE BEFORE SUBMITTING
    if (!validateBeforeSubmit()) {
      return; // Validation failed, don't proceed
    }

    setSubmitting(true);
    try {
      const editData = prepareEditData();
      const res = await submitEdit(editData);

      const routedRole = res?.data?.displayCurrentAssigneeRole || 'NEXT_APPROVER';
      const forwardedCount = res?.data?.forwardedToUsersCount;
      
      let extraHint = '';
      if (routedRole === 'BUDGET PLANNING ANALYST') {
        extraHint = `You can track it under statuses like "Forwarded to Analyst" or "Under Review by Analyst" in All Proposals.`;
      } else if (routedRole === 'BUDGET OFFICER') {
        extraHint = `You can track it under statuses like "Forwarded to Officer" or "Under Review by Officer" in All Proposals.`;
      } else if (routedRole === 'OVERALL BUDGET APPROVER') {
        extraHint = `You can track it under statuses like "Forwarded to Manager" or "Under Review by Manager" in All Proposals.`;
      }
      
      const recipientsNote = typeof forwardedCount === 'number'
        ? ` Notified recipients: ${forwardedCount}.`
        : '';

      toast.success(
        `✅ Edits submitted successfully. Now pending with: ${routedRole}.${recipientsNote}\n${extraHint}`,
        { duration: 6000 }
      );
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error submitting edits:', error);
      toast.error(error.response?.data?.message || 'Failed to submit edits');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSubmitClose = () => setConfirmSubmitOpen(false);

  const handleConfirmSubmitProceed = () => {
    setConfirmSubmitOpen(false);
    handleSubmit();
  };


  // Calculate module totals for summary display
  const summaryPersonnelTotal = calculateModuleTotal(personnelData, 'Total');
  const summaryChargedToIncomeTotal = calculateModuleTotal(chargedToIncomeData, 'chargedToIncomeAmount');
  const summaryMooeTotal = calculateModuleTotal(mooeData, 'amount');
  const summaryCapitalTotal = calculateModuleTotal(capitalOutlayData, 'cost');
  const summaryIncomeTotal = calculateModuleTotal(incomeData, 'amount');
  const regionName = (proposal.region || '').toUpperCase();
  const isCentralOffice = regionName.includes('CENTRAL') && regionName.includes('OFFICE');

  // Determine missing modules for warning (Personnel Services now includes charged to income)
  const summaryMissingModules = [];
  if ((summaryPersonnelTotal + summaryChargedToIncomeTotal) <= 0 || (personnelData.length + chargedToIncomeData.length) === 0) summaryMissingModules.push('Personnel Services');
  if (summaryMooeTotal <= 0 || mooeData.length === 0) summaryMissingModules.push('MOOE');
  if (summaryCapitalTotal <= 0 || capitalOutlayData.length === 0) summaryMissingModules.push('Capital Outlay');
  if (!isCentralOffice && (summaryIncomeTotal <= 0 || incomeData.length === 0)) summaryMissingModules.push('Income');

  // Determine if form is valid for submission (disable button if not)
  const isFormValid = summaryMissingModules.length === 0;

  return (
    <Box>
      {/* TEMPORARILY HIDDEN - Edit Mode Alert */}
      {false && <Alert severity={variant === 'manager' ? 'warning' : 'info'} sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>
            {variant === 'manager' ? 'Budget Manager Edit Mode' : 
             variant === 'reviewer' ? 'Budget Reviewer Edit Mode' : 
             variant === 'analyst' ? 'Preparer Edit Mode' :
             'Budget Officer Edit Mode'}:
          </strong> You can edit all four tables below.
          {variant === 'manager' ? ' After reviewing your changes, use Approve in the dialog footer to proceed.' : 
           variant === 'reviewer' ? ' Changes will be tracked and sent for further review after submission.' :
           variant === 'analyst' ? ' Make necessary updates and submit to budget officer for approval.' :
           variant === 'approver' ? ' Review and submit to Budget Planning Analyst for analysis.' :
           ' Changes will be tracked and sent to Preparers for review after approval.'}
        </Typography>
      </Alert>}

      {/* Module Summary Box */}
      <Alert 
        severity={summaryMissingModules.length > 0 ? 'error' : 'success'} 
        sx={{ mb: 2, p: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
          📊 Budget Summary (Totals):
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mb: 1 }}>
          <Typography variant="body2">
            ✓ Personnel Services: <strong>{summaryPersonnelTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</strong>
            {summaryChargedToIncomeTotal > 0 && (
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                + PS - Charged to Income: {summaryChargedToIncomeTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
              </div>
            )}
          </Typography>
          <Typography variant="body2">
            ✓ MOOE: <strong>{summaryMooeTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</strong>
          </Typography>
          <Typography variant="body2">
            ✓ Capital Outlay: <strong>{summaryCapitalTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</strong>
          </Typography>
          {!isCentralOffice && (
            <Typography variant="body2">
              ✓ Income: <strong>{summaryIncomeTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</strong>
            </Typography>
          )}
        </Box>
        {summaryMissingModules.length > 0 && (
          <Typography variant="body2" sx={{ color: '#d32f2f', fontWeight: 'bold', mt: 1 }}>
            ⚠️ Before submitting, please ensure all required modules have positive amounts: {summaryMissingModules.join(', ')}
          </Typography>
        )}
      </Alert>

      {showTables && (
        <>
          {/* Tabs for different expenditure types */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab 
                label={`Income (${incomeData.length})`} 
                sx={{ fontWeight: activeTab === 0 ? 'bold' : 'normal' }}
              />
              <Tab 
                label={`Personnel Services (${personnelData.length})`}
                sx={{ fontWeight: activeTab === 1 ? 'bold' : 'normal' }}
              />
              <Tab 
                label={`PS - Charged to Income (${chargedToIncomeData.length})`}
                sx={{ fontWeight: activeTab === 2 ? 'bold' : 'normal' }}
              />
              <Tab 
                label={`MOOE (${mooeData.length})`}
                sx={{ fontWeight: activeTab === 3 ? 'bold' : 'normal' }}
              />
              <Tab 
                label={`Capital Outlay (${capitalOutlayData.length})`}
                sx={{ fontWeight: activeTab === 4 ? 'bold' : 'normal' }}
              />
            </Tabs>
          </Box>

          {/* Table Content */}
          <Box sx={{ minHeight: 400, mb: 3 }}>
            {activeTab === 0 && (
              <EditableIncomeTable 
                data={incomeData} 
                onChange={readOnly ? undefined : setIncomeData}
              />
            )}
            {activeTab === 1 && (
              <EditablePersonnelTable 
                data={personnelData} 
                onChange={readOnly ? undefined : setPersonnelData}
              />
            )}
            {activeTab === 2 && (
              <EditablePersonnelTable 
                data={chargedToIncomeData} 
                onChange={readOnly ? undefined : setChargedToIncomeData}
                title="Personnel Services - Charged to Income"
              />
            )}
            {activeTab === 3 && (
              <EditableMOOETable 
                data={mooeData} 
                onChange={readOnly ? undefined : setMooeData}
              />
            )}
            {activeTab === 4 && (
              <EditableCapitalOutlayTable 
                data={capitalOutlayData} 
                onChange={readOnly ? undefined : setCapitalOutlayData}
              />
            )}
          </Box>
        </>
      )}

      {/* Comments Section */}
      <Box sx={{ mt: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Comments (Optional)"
          placeholder="Add any notes or comments about your edits..."
          value={comments}
          onChange={readOnly ? undefined : (e) => setComments(e.target.value)}
          variant="outlined"
          InputProps={{
            readOnly: readOnly
          }}
          helperText={
            variant === 'analyst' 
              ? 'These comments will be visible to Budget Officer when approving your submission'
              : variant === 'reviewer'
              ? 'These comments will be visible to Approvers when reviewing your edits'
              : variant === 'approver'
              ? 'These comments will be visible to Preparer when reviewing your approved proposal'
              : 'These comments will be visible to Preparers when reviewing your edits'
          }
        />
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
        {showSaveDraftButton && (
          <Button
            variant="outlined"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSaveDraft}
            disabled={saving || submitting}
          >
            {saving ? 'Saving...' : (variant === 'manager' ? 'Save Changes' : 'Save Draft')}
          </Button>
        )}
        {allowSubmit && (
          <Button
            variant="contained"
            color="primary"
            startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
            onClick={handleSubmitClick}
            disabled={saving || submitting || !isFormValid}
            title={!isFormValid ? `Missing required modules: ${summaryMissingModules.join(', ')}` : 'Submit for approval'}
          >
        {submitting ? 'Submitting...' : 
         !isFormValid ? `❌ Complete all modules to submit` :
         variant === 'analyst' ? 'Submit to Budget Officer' :
         variant === 'preparer' ? 'Submit to Budget Reviewer' :
         variant === 'approver' ? 'Submit to Budget/Planning Analyst' :
         variant === 'reviewer' ? 'Submit to Budget Approver' :
         'Submit to Budget Manager'}
          </Button>
        )}
      </Box>

      {/* Generic submit confirmation (analyst/officer) */}
      <Dialog open={confirmSubmitOpen} onClose={handleConfirmSubmitClose} maxWidth="xs" fullWidth>
        <DialogTitle>{submitConfirmationCopy.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {submitConfirmationCopy.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmSubmitClose} disabled={submitting}>Cancel</Button>
          <Button
            onClick={handleConfirmSubmitProceed}
            variant="contained"
            color="primary"
            disabled={submitting}
          >
            {submitConfirmationCopy.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reviewer Submit Target Dialog */}
      {variant === 'reviewer' && (
        <Dialog open={showSubmitDialog} onClose={() => setShowSubmitDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Submit Reviewed Proposal</DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              Where would you like to send this reviewed proposal?
            </Typography>
            <RadioGroup
              value={submitTarget}
              onChange={(e) => setSubmitTarget(e.target.value)}
            >
              <FormControlLabel
                value="BUDGET APPROVER"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Approver (Standard Flow)
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Send to Approver for review and approval
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="BUDGET MANAGER"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Budget Manager (Skip Approver)
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Send directly to the Budget Manager for final approval
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleConfirmSubmit} 
              variant="contained" 
              color="primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
});

export default BudgetOfficerEditView;