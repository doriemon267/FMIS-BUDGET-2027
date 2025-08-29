const fs = require('fs');
const path = require('path');

// Path to the file
const filePath = path.join(__dirname, 'CLIENT', 'src', 'components', 'corporateincome', 'IncomeTable.jsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Replace the problematic code
const pattern = /const matchesRegion = !regionFilter \|\|\s+!item\.region \|\|\s+item\.region === regionFilter \|\|\s+item\.region === "ALL" \|\|\s+\(regionFilter === "Region X" && item\.region === "Region 10"\) \|\|\s+\(regionFilter === "Region 10" && item\.region === "Region X"\);/g;
const replacement = 'const matchesRegion = !regionFilter || \n                                 !item.region || \n                                 item.region === regionFilter || \n                                 item.region === "ALL";';

// Apply the replacement
content = content.replace(pattern, replacement);

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

console.log('Region filtering code has been fixed in IncomeTable.jsx');