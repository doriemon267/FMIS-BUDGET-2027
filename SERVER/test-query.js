const mongoose = require('mongoose');
mongoose.connect('mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin').then(async () => {
  const Schema = mongoose.Schema;
  const mooeProposalSchema = new Schema({}, { strict: false });
  const MooeProposal = mongoose.model('MooeProposal', mooeProposalSchema, 'mooeproposals');
  
  const docs = await MooeProposal.find({});
  const titles = docs.filter(d => d.sublineItem && d.sublineItem.toLowerCase().includes('travel')).map(d => ({
    title: d.accountingTitle,
    subline: d.sublineItem,
    region: d.region
  }));
  
  const docsTrain = await MooeProposal.find({});
  const titlesTrain = docsTrain.filter(d => d.sublineItem && d.sublineItem.toLowerCase().includes('train')).map(d => ({
    title: d.accountingTitle,
    subline: d.sublineItem,
    region: d.region
  }));

  console.log('TRAVEL:');
  console.log(JSON.stringify(titles, null, 2));
  console.log('TRAIN:');
  console.log(JSON.stringify(titlesTrain, null, 2));
  process.exit();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
