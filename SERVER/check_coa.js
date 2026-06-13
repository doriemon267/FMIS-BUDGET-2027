require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    const schema = new mongoose.Schema({}, { strict: false, collection: 'chartofaccounts' });
    const COA = mongoose.model('COA', schema);
    const items = await COA.find({ uacsCode: "5-02-99-990" });
    console.log("Found COA:", items.map(i => ({ 
      id: i._id,
      accountingTitle: i.accountingTitle,
      sublineItem: i.sublineItem,
    })));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
