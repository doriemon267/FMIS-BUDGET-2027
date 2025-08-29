# Test Scripts

This directory contains all testing and debugging scripts organized by category.

## Structure

### `/connection`
Database and server connection tests:
- `testConnection.js` - Tests MongoDB connection
- `testDB.js` - General database testing

### `/features`
Feature-specific test scripts:
- `testAllCategoriesFinal.js` - Tests all category functionalities
- `testCapitalOutlayAPI.js` - Tests Capital Outlay API endpoints
- `testMOOE.js` - Tests MOOE (Maintenance and Other Operating Expenses) functionality
- `testMOOEData.js` - Tests MOOE data operations

### `/backup-tests`
Backup system testing scripts:
- `testBackupSystem.js` - Tests the backup system functionality
- `test-backup-paths.js` - Tests backup path configurations
- `test-custom-backup-path.js` - Tests custom backup path settings

### `/auth-tests`
Authentication and authorization testing:
- `test_endpoints_with_auth.js` - Tests API endpoints with authentication
- `generate_test_token.js` - Generates test tokens for authentication testing
- `verify_test_token.js` - Verifies test token validity

### `/debug`
Debugging and troubleshooting tools:
- `debug_env.js` - Environment debugging script
- `test_export_debug.js` - Export functionality debugging
- `jwt_debug.log` - JWT debugging log file

## Usage
```bash
# Run from SERVER root directory
node test-scripts/connection/testConnection.js
node test-scripts/features/testMOOE.js
node test-scripts/auth-tests/generate_test_token.js
# etc.
```

## Notes
- These scripts are for development and testing purposes only
- Do not run in production environment
- Some scripts may require specific environment variables or configurations
