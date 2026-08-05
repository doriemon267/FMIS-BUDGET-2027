const fs = require('fs');
let code = fs.readFileSync('tierController.js', 'utf8');

// Replace rData lookup
code = code.replace(
  /const rData = regionalBreakdown\.data\[r\]\?\.\[lineItem\.lineItemId\];/g,
  \const targetKey = String(lineItem.lineItemId).trim().toLowerCase().replace(/\\s+/g, ' ');
             const rMap = regionalBreakdown.data[r] || {};
             const actualKey = Object.keys(rMap).find(k => k.trim().toLowerCase().replace(/\\s+/g, ' ') === targetKey);
             const rData = actualKey ? rMap[actualKey] : null;\
);

fs.writeFileSync('tierController.js', code);
console.log('Replaced lookups');
