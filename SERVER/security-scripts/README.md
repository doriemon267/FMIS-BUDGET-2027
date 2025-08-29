# Security Scripts

This directory contains all security-related scripts and tools.

## Scripts

- `analyze_rbac_opportunities.js` - Analyzes the codebase for RBAC (Role-Based Access Control) implementation opportunities
- `mass_auth_fix.js` - Bulk authentication fixes across the system
- `secure_remaining_routes.js` - Secures routes that haven't been protected yet
- `security-implementation.ps1` - PowerShell script for security implementation
- `security-implementation.sh` - Bash script for security implementation

## Usage
```bash
# For JavaScript scripts
node security-scripts/scriptname.js

# For PowerShell (Windows)
.\security-scripts\security-implementation.ps1

# For Bash (Linux/macOS)
./security-scripts/security-implementation.sh
```

## Important Notes
- These scripts modify security settings and access controls
- Always test in a development environment first
- Review the scripts before running in production
- Backup your system before making security changes
