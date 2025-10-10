import React, { useMemo, useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Alert,
  Typography,
  Chip
} from '@mui/material';
import ComparisonIncomeTable from './tables/ComparisonIncomeTable';
import ComparisonPersonnelTable from './tables/ComparisonPersonnelTable';
import ComparisonMOOETable from './tables/ComparisonMOOETable';
import ComparisonCapitalOutlayTable from './tables/ComparisonCapitalOutlayTable';

const normalizeComparisonEntries = (entries = []) => {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => {
      if (!entry) return null;

      const { type, edited, original, changes } = entry;
      const detectedChangeType = edited?.changeType || type || 'unchanged';
      const changeType = ['added', 'modified', 'deleted', 'unchanged'].includes(detectedChangeType)
        ? detectedChangeType
        : 'unchanged';

      const baseRecord = changeType === 'deleted'
        ? { ...(original || {}) }
        : { ...(original || {}), ...(edited || {}) };

      const originalValues = edited?.originalValues
        ? { ...edited.originalValues }
        : (original ? { ...original } : null);

      return {
        ...baseRecord,
        changeType,
        originalValues,
        comparisonOriginal: original || null,
        comparisonEdited: edited || null,
        comparisonChanges: changes || null
      };
    })
    .filter(Boolean);
};

const BudgetAnalystComparisonView = ({ comparisonData, proposal }) => {
  const [activeTab, setActiveTab] = useState(0);

  const normalizedData = useMemo(() => {
    if (!comparisonData) {
      return {
        income: [],
        personnelServices: [],
        mooe: [],
        capitalOutlay: []
      };
    }

    return {
      ...comparisonData,
      income: normalizeComparisonEntries(comparisonData.income),
      personnelServices: normalizeComparisonEntries(comparisonData.personnelServices),
      mooe: normalizeComparisonEntries(comparisonData.mooe),
      capitalOutlay: normalizeComparisonEntries(comparisonData.capitalOutlay)
    };
  }, [comparisonData]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getChangeCounts = (data) => {
    if (!data || !Array.isArray(data)) return { added: 0, modified: 0, deleted: 0, unchanged: 0 };
    
    return data.reduce((acc, item) => {
      const changeType = item.changeType || 'unchanged';
      acc[changeType] = (acc[changeType] || 0) + 1;
      return acc;
    }, { added: 0, modified: 0, deleted: 0, unchanged: 0 });
  };

  const incomeChanges = getChangeCounts(normalizedData.income);
  const personnelChanges = getChangeCounts(normalizedData.personnelServices);
  const mooeChanges = getChangeCounts(normalizedData.mooe);
  const capitalOutlayChanges = getChangeCounts(normalizedData.capitalOutlay);

  const renderChangeChips = (changes) => (
    <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
      {changes.added > 0 && (
        <Chip label={`+${changes.added}`} size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
      )}
      {changes.modified > 0 && (
        <Chip label={`~${changes.modified}`} size="small" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />
      )}
      {changes.deleted > 0 && (
        <Chip label={`-${changes.deleted}`} size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
      )}
    </Box>
  );

  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Budget Analyst View:</strong> This shows your original submission alongside the approved version. 
          <span style={{ color: '#2e7d32', fontWeight: 'bold' }}> Green highlights</span> indicate increased values, 
          <span style={{ color: '#d32f2f', fontWeight: 'bold' }}> red highlights</span> indicate decreased values.
        </Typography>
      </Alert>

      {/* Tabs with change indicators */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <span>Income ({normalizedData.income.length})</span>
                {renderChangeChips(incomeChanges)}
              </Box>
            }
            sx={{ fontWeight: activeTab === 0 ? 'bold' : 'normal' }}
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <span>Personnel Services ({normalizedData.personnelServices.length})</span>
                {renderChangeChips(personnelChanges)}
              </Box>
            }
            sx={{ fontWeight: activeTab === 1 ? 'bold' : 'normal' }}
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <span>MOOE ({normalizedData.mooe.length})</span>
                {renderChangeChips(mooeChanges)}
              </Box>
            }
            sx={{ fontWeight: activeTab === 2 ? 'bold' : 'normal' }}
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <span>Capital Outlay ({normalizedData.capitalOutlay.length})</span>
                {renderChangeChips(capitalOutlayChanges)}
              </Box>
            }
            sx={{ fontWeight: activeTab === 3 ? 'bold' : 'normal' }}
          />
        </Tabs>
      </Box>

      {/* Comparison Tables */}
      <Box sx={{ minHeight: 400 }}>
        {activeTab === 0 && (
          <ComparisonIncomeTable data={normalizedData.income} />
        )}
        {activeTab === 1 && (
          <ComparisonPersonnelTable data={normalizedData.personnelServices} />
        )}
        {activeTab === 2 && (
          <ComparisonMOOETable data={normalizedData.mooe} />
        )}
        {activeTab === 3 && (
          <ComparisonCapitalOutlayTable data={normalizedData.capitalOutlay} />
        )}
      </Box>

      {/* Legend */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>Legend:</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, bgcolor: '#e8f5e9', border: '1px solid #4caf50' }} />
            <Typography variant="caption">Increased Value</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, bgcolor: '#ffebee', border: '1px solid #f44336' }} />
            <Typography variant="caption">Decreased Value</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="Added" size="small" color="success" />
            <Typography variant="caption">New Entry</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="Modified" size="small" color="warning" />
            <Typography variant="caption">Changed Entry</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="Deleted" size="small" color="error" />
            <Typography variant="caption">Removed Entry</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default BudgetAnalystComparisonView;