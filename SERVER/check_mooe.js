require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    const schema = new mongoose.Schema({}, { strict: false, collection: 'mooeproposals' });
    const Mooe = mongoose.model('Mooe', schema);
    const items = await Mooe.find({ uacsCode: "5-02-99-990" });
    console.log("Found items:", items.map(i => ({ 
      id: i._id,
      amount: i.amount, 
      accountingTitle: i.accountingTitle,
      sublineItem: i.sublineItem,
      region: i.region,
      department: i.department
    })));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
