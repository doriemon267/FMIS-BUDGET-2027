const { ensureBackupDirectory, getBackupDirectoryInfo } = require('./utils/backupPaths');
// Show current configuration
const info = getBackupDirectoryInfo();
// Test auto-creation
if (!info.exists) {
  try {
    const createdPath = ensureBackupDirectory();
    } catch (error) {
    }
} else {
  }
// Test with custom path
const customPath = './test-backup-demo';
try {
  const customDir = ensureBackupDirectory(customPath);
  // Clean up demo directory
  const fs = require('fs');
  fs.rmSync(customDir, { recursive: true, force: true });
  } catch (error) {
  }
creates directories automatically');
');