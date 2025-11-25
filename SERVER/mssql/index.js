/**
 * MSSQL (Sequelize) initialization
 * - Uses environment variables to configure connection
 * - Exposes sequelize instance and DataTypes
 * - Safe to require even if MSSQL not configured (fail-open)
 */
const { Sequelize, DataTypes } = require('sequelize');

const enableMssql = (process.env.ENABLE_MSSQL === 'true') || !!process.env.MSSQL_HOST;

let sequelize = null;
if (enableMssql) {
  const dialectOptions = { options: {} };
  // If using Azure or encrypted connections
  if (process.env.MSSQL_ENCRYPT === 'true' || process.env.MSSQL_ENCRYPT === '1' || process.env.MSSQL_ENCRYPT === 'true') {
    dialectOptions.options.encrypt = true;
  }

  // Support named instance via MSSQL_INSTANCE or host that contains "\\" (e.g. host\\INSTANCE)
  let hostVal = process.env.MSSQL_HOST || 'localhost';
  let portVal = process.env.MSSQL_PORT ? Number(process.env.MSSQL_PORT) : 1433;
  const instanceFromEnv = process.env.MSSQL_INSTANCE || '';
  let instanceName = instanceFromEnv && String(instanceFromEnv).trim() || '';

  // If host includes an instance (like "172.16.4.10\\SQLEXPRESS"), split and set instanceName
  if (hostVal && hostVal.includes('\\')) {
    const [hostPart, inst] = hostVal.split('\\');
    hostVal = hostPart;
    // Inst may contain a port if provided like 'SQLEXPRESS:1433'
    let instPart = inst;
    let portFromInst = null;
    if (instPart && instPart.includes(':')) {
      const [i, p] = instPart.split(':');
      instPart = i;
      portFromInst = Number(p) || null;
    }
    instanceName = instanceName || instPart;
    // Use instance port from host if provided; otherwise allow MSSQL_PORT from env
    if (portFromInst) portVal = portFromInst;
    // If we have instanceName and no explicit MSSQL_PORT from env, unset port so SQL Browser is used
    if (instanceName && !process.env.MSSQL_PORT) portVal = undefined;
  }

  // If MSSQL_INSTANCE is set explicitly, use it
  if (instanceName) {
    dialectOptions.options.instanceName = instanceName;
  }
  // If an explicit port is set, allow it to connect directly
  const portCfg = (typeof portVal === 'number' && !Number.isNaN(portVal)) ? { port: portVal } : {};

  sequelize = new Sequelize(process.env.MSSQL_DB || process.env.MSSQL_DATABASE || '', process.env.MSSQL_USER || process.env.MSSQL_USERNAME || '', process.env.MSSQL_PASSWORD || '', {
    host: hostVal,
    ...portCfg,
    dialect: 'mssql',
    dialectOptions,
    logging: process.env.DEBUG_MODE === 'true' ? console.debug : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: false,
      freezeTableName: true
    }
  });

  const net = require('net');
  // Only set serverName for TLS SNI when host is a DNS name (not IP) or when an explicit override is set
  const sniHostname = (process.env.MSSQL_SNI_HOST && process.env.MSSQL_SNI_HOST.trim()) || null;
  if (sniHostname) {
    dialectOptions.options.serverName = sniHostname; // `tedious` expects `serverName` CamelCase
  } else if (!net.isIP(hostVal)) {
    // hostVal is not an IP (i.e., looks like DNS name), safe to set serverName
    dialectOptions.options.serverName = hostVal;
  }

  (async () => {
    try {
            if (net.isIP(hostVal) && !dialectOptions.options.serverName) {
             if (!process.env.MSSQL_SUPPRESS_SNI_WARNING || process.env.MSSQL_SUPPRESS_SNI_WARNING !== 'true') {
               console.warn('[MSSQL] Warning: MSSQL_HOST is an IP address and no MSSQL_SNI_HOST is provided; TLS SNI may use IP and cause DEP0123 deprecation. Consider set MSSQL_SNI_HOST to a DNS name to prevent this.');
             }
           }
      await sequelize.authenticate();
      console.log('[MSSQL] Connected to MSSQL', { host: hostVal, port: portVal, instance: instanceName, serverName: dialectOptions.options.serverName });
    } catch (err) {
      console.warn('[MSSQL] Connection failed:', err.message);
    }
  })();
}

// Validate SNI and TLS configuration for stricter deployments
const validateSniConfig = () => {
  const net = require('net');
  const encryptEnabled = (process.env.MSSQL_ENCRYPT === 'true' || process.env.MSSQL_ENCRYPT === '1');
  const hostIsIp = net.isIP(hostVal);
  const sniProvided = !!(process.env.MSSQL_SNI_HOST && process.env.MSSQL_SNI_HOST.trim()) || !!dialectOptions.options.serverName;
  if (encryptEnabled && hostIsIp && !sniProvided) {
    const strictFail = process.env.MSSQL_STRICT_SNI_FAIL === 'true';
    const message = `[MSSQL] TLS SNI recommended: MSSQL host is an IP (${hostVal}) and encryption is enabled; specify MSSQL_SNI_HOST to avoid TLS SNI fallback to IP and Node deprecation warning DEP0123.`;
    if (strictFail) {
      throw new Error(message + ' (MSSQL_STRICT_SNI_FAIL=true)');
    } else {
      console.warn(message + ' (set MSSQL_STRICT_SNI_FAIL=true to enforce failure)');
    }
  }
};

// Expose validation helper for use by health checks / scripts
module.exports = { sequelize, DataTypes, enableMssql, validateSniConfig };

module.exports = { sequelize, DataTypes, enableMssql };
