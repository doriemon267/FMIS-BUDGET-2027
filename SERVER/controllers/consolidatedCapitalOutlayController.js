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
