const fs = require('fs');
const path = require('path');

// Path to the file
const filePath = path.join(__dirname, 'CLIENT', 'src', 'components', 'corporateincome', 'IncomeTable.jsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Replace all instances of the old region filtering code with the new helper function
const oldCode = [
  // Pattern 1: Standard region filtering
  /\/\/ Check if the item matches the current region filter.*\n\s*const matchesRegion = !regionFilter \|\|\s*\n\s*!item\.region \|\|\s*\n\s*item\.region === regionFilter \|\|\s*\n\s*item\.region === "ALL";/g,
  
  // Pattern 2: Simple region filtering
  /const matchesRegion = !regionFilter \|\|\s*\n\s*!item\.region \|\|\s*\n\s*item\.region === regionFilter \|\|\s*\n\s*item\.region === "ALL";/g,
  
  // Pattern 3: Region filtering with comment
  /\/\/ For region filtering.*\n\s*const matchesRegion = !regionFilter \|\|\s*\n\s*!item\.region \|\|\s*\n\s*item\.region === regionFilter \|\|\s*\n\s*item\.region === "ALL";/g,
  
  // Pattern 4: Region filtering with different indentation
  /const matchesRegion = !regionFilter \|\|\s*\n\s*!item\.region \|\|\s*\n\s*item\.region === regionFilter \|\|\s*\n\s*item\.region === "ALL";/g
];

const newCode = '// Use the centralized region matching function\n            const matchesRegion = checkRegionMatch(item);';

// Apply all replacements
oldCode.forEach(pattern => {
  content = content.replace(pattern, newCode);
});

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

console.log('Region filtering code has been updated to use the centralized helper function');