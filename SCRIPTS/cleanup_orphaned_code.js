const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'CLIENT/src/components/proposals/ProposalCustomPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove orphaned object literals that were left after console.log removal
// Remove lines that are clearly orphaned from console.log removals
const lines = content.split('\n');
const cleanedLines = [];
let skipMode = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Skip orphaned object literal patterns
  if (trimmed.startsWith('=> ({') || 
      trimmed.startsWith('=>({') ||
      (trimmed.includes(': ') && trimmed.endsWith(',') && !trimmed.includes('const') && !trimmed.includes('let') && !trimmed.includes('var') && !trimmed.includes('function')) ||
      trimmed === '})),' ||
      trimmed === '});' ||
      (trimmed.endsWith('({') && !trimmed.includes('=')) ||
      (trimmed.includes('Count:') && trimmed.endsWith('),')) ||
      (trimmed.includes('Data:') && trimmed.endsWith('.map'))) {
    
    // Check if this is part of an orphaned console.log object
    const nextFewLines = lines.slice(i, i + 5).join(' ');
    if (nextFewLines.includes('isEligible') || 
        nextFewLines.includes('status:') || 
        nextFewLines.includes('Count:') ||
        nextFewLines.includes('Data:')) {
      skipMode = true;
      braceCount = 0;
      continue;
    }
  }
  
  if (skipMode) {
    // Count braces to know when to stop skipping
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;
    
    if (trimmed === '});' || trimmed === '}));' || braceCount <= 0) {
      skipMode = false;
    }
    continue;
  }
  
  // Skip obviously orphaned lines
  if (trimmed.startsWith(', Overview loads ALL data') ||
      trimmed.includes('This might be the discrepancy!') ||
      (trimmed.includes('const mooeTotal') && line.includes('iasOMCostTotal;'))) {
    continue;
  }
  
  cleanedLines.push(line);
}

content = cleanedLines.join('\n');

// Clean up any double semicolons
content = content.replace(/;;/g, ';');

// Clean up multiple empty lines
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

// Write the file back
fs.writeFileSync(filePath, content);

console.log('Orphaned code cleaned up from ProposalCustomPage.jsx');
