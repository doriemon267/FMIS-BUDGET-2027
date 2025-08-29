const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Function to clean console logs from a file
function cleanConsoleLogsFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Remove active console.log statements
    const lines = content.split('\n');
    const cleanedLines = [];
    let inConsoleLog = false;
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
        openParens = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        
        // If the console.log is complete on one line
        if (openParens <= 0 && line.includes(');')) {
          inConsoleLog = false;
          continue; // Skip this line
        }
        continue;
      }
      
      // If we're in a multi-line console.log, continue collecting
      if (inConsoleLog) {
        openParens += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        
        // If we've closed all parentheses
        if (openParens <= 0 && (line.includes(');') || line.includes(')'))) {
          inConsoleLog = false;
          continue; // Skip this line
        }
        continue;
      }
      
      // Regular line, keep it
      cleanedLines.push(line);
    }

    content = cleanedLines.join('\n');
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Find and clean all JS/JSX files
function findAndCleanFiles() {
  const targetFiles = [
    // Context files
    'CLIENT/src/context/UserContext.jsx',
    'CLIENT/src/context/RegionContext.jsx',
    'CLIENT/src/context/SearchContext.jsx',
    'CLIENT/src/context/ThemeContext.jsx',
    'CLIENT/src/context/NotificationContext.jsx',
    
    // Pages
    'CLIENT/src/pages/CourtAppearancePage.jsx',
    'CLIENT/src/pages/SubsistenceAllowanceSTPage.jsx',
    'CLIENT/src/pages/SubsistenceAllowanceMDSPage.jsx',
    
    // Components already found
    'CLIENT/src/components/subsistenceallowancest/SubsistenceAllowanceSTDialog.jsx',
    'CLIENT/src/components/subsistenceallowancest/SubsistenceAllowanceSTCustomTable.jsx',
    'CLIENT/src/components/subsistenceallowancest/SubsistenceAllowanceCustomPage.jsx',
    'CLIENT/src/components/subsistenceallowancemds/SubsistenceAllowanceDialog.jsx',
    'CLIENT/src/components/subsistenceallowancemds/SubsistenceAllowanceCustomTable.jsx',
    'CLIENT/src/components/subsistenceallowancemds/SubsistenceAllowanceCustomPage.jsx',
    
    // Find other common component files
    'CLIENT/src/components/regions/RegionAssignmentGuard.jsx',
    'CLIENT/src/components/employees/EmployeeCustomTable.jsx',
    'CLIENT/src/components/employees/EmployeeList.jsx',
    'CLIENT/src/components/categories/CategoryPage.jsx',
    'CLIENT/src/components/income/IncomeCategoriesCustomTable.jsx',
    'CLIENT/src/components/income/IncomeManagementPage.jsx',
    'CLIENT/src/components/users/UserRegionAssignmentPage.jsx',
    'CLIENT/src/components/retirement/RetirementDialog.jsx'
  ];

  let cleanedCount = 0;
  let processedCount = 0;

  console.log('🧹 Starting comprehensive console log cleanup...\n');

  targetFiles.forEach(relativePath => {
    const fullPath = path.join(__dirname, relativePath);
    processedCount++;
    
    if (fs.existsSync(fullPath)) {
      if (cleanConsoleLogsFromFile(fullPath)) {
        cleanedCount++;
        console.log(`✅ Cleaned: ${relativePath}`);
      } else {
        console.log(`ℹ️ No changes: ${relativePath}`);
      }
    } else {
      console.log(`⚠️ Not found: ${relativePath}`);
    }
  });

  // Also search for additional files with patterns
  const searchPatterns = [
    'CLIENT/src/components/**/*Dialog.jsx',
    'CLIENT/src/components/**/*CustomTable.jsx',
    'CLIENT/src/components/**/*CustomPage.jsx',
    'CLIENT/src/pages/**/*Page.jsx'
  ];

  console.log('\n🔍 Searching for additional files...');
  
  // Use a simple recursive search for remaining files
  function searchDirectory(dir, pattern) {
    const files = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...searchDirectory(fullPath, pattern));
        } else if (item.endsWith('.jsx') || item.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    return files;
  }

  const clientDir = path.join(__dirname, 'CLIENT/src');
  if (fs.existsSync(clientDir)) {
    const allJsxFiles = searchDirectory(clientDir, '*.jsx');
    let additionalCleaned = 0;
    
    allJsxFiles.forEach(filePath => {
      const relativePath = path.relative(__dirname, filePath);
      
      // Skip files we already processed
      if (!targetFiles.some(tf => filePath.includes(tf.replace(/\//g, path.sep)))) {
        if (cleanConsoleLogsFromFile(filePath)) {
          additionalCleaned++;
          console.log(`✅ Additional cleanup: ${relativePath}`);
        }
      }
    });
    
    cleanedCount += additionalCleaned;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Files cleaned: ${cleanedCount}`);
  console.log('\n🎉 Console log cleanup completed!');
}

findAndCleanFiles();
