/**
 * Example Sequelize model for a MSSQL table.
 * Replace fields and tableName with the table your environment uses.
 */
const { sequelize, DataTypes, enableMssql } = require('../index');

if (!enableMssql) {
  // Export a placeholder to avoid requiring issues in code that references the model
  module.exports = null;
} else {
  const ExternalProposal = sequelize.define('ExternalProposal', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    externalId: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
    region: { type: DataTypes.STRING, allowNull: true },
    amount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: process.env.MSSQL_EXTERNAL_TABLE_NAME || 'ExternalProposals',
    timestamps: false
  });

  module.exports = ExternalProposal;
}
