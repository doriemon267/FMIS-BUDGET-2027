const Income = require('../models/Income');
const MooeProposal = require('../models/mooeProposals');
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

    res.json({
      success: true,
      fiscalYear,
      status: {
        income: incomeStatus.map(s => ({
          region: s._id.region || 'N/A',
          department: s._id.department || 'N/A',
          division: s._id.division || 'N/A',
          count: s.count,
          lastUpload: s.lastUpload
        })),
        mooe: mooeStatus.map(s => ({
          region: s._id.region || 'N/A',
          department: s._id.department || 'N/A',
          division: s._id.division || 'N/A',
          count: s.count,
          lastUpload: s.lastUpload
        })),
        capitalOutlay: coStatus.map(s => ({
          region: s._id.region || 'N/A',
          department: s._id.department || 'N/A',
          division: s._id.division || 'N/A',
          count: s.count,
          lastUpload: s.lastUpload
        }))
      }
    });
  } catch (error) {
    console.error('Error getting upload status:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
