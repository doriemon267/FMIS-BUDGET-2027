# SERVER Directory Reorganization Plan

## Current Problem
The SERVER directory has too many loose files scattered in the root directory, making it hard to maintain and navigate.

## Proposed Folder Structure

```
SERVER/
├── config/                    (existing - configuration files)
├── controllers/               (existing - route controllers)
├── middleware/                (existing - middleware functions)
├── models/                    (existing - database models)
├── routes/                    (existing - API routes)
├── utils/                     (existing - utility functions)
├── scripts/                   (existing - has some scripts)
├── tests/                     (existing - test files)
├── backups/                   (existing - backup files)
├── migrations/                (existing - database migrations)
├── docs/                      (existing - documentation)
├── node_modules/              (existing - dependencies)
│
├── database-scripts/          (NEW - database maintenance scripts)
│   ├── fixes/
│   │   ├── addMissingChartOfAccounts.js
│   │   ├── fixDatabaseIndex.js
│   │   ├── fixMOOE.js
│   │   ├── fix_all_indexes.js
│   │   ├── fix_user_id_mismatch.js
│   │   └── revert_user_id_fix.js
│   ├── seeds/
│   │   ├── seedRegions.js
│   │   └── demo-auto-create.js
│   └── utilities/
│       ├── checkAllCategories.js
│       ├── check_and_fix_indexes.js
│       └── update-due-date.js
│
├── security-scripts/          (NEW - security related scripts)
│   ├── analyze_rbac_opportunities.js
│   ├── mass_auth_fix.js
│   ├── secure_remaining_routes.js
│   ├── security-implementation.ps1
│   └── security-implementation.sh
│
├── test-scripts/              (NEW - testing and debugging scripts)
│   ├── connection/
│   │   ├── testConnection.js
│   │   └── testDB.js
│   ├── features/
│   │   ├── testAllCategoriesFinal.js
│   │   ├── testCapitalOutlayAPI.js
│   │   ├── testMOOE.js
│   │   └── testMOOEData.js
│   ├── backup-tests/
│   │   ├── testBackupSystem.js
│   │   ├── test-backup-paths.js
│   │   └── test-custom-backup-path.js
│   ├── auth-tests/
│   │   ├── test_endpoints_with_auth.js
│   │   ├── generate_test_token.js
│   │   └── verify_test_token.js
│   └── debug/
│       ├── debug_env.js
│       ├── test_export_debug.js
│       └── jwt_debug.log
│
├── backup-scripts/            (NEW - backup system scripts)
│   └── initBackupSystem.js
│
└── dev-tools/                 (NEW - development utilities)
    ├── quickServer.js
    └── ecosystem.config.js
```

## Files to Move

### Database Scripts (to database-scripts/)
- addMissingChartOfAccounts.js → database-scripts/fixes/
- fixDatabaseIndex.js → database-scripts/fixes/
- fixMOOE.js → database-scripts/fixes/
- fix_all_indexes.js → database-scripts/fixes/
- fix_user_id_mismatch.js → database-scripts/fixes/
- revert_user_id_fix.js → database-scripts/fixes/
- seedRegions.js → database-scripts/seeds/
- demo-auto-create.js → database-scripts/seeds/
- checkAllCategories.js → database-scripts/utilities/
- check_and_fix_indexes.js → database-scripts/utilities/
- update-due-date.js → database-scripts/utilities/

### Security Scripts (to security-scripts/)
- analyze_rbac_opportunities.js
- mass_auth_fix.js
- secure_remaining_routes.js
- security-implementation.ps1
- security-implementation.sh

### Test Scripts (to test-scripts/)
- testConnection.js → test-scripts/connection/
- testDB.js → test-scripts/connection/
- testAllCategoriesFinal.js → test-scripts/features/
- testCapitalOutlayAPI.js → test-scripts/features/
- testMOOE.js → test-scripts/features/
- testMOOEData.js → test-scripts/features/
- testBackupSystem.js → test-scripts/backup-tests/
- test-backup-paths.js → test-scripts/backup-tests/
- test-custom-backup-path.js → test-scripts/backup-tests/
- test_endpoints_with_auth.js → test-scripts/auth-tests/
- generate_test_token.js → test-scripts/auth-tests/
- verify_test_token.js → test-scripts/auth-tests/
- debug_env.js → test-scripts/debug/
- test_export_debug.js → test-scripts/debug/
- jwt_debug.log → test-scripts/debug/

### Backup Scripts (to backup-scripts/)
- initBackupSystem.js

### Development Tools (to dev-tools/)
- quickServer.js
- ecosystem.config.js

## Benefits of This Organization

1. **Easier Navigation** - Related files are grouped together
2. **Better Maintenance** - Easy to find specific types of scripts
3. **Cleaner Root Directory** - Only essential files remain in root
4. **Logical Grouping** - Files are organized by purpose
5. **Scalable Structure** - Easy to add new scripts in appropriate folders

## Files to Keep in Root
- index.js (main server file)
- package.json
- package-lock.json
- .env files
- README files

## Implementation Steps
1. Create new directories
2. Move files to appropriate directories
3. Update any import paths that reference moved files
4. Update documentation
5. Test to ensure everything still works
