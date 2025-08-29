const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'CLIENT/src/components/proposals/ProposalCustomPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove active console.log statements more carefully
// This regex looks for console.log followed by parentheses, handling multi-line statements
content = content.replace(/^\s*console\.log\s*\([^;]*?\);?\s*$/gm, '');

// Handle multi-line console.log statements
const lines = content.split('\n');
const cleanedLines = [];
let inConsoleLog = false;
let consoleLogBuffer = '';
let openParens = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Skip commented console.log lines (keep them)
  if (trimmed.startsWith('//') && trimmed.includes('console.log')) {
    cleanedLines.push(line);
    continue;
  }
  
  // Check if this line starts a console.log
  if (trimmed.includes('console.log(') && !trimmed.startsWith('//')) {
    inConsoleLog = true;
    consoleLogBuffer = line;
    openParens = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    
    // If the console.log is complete on one line
    if (openParens <= 0 && line.includes(');')) {
      inConsoleLog = false;
      consoleLogBuffer = '';
      continue; // Skip this line
    }
    continue;
  }
  
  // If we're in a multi-line console.log, continue collecting
  if (inConsoleLog) {
    consoleLogBuffer += line;
    openParens += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    
    // If we've closed all parentheses and found the semicolon
    if (openParens <= 0 && (line.includes(');') || line.includes(')'))) {
      inConsoleLog = false;
      consoleLogBuffer = '';
      continue; // Skip this line
    }
    continue;
  }
  
  // Regular line, keep it
  cleanedLines.push(line);
}

content = cleanedLines.join('\n');

// Clean up any extra empty lines
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

// Write the file back
fs.writeFileSync(filePath, content);

console.log('Console logs carefully removed from ProposalCustomPage.jsx');
