/**
 * Workflow Template Controller
 * 
 * Handles CRUD operations for workflow templates
 */

const WorkflowTemplate = require('../models/WorkflowTemplate');

/**
 * Get all templates (with filtering)
 */
exports.getAllTemplates = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    const { category, fiscalYear, budgetType, isPublic, search } = req.query;

    const filter = { isActive: true };

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Filter by fiscal year
    if (fiscalYear) {
      filter.fiscalYear = parseInt(fiscalYear);
    }

    // Filter by budget type
    if (budgetType) {
      filter.budgetType = budgetType;
    }

    // Filter public templates or user's own templates
    if (isPublic === 'true') {
      filter.isPublic = true;
    } else {
      // User can see their own templates and public templates
      filter.$or = [{ createdBy: userId }, { isPublic: true }, { sharedWith: { $elemMatch: { userId } } }];
    }

    // Search by name or description
    if (search) {
      filter.$or = [
        ...(filter.$or || []),
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const templates = await WorkflowTemplate.find(filter)
      .sort({ usageCount: -1, createdAt: -1 })
      .select('-templateData.personnelData -templateData.mooeData -templateData.capitalData')
      .lean();

    res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: error.message,
    });
  }
};

/**
 * Get single template by ID
 */
exports.getTemplate = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    const { id } = req.params;

    const template = await WorkflowTemplate.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Check access
    if (!template.canUse(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this template',
      });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: error.message,
    });
  }
};

/**
 * Create new template
 */
exports.createTemplate = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    const userName = req.user?.FirstName
      ? `${req.user.FirstName} ${req.user.LastName || ''}`.trim()
      : req.user?.name || 'Unknown';

    const {
      name,
      description,
      category,
      fiscalYear,
      budgetType,
      templateData,
      workflowConfig,
      tags,
      isPublic,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Template name is required',
      });
    }

    const template = await WorkflowTemplate.create({
      name,
      description,
      category: category || 'Initial',
      fiscalYear,
      budgetType,
      templateData: templateData || {},
      workflowConfig: workflowConfig || {},
      tags: tags || [],
      isPublic: isPublic || false,
      createdBy: userId,
      createdByName: userName,
    });

    res.status(201).json({
      success: true,
      template,
      message: 'Template created successfully',
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: error.message,
    });
  }
};

/**
 * Update template
 */
exports.updateTemplate = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    const { id } = req.params;
    const updateData = req.body;

    const template = await WorkflowTemplate.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Check edit permission
    if (!template.canEdit(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this template',
      });
    }

    // Update template
    Object.keys(updateData).forEach((key) => {
      if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
        template[key] = updateData[key];
      }
    });

    await template.save();

    res.json({
      success: true,
      template,
      message: 'Template updated successfully',
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: error.message,
    });
  }
};

/**
 * Delete template (soft delete)
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    const { id } = req.params;

    const template = await WorkflowTemplate.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Only creator can delete
    if (template.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this template',
      });
    }

    // Soft delete
    template.isActive = false;
    await template.save();

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: error.message,
    });
  }
};

/**
 * Create proposal from template
 */
exports.createProposalFromTemplate = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    const userName = req.user?.FirstName
      ? `${req.user.FirstName} ${req.user.LastName || ''}`.trim()
      : req.user?.name || 'Unknown';
    const { templateId, overrides = {} } = req.body;

    const template = await WorkflowTemplate.findById(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Check access
    if (!template.canUse(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to use this template',
      });
    }

    // Increment usage
    await template.incrementUsage();

    // Create proposal data from template
    const NewProposalWorkflow = require('../models/NewProposalWorkflow');
    const proposalData = {
      title: overrides.title || template.templateData.title || `Proposal from ${template.name}`,
      description: overrides.description || template.templateData.description || template.description,
      modelType: overrides.modelType || template.budgetType || template.category,
      fiscalYear: overrides.fiscalYear || template.fiscalYear,
      amount: overrides.amount || template.templateData.amount || 0,
      projectedCorporateIncome:
        overrides.projectedCorporateIncome || template.templateData.projectedCorporateIncome || 0,
      projectedSubsidy: overrides.projectedSubsidy || template.templateData.projectedSubsidy || 0,
      status: 'DRAFT',
      createdBy: userId,
      createdByName: userName,
      region: overrides.region || template.templateData.region,
      division: overrides.division || template.templateData.division,
      department: overrides.department || template.templateData.department,
      office: overrides.office || template.templateData.office,
      currentAssigneeRole: template.workflowConfig.defaultAssigneeRole || 'BUDGET PREPARER',
      personnelData: overrides.personnelData || template.templateData.personnelData || [],
      mooeData: overrides.mooeData || template.templateData.mooeData || [],
      capitalData: overrides.capitalData || template.templateData.capitalData || [],
      incomeData: overrides.incomeData || template.templateData.incomeData || [],
      workflowHistory: [
        {
          action: 'CREATED_FROM_TEMPLATE',
          fromStatus: 'NONE',
          toStatus: 'DRAFT',
          performedBy: userId,
          performedByName: userName,
          comment: `Created from template: ${template.name}`,
          timestamp: new Date(),
        },
      ],
    };

    const proposal = await NewProposalWorkflow.create(proposalData);

    res.status(201).json({
      success: true,
      proposal,
      template: {
        id: template._id,
        name: template.name,
      },
      message: 'Proposal created from template successfully',
    });
  } catch (error) {
    console.error('Error creating proposal from template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create proposal from template',
      error: error.message,
    });
  }
};

/**
 * Share template with users
 */
exports.shareTemplate = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id || req.user?.userId;
    const { id } = req.params;
    const { sharedWith } = req.body;

    const template = await WorkflowTemplate.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Only creator can share
    if (template.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to share this template',
      });
    }

    template.sharedWith = sharedWith || [];
    await template.save();

    res.json({
      success: true,
      template,
      message: 'Template sharing updated successfully',
    });
  } catch (error) {
    console.error('Error sharing template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share template',
      error: error.message,
    });
  }
};
