const { sequelize, DataTypes, enableMssql } = require("../index");

if (!enableMssql) {
  module.exports = null;
} else {
  const SalaryTable = sequelize.define(
    "SalaryTable",
    {
      Id: { type: DataTypes.INTEGER, primaryKey: true },
      StatusOfAppointment: { type: DataTypes.STRING, allowNull: true },
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
      ModifiedDate: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: process.env.MSSQL_SALARYTABLE_TABLE_NAME || "SalaryTable",
      timestamps: false,
    },
  );

  module.exports = SalaryTable;
}
