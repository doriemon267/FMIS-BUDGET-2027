#!/usr/bin/env node

/**
 * Script to remove all console.log statements from server files
 * while preserving console.error statements for error handling
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to recursively find all .js files in server directory
function findJSFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findJSFiles(fullPath, files);
    } else if (stat.isFile() && item.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Function to remove console.log statements from a file
function cleanConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Remove console.log statements (but keep console.error, console.warn, console.info)
    content = content.replace(/console\.log\([^)]*\);?\s*/g, '');
    content = content.replace(/console\.log\([^)]*\)\s*$/gm, '');
    content = content.replace(/^\s*console\.log\([^)]*\);\s*$/gm, '');
    content = content.replace(/^\s*console\.log\([^)]*\)\s*$/gm, '');

    // Remove empty lines that were left behind
    content = content.replace(/^\s*$/gm, '');
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Cleaned: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error cleaning ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
function main() {
  const serverDir = path.join(__dirname, 'SERVER');

  console.log('🔍 Finding all JavaScript files in SERVER directory...');
  const jsFiles = findJSFiles(serverDir);

  console.log(`📁 Found ${jsFiles.length} JavaScript files`);
  console.log('🧹 Cleaning console.log statements...\n');

  let cleanedCount = 0;
  for (const file of jsFiles) {
    if (cleanConsoleLogs(file)) {
      cleanedCount++;
    }
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`📊 Cleaned ${cleanedCount} files`);
  console.log(`📁 Total files processed: ${jsFiles.length}`);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { findJSFiles, cleanConsoleLogs };
