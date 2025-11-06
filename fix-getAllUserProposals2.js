const fs = require('fs');

const filePath = 'SERVER/controllers/proposalController.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the line number of each "exports.getAllUserProposals"
const lines = content.split('\n');
const getAllUserProposalsLines = [];
lines.forEach((line, index) => {
  if (line.includes('exports.getAllUserProposals')) {
    getAllUserProposalsLines.push(index);
  }
});

console.log(`Found getAllUserProposals at lines: ${getAllUserProposalsLines.map(i => i + 1).join(', ')}`);

// We want to update the ONE AFTER the comment "Add this function to get all user proposals including drafts"
// Find that one
let targetLineIndex = -1;
lines.forEach((line, index) => {
  if (line.includes('Add this function to get all user proposals including drafts')) {
    // The exports line should be the next one
    targetLineIndex = index + 1;
  }
});

if (targetLineIndex === -1) {
  console.log('ERROR: Could not find the "Add this function" comment');
  process.exit(1);
}

console.log(`Target line index: ${targetLineIndex + 1}`);

// Now find the "const { processBy, region }" line after this and update it
for (let i = targetLineIndex; i < targetLineIndex + 10; i++) {
  if (lines[i].includes('const { processBy, region } = req.query')) {
    lines[i] = lines[i].replace('const { processBy, region } = req.query', 'const { processBy, region, fiscalYear, budgetType } = req.query');
    console.log(`✓ Updated destructuring at line ${i + 1}`);
    break;
  }
}

// Now find and update the baseQuery line
for (let i = targetLineIndex; i < targetLineIndex + 30; i++) {
  if (lines[i].trim() === 'const baseQuery = { processBy, region };') {
    lines[i] = '    const baseQuery = { processBy, region };';
    // Insert the new lines after it
    lines.splice(i + 1, 0, 
      '    if (fiscalYear) baseQuery.fiscalYear = fiscalYear;',
      '    if (budgetType) baseQuery.budgetType = budgetType;'
    );
    console.log(`✓ Updated baseQuery and added filter lines at line ${i + 1}`);
    break;
  }
}

// Write back
fs.writeFileSync(filePath, lines.join('\n'));
console.log('✓ File updated successfully');
