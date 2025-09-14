/**
 * Check the Region document and fix the assignment
 */
const mongoose = require('mongoose');

async function fixRegionAssignment() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get the region document
    const regionId = "68be0fba37907a9f5551c935";
    const region = await db.collection('regions').findOne({ _id: new mongoose.Types.ObjectId(regionId) });
    
    console.log('\n📋 Region Document:');
    console.log(JSON.stringify(region, null, 2));
    
    if (region) {
      console.log(`Region Name: ${region.Region || region.regionName || region.name}`);
      
      // Now fix the assignment to include the actual region name
      // The middleware expects either assignment.regionId.Region or assignment.regions[0].regionName
      
      // Option 1: Add regions array
      const regionAssignmentId = "68c618c141dceb37ad19feb3";
      
      console.log('\n🔧 Fixing Region assignment...');
      
      const updateResult = await db.collection('hierarchicaluserassignments').updateOne(
        { _id: new mongoose.Types.ObjectId(regionAssignmentId) },
        {
          $set: {
            regions: [{
              regionId: new mongoose.Types.ObjectId(regionId),
              regionName: region.Region
            }]
          }
        }
      );
      
      console.log('Update result:', updateResult);
      
      // Verify the fix
      const updatedAssignment = await db.collection('hierarchicaluserassignments').findOne({
        _id: new mongoose.Types.ObjectId(regionAssignmentId)
      });
      
      console.log('\n✅ Updated Assignment:');
      console.log(`Regions: ${JSON.stringify(updatedAssignment.regions)}`);
      console.log(`Region Name: ${updatedAssignment.regions?.[0]?.regionName}`);
      
    } else {
      console.log('❌ Region document not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

fixRegionAssignment();