require('dotenv').config();
const mongoose = require('mongoose');
require('./models/Department');
require('./models/Region');
const DepartmentDivisionMapping = require('./models/OrganizationStructure');

async function checkMARIIS() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('=== MARIIS REGION MAPPINGS ===');

    const mariisMappings = await DepartmentDivisionMapping.find({})
      .populate('departmentId regionId')
      .sort({ 'regionId.Region': 1, departmentName: 1 });

    const mariisData = mariisMappings.filter(m =>
      m.regionId && m.regionId.Region === 'MARIIS'
    );

    if (mariisData.length === 0) {
      console.log('No MARIIS data found in database!');
      return;
    }

    mariisData.forEach(mapping => {
      console.log(`Department: ${mapping.departmentName}`);
      console.log('Divisions:');
      mapping.divisions.forEach(div => {
        console.log(`  - ${div.name}`);
        if (div.sections && div.sections.length > 0) {
          console.log('    Sections:');
          div.sections.forEach(sec => console.log(`      * ${sec.name}`));
        }
      });
      console.log('');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMARIIS();
