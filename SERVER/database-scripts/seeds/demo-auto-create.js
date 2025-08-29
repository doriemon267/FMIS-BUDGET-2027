const { ensureBackupDirectory, getBackupDirectoryInfo } = require('./utils/backupPaths');

console.log('=== DEMO: Auto-Create Backup Directory ===\n');

// Show current configuration
console.log('1. Current Configuration:');
const info = getBackupDirectoryInfo();
console.log(`   Environment Variable: ${info.environmentVariable}`);
console.log(`   Resolved Path: ${info.resolvedPath}`);
console.log(`   Directory Exists: ${info.exists}\n`);

// Test auto-creation
console.log('2. Testing Auto-Creation:');
if (!info.exists) {
  console.log('   📁 Directory does not exist, creating...');
  try {
    const createdPath = ensureBackupDirectory();
    console.log(`   ✅ Successfully created: ${createdPath}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
} else {
  console.log('   ✅ Directory already exists');
}

// Test with custom path
console.log('\n3. Testing Custom Path Creation:');
const customPath = './test-backup-demo';
console.log(`   Testing path: ${customPath}`);
try {
  const customDir = ensureBackupDirectory(customPath);
  console.log(`   ✅ Custom directory ready: ${customDir}`);
  
  // Clean up demo directory
  const fs = require('fs');
  fs.rmSync(customDir, { recursive: true, force: true });
  console.log(`   🧹 Cleaned up demo directory`);
} catch (error) {
  console.log(`   ❌ Error with custom path: ${error.message}`);
}

console.log('\n=== Demo Complete ===');
console.log('\nKey Points:');
console.log('• ensureBackupDirectory() creates directories automatically');
console.log('• Uses { recursive: true } to create parent directories');
console.log('• Safe to call multiple times (idempotent)');
console.log('• Works with both relative and absolute paths');
