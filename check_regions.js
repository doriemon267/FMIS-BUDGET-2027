const mongoose = require('mongoose');
require('dotenv').config({ path: './SERVER/.env' });
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Region = require('./SERVER/models/Region');
  const regions = await Region.find({}).lean();
  console.log(JSON.stringify(regions, null, 2));
  process.exit(0);
});
