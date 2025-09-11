// Load test environment
require('dotenv').config({ path: '.env.test' });
const { getBackupDirectoryInfo, ensureBackupDirectory } = require('./utils/backupPaths');
:');
const info = getBackupDirectoryInfo();
if (!info.exists) {
  try {
    const backupDir = ensureBackupDirectory();
    } catch (error) {
    }
} else {
  }