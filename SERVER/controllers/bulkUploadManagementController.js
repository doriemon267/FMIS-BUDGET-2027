const Income = require('../models/Income');
const MooeProposal = require('../models/MooeProposal');
const CapitalOutlay = require('../models/CapitalOutlay');
const Settings = require('../models/Settings');

exports.getUploadStatus = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ error: 'No active fiscal year settings found' });
    }

    const fiscalYear = activeSettings.fiscalYear;

    const [incomeStatus, mooeStatus, coStatus] = await Promise.all([
      Income.aggregate([
        { $match: { isSystemGenerated: true, fiscalYear: fiscalYear.toString() } },
        {
          $group: {
            _id: {
              region: '$region',
              department: '$department',
              division: '$division'
            },
            count: { $sum: 1 },
            lastUpload: { $max: '$createdAt' }
          }
        }
      ]),
      MooeProposal.aggregate([
        { $match: { isSystemGenerated: true, fiscalYear: fiscalYear.toString() } },
        {
          $group: {
            _id: {
              region: '$region',
              department: '$department',
              division: '$division'
            },
            count: { $sum: 1 },
            lastUpload: { $max: '$createdAt' }
          }
        }
      ]),
      CapitalOutlay.aggregate([
        { $match: { isSystemGenerated: true, fiscalYear: fiscalYear.toString() } },
        {
          $group: {
            _id: {
              region: '$region',
              department: '$department',
              division: '$division'
            },
            count: { $sum: 1 },
            lastUpload: { $max: '$createdAt' }
          }
        }
      ])
    ]);

    const mergedStatus = {};

    const processResults = (results, type) => {
      results.forEach(s => {
        const key = `${s._id.region || 'N/A'}|${s._id.department || 'N/A'}|${s._id.division || 'N/A'}`;
        if (!mergedStatus[key]) {
          mergedStatus[key] = {
            region: s._id.region || 'N/A',
            department: s._id.department || 'N/A',
            division: s._id.division || 'N/A',
            incomeCount: 0,
            mooeCount: 0,
            capitalCount: 0,
            lastUpload: s.lastUpload
          };
        }
        
        if (type === 'income') mergedStatus[key].incomeCount = s.count;
        if (type === 'mooe') mergedStatus[key].mooeCount = s.count;
        if (type === 'capital') mergedStatus[key].capitalCount = s.count;
        
        if (new Date(s.lastUpload) > new Date(mergedStatus[key].lastUpload)) {
          mergedStatus[key].lastUpload = s.lastUpload;
        }
      });
    };

    processResults(incomeStatus, 'income');
    processResults(mooeStatus, 'mooe');
    processResults(coStatus, 'capital');

    res.json({
      success: true,
      fiscalYear,
      data: Object.values(mergedStatus).sort((a, b) => 
        a.region.localeCompare(b.region) || 
        a.department.localeCompare(b.department) || 
        a.division.localeCompare(b.division)
      )
    });
  } catch (error) {
    console.error('Error getting upload status:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
