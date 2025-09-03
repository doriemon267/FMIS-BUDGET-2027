// Create hierarchical user assignment
const { MongoClient, ObjectId } = require('mongodb');

async function createUserAssignment() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('FMIS');
    
    // Create the user assignment with the correct structure
    const regionId = new ObjectId('67c7fe35b10250a3e86b3d86');
    
    const assignment = {
      userId: '909549',
      userName: 'Reymund Edra',
      email: '909549reymund.m.edra@gmail.com',
      assignmentLevel: 'REGION',
      regionId: regionId,
      departmentId: null,
      divisionName: null,
      accessScope: 'REGION',
      roles: [
        'BUDGET ADMIN',
        'BUDGET ANALYST', 
        'BUDGET COORDINATOR',
        'BUDGET MANAGER',
        'BUDGET OFFICER'
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('hierarchicaluserassignments').updateOne(
      { userId: '909549' },
      { $set: assignment },
      { upsert: true }
    );
    
    console.log('✅ User assignment created/updated:', result);
    
    // Verify the assignment
    const createdAssignment = await db.collection('hierarchicaluserassignments').findOne({ userId: '909549' });
    console.log('📊 Created assignment:', createdAssignment);
    
  } catch (error) {
    console.error('❌ Error creating assignment:', error);
  } finally {
    await client.close();
  }
}

createUserAssignment();
