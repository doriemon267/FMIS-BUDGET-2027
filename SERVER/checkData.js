require('dotenv').config();
const mongoose = require('mongoose');
require('./config/mongo_db')();
async function checkData() {
  try {
    const Region = require('./models/Region');
    const DepartmentDivisionMapping = require('./models/OrganizationStructure');
    const regions = await Region.find({});
    regions.forEach(r => );
    const mappings = await DepartmentDivisionMapping.find({}).populate('regionId', 'Region');
    mappings.forEach(m => {
      `);
      });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}
checkData();