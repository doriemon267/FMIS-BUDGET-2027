const { getBackupDirectoryInfo, ensureBackupDirectory } = require('./utils/backupPaths');

console.log('🔍 Backup Directory Configuration:');
console.log('=====================================');

const info = getBackupDirectoryInfo();
console.log('Environment Variable:', info.environmentVariable);
console.log('Resolved Path:', info.resolvedPath);
console.log('Is Absolute Path:', info.isAbsolute);
console.log('Directory Exists:', info.exists);

console.log('\n🏗️ Ensuring Backup Directory Exists...');
const backupDir = ensureBackupDirectory();
console.log('✅ Backup Directory Ready:', backupDir);

console.log('\n📋 Usage Examples:');
console.log('Development: BACKUP_STORAGE_PATH=./backups');
console.log('Linux Production: BACKUP_STORAGE_PATH=/var/backups/fmis-budget');
console.log('Windows Production: BACKUP_STORAGE_PATH=C:\\Backups\\FMIS-Budget');
console.log('Docker Volume: BACKUP_STORAGE_PATH=/mnt/backup-volume/fmis');
