/**
 * Workflow Template Selector Component
 * 
 * Allows users to select and use workflow templates
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Description as TemplateIcon,
  Star as StarIcon,
  Person as PersonIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../config/api';
import logger from '../../utils/logger';
import { handleApiError } from '../../utils/errorHandler';
import { toast } from 'react-toastify';

const WorkflowTemplateSelector = ({ open, onClose, onSelectTemplate, fiscalYear, budgetType }) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['workflowTemplates', fiscalYear, budgetType, selectedCategory],
    queryFn: async () => {
      const params = {};
      if (fiscalYear) params.fiscalYear = fiscalYear;
      if (budgetType) params.budgetType = budgetType;
      if (selectedCategory !== 'all') params.category = selectedCategory;

      const response = await api.get('/api/workflow-templates', { params });
      return response.data;
    },
    enabled: open,
  });

  // Filter templates by search query
  const filteredTemplates =
    templatesData?.templates?.filter((template) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }) || [];

  const handleSelectTemplate = async (template) => {
    try {
      if (onSelectTemplate) {
        await onSelectTemplate(template);
      }
      onClose();
    } catch (error) {
      handleApiError(error, toast, 'Selecting template');
    }
  };

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'Initial', label: 'Initial' },
    { value: 'NEP', label: 'NEP' },
    { value: 'GAA', label: 'GAA' },
    { value: 'Custom', label: 'Custom' },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Select Workflow Template</Typography>
          <Button onClick={onClose} size="small">
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Search and Filter */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <Chip
                key={cat.value}
                label={cat.label}
                onClick={() => setSelectedCategory(cat.value)}
                color={selectedCategory === cat.value ? 'primary' : 'default'}
                variant={selectedCategory === cat.value ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>

        {/* Templates Grid */}
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        ) : filteredTemplates.length === 0 ? (
          <Alert severity="info">No templates found. Create a template to get started.</Alert>
        ) : (
          <Grid container spacing={2}>
            {filteredTemplates.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template._id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 4,
                    },
                  }}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <TemplateIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" component="div">
                        {template.name}
                      </Typography>
                      {template.isPublic && (
                        <PublicIcon sx={{ ml: 'auto', fontSize: 16, color: 'text.secondary' }} />
                      )}
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {template.description || 'No description'}
                    </Typography>

                    <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
                      <Chip label={template.category} size="small" />
                      {template.fiscalYear && (
                        <Chip label={`FY ${template.fiscalYear}`} size="small" variant="outlined" />
                      )}
                      {template.budgetType && (
                        <Chip label={template.budgetType} size="small" variant="outlined" />
                      )}
                    </Box>

                    {template.tags && template.tags.length > 0 && (
                      <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
                        {template.tags.slice(0, 3).map((tag, idx) => (
                          <Chip key={idx} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}

                    <Box display="flex" alignItems="center" mt={1}>
                      <StarIcon sx={{ fontSize: 14, color: 'warning.main', mr: 0.5 }} />
                      <Typography variant="caption" color="text.secondary">
                        Used {template.usageCount || 0} times
                      </Typography>
                      {template.createdByName && (
                        <>
                          <PersonIcon sx={{ fontSize: 14, ml: 2, mr: 0.5, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {template.createdByName}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </CardContent>

                  <CardActions>
                    <Button size="small" onClick={() => handleSelectTemplate(template)}>
                      Use Template
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowTemplateSelector;
