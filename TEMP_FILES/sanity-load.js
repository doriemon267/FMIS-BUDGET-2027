try {
  require('../SERVER/controllers/mooeController.js');
  require('../SERVER/routers/capitalOutlayRouter.js');
  require('../SERVER/routers/personnelServicesRoutes.js');
  console.log('Loaded OK');
} catch (e) {
  console.error('Load error:', e);
  process.exit(1);
}
