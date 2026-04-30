const { execSync } = require('child_process');
execSync('git checkout -- SERVER/controllers/exportController.js');
console.log('done');
