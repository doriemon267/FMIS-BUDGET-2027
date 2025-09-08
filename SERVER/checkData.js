require('dotenv').config();
const mongoose = require('mongoose');
require('./config/mongo_db')();

async function checkData() {
  try {
    const Region = require('./models/Region');
    const DepartmentDivisionMapping = require('./models/OrganizationStructure');

    const regions = await Region.find({});
    console.log('Regions:');
    regions.forEach(r => console.log(`  ${r._id}: ${r.Region}`));

    const mappings = await DepartmentDivisionMapping.find({}).populate('regionId', 'Region');
    console.log('\nMappings:');
    mappings.forEach(m => {
      console.log(`  Department: ${m.departmentName}`);
      console.log(`  Region: ${m.regionId?.Region} (${m.regionId?._id})`);
      console.log(`  Divisions: ${m.divisions?.length || 0}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();
