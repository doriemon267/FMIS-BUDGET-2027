# Backup Directory Configuration Guide

## Overview
The FMIS Budget system now supports flexible backup directory configuration through environment variables, making it easily adaptable for different deployment environments.

## Environment Variable Configuration

### BACKUP_STORAGE_PATH
Configure where database backups will be stored by setting the `BACKUP_STORAGE_PATH` environment variable in your `.env` file.

## Configuration Examples

### Development Environment
```bash
# Relative path - will be resolved relative to the SERVER directory
BACKUP_STORAGE_PATH=./backups
```

### Linux Production Server
```bash
# Absolute path for Linux/Unix systems
BACKUP_STORAGE_PATH=/var/backups/fmis-budget
```

### Windows Production Server
```bash
# Absolute path for Windows systems
BACKUP_STORAGE_PATH=C:\Backups\FMIS-Budget
```

### Docker Container with Volume Mount
```bash
# Path to mounted volume
BACKUP_STORAGE_PATH=/mnt/backup-volume/fmis
```

### Network Storage (SMB/NFS)
```bash
# Mounted network drive
BACKUP_STORAGE_PATH=/mnt/network-storage/fmis-backups
```

## Path Resolution Rules

1. **Relative Paths**: Paths starting with `./` or `../` are resolved relative to the SERVER directory
2. **Absolute Paths**: Paths starting with `/` (Linux/Mac) or `C:\` (Windows) are used as-is
3. **Default Fallback**: If `BACKUP_STORAGE_PATH` is not set, defaults to `./backups`

## Directory Creation

The system automatically creates the backup directory if it doesn't exist, including any parent directories in the path.

## Testing Configuration

You can test your backup path configuration by running:

```bash
cd SERVER
node test-backup-paths.js
```

This will show:
- Current environment variable setting
- Resolved absolute path
- Whether the directory exists
- Example configurations for different environments

## Security Considerations

### File Permissions
Ensure the application has appropriate read/write permissions to the backup directory:

```bash
# Linux/Mac example
sudo chown -R app-user:app-group /var/backups/fmis-budget
sudo chmod -R 755 /var/backups/fmis-budget
```

### Network Storage
When using network storage, ensure:
- Stable network connection
- Appropriate authentication/mounting
- Sufficient storage space
- Regular connectivity monitoring

## Migration from Hardcoded Paths

If you're migrating from a previous version with hardcoded backup paths:

1. Set `BACKUP_STORAGE_PATH` in your `.env` file
2. Copy existing backups to the new location if needed
3. Update any backup monitoring/cleanup scripts to use the new path
4. Test backup creation and restoration

## Monitoring and Maintenance

### Storage Space
Monitor backup directory disk usage:
```bash
df -h /var/backups/fmis-budget
```

### Backup Validation
Regular backup integrity checks are recommended:
```bash
# The system includes built-in backup verification
# Check backup status through the admin interface
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```
   Error: EACCES: permission denied, mkdir '/var/backups/fmis-budget'
   ```
   **Solution**: Ensure the application user has write permissions to the parent directory.

2. **Directory Not Found**
   ```
   Error: ENOENT: no such file or directory
   ```
   **Solution**: Ensure parent directories exist or the path is correctly specified.

3. **Network Storage Issues**
   ```
   Error: EIO: i/o error, write
   ```
   **Solution**: Check network connectivity and mount status.

### Validation Commands

```bash
# Test directory creation
node -e "require('./utils/backupPaths').ensureBackupDirectory()"

# Check current configuration
node -e "console.log(require('./utils/backupPaths').getBackupDirectoryInfo())"
```

## Best Practices

1. **Use absolute paths in production** for clarity and reliability
2. **Set up backup directory monitoring** to track storage usage
3. **Test backup and restore procedures** after changing paths
4. **Document your backup strategy** including retention policies
5. **Regular integrity checks** of stored backups
6. **Implement offsite backup** for disaster recovery

## Environment-Specific Recommendations

### Development
- Use relative paths (`./backups`)
- Small retention period
- Manual cleanup acceptable

### Staging
- Use absolute paths
- Mirror production configuration
- Regular automated testing

### Production
- Use absolute paths
- Implement monitoring
- Automated cleanup policies
- Offsite backup strategy
- Security hardening
