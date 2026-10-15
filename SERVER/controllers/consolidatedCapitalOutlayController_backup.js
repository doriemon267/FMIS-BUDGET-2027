const CapitalOutlay = require('../models/CapitalOutlay');
const Region = require('../models/Region');

const consolidatedCapitalOutlayController = {
  // Get consolidated Capital Outlay data for all or specific regions
  getConsolidatedCapitalOutlayData: async (req, res) => {
    try {
      const { regions, fiscalYear, budgetType } = req.query;
      
      // Initialize base filter
      let regionFilter = {};
      
      // Apply submission workflow filtering for proper data isolation
      if (req.submissionWorkflowFilters) {
        // Use submission workflow filters (preferred approach)
        Object.assign(regionFilter, req.submissionWorkflowFilters);
      } else if (req.hierarchicalAccessInfo) {
        // Fallback to hierarchical access info with submission workflow logic
        const accessInfo = req.hierarchicalAccessInfo;
        
        if (accessInfo?.scope === 'DIVISION') {
          // Division users: only their division data
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
          // Department users: ONLY submitted division data + own department data
          const baseRegion = accessInfo.accessibleRegions?.[0]?.regionName;
          const baseDepartment = accessInfo.accessibleDepartments?.[0]?.departmentName;
          
          if (baseRegion && baseDepartment) {
            regionFilter = {
              $and: [
                { region: baseRegion },
                { department: baseDepartment },
                {
                  $or: [
                    { originalLevel: 'DEPARTMENT' },
                    { 
                      $and: [
                        { originalLevel: 'DIVISION' },
                        { status: { $in: ['Submitted', 'Approved'] } }
                      ]
                    }
                  ]
                }
              ]
            };
          }
        } else if (accessInfo?.scope === 'REGION') {
          // Region users: only submitted department/division data + own region data
          const baseRegion = accessInfo.accessibleRegions?.[0]?.regionName;
          
          if (baseRegion) {
            regionFilter = {
              $and: [
                { region: baseRegion },
                {
                  $or: [
                    { originalLevel: 'REGION' },
                    { 
                      $and: [
                        { originalLevel: { $in: ['DEPARTMENT', 'DIVISION'] } },
                        { status: { $in: ['Submitted', 'Approved'] } }
                      ]
                    }
                  ]
                }
              ]
            };
          }
        } else if (accessInfo?.accessibleRegions?.[0]?.regionName) {
          regionFilter.region = accessInfo.accessibleRegions[0].regionName;
        }
      }
      
      // Handle explicit regions parameter
      if (regions && !regionFilter.$and) {
        const regionList = Array.isArray(regions) ? regions : [regions];
        regionFilter.region = { $in: regionList };
      }

      // Build final query
      const coQuery = { ...regionFilter };
      if (fiscalYear) coQuery.fiscalYear = fiscalYear;
      if (budgetType) coQuery.budgetType = budgetType;

      // Fetch all Capital Outlay proposals matching the query
      const coData = await CapitalOutlay.find(coQuery).lean();

      // Group by region
      const regionGroups = {};
      let grandTotal = 0;

      coData.forEach(item => {
        const regionName = item.region || 'Unknown Region';
        if (!regionGroups[regionName]) {
          regionGroups[regionName] = [];
        }
        regionGroups[regionName].push(item);
        grandTotal += Number(item.amount) || 0;
      });

      // Format response
      const formattedData = Object.keys(regionGroups).map(regionName => ({
        region: regionName,
        items: regionGroups[regionName],
        total: regionGroups[regionName].reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
        count: regionGroups[regionName].length
      }));

      return res.status(200).json({
        success: true,
        data: formattedData,
        summary: {
          totalRegions: Object.keys(regionGroups).length,
          totalEntries: coData.length,
          grandTotal: grandTotal
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
