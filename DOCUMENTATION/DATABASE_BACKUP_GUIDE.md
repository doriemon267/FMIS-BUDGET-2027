# Database Backup System Guide

## Overview
The FMIS Budget System now includes a comprehensive database backup solution that provides both manual and scheduled backup capabilities with hot backup support and timeline management.

## Features

### 🔄 Backup Types
1. **Manual Backups** - Create backups on-demand
2. **Scheduled Backups** - Automated backups based on cron schedules
3. **Hot Backups** - Database remains operational during backup
4. **Pre-restore Backups** - Automatic backup before restore operations

### 📅 Scheduling Options
- **Daily backups** at specified times (2:00 AM, 6:00 PM)
- **Weekly backups** (Sundays, Fridays)
- **Monthly backups** (1st day of month)
- **Custom cron expressions** for advanced scheduling

### 💾 Storage Features
- **Compression** - All backups are compressed using gzip
- **Retention Policy** - Automatic cleanup based on retention days
- **Storage Statistics** - Track backup sizes and disk usage
- **File Integrity** - Verify backup files exist and are valid

## Access Levels

### Super Admin & Budget Admin
- Full access to all backup operations
- Create, schedule, delete, and restore backups
- Access to advanced backup settings
- View backup history and statistics

### Other Roles
- Limited access through Settings page
- Can view backup status and recent backups
- Cannot perform restore operations

## How to Access

### 1. Main Database Backup Page
Navigate to: `/database-backup`
- Available through Settings menu → Database Backup

### 2. Settings Integration
Navigate to: `/settings`
- Click "Backup Settings" card for quick access

## Key Features Explained

### Manual Backup Creation
1. Click "Create Manual Backup"
2. Add optional description
3. Backup starts immediately
4. Monitor progress in real-time
5. Download completed backups

### Scheduled Backup Setup
1. Open "Schedule Backup" dialog
2. Choose from predefined schedules or create custom
3. Enable/disable as needed
4. System automatically runs backups per schedule

### Backup Timeline & History
- **Real-time Status** - See active backup operations
- **History View** - Browse all past backups
- **Status Tracking** - Monitor completed, failed, in-progress backups
- **File Management** - Download or delete backups

### Restore Operations
⚠️ **Important**: Restore operations replace all current data
1. Select backup from history
2. Confirm restore operation  
3. System creates pre-restore backup automatically
4. Database is restored from selected backup

## Backup File Details

### File Format
- **Extension**: `.gz` (gzip compressed)
- **Naming**: `backup_YYYY-MM-DDTHH-mm-ss.gz`
- **Location**: `SERVER/backups/` directory

### Compression
- **Algorithm**: gzip compression
- **Benefits**: Reduced storage space (~70-80% compression ratio)
- **Speed**: Optimized for MongoDB data structures

## Automation & Maintenance

### Automatic Cleanup
- **Daily Cleanup**: Runs at 3:00 AM
- **Retention Policy**: Configurable (default 30 days)
- **Orphaned Files**: Automatically removes files without database records
- **Health Checks**: Weekly system health reports

### Monitoring
- **Active Backups**: Real-time progress tracking
- **Storage Stats**: Total backups, sizes, disk usage
- **Health Reports**: System status and issues detection
- **Email Alerts**: (Future feature) Notifications for failures

## API Endpoints

### Backup Operations
```
GET    /api/database-backup/backup/history          # Get backup history
POST   /api/database-backup/backup/create           # Create manual backup
POST   /api/database-backup/backup/schedule         # Schedule backup
GET    /api/database-backup/backup/settings         # Get backup settings
POST   /api/database-backup/backup/restore/:id      # Restore from backup
GET    /api/database-backup/backup/download/:id     # Download backup
DELETE /api/database-backup/backup/:id              # Delete backup
```

### Monitoring & Maintenance
```
GET    /api/database-backup/backup/status           # Get active backup status
POST   /api/database-backup/backup/cleanup          # Manual cleanup
GET    /api/database-backup/backup/storage-stats    # Storage statistics
```

## Best Practices

### 1. Backup Scheduling
- **Production**: Daily backups at off-peak hours (2:00 AM)
- **Development**: Weekly backups sufficient
- **Before Updates**: Always create manual backup before system updates

### 2. Storage Management
- **Retention**: Keep 30 days for production, 7 days for development
- **Monitoring**: Check storage usage monthly
- **Cleanup**: Run manual cleanup before major operations

### 3. Security
- **Access Control**: Limit restore access to Super Admin only
- **File Security**: Backup files contain sensitive data
- **Network**: Use secure connections for backup downloads

### 4. Testing
- **Regular Tests**: Test restore process monthly
- **Verify Integrity**: Check backup file sizes and completion status
- **Recovery Plan**: Document restore procedures

## Troubleshooting

### Common Issues

**Backup Stuck in Progress**
- Check MongoDB connection
- Verify disk space availability
- Restart backup process if needed

**Missing Backup Files**
- Run storage health check
- Check file permissions
- Verify backup directory exists

**Restore Failures**
- Ensure MongoDB is accessible
- Check backup file integrity
- Verify sufficient disk space

### Error Messages

| Error | Cause | Solution |
|-------|--------|----------|
| "Failed to create backup" | MongoDB connection issue | Check database connectivity |
| "Backup file not found" | File system issue | Verify file exists and permissions |
| "Invalid cron schedule" | Wrong schedule format | Use valid cron expression |
| "Insufficient disk space" | Storage full | Free up disk space |

## Support & Maintenance

### Regular Tasks
- [ ] Weekly: Review backup logs
- [ ] Monthly: Test restore process
- [ ] Quarterly: Update retention policies
- [ ] Annually: Review and update procedures

### Contact Information
For technical support with backup operations, contact your system administrator or refer to the application logs for detailed error information.

---

*Last Updated: December 2024*
*Version: 1.0*