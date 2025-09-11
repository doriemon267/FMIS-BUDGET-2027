const CapitalOutlay = require('../models/CapitalOutlay');
const Region = require('../models/Region');

const consolidatedCapitalOutlayController = {
  // Get consolidated Capital Outlay data for all or specific regions
  getConsolidatedCapitalOutlayData: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;
      let regionFilter = {};
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter = { region: { $in: regionList } };
      }
      
      // Apply sophisticated hierarchical filtering based on user access scope
      const accessScope = req.hierarchicalAccess?.scope;
      const accessibleRegionName = req.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;

      // Add region filter based on access scope
      if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
        regionFilter.region = accessibleRegionName;
      }

      // Add finer filters based on access scope
      if (accessScope === 'DIVISION') {
        // Division users: only their division within their department and region
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        const divName = req.hierarchicalAccess?.accessibleDivisions?.[0];
        if (deptName) regionFilter.department = deptName;
        if (divName) regionFilter.division = divName;
      } else if (accessScope === 'DEPARTMENT') {
        // Department users: all divisions within their department in the region
        const deptName = req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
        if (deptName) regionFilter.department = deptName;
      } else if (accessScope === 'REGION') {
        // Region-level users should ONLY see:
        // 1. Records that don't have department field (already consolidated to region level)
        // 2. Department records that are properly submitted/approved ONLY  
        // BUT NOT current working drafts of departments
        regionFilter.$and = [
          { region: accessibleRegionName }, // Must be in their region
          {
            $or: [
              // Option 1: Consolidated records (no department info)
              { department: { $exists: false } },
              { department: null },
              { department: "" },
              // Option 2: Department records that are submitted/approved ONLY
              { 
                $and: [
                  { department: { $exists: true, $ne: null, $ne: "" } },
                  { status: { $in: ['Department Submitted', 'Region Verified', 'Approved', 'Finalized'] } }
                ]
              }
            ]
          }
        ];
      }

      // Handle explicit regions parameter while preserving hierarchical filtering
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        if (accessScope === 'REGION' && regionFilter.$and) {
          // For region users, preserve the hierarchical filtering but update the region constraint
          regionFilter.$and[0] = { region: { $in: regionList } };
        } else if (accessScope && accessScope !== 'FULL' && accessibleRegionName) {
          // For other scoped users, intersect with their accessible region
          const allowedRegions = regionList.includes(accessibleRegionName) ? [accessibleRegionName] : [];
          if (allowedRegions.length > 0) {
            regionFilter.region = allowedRegions[0];
          } else {
            // User requested regions they don't have access to - return empty
            return res.status(200).json({
              success: true,
              data: [],
              summary: {
                totalRegions: 0,
                totalCategories: 0,
                totalEntries: 0,
                grandTotal: 0
              }
            });
          }
        } else {
          regionFilter.region = { $in: regionList };
        }
      }
      
      const coQuery = { ...regionFilter };
      if (fiscalYear) coQuery.fiscalYear = fiscalYear;
      if (budgetType) coQuery.budgetType = budgetType;

      // Fetch all Capital Outlay proposals matching the query
      const coData = await CapitalOutlay.find(coQuery).lean();
      if (!Array.isArray(coData) || coData.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          summary: {
            totalRegions: 0,
            totalCategories: 0,
            totalEntries: 0,
            grandTotal: 0
          }
        });
      }

      // Group by region and category
      const grouped = {};
      let grandTotal = 0;
      let regionSet = new Set();
      let categorySet = new Set();
      coData.forEach((item) => {
        const region = item.region || 'Unspecified';
        const category = item.sublineItem || 'Uncategorized';
        regionSet.add(region);
        categorySet.add(category);
        const key = `${region}||${category}`;
        if (!grouped[key]) {
          grouped[key] = {
            region,
            category,
            items: [],
            total: 0,
            totalIncome: 0,
            totalSubsidy: 0
          };
        }
        const cost = Number(item.cost || 0);
        const income = Number(item.income || 0);
        const subsidy = Number(item.subsidy || 0);
        
        grouped[key].items.push({
          uacsCode: item.uacsCode || '',
          projectTitle: item.accountingTitle || '',
          particulars: item.particulars || '',
          cost: cost,
          income: income,
          subsidy: subsidy,
          amount: cost, // Keep amount for backward compatibility
          status: item.status || '',
          processBy: item.processBy || '',
          fiscalYear: item.fiscalYear || '',
          budgetType: item.budgetType || '',
          id: item._id || ''
        });
        grouped[key].total += cost;
        grouped[key].totalIncome += income;
        grouped[key].totalSubsidy += subsidy;
        grandTotal += cost;
      });

      // Prepare result for UI: array of { region, category, total, totalIncome, totalSubsidy, items }
      const result = Object.values(grouped).map(g => ({
        region: g.region,
        category: g.category,
        total: g.total,
        totalIncome: g.totalIncome || 0,
        totalSubsidy: g.totalSubsidy || 0,
        items: Array.isArray(g.items) ? g.items : []
      })).sort((a, b) => a.region.localeCompare(b.region) || a.category.localeCompare(b.category));

      // Defensive: ensure every group has items as array and proper totals
      const safeResult = Array.isArray(result)
        ? result.map(g => ({ 
            ...g, 
            items: Array.isArray(g.items) ? g.items : [],
            totalIncome: g.totalIncome || 0,
            totalSubsidy: g.totalSubsidy || 0
          }))
        : [];

      res.status(200).json({
        success: true,
        data: Array.isArray(safeResult) ? safeResult.map(g => ({ 
          ...g, 
          items: Array.isArray(g.items) ? g.items : [],
          totalIncome: g.totalIncome || 0,
          totalSubsidy: g.totalSubsidy || 0
        })) : [],
        summary: {
          totalRegions: regionSet.size,
          totalCategories: categorySet.size,
          totalEntries: coData.length,
          grandTotal
        }
      });
    } catch (error) {
      console.error('Error fetching consolidated Capital Outlay data:', error);
      res.status(200).json({
        success: false,
        data: [],
        summary: {
          totalRegions: 0,
          totalCategories: 0,
          totalEntries: 0,
          grandTotal: 0
        },
        message: 'Failed to fetch consolidated Capital Outlay data',
        error: error.message
      });
    }
  }
};

module.exports = consolidatedCapitalOutlayController;
