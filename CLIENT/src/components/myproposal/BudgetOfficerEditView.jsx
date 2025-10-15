import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Button,
  Alert,
  CircularProgress,
  Typography,
  TextField
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import toast from 'react-hot-toast';
import { saveDraftEdit, submitEdit } from '../../services/budgetOfficerEditService';
import EditableIncomeTable from './tables/EditableIncomeTable';
import EditablePersonnelTable from './tables/EditablePersonnelTable';
import EditableMOOETable from './tables/EditableMOOETable';
import EditableCapitalOutlayTable from './tables/EditableCapitalOutlayTable';

const BudgetOfficerEditView = ({ proposalData, proposal, onSaveSuccess, variant = 'officer', allowSubmit = true }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState('');
  
  // State for each table
  const [incomeData, setIncomeData] = useState([]);
  const [personnelData, setPersonnelData] = useState([]);
  const [mooeData, setMooeData] = useState([]);
  const [capitalOutlayData, setCapitalOutlayData] = useState([]);

  useEffect(() => {
    if (proposalData) {
      console.log('BudgetOfficerEditView - proposalData:', proposalData);
      console.log('BudgetOfficerEditView - capitalOutlay data:', proposalData.capitalOutlay);
      console.log('BudgetOfficerEditView - hasExistingEdit:', proposalData.hasExistingEdit);
      console.log('BudgetOfficerEditView - editedData:', proposalData.editedData);
      
      // If there's existing edited data, use it but merge with fresh data to get categoryName and details
      if (proposalData.hasExistingEdit && proposalData.editedData) {
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
        
        console.log('BudgetOfficerEditView - merged capitalOutlay:', mergedCapitalOutlay);
        
        setIncomeData(proposalData.editedData.income || []);
        setPersonnelData(proposalData.editedData.personnelServices || []);
        setMooeData(proposalData.editedData.mooe || []);
        setCapitalOutlayData(mergedCapitalOutlay);
        setComments(proposalData.editComments || ''); // Load existing comments
      } else {
        // No existing edit, use fresh data
        setIncomeData(proposalData.income || []);
        setPersonnelData(proposalData.personnelServices || []);
        setMooeData(proposalData.mooe || []);
        setCapitalOutlayData(proposalData.capitalOutlay || []);
        setComments(''); // Clear comments for new edit
      }
    }
  }, [proposalData]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const prepareEditData = () => {
    return {
      proposalId: proposal._id,
      editedIncome: incomeData,
      editedPersonnelServices: personnelData,
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
      toast.success('Draft saved successfully');
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error(error.response?.data?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const editData = prepareEditData();
      await submitEdit(editData);
      toast.success('Edits submitted for approval successfully');
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error submitting edits:', error);
      toast.error(error.response?.data?.message || 'Failed to submit edits');
    } finally {
      setSubmitting(false);
    }
  };

  const hasChanges = () => {
    // Check if any data has been modified
    return incomeData.some(item => item.changeType && item.changeType !== 'unchanged') ||
           personnelData.some(item => item.changeType && item.changeType !== 'unchanged') ||
           mooeData.some(item => item.changeType && item.changeType !== 'unchanged') ||
           capitalOutlayData.some(item => item.changeType && item.changeType !== 'unchanged');
  };

  return (
    <Box>
      <Alert severity={variant === 'manager' ? 'warning' : 'info'} sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>
            {variant === 'manager' ? 'Budget Manager Edit Mode' : 
             variant === 'coordinator' ? 'Budget Coordinator Edit Mode' : 
             variant === 'analyst' ? 'Budget Analyst Edit Mode' :
             'Budget Officer Edit Mode'}:
          </strong> You can edit all four tables below.
          {variant === 'manager' ? ' After reviewing your changes, use Approve in the dialog footer to proceed.' : 
           variant === 'coordinator' ? ' Changes will be tracked and sent for further review after submission.' :
           variant === 'analyst' ? ' Make necessary updates and submit for coordinator review.' :
           ' Changes will be tracked and sent to Budget Analysts for review after approval.'}
        </Typography>
      </Alert>

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
            label={`MOOE (${mooeData.length})`}
            sx={{ fontWeight: activeTab === 2 ? 'bold' : 'normal' }}
          />
          <Tab 
            label={`Capital Outlay (${capitalOutlayData.length})`}
            sx={{ fontWeight: activeTab === 3 ? 'bold' : 'normal' }}
          />
        </Tabs>
      </Box>

      {/* Table Content */}
      <Box sx={{ minHeight: 400, mb: 3 }}>
        {activeTab === 0 && (
          <EditableIncomeTable 
            data={incomeData} 
            onChange={setIncomeData}
          />
        )}
        {activeTab === 1 && (
          <EditablePersonnelTable 
            data={personnelData} 
            onChange={setPersonnelData}
          />
        )}
        {activeTab === 2 && (
          <EditableMOOETable 
            data={mooeData} 
            onChange={setMooeData}
          />
        )}
        {activeTab === 3 && (
          <EditableCapitalOutlayTable 
            data={capitalOutlayData} 
            onChange={setCapitalOutlayData}
          />
        )}
      </Box>

      {/* Comments Section */}
      <Box sx={{ mt: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Comments (Optional)"
          placeholder="Add any notes or comments about your edits..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          variant="outlined"
          helperText={
            variant === 'analyst' 
              ? 'These comments will be visible to Budget Coordinators when reviewing your submission'
              : variant === 'coordinator'
              ? 'These comments will be visible to Budget Officers when reviewing your edits'
              : 'These comments will be visible to Budget Analysts when reviewing your edits'
          }
        />
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSaveDraft}
          disabled={saving || submitting}
        >
          {saving ? 'Saving...' : (variant === 'manager' ? 'Save Changes' : 'Save Draft')}
        </Button>
        {allowSubmit && (
          <Button
            variant="contained"
            color="primary"
            startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
            onClick={handleSubmit}
            disabled={saving || submitting}
          >
            {submitting ? 'Submitting...' : 
             variant === 'analyst' ? 'Submit for Coordinator Review' :
             variant === 'coordinator' ? 'Submit for Officer Review' :
             'Submit for Manager Approval'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default BudgetOfficerEditView;