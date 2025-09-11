const path = require('path');
const fs = require('fs');
/**
 * Get the backup storage directory path from environment variable or default
 * @returns {string} The absolute path to the backup directory
 */
const getBackupStoragePath = () => {
  // Get backup path from environment variable, default to './backups' relative to SERVER directory
  const backupPath = process.env.BACKUP_STORAGE_PATH || './backups';
  // If it's a relative path, make it relative to the SERVER directory
  if (!path.isAbsolute(backupPath)) {
    return path.resolve(__dirname, '..', backupPath);
  }
  // If it's already an absolute path, use it as-is
  return backupPath;
};
/**
 * Ensure the backup directory exists
 * @param {string} customPath - Optional custom backup path
 * @returns {string} The backup directory path
 */
const ensureBackupDirectory = (customPath = null) => {
  const backupDir = customPath || getBackupStoragePath();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    }
  return backupDir;
};
/**
 * Get the full path for a backup file
 * @param {string} filename - The backup filename
 * @returns {string} The full path to the backup file
 */
const getBackupFilePath = (filename) => {
  const backupDir = ensureBackupDirectory();
  return path.join(backupDir, filename);
};
/**
 * Get backup directory info for logging/debugging
 * @returns {object} Information about the backup directory configuration
 */
const getBackupDirectoryInfo = () => {
  const envPath = process.env.BACKUP_STORAGE_PATH;
  const resolvedPath = getBackupStoragePath();
  return {
    environmentVariable: envPath || 'Not set (using default)',
    resolvedPath: resolvedPath,
    isAbsolute: path.isAbsolute(envPath || './backups'),
    exists: fs.existsSync(resolvedPath)
  };
};
module.exports = {
  getBackupStoragePath,
  ensureBackupDirectory,
  getBackupFilePath,
  getBackupDirectoryInfo
};