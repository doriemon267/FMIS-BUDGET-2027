const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const zlib = require('zlib');
const { promisify } = require('util');
const execAsync = promisify(exec);
/**
 * Verify backup file integrity
 */
const verifyBackupIntegrity = async (filePath) => {
  try {
    const verification = {
      fileExists: false,
      fileSize: 0,
      isValidGzip: false,
      canExtract: false,
      estimatedRecords: 0,
      collections: [],
      verificationTime: new Date(),
      errors: []
    };
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      verification.errors.push('Backup file does not exist');
      return verification;
    }
    verification.fileExists = true;
    // Get file stats
    const stats = fs.statSync(filePath);
    verification.fileSize = stats.size;
    if (verification.fileSize === 0) {
      verification.errors.push('Backup file is empty');
      return verification;
    }
    // Verify gzip integrity
    try {
      const buffer = fs.readFileSync(filePath);
      zlib.gunzipSync(buffer);
      verification.isValidGzip = true;
    } catch (error) {
      verification.errors.push(`Invalid gzip format: ${error.message}`);
      verification.isValidGzip = false;
    }
    // Try to extract and analyze backup content
    if (verification.isValidGzip) {
      try {
        const tempDir = path.join(__dirname, '../temp_verification');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        // Extract backup to temporary directory for analysis
        const { stdout, stderr } = await execAsync(`mongorestore --gzip --archive="${filePath}" --dryRun --verbose`);
        if (stderr && !stderr.includes('done')) {
          verification.errors.push(`Mongorestore verification failed: ${stderr}`);
        } else {
          verification.canExtract = true;
          // Parse mongorestore output to get collection info
          const lines = stdout.split('\n');
          const collections = [];
          let recordCount = 0;
          for (const line of lines) {
            if (line.includes('collection') && line.includes('documents')) {
              const match = line.match(/(\w+)\.(\w+).*?(\d+)\s+document/);
              if (match) {
                const [, database, collection, count] = match;
                collections.push({
                  database,
                  collection,
                  documentCount: parseInt(count)
                });
                recordCount += parseInt(count);
              }
            }
          }
          verification.collections = collections;
          verification.estimatedRecords = recordCount;
        }
        // Cleanup temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (error) {
        verification.errors.push(`Extraction test failed: ${error.message}`);
        verification.canExtract = false;
      }
    }
    return verification;
  } catch (error) {
    // Backup verification failed
    return {
      fileExists: false,
      fileSize: 0,
      isValidGzip: false,
      canExtract: false,
      estimatedRecords: 0,
      collections: [],
      verificationTime: new Date(),
      errors: [error.message]
    };
  }
};
/**
 * Compare two backups
 */
const compareBackups = async (backup1Path, backup2Path) => {
  try {
    const [verification1, verification2] = await Promise.all([
      verifyBackupIntegrity(backup1Path),
      verifyBackupIntegrity(backup2Path)
    ]);
    const comparison = {
      backup1: {
        path: backup1Path,
        ...verification1
      },
      backup2: {
        path: backup2Path,
        ...verification2
      },
      differences: {
        sizeDifference: Math.abs(verification1.fileSize - verification2.fileSize),
        recordCountDifference: Math.abs(verification1.estimatedRecords - verification2.estimatedRecords),
        collectionsOnlyIn1: [],
        collectionsOnlyIn2: [],
        collectionDifferences: []
      },
      comparisonTime: new Date()
    };
    // Compare collections
    const collections1 = verification1.collections.map(c => `${c.database}.${c.collection}`);
    const collections2 = verification2.collections.map(c => `${c.database}.${c.collection}`);
    comparison.differences.collectionsOnlyIn1 = collections1.filter(c => !collections2.includes(c));
    comparison.differences.collectionsOnlyIn2 = collections2.filter(c => !collections1.includes(c));
    // Compare collection document counts
    for (const col1 of verification1.collections) {
      const col2 = verification2.collections.find(c => 
        c.database === col1.database && c.collection === col1.collection
      );
      if (col2 && col1.documentCount !== col2.documentCount) {
        comparison.differences.collectionDifferences.push({
          collection: `${col1.database}.${col1.collection}`,
          backup1Count: col1.documentCount,
          backup2Count: col2.documentCount,
          difference: Math.abs(col1.documentCount - col2.documentCount)
        });
      }
    }
    return comparison;
  } catch (error) {
    // Backup comparison failed
    return {
      error: error.message,
      comparisonTime: new Date()
    };
  }
};
/**
 * Generate backup report
 */
const generateBackupReport = async (backupPath) => {
  try {
    const verification = await verifyBackupIntegrity(backupPath);
    const fileName = path.basename(backupPath);
    const report = {
      fileName,
      filePath: backupPath,
      verification,
      summary: {
        status: verification.errors.length === 0 ? 'HEALTHY' : 'ISSUES_FOUND',
        totalCollections: verification.collections.length,
        totalRecords: verification.estimatedRecords,
        fileSize: formatBytes(verification.fileSize),
        issues: verification.errors,
        recommendations: []
      },
      generatedAt: new Date()
    };
    // Generate recommendations
    if (verification.fileSize === 0) {
      report.summary.recommendations.push('Backup file is empty - recreation recommended');
    } else if (verification.fileSize < 1024) {
      report.summary.recommendations.push('Backup file is unusually small - verify completeness');
    }
    if (!verification.isValidGzip) {
      report.summary.recommendations.push('File is corrupted - recreation required');
    }
    if (!verification.canExtract) {
      report.summary.recommendations.push('Backup cannot be restored - recreation recommended');
    }
    if (verification.estimatedRecords === 0) {
      report.summary.recommendations.push('No data found in backup - verify database content');
    }
    return report;
  } catch (error) {
    return {
      fileName: path.basename(backupPath),
      filePath: backupPath,
      error: error.message,
      summary: {
        status: 'ERROR',
        issues: [error.message]
      },
      generatedAt: new Date()
    };
  }
};
/**
 * Format bytes to human readable format
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
/**
 * Batch verify multiple backups
 */
const batchVerifyBackups = async (backupPaths) => {
  const results = [];
  let healthyCount = 0;
  let corruptedCount = 0;
  for (let i = 0; i < backupPaths.length; i++) {
    const backupPath = backupPaths[i];
    try {
      const report = await generateBackupReport(backupPath);
      results.push(report);
      if (report.summary.status === 'HEALTHY') {
        healthyCount++;
      } else {
        corruptedCount++;
      }
    } catch (error) {
      results.push({
        fileName: path.basename(backupPath),
        filePath: backupPath,
        error: error.message,
        summary: { status: 'ERROR' }
      });
      corruptedCount++;
    }
  }
  return {
    totalBackups: backupPaths.length,
    healthyBackups: healthyCount,
    corruptedBackups: corruptedCount,
    results,
    completedAt: new Date()
  };
};
module.exports = {
  verifyBackupIntegrity,
  compareBackups,
  generateBackupReport,
  batchVerifyBackups,
  formatBytes
};