const mongoose = require('mongoose');

async function setupSampleData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/fmis-budget-september');

    console.log('Connected to MongoDB');

    // Check if offices collection exists and has data
    const officesCount = await mongoose.connection.db.collection('offices').countDocuments();
    console.log('Offices count:', officesCount);

    // Check if responsibilitycenters collection exists and has data
    const rcCount = await mongoose.connection.db.collection('responsibilitycenters').countDocuments();
    console.log('Responsibility Centers count:', rcCount);

    if (officesCount === 0) {
      console.log('Creating sample offices...');
      await mongoose.connection.db.collection('offices').insertMany([
        { _id: 'office_001', name: 'Office of the Director', code: 'OD', region: 'NCR' },
        { _id: 'office_002', name: 'Finance Office', code: 'FO', region: 'NCR' },
        { _id: 'office_003', name: 'Administrative Office', code: 'AO', region: 'NCR' }
      ]);
      console.log('Sample offices created');
    }

    if (rcCount === 0) {
      console.log('Creating sample responsibility centers...');
      await mongoose.connection.db.collection('responsibilitycenters').insertMany([
        { _id: 'rc_001', name: 'Budget Planning Center', code: 'BPC', officeId: 'office_001', officeName: 'Office of the Director' },
        { _id: 'rc_002', name: 'Financial Management Center', code: 'FMC', officeId: 'office_002', officeName: 'Finance Office' },
        { _id: 'rc_003', name: 'Administrative Services Center', code: 'ASC', officeId: 'office_003', officeName: 'Administrative Office' },
        { _id: 'rc_004', name: 'Program Implementation Center', code: 'PIC', officeId: 'office_001', officeName: 'Office of the Director' }
      ]);
      console.log('Sample responsibility centers created');
    }

    console.log('Sample data setup complete!');
  } catch (error) {
    console.error('Error setting up sample data:', error);
  } finally {
    await mongoose.disconnect();
  }
}

setupSampleData();