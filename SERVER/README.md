# Server Runtime (FMIS Budget)

This folder contains the backend server of the FMIS Budget system.

## Debug Logging

To reduce console noise in production, most verbose debug logs (JWT payload structure, role checks, workflow debug messages) are now conditional and only printed when the `DEBUG_LOGS=true` environment variable is set.

- To enable detailed debug logs while developing or debugging issues, set `DEBUG_LOGS=true` in your environment or `.env` file. Example:

```powershell
$env:DEBUG_LOGS = 'true'
node SERVER/index.js
```

- If `DEBUG_LOGS` is not set, only essential startup, warning, and error logs are printed.

## Starting the server

To run the server locally, invoke:

```powershell
node SERVER/index.js
```

You may prefer to use `nodemon` for hot-reloading during development:

```powershell
nodemon SERVER/index.js
```


## Notes

- Avoid logging full tokens or Authorization header contents; sensitive information should never be printed in logs.
- Long-lived logs and persistent log files can be rotated or cleared manually as needed.
