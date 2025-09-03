// Quick fix for region assignment issue
const { MongoClient, ObjectId } = require('mongodb');

async function fixRegionAssignment() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('FMIS');
    
    // Create or update the region record
    const regionId = new ObjectId('67c7fe35b10250a3e86b3d86');
    
    const result = await db.collection('regions').updateOne(
      { _id: regionId },
      { 
        $set: { 
          regionName: 'Central Office',
          regionCode: 'CO',
          createdAt: new Date(),
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    
    console.log('✅ Region updated/created:', result);
    
    // Verify the update
    const updatedRegion = await db.collection('regions').findOne({ _id: regionId });
    console.log('📊 Updated region:', updatedRegion);
    
  } catch (error) {
    console.error('❌ Error fixing region:', error);
  } finally {
    await client.close();
  }
}

fixRegionAssignment();
