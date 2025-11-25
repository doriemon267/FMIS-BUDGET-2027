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
MSSQL_DB=your_database
MSSQL_USER=your_user
MSSQL_PASSWORD=your_password
MSSQL_ENCRYPT=false
MSSQL_EXTERNAL_TABLE_NAME=ExternalProposals
```

3) Model & Controller

- The example MSSQL model `ExternalProposal` is in `SERVER/mssql/models/ExternalProposal.js`.
- The controller is `SERVER/controllers/mssqlController.js`. It exports CRUD functions and an example `listMerged` method that attempts to merge MSSQL rows with `NewProposalWorkflow` documents (if present) from MongoDB.

4) Routes

- The routes are exposed under `/api/mssql` (e.g., GET `/api/mssql`, GET `/api/mssql/merged`). These are protected by the existing `checkToken` middleware.

5) Notes

- The MSSQL setup is optional and the server will continue to work if `ENABLE_MSSQL` is false or MSSQL connection fails.
- You can change the table name by updating `MSSQL_EXTERNAL_TABLE_NAME` env var or updating the model file.
- To combine MSSQL data with your MongoDB models, use the `listMerged` example or call `ExternalProposal` from other controllers.

6) Extending

- If you have a specific table structure, update `SERVER/mssql/models/ExternalProposal.js` to reflect actual column names and types.
- Add indexes or constraints in MSSQL directly as needed.
