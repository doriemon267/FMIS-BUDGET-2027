// Load test environment
require('dotenv').config({ path: '.env.test' });

const { getBackupDirectoryInfo, ensureBackupDirectory } = require('./utils/backupPaths');

console.log('🔍 Backup Directory Configuration (Test):');
console.log('==========================================');

const info = getBackupDirectoryInfo();
console.log('Environment Variable:', info.environmentVariable);
console.log('Resolved Path:', info.resolvedPath);
console.log('Is Absolute Path:', info.isAbsolute);
console.log('Directory Exists:', info.exists);

if (!info.exists) {
  console.log('\n🏗️ Ensuring Backup Directory Exists...');
  try {
    const backupDir = ensureBackupDirectory();
    console.log('✅ Backup Directory Created:', backupDir);
  } catch (error) {
    console.log('❌ Error creating directory:', error.message);
  }
} else {
  console.log('✅ Directory already exists');
}
