const CapitalOutlay = require('../models/CapitalOutlay');
const CapitalOutlayDetails = require('../models/CapitalOutlayDetails');
const Region = require('../models/Region');

const consolidatedCapitalOutlayController = {
  // Get consolidated Capital Outlay data for all or specific regions
  getConsolidatedCapitalOutlayData: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;
      
      let regionFilter = {};
      
      if (req.submissionWorkflowFilters) {
        Object.assign(regionFilter, req.submissionWorkflowFilters);
      } else if (req.hierarchicalAccess) {
        const accessInfo = req.hierarchicalAccess;
        
        if (accessInfo?.scope === 'DIVISION') {
          if (accessInfo.accessibleRegions?.[0]?.regionName) {
            regionFilter.region = accessInfo.accessibleRegions[0].regionName;
          }
          if (accessInfo.accessibleDepartments?.[0]?.departmentName) {
            regionFilter.department = accessInfo.accessibleDepartments[0].departmentName;
          }
          if (accessInfo.accessibleDivisions?.[0]) {
            regionFilter.division = accessInfo.accessibleDivisions[0];
          }
        } else if (accessInfo?.scope === 'DEPARTMENT') {
          const baseRegion = accessInfo.accessibleRegions?.[0]?.regionName;
          const baseDepartment = accessInfo.accessibleDepartments?.[0]?.departmentName;
          
          if (baseRegion && baseDepartment) {
            regionFilter = {
              $and: [
                { region: baseRegion },
                { department: baseDepartment },
                {
                  $or: [
                    { $and: [{ $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }] },
                    {
                      $and: [
                        { division: { $exists: true, $ne: null, $ne: "" } },
                        { status: { $in: ["Submitted", "Approved", "Completed"] } }
                      ]
                    }
                  ]
                }
              ]
            };
          }
        } else if (accessInfo?.scope === 'REGION') {
          const baseRegion = accessInfo.accessibleRegions?.[0]?.regionName;
          if (baseRegion) {
            regionFilter = {
              $and: [
                { region: baseRegion },
                { $or: [{ department: { $exists: false } }, { department: null }, { department: "" }] }
              ]
            };
          }
        } else if (accessInfo?.accessibleRegions?.[0]?.regionName) {
          regionFilter.region = accessInfo.accessibleRegions[0].regionName;
        }
      }
      
      if (regions && !regionFilter.$and) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter.region = { $in: regionList };
      }

      const coQuery = { ...regionFilter };
      if (fiscalYear) coQuery.fiscalYear = fiscalYear;
      if (budgetType) coQuery.budgetType = budgetType;

      const coData = await CapitalOutlay.find(coQuery).populate('category', 'categoryName').lean();

      const parentIds = coData.map((c) => c._id);
      const allDetails = await CapitalOutlayDetails.find({ capital_outlay_id: { $in: parentIds } })
        .sort({ createdAt: 1 })
        .lean();

      const detailsByParentId = {};
      allDetails.forEach((d) => {
        // Parentheses added to fix potential ambiguity (though only ?? used here, it's good practice)
        const pid = (d.capital_outlay_id?.toString?.()) ?? d.capital_outlay_id;
        if (!detailsByParentId[pid]) detailsByParentId[pid] = [];
        detailsByParentId[pid].push(d);
      });

      const regionGroups = {};
      let grandTotal = 0;

      coData.forEach((parent) => {
        const regionName = parent.region || 'Unknown Region';
        if (!regionGroups[regionName]) regionGroups[regionName] = [];
        const details = detailsByParentId[parent._id.toString()];
        
        if (Array.isArray(details) && details.length > 0) {
          const categoryGroup = parent.sublineItem || parent.accountingTitle || (parent.category && parent.category.categoryName) || 'Other';
          details.forEach((d) => {
            const incomeAmt = Number(d.income_amount) || 0;
            const subsidyAmt = Number(d.subsidy_amount) || 0;
            const amount = incomeAmt + subsidyAmt;
            const expanded = {
              ...parent,
              _id: d._id,
              particulars: d.particulars || '',
              sublineItem: d.particulars || parent.sublineItem,
              categoryGroup,
              income: incomeAmt,
              subsidy: subsidyAmt,
              cost: amount,
              amount,
              uacsCode: `${parent.uacsCode || parent._id}-${d._id}`,
            };
            regionGroups[regionName].push(expanded);
            grandTotal += amount;
          });
        } else {
          const amount = (Number(parent.amount) ?? (Number(parent.cost) || 0)) || ((Number(parent.income) || 0) + (Number(parent.subsidy) || 0));
          regionGroups[regionName].push({ ...parent, amount });
          grandTotal += amount;
        }
      });

      const formattedData = Object.keys(regionGroups).map((regionName) => {
        const items = regionGroups[regionName];
        // FIX 2: Wrapped ?? and || in parentheses
        const total = items.reduce((sum, item) => sum + (Number(item.amount) ?? (Number(item.cost) || 0)), 0);
        return { region: regionName, items, total, count: items.length };
      });

      const totalEntries = Object.values(regionGroups).reduce((s, arr) => s + arr.length, 0);
      
      return res.status(200).json({
        success: true,
        data: formattedData,
        summary: {
          totalRegions: Object.keys(regionGroups).length,
          totalEntries,
          grandTotal
        },
        filters: {
          fiscalYear,
          budgetType,
          regions: regions || 'All'
        }
      });

    } catch (error) {
      console.error('Error in getConsolidatedCapitalOutlayData:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = consolidatedCapitalOutlayController;