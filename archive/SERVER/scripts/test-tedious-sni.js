const { Connection } = require('tedious');
// Load .env and optionally suppress Node deprecation warnings like DEP0123
require('dotenv').config();
const SUPPRESS_NODE_DEPRECATION_WARNINGS = (process.env.SUPPRESS_NODE_DEPRECATION_WARNINGS || '').split(',').map(s => s && s.trim()).filter(Boolean);
if (SUPPRESS_NODE_DEPRECATION_WARNINGS.length > 0) {
  const origEmitWarning = process.emitWarning;
  process.emitWarning = function(warning, options) {
    try {
      let code = undefined;
      if (options && typeof options === 'string') {
        code = options;
      } else if (options && typeof options === 'object') {
        code = options.code || options.name;
      } else if (warning && typeof warning === 'object') {
        code = warning.code || warning.name;
      }
      if (code && SUPPRESS_NODE_DEPRECATION_WARNINGS.includes(code)) {
        return;
      }
    } catch (e) {/* ignore */}
    return origEmitWarning.apply(process, arguments);
  };
}
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
