const fs = require('fs');
let code = fs.readFileSync('tierController.js', 'utf8');

const regex = /const query = \{ fiscalYear: fyStr, budgetType: 'Initial' \};/g;
const replacement = \const query = { fiscalYear: fyStr, budgetType: 'Initial' };
    if (department) query.department = new RegExp('^' + String(department).replace(/[.*+?^\\$\\{\\}()|[\\]\\\\\\\]/g, '\\\\$&') + '$', 'i');
    if (division) query.division = new RegExp('^' + String(division).replace(/[.*+?^\\$\\{\\}()|[\\]\\\\\\\]/g, '\\\\$&') + '$', 'i');\;

code = code.replace(regex, replacement);
fs.writeFileSync('tierController.js', code);
console.log('Added department and division filters');
