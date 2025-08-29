const fs = require('fs');
const path = require('path');

// List of files to clean based on the screenshot
const filesToClean = [
  'CLIENT/src/components/users/UserContext.jsx',
  'CLIENT/src/components/regions/RegionAssignmentGuard.jsx',
  'CLIENT/src/components/regions/RegionContext.jsx',
  'CLIENT/src/components/personnel/PersonnelCustomTable.jsx',
  'CLIENT/src/components/personnel/PersonnelCustomPageTable.jsx',
  'CLIENT/src/components/personnel/PersonnelCustomTable.jsx',
  'CLIENT/src/components/mooe/MooeTable.jsx',
  'CLIENT/src/components/capitaloutlay/CapitalOutlayTable.jsx',
  'CLIENT/src/components/courtappearance/CourtAppearancePage.jsx',
  'CLIENT/src/components/subsistenceallowance/SubsistenceAllowanceDialog.jsx',
  'CLIENT/src/components/subsistenceallowance/SubsistenceAllowanceCustom.jsx',
  'CLIENT/src/components/subsistenceallowance/SubsistenceAllowanceSTDialog.jsx',
  'CLIENT/src/components/mealallowance/MealAllowanceDialog.jsx',
  'CLIENT/src/components/mealallowance/MealAllowanceCustomTable.jsx',
  'CLIENT/src/components/childrenallowance/ChildrenAllowanceDialog.jsx',
  'CLIENT/src/components/retirement/RetirementDialog.jsx',
  'CLIENT/src/components/employees/EmployeeCustomTable.jsx',
  'CLIENT/src/components/employees/EmployeeList.jsx',
  'CLIENT/src/components/categories/CategoryPage.jsx',
  'CLIENT/src/components/income/IncomeCategoriesCustomTable.jsx',
  'CLIENT/src/components/income/IncomeManagementPage.jsx',
  'CLIENT/src/components/users/UserRegionAssignmentPage.jsx'
];

function cleanConsoleLogsFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Remove active console.log statements more carefully
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
      
      // Keep console.error, console.warn, console.info, console.debug
      if (trimmed.includes('console.error') || 
          trimmed.includes('console.warn') || 
          trimmed.includes('console.info') || 
          trimmed.includes('console.debug')) {
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

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Cleaned console logs from: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️ No console logs found in: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Process all files
let processedCount = 0;
let cleanedCount = 0;

console.log('🧹 Starting console log cleanup for all files...\n');

filesToClean.forEach(relativePath => {
  const fullPath = path.join(__dirname, relativePath);
  processedCount++;
  
  if (cleanConsoleLogsFromFile(fullPath)) {
    cleanedCount++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Files processed: ${processedCount}`);
console.log(`   Files cleaned: ${cleanedCount}`);
console.log(`   Files skipped: ${processedCount - cleanedCount}`);
console.log('\n🎉 Console log cleanup completed!');
