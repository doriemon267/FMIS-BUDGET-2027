const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'CLIENT/src/components/proposals/ProposalCustomPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove console.log statements but preserve console.error
// This regex matches console.log followed by parentheses and everything inside, including multiline
content = content.replace(/console\.log\s*\([^)]*\);?/g, '');
content = content.replace(/console\.log\s*\(\s*[\s\S]*?\s*\);?/gm, '');

// Clean up any double semicolons that might have been left
content = content.replace(/;;/g, ';');

// Clean up any empty lines that might have been left
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

// Write the file back
fs.writeFileSync(filePath, content);

console.log('Console logs removed from ProposalCustomPage.jsx');
