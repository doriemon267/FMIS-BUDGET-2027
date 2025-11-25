const { Connection } = require('tedious');
require('dotenv').config();
const host = process.env.MSSQL_HOST || '172.16.4.10';
const user = process.env.MSSQL_USER || 'edra';
const password = process.env.MSSQL_PASSWORD || 'Xsm7NmDP';
const database = process.env.MSSQL_DB || 'HumanResourceDb';
const sni = process.env.MSSQL_SNI_HOST || undefined;

const config = {
  server: host,
  authentication: {
    type: 'default',
    options: {
      userName: user,
      password: password
    }
  },
  options: {
    encrypt: (process.env.MSSQL_ENCRYPT === 'true' || process.env.MSSQL_ENCRYPT === '1'),
    trustServerCertificate: true,
    database: database,
    serverName: sni
  }
};

console.log('[test-tedious-sni] Connect config:', { host, sni, database });
const connection = new Connection(config);
connection.on('connect', (err) => {
  if (err) {
    console.error('[test-tedious-sni] Connection error:', err);
    process.exit(2);
  }
  console.log('[test-tedious-sni] Connected');
  connection.close();
  process.exit(0);
});
connection.connect();
