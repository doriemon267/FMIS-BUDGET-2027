# MSSQL (Sequelize) Integration Guide

This guide explains how to enable and use the MSSQL integration for this server. The implementation uses Sequelize and the `tedious` driver.

1) Install packages

From the `SERVER` directory, run:
```
npm install --save sequelize tedious
```

2) Environment variables

Add the following to your `SERVER/.env`:
```
ENABLE_MSSQL=true
MSSQL_HOST=your-mssql-host
MSSQL_PORT=1433
Named instance example:
```
MSSQL_HOST=172.16.4.10
MSSQL_INSTANCE=SQLEXPRESS
# If instance uses dynamic port (SQL Browser), omit MSSQL_PORT
MSSQL_PORT=1433   # optional; omit if using named instance with SQL Browser
```

If you set `MSSQL_HOST` using search pattern like `172.16.4.10\\SQLEXPRESS`, the init script will parse and use `172.16.4.10` as host and `SQLEXPRESS` as `instanceName`. However preferred approach is to set `MSSQL_HOST` and `MSSQL_INSTANCE` separately (see above) or set an explicit `MSSQL_PORT`.
MSSQL_DB=your_database
MSSQL_USER=your_user
MSSQL_PASSWORD=your_password
MSSQL_ENCRYPT=false
MSSQL_EXTERNAL_TABLE_NAME=ExternalProposals
```

3) Model & Controller

- The example MSSQL model `ExternalProposal` is in `SERVER/mssql/models/ExternalProposal.js`.
- The controller is `SERVER/controllers/mssqlController.js`. It exports CRUD functions and an example `listMerged` method that attempts to merge MSSQL rows with `NewProposalWorkflow` documents (if present) from MongoDB.
 - A sample model for the `SalaryTable` (as requested) is in `SERVER/mssql/models/SalaryTable.js` and is exposed via a dedicated controller and router `SERVER/controllers/mssqlSalaryTableController.js` and `SERVER/routers/mssqlSalaryTableRoutes.js`.
	 - The new endpoints are registered at `/api/mssql/salarytable` and support:
		 - GET `/api/mssql/salarytable?q=...&limit=...&offset=...` — list rows, with `q` search and optional filters `SG`, `JG`, `StatusOfAppointment`.
		 - GET `/api/mssql/salarytable/:id` — fetch a single row by Id.
		 - GET `/api/mssql/salarytable/search?q=...` — lightweight search endpoint by Id or Source field.

4) Routes

- The routes are exposed under `/api/mssql` (e.g., GET `/api/mssql`, GET `/api/mssql/merged`). These are protected by the existing `checkToken` middleware.

If you'd like this `salarytable` route to be public for test or UI consumption without JWT, you can edit `SERVER/routers/mssqlSalaryTableRoutes.js` to remove or conditionally apply `checkToken` (useful for local testing only).

5) Notes

- The MSSQL setup is optional and the server will continue to work if `ENABLE_MSSQL` is false or MSSQL connection fails.
- You can change the table name by updating `MSSQL_EXTERNAL_TABLE_NAME` env var or updating the model file.
- To combine MSSQL data with your MongoDB models, use the `listMerged` example or call `ExternalProposal` from other controllers.

Troubleshooting (e.g., ENOTFOUND when host contains a backslash):
- If you previously set `MSSQL_HOST=172.16.4.10\\SQLEXPRESS` or `MSSQL_HOST=172.16.4.10\\SQLEXPRESS:1433`, the environment variable should instead be split into `MSSQL_HOST` and `MSSQL_INSTANCE` (or just `MSSQL_HOST` and `MSSQL_PORT`).

Correct forms:
```
MSSQL_HOST=172.16.4.10
MSSQL_INSTANCE=SQLEXPRESS
# Optionally set port if you know it
MSSQL_PORT=1433
```

or explicitly:
```
MSSQL_HOST=172.16.4.10
MSSQL_PORT=1433
```

Quick connectivity checks (PowerShell):
``powershell
Test-NetConnection -ComputerName 172.16.4.10 -Port 1433
# or if pinging host name
Test-NetConnection -ComputerName HumanResourceDb -Port 1433
```
If using a named instance without a fixed port, ensure `SQL Server Browser` service is running and that UDP port `1434` is reachable so the named instance can be resolved. For Azure, ensure `MSSQL_ENCRYPT=true` and use `server.database.windows.net` host.

TLS SNI notes:
- If your SMTP or MSSQL host is an IP address (e.g., `172.16.4.10`), Node will set the TLS Server Name to that IP, which raises the deprecation warning `DEP0123`. To avoid this:
	- Use a DNS hostname (preferred) for `MSSQL_HOST` / `MAIL_HOST` (e.g., `hrdb.example.local`, `smtp.gmail.com`).
	- Or set an explicit servername override for TLS using `MSSQL_SNI_HOST` for MSSQL and `MAIL_SNI_HOST` for email:
		```dotenv
		MSSQL_SNI_HOST=hrdb.example.local
		MAIL_SNI_HOST=smtp.example.com
		```
	- This ensures the TLS SNI field is a valid hostname (not IP), removing the `DEP0123` warning.

6) Extending

- If you have a specific table structure, update `SERVER/mssql/models/ExternalProposal.js` to reflect actual column names and types.
- Add indexes or constraints in MSSQL directly as needed.
