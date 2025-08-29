# Development Tools

This directory contains development and deployment tools.

## Scripts

- `quickServer.js` - Quick server startup script for development
- `ecosystem.config.js` - PM2 ecosystem configuration for process management

## Usage

### Quick Server
```bash
# Run from SERVER root directory
node dev-tools/quickServer.js
```

### PM2 Ecosystem
```bash
# Start with PM2
pm2 start dev-tools/ecosystem.config.js

# Monitor processes
pm2 monit

# Stop all processes
pm2 stop all
```

## Notes
- `quickServer.js` is for development use only
- `ecosystem.config.js` is used for production deployment with PM2
- These tools help streamline development and deployment workflows
