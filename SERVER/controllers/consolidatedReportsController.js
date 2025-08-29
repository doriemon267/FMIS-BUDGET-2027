const MooeProposal = require('../models/mooeProposals');
const Region = require('../models/Region');

const consolidatedReportsController = {
  // Get consolidated MOOE data for all or specific regions
  getConsolidatedData: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;
      let regionFilter = {};
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter = { region: { $in: regionList } };
      }
      const mooeQuery = { ...regionFilter };
      if (fiscalYear) mooeQuery.fiscalYear = fiscalYear;
      if (budgetType) mooeQuery.budgetType = budgetType;

      // Fetch all MOOE proposals matching the query
      const mooeData = await MooeProposal.find(mooeQuery).lean();
      if (!Array.isArray(mooeData) || mooeData.length === 0) {
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
      mooeData.forEach((item) => {
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
            total: 0
          };
        }
        // Defensive: always use numbers
        const total =
          Number(item.income || 0) +
          Number(item.subsidy || 0) +
          Number(item.amount || 0) +
          Number(item.nis || 0) +
          Number(item.cis || 0);
        grouped[key].items.push({
          uacsCode: item.uacsCode || '',
          accountingTitle: item.accountingTitle || '',
          income: Number(item.income || 0),
          subsidy: Number(item.subsidy || 0),
          amount: Number(item.amount || 0),
          nis: Number(item.nis || 0),
          cis: Number(item.cis || 0),
          total,
          status: item.status || '',
          processBy: item.processBy || '',
          fiscalYear: item.fiscalYear || '',
          budgetType: item.budgetType || '',
          id: item._id || ''
        });
        grouped[key].total += total;
        grandTotal += total;
      });

      // Prepare result for UI: array of { region, category, total, items }
      const result = Object.values(grouped).map(g => {
        // Sort items by uacsCode ascending (copy first to avoid in-place sort issues)
        const sortedItems = Array.isArray(g.items)
          ? [...g.items].sort((a, b) => {
              const aUacs = (a.uacsCode || '').toString();
              const bUacs = (b.uacsCode || '').toString();
              // Pad with zeros for consistent sorting if numeric
              if (/^\d[\d\-]*$/.test(aUacs) && /^\d[\d\-]*$/.test(bUacs)) {
                return aUacs.padStart(20, '0').localeCompare(bUacs.padStart(20, '0'));
              }
              return aUacs.localeCompare(bUacs);
            })
          : [];
        return {
          region: g.region,
          category: g.category,
          total: g.total,
          items: sortedItems
        };
      }).sort((a, b) => a.region.localeCompare(b.region) || a.category.localeCompare(b.category));

      // Defensive: ensure every group has items as array
      const safeResult = Array.isArray(result)
        ? result.map(g => ({ ...g, items: Array.isArray(g.items) ? g.items : [] }))
        : [];

      res.status(200).json({
        success: true,
        data: Array.isArray(safeResult) ? safeResult.map(g => ({ ...g, items: Array.isArray(g.items) ? g.items : [] })) : [],
        summary: {
          totalRegions: regionSet.size,
          totalCategories: categorySet.size,
          totalEntries: mooeData.length,
          grandTotal
        }
      });
    } catch (error) {
      console.error('Error fetching consolidated MOOE data:', error);
      res.status(200).json({
        success: false,
        data: [],
        summary: {
          totalRegions: 0,
          totalCategories: 0,
          totalEntries: 0,
          grandTotal: 0
        },
        message: 'Failed to fetch consolidated MOOE data',
        error: error.message
      });
    }
  },

  // Get consolidated MOOE summary statistics
  getConsolidatedSummary: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;
      
      let regionFilter = {};
      if (regions) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter = { region: { $in: regionList } };
      }

      // Build query filters for MOOE only
      const mooeQuery = { ...regionFilter };
      
      if (fiscalYear) {
        mooeQuery.fiscalYear = fiscalYear;
      }
      
      if (budgetType) {
        mooeQuery.budgetType = budgetType;
      }

      // Aggregate MOOE totals only
      const mooeAggregation = await MooeProposal.aggregate([
        { $match: mooeQuery },
        { $unwind: '$entries' },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $toDouble: '$entries.amount' } },
            entryCount: { $sum: 1 }
          }
        }
      ]);

      const mooeTotals = mooeAggregation[0] || { totalAmount: 0, entryCount: 0 };

      const summary = {
        mooe: {
          totalAmount: mooeTotals.totalAmount,
          entryCount: mooeTotals.entryCount
        },
        grandTotals: {
          totalAmount: mooeTotals.totalAmount
        }
      };

      res.status(200).json({
        success: true,
        summary
      });

    } catch (error) {
      console.error('Error fetching consolidated summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch consolidated summary',
        error: error.message
      });
    }
  },

  // Get available regions for consolidation
  getAvailableRegions: async (req, res) => {
    try {
      // Get regions that have MOOE data only
      const mooeRegions = await MooeProposal.distinct('region');
      
      // Filter out null/undefined regions
      const allRegions = mooeRegions.filter(Boolean);
      
      // Get region details
      const regionDetails = await Region.find({ name: { $in: allRegions } }).lean();
      
      res.status(200).json({
        success: true,
        regions: regionDetails,
        availableRegions: allRegions
      });

    } catch (error) {
      console.error('Error fetching available regions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available regions',
        error: error.message
      });
    }
  },

  // Export consolidated data (placeholder for future implementation)
  exportConsolidatedData: async (req, res) => {
    try {
      const { format = 'json', regions, fiscalYear, budgetType } = req.query;
      
      // For now, just return the data - can be extended to generate Excel/PDF
      const consolidatedController = require('./consolidatedReportsController');
      
      // Reuse the getConsolidatedData logic
      req.query = { regions, fiscalYear, budgetType };
      
      // This is a simplified approach - in production, you'd want to generate actual files
      res.status(200).json({
        success: true,
        message: `Export functionality for ${format} format will be implemented`,
        note: 'Use the /consolidated-data endpoint to get the data for now'
      });

    } catch (error) {
      console.error('Error exporting consolidated data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export consolidated data',
        error: error.message
      });
    }
  }
};

module.exports = consolidatedReportsController;