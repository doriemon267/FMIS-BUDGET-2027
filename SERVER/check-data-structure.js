const mongoose = require('mongoose');
const PersonnelServices = require('./models/personnelServices');

async function checkFields() {
  try {
    await mongoose.connect(process.env.MONGO_URL || 'mongodb+srv://fmis:fmis123@cluster0.hha2kib.mongodb.net/fmis-budget');
    
    console.log('🔍 Checking Personnel Data Structure...\n');
    
    const sample = await PersonnelServices.findOne({}).lean();
    if (!sample) {
      console.log('❌ No personnel records found');
      return;
    }
    
    console.log('📋 Sample Personnel Record:');
    console.log('Available fields:', Object.keys(sample).slice(0, 20)); // Show first 20 fields
    console.log('\n🔍 Submission Workflow Fields:');
    console.log('- Has originalLevel:', sample?.originalLevel !== undefined ? '✅' : '❌');
    console.log('- Has status:', sample?.status !== undefined ? '✅' : '❌');
    console.log('- Has region:', sample?.region !== undefined ? '✅' : '❌');
    console.log('- Has department:', sample?.department !== undefined ? '✅' : '❌');
    console.log('- Has division:', sample?.division !== undefined ? '✅' : '❌');
    
    console.log('\n📊 Sample values:');
    console.log('- originalLevel:', sample?.originalLevel || 'NOT SET');
    console.log('- status:', sample?.status || 'NOT SET');
    console.log('- region:', sample?.region || 'NOT SET');
    console.log('- department:', sample?.department || 'NOT SET');
    console.log('- division:', sample?.division || 'NOT SET');
    console.log('- employeeFullName:', sample?.employeeFullName || 'NOT SET');
    
    const totalCount = await PersonnelServices.countDocuments({});
    console.log('\n📈 Data Statistics:');
    console.log('Total personnel records:', totalCount);
    
    const withOriginalLevel = await PersonnelServices.countDocuments({ originalLevel: { $exists: true, $ne: null, $ne: '' } });
    const withStatus = await PersonnelServices.countDocuments({ status: { $exists: true, $ne: null, $ne: '' } });
    const withRegion = await PersonnelServices.countDocuments({ region: { $exists: true, $ne: null, $ne: '' } });
    const withDepartment = await PersonnelServices.countDocuments({ department: { $exists: true, $ne: null, $ne: '' } });
    const withDivision = await PersonnelServices.countDocuments({ division: { $exists: true, $ne: null, $ne: '' } });
    
    console.log('Records with originalLevel:', withOriginalLevel, `(${((withOriginalLevel/totalCount)*100).toFixed(1)}%)`);
    console.log('Records with status:', withStatus, `(${((withStatus/totalCount)*100).toFixed(1)}%)`);
    console.log('Records with region:', withRegion, `(${((withRegion/totalCount)*100).toFixed(1)}%)`);
    console.log('Records with department:', withDepartment, `(${((withDepartment/totalCount)*100).toFixed(1)}%)`);
    console.log('Records with division:', withDivision, `(${((withDivision/totalCount)*100).toFixed(1)}%)`);
    
    // Check specific regional data
    console.log('\n🏢 Regional Distribution:');
    const regionStats = await PersonnelServices.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    regionStats.forEach(stat => {
      console.log(`- ${stat._id || 'NO REGION'}: ${stat.count} records`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Analysis complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFields();
