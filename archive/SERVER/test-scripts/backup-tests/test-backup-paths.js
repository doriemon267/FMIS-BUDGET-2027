const { getBackupDirectoryInfo, ensureBackupDirectory } = require('./utils/backupPaths');
const info = getBackupDirectoryInfo();
const backupDir = ensureBackupDirectory();