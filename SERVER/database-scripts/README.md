# Database Scripts

This directory contains all database-related maintenance scripts.

## Structure

### `/fixes`
Scripts for fixing database issues and inconsistencies:
- `addMissingChartOfAccounts.js` - Adds missing chart of accounts entries
- `fixDatabaseIndex.js` - Fixes database indexing issues
- `fixMOOE.js` - Fixes MOOE (Maintenance and Other Operating Expenses) data issues
- `fix_all_indexes.js` - Comprehensive index fixing script
- `fix_user_id_mismatch.js` - Fixes user ID mismatches in the database
- `revert_user_id_fix.js` - Reverts user ID fixes if needed

### `/seeds`
Scripts for seeding the database with initial data:
- `seedRegions.js` - Seeds regional data
- `demo-auto-create.js` - Creates demo data automatically

### `/utilities`
General database utility scripts:
- `checkAllCategories.js` - Checks all categories for data consistency
- `check_and_fix_indexes.js` - Checks and fixes database indexes
- `update-due-date.js` - Updates due dates in the system

## Usage
Run these scripts from the SERVER root directory:
```bash
node database-scripts/fixes/scriptname.js
node database-scripts/seeds/scriptname.js
node database-scripts/utilities/scriptname.js
```

⚠️ **Warning**: Always backup your database before running fix scripts!
