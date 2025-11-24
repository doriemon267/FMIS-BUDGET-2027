require('dotenv').config();
const mongoose = require('mongoose');
const controller = require('../controllers/newProposalWorkflowController');

(async function(){
  try {
    const mongo = process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL || 'mongodb://127.0.0.1:27017/fmis_budget';
    console.log('[debug] connecting to', mongo);
    await mongoose.connect(mongo, { useNewUrlParser: true, useUnifiedTopology: true });

    const req = {
      query: { page: 1, limit: 50, view: 'monitoring', region: '68be0fba37907a9f5551c935' },
      user: {
        id: 'debug-manager-1',
        Roles: ['BUDGET MANAGER']
      }
    };

    const res = {
      _status: 200,
      status(code){ this._status = code; return this; },
      json(obj){ console.log('RESULT:', JSON.stringify(obj, null, 2)); }
    };

    console.log('[debug] calling getProposals with manager role');
    await controller.getProposals(req, res);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error', err);
    process.exit(1);
  }
})();
