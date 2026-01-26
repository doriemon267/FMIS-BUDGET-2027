const Proposal = require('../models/Proposal');
const { consolidateAllDrafts } = require('../utils/autoConsolidateDrafts');

/**
 * Get proposals visible to the current user, honoring:
 * - Role-based visibility (req.budgetRoleVisibilityFilter)
 * - Organizational scope (req.hierarchicalFilters)
 * - Optional query filters: statuses, region, department, division, search
 * - Pagination and sorting
 */
exports.getAllUserProposals = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const sortBy = req.query.sortBy || 'updatedAt';
    const sortOrder = (req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    // Base filters from middleware
    const roleFilter = req.budgetRoleVisibilityFilter || {};
    const orgFilter = req.hierarchicalFilters || {};

    // Optional query filters
    const andFilters = [];
    if (roleFilter && Object.keys(roleFilter).length) andFilters.push(roleFilter);
    if (orgFilter && Object.keys(orgFilter).length) andFilters.push(orgFilter);

    // statuses: comma-separated or repeated query param
    let statuses = req.query.statuses;
    if (typeof statuses === 'string') {
      statuses = statuses.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (Array.isArray(statuses) && statuses.length) {
      andFilters.push({ status: { $in: statuses } });
    }

    // region/department/division overrides (further restrict, not broaden)
    const { region, department, division, processBy, fiscalYear, budgetType } = req.query;
    if (region) andFilters.push({ region });
    if (department) andFilters.push({ department });
    if (division) andFilters.push({ division });
    if (processBy) andFilters.push({ processBy });
    if (fiscalYear) andFilters.push({ fiscalYear });
    if (budgetType) andFilters.push({ budgetType });

    // Simple text search across common fields
    const search = (req.query.search || '').trim();
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andFilters.push({ $or: [
        { title: regex },
        { description: regex },
        { region: regex },
        { department: regex },
        { division: regex },
        { processBy: regex }
      ]});
    }

    const query = andFilters.length ? { $and: andFilters } : {};

    const [items, total] = await Promise.all([
      Proposal.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Proposal.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: items,
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error('❌ getAllUserProposals error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch proposals', error: error.message });
  }
};

/**
 * Get consolidated proposals visible to the current user.
 * Returns aggregated Proposal records (not separate budget items).
 * 
 * Flow:
 * 1. Auto-consolidate Draft budget items into Proposal records
 * 2. Query db.proposals with role-based filters
 * 3. Return consolidated proposals with totals (totalExpenses, projectedSubsidy, proposedBudget, etc.)
 */
exports.getAllUserBudgetItems = async (req, res) => {
  try {
    // Get role-based visibility filter from middleware (PREPARER, BUDGET_ANALYST, etc.)
    const roleFilter = req.budgetRoleVisibilityFilter || {};
    const orgFilter = req.hierarchicalFilters || {};

    // Build query - prioritize roleFilter from middleware
    // The roleFilter already knows what user can see based on their role
    const andFilters = [];
    
    // 1. Apply role-based visibility (this is the main filter)
    if (roleFilter && Object.keys(roleFilter).length) {
      andFilters.push(roleFilter);
    }
    
    // 2. Apply organizational scope filter if present
    if (orgFilter && Object.keys(orgFilter).length) {
      andFilters.push(orgFilter);
    }
    
    // 3. Apply fiscal year and budget type filters from query params
    // These are sent from the frontend to filter by active settings
    const { fiscalYear, budgetType } = req.query;
    if (fiscalYear) {
      andFilters.push({ fiscalYear });
    }
    if (budgetType) {
      andFilters.push({ budgetType });
    }
    
    // NOTE: region and processBy query params are IGNORED by design
    // The middleware (budgetRoleVisibilityControl) already handles role-based filtering
    // These should not override the middleware's authorization decisions

    const query = andFilters.length ? { $and: andFilters } : {};
    
    // Debug: log what filters are being applied
    if (String(req.query._debug) === 'true') {
      console.log('📋 getAllUserBudgetItems Query (Consolidated):');
      console.log('- roleFilter:', JSON.stringify(roleFilter));
      console.log('- orgFilter:', JSON.stringify(orgFilter));
      console.log('- (region & processBy query params are IGNORED - middleware handles auth)');
      console.log('- final query:', JSON.stringify(query));
    }
    
    // Step 1: Auto-consolidate any Draft budget items into Proposal records
    try {
      await consolidateAllDrafts();
    } catch (error) {
      console.warn('⚠️ Warning during consolidation:', error.message);
      // Don't fail the request if consolidation has issues
    }

    // Step 2: Fetch consolidated proposals from db.proposals
    const proposals = await Proposal.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: proposals,
      total: proposals.length,
      summary: {
        totalProposals: proposals.length,
        totalExpenses: proposals.reduce((sum, p) => sum + (p.totalExpenses || 0), 0),
        totalIncome: proposals.reduce((sum, p) => sum + (p.totalIncome || 0), 0),
        projectedSubsidy: proposals.reduce((sum, p) => sum + (p.projectedSubsidy || 0), 0),
        proposedBudget: proposals.reduce((sum, p) => sum + (p.proposedBudget || 0), 0)
      }
    });
  } catch (error) {
    console.error("❌ Error fetching consolidated proposals:", error);
    res.status(500).json({ success: false, message: "Failed to fetch proposals" });
  }
};
