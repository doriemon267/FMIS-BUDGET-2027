/**
 * Example: How to integrate the new improvements into your components
 * 
 * This file shows examples of using:
 * - Error handling
 * - Loading skeletons
 * - Debounced search
 * - Auto-save
 * - Keyboard shortcuts
 * - Validation
 */

import React, { useState } from 'react';
import { Box, TextField, Button, Stack } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import api from '../config/api';

// Import utilities
import { handleApiError } from '../utils/errorHandler';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { useDebouncedCallback } from '../hooks/useDebounce';
import useAutoSave from '../hooks/useAutoSave';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import { createValidator } from '../utils/validation';
import TooltipHelp from '../components/common/TooltipHelp';

const ExampleComponent = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [errors, setErrors] = useState({});

  // 1. Debounced Search
  const handleSearch = useDebouncedCallback(async (term) => {
    try {
      const response = await api.get('/search', { params: { q: term } });
      // Update query cache
      queryClient.setQueryData(['search', term], response.data);
    } catch (error) {
      handleApiError(error, toast, 'Search');
    }
  }, 300);

  const onSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    handleSearch(value);
  };

  // 2. Auto-Save
  const { manualSave } = useAutoSave(
    async (data) => {
      await api.put(`/proposal/${proposalId}`, data);
      toast.success('Draft saved automatically');
    },
    formData,
    {
      delay: 2000,
      enabled: !!proposalId && !isSubmitting,
      onSaveError: (error) => {
        handleApiError(error, toast, 'Auto-save');
      },
    }
  );

  // 3. Keyboard Shortcuts
  useKeyboardShortcuts({
    'ctrl+s': (e) => {
      e.preventDefault();
      manualSave();
    },
    'ctrl+k': (e) => {
      e.preventDefault();
      // Open search
      document.getElementById('search-input')?.focus();
    },
    'esc': () => {
      // Close modals, clear search, etc.
      setSearchTerm('');
    },
  });

  // 4. Validation
  const validateTitle = createValidator([
    { type: 'required', message: 'Title is required' },
    { type: 'min', value: 3, message: 'Title must be at least 3 characters' },
  ]);

  const handleTitleChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, title: value });

    // Real-time validation
    const result = validateTitle('Title', value);
    setErrors({
      ...errors,
      title: result.isValid ? '' : result.errors[0]?.message,
    });
  };

  // 5. Query with Error Handling
  const { data, isLoading, error } = useQuery({
    queryKey: ['proposals', searchTerm],
    queryFn: async () => {
      const response = await api.get('/proposals', {
        params: { search: searchTerm },
      });
      return response.data;
    },
    onError: (error) => {
      handleApiError(error, toast, 'Loading proposals');
    },
  });

  // 6. Mutation with Error Handling
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/proposals', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Proposal saved successfully');
      queryClient.invalidateQueries(['proposals']);
    },
    onError: (error) => {
      handleApiError(error, toast, 'Saving proposal');
    },
  });

  const handleSubmit = async () => {
    // Validate all fields
    const titleResult = validateTitle('Title', formData.title);
    if (!titleResult.isValid) {
      setErrors({ title: titleResult.errors[0]?.message });
      return;
    }

    saveMutation.mutate(formData);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Search with debounce */}
      <TextField
        id="search-input"
        label="Search"
        value={searchTerm}
        onChange={onSearchChange}
        fullWidth
        sx={{ mb: 2 }}
      />

      {/* Form with auto-save and validation */}
      <Stack spacing={2}>
        <TextField
          label="Title"
          value={formData.title}
          onChange={handleTitleChange}
          error={!!errors.title}
          helperText={errors.title}
          InputProps={{
            endAdornment: (
              <TooltipHelp
                title="Enter a descriptive title for your proposal"
                placement="right"
              />
            ),
          }}
        />

        <TextField
          label="Description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          multiline
          rows={4}
        />

        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saveMutation.isLoading}
        >
          {saveMutation.isLoading ? 'Saving...' : 'Save'}
        </Button>
      </Stack>

      {/* Error Display */}
      {error && (
        <ErrorAlert
          error={error}
          onRetry={() => queryClient.refetchQueries(['proposals'])}
          sx={{ mt: 2 }}
        />
      )}

      {/* Loading State */}
      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : (
        <Box>
          {/* Your data display here */}
          {data?.map((item) => (
            <div key={item.id}>{item.title}</div>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ExampleComponent;
