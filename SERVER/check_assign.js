const mongoose = require('mongoose');

const url = 'mongodb://172.16.4.98:27017/fmis_budget';

mongoose.connect(url).then(async () => {
    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
    const u = await HierarchicalUserAssignment.find({ assignmentLevel: /RESPONSIBILITY_CENTER|DIVISION_LEVEL/ }).lean().limit(5);
    console.log("Assignments found:", u.length);
    console.log(JSON.stringify(u, null, 2));
    process.exit();
}).catch(e => {
    console.error(e);
    process.exit(1);
});
