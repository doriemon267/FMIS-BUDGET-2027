import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import api from '../config/api';
import { Button, TextField, Box, Typography, Alert } from '@mui/material';

const TestAssignmentCreation = () => {
  const { currentUser, refetchUserProfile } = useUser();
  const [userId, setUserId] = useState(currentUser?.Id || currentUser?.id || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const createFullAssignment = async () => {
    if (!userId) {
      setError('User ID is required');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        userId: userId,
        userName: currentUser?.Username || 'Test User',
        email: currentUser?.email || 'test@example.com',
        assignmentLevel: 'FULL',
        accessScope: 'FULL',
        rolePermissions: {
          canCreateProposals: true,
          canEditOwnProposals: true,
          canEditAllProposals: true,
          canDeleteProposals: true,
          canApproveProposals: true,
          canViewReports: true,
          canManageUsers: true,
          canManageSettings: true
        },
        workflowRoles: [
          'divisionCreator',
          'divisionApprover',
          'departmentCreator',
          'departmentConsolidator',
          'departmentSubmission',
          'regionFinalVerifier',
          'regionCreator'
        ],
        restrictions: {
          readOnlyMode: false,
          allowedBudgetTypes: ['Initial', 'NEP', 'GAA'],
          allowedFiscalYears: []
        }
      };

      console.log('Creating assignment with payload:', payload);

      const response = await api.post('/api/hierarchical-rbac/assignments', payload);
      setResult(response.data);

      // Refresh user profile to get updated access
      await refetchUserProfile();

      console.log('Assignment created successfully:', response.data);
    } catch (err) {
      console.error('Error creating assignment:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Test Assignment Creation (FULL Access)
      </Typography>

      <TextField
        fullWidth
        label="User ID"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Button
        variant="contained"
        onClick={createFullAssignment}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Creating...' : 'Create FULL Assignment'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Assignment created successfully!
        </Alert>
      )}

      {result && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Result:</Typography>
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
};

export default TestAssignmentCreation;