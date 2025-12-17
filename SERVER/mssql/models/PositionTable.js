const { sequelize, DataTypes, enableMssql } = require('../index');

if (!enableMssql) {
  module.exports = null;
} else {
  const PositionTable = sequelize.define('Positions', {

    ItemNumber: { type: DataTypes.STRING, allowNull: true },
    PositionTitle: { type: DataTypes.STRING, allowNull: true },
    Status: { type: DataTypes.STRING, allowNull: true },
    SG: { type: DataTypes.STRING, allowNull: true },
    SG_Step: { type: DataTypes.STRING, allowNull: true },
    JG: { type: DataTypes.STRING, allowNull: true },
    JG_Step: { type: DataTypes.STRING, allowNull: true },
    MonthlyRate: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    DailyRate: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    Source: { type: DataTypes.STRING, allowNull: true },
    EncodedBy: { type: DataTypes.STRING, allowNull: true },
    EncodedDate: { type: DataTypes.DATE, allowNull: true },
    ModifiedBy: { type: DataTypes.STRING, allowNull: true },
    ModifiedDate: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'Positions',
    timestamps: false
  });

  module.exports = PositionTable;
}
