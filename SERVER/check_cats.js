require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    const catSchema = new mongoose.Schema({}, { strict: false, collection: 'incomecategories' });
    const Cat = mongoose.model('Cat', catSchema);
    const cats = await Cat.find({});
    console.log("Found categories:", cats.map(c => c.incomeCategoryName || c.name));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
