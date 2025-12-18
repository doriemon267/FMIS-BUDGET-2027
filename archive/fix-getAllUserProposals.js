const fs = require('fs');
const path = require('path');

const filePath = 'SERVER/controllers/proposalController.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find all occurrences of "exports.getAllUserProposals"
const pattern = /exports\.getAllUserProposals = async \(req, res\) => \{[\s\S]*?const { processBy, region } = req\.query;/g;
const matches = Array.from(content.matchAll(pattern));

console.log(`Found ${matches.length} occurrences of getAllUserProposals`);

// Replace ONLY the last occurrence
if (matches.length > 0) {
  const lastMatch = matches[matches.length - 1];
  const lastMatchText = lastMatch[0];
  const newText = lastMatchText.replace(
    'const { processBy, region } = req.query;',
    'const { processBy, region, fiscalYear, budgetType } = req.query;'
  );
  
  content = content.replace(lastMatchText, newText);
  
  // Also update the baseQuery line in the same section
  // Find and replace the baseQuery = { processBy, region }; line that comes next
  const baseQueryOldPattern = /const baseQuery = { processBy, region };(\s+)let visibilityGate = {};/;
  const baseQueryNewText = 'const baseQuery = { processBy, region };\n    if (fiscalYear) baseQuery.fiscalYear = fiscalYear;\n    if (budgetType) baseQuery.budgetType = budgetType;$1let visibilityGate = {};';
  
  content = content.replace(baseQueryOldPattern, baseQueryNewText);
  
  fs.writeFileSync(filePath, content);
  console.log('✓ Updated destructuring and baseQuery in the last getAllUserProposals function');
} else {
  console.log('ERROR: No matches found!');
}
