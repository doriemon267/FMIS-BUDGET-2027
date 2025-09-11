require('dotenv').config();
const mongoose = require('mongoose');
require('./models/Department');
require('./models/Region');
const DepartmentDivisionMapping = require('./models/OrganizationStructure');
async function checkMARIIS() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    const mariisMappings = await DepartmentDivisionMapping.find({})
      .populate('departmentId regionId')
      .sort({ 'regionId.Region': 1, departmentName: 1 });
    const mariisData = mariisMappings.filter(m =>
      m.regionId && m.regionId.Region === 'MARIIS'
    );
    if (mariisData.length === 0) {
      return;
    }
    mariisData.forEach(mapping => {
      mapping.divisions.forEach(div => {
        if (div.sections && div.sections.length > 0) {
          div.sections.forEach(sec => );
        }
      });
      });
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}
checkMARIIS();