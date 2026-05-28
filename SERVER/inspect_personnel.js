const mongoose = require('mongoose');

const MONGODB_BUDGET_URL = 'mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('Connected!');

    // Let's inspect the collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    // Inspect PersonnelServices
    const psCollection = mongoose.connection.db.collection('personnelservices');
    const totalCount = await psCollection.countDocuments();
    console.log(`Total PersonnelServices: ${totalCount}`);

    // Distinct statusOfAppointment
    const statuses = await psCollection.distinct('statusOfAppointment');
    console.log('Distinct statusOfAppointment:', statuses);

    // Let's count where statusOfAppointment is CASUAL
    const casualCount = await psCollection.countDocuments({
      statusOfAppointment: { $regex: '^casual$', $options: 'i' }
    });
    console.log(`Total CASUAL personnel: ${casualCount}`);

    // Let's look at one casual personnel
    if (casualCount > 0) {
      const casualSample = await psCollection.findOne({
        statusOfAppointment: { $regex: '^casual$', $options: 'i' }
      });
      console.log('Casual sample:', {
        name: casualSample.employeeFullName,
        statusOfAppointment: casualSample.statusOfAppointment,
        region: casualSample.region,
        fiscalYear: casualSample.fiscalYear,
        budgetType: casualSample.budgetType,
        Total: casualSample.Total,
        chargedToIncomeEligible: casualSample.chargedToIncomeEligible,
        subsidyEligible: casualSample.subsidyEligible
      });
    } else {
      console.log('No casual records found, let us look at permanent records distinct statuses:');
      const somePerm = await psCollection.findOne({
        statusOfAppointment: { $regex: '^permanent$', $options: 'i' }
      });
      if (somePerm) {
        console.log('Permanent sample:', {
          name: somePerm.employeeFullName,
          statusOfAppointment: somePerm.statusOfAppointment,
          region: somePerm.region,
          fiscalYear: somePerm.fiscalYear,
          budgetType: somePerm.budgetType,
          Total: somePerm.Total
        });
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected!');
  }
}

run();
