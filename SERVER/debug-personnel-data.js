const mongoose = require('mongoose');
const PersonnelServices = require('./models/personnelServices');

// Connect to MongoDB - use your actual database server
mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkPersonnelData() {
  try {
    console.log('🔍 Checking John Rey Solivares data...');
    
    const johnReyData = await PersonnelServices.findOne({ 
      $or: [
        { employeeName: /John Rey/i },
        { 'employeeName': /Solivares/i }
      ]
    });
    
    if (johnReyData) {
      console.log('📋 Found John Rey data:');
      console.log('- Employee Name:', johnReyData.employeeName);
      console.log('- Region:', johnReyData.region);
      console.log('- Department:', johnReyData.department);
      console.log('- Division:', johnReyData.division);
      console.log('- Status:', johnReyData.status);
      console.log('- Original Level:', johnReyData.originalLevel);
      console.log('- Full Record:', JSON.stringify(johnReyData, null, 2));
    } else {
      console.log('❌ No John Rey data found');
      
      // Check all records to see data structure
      const allRecords = await PersonnelServices.find().limit(3);
      console.log('📊 Sample records structure:');
      allRecords.forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        console.log('- Employee Name:', record.employeeName);
        console.log('- Region:', record.region);
        console.log('- Department:', record.department);
        console.log('- Division:', record.division);
        console.log('- Status:', record.status);
        console.log('- Original Level:', record.originalLevel);
        console.log('- Process By:', record.processBy);
        console.log('- Created By:', record.createdBy);
        console.log('- User ID:', record.userId);
      });
    }
    
    // Check total count by division
    const divisionCounts = await PersonnelServices.aggregate([
      {
        $group: {
          _id: '$division',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📈 Division distribution:');
    divisionCounts.forEach(item => {
      console.log(`- Division: "${item._id}" -> Count: ${item.count}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkPersonnelData();
