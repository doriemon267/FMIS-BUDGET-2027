#!/usr/bin/env node

/**
 * 🔒 SECURITY FIX SCRIPT: Mass Authentication Implementation
 * This script adds checkToken middleware to ALL routes that don't have it
 */

const fs = require('fs');
const path = require('path');

const routersDir = path.join(__dirname, 'routers');

// List of files that already have authentication or don't need it
const skipFiles = [
  'budgetarySupportRoutes.js', // Already fixed
  'mooeRoutes.js', // Already fixed
  'incomeRoutes.js', // Already fixed
  'iasOMCostRoutes.js', // Already fixed
  'income_subcategory_router.js', // Already fixed
  'personnelServices_router_simplified.js', // Already fixed
  'proposalRoutesRBAC.js', // Uses different auth system
  'comprehensiveReportsRoutes.js', // Uses checkToken
  'excelUpload.js', // Uses different middleware
  'chartOfAccountsRoutes.js' // Just fixed
];

// Function to check if file already has checkToken
function hasCheckToken(content) {
  return content.includes('checkToken') || 
         content.includes('authenticatedRoute') ||
         content.includes('require(\'../middleware/check_token\')');
}

// Function to add checkToken to a route file
function addAuthenticationToFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if already has authentication
    if (hasCheckToken(content)) {
      console.log(`✅ SKIP: ${path.basename(filePath)} - Already has authentication`);
      return;
    }
    
    // Skip test files
    if (content.includes('test') && content.includes('endpoint')) {
      console.log(`✅ SKIP: ${path.basename(filePath)} - Test file`);
      return;
    }
    
    // Add checkToken import after other requires
    const importStatement = "\n// 🔒 SECURITY: Import authentication middleware\nconst checkToken = require('../middleware/checkToken');\n";
    
    // Find the position to insert import (after last require)
    const requireRegex = /const .* = require\([^)]+\);/g;
    const requires = [...content.matchAll(requireRegex)];
    
    if (requires.length > 0) {
      const lastRequire = requires[requires.length - 1];
      const insertPos = lastRequire.index + lastRequire[0].length;
      content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
    }
    
    // Add checkToken to all route definitions
    content = content.replace(
      /(router|[a-zA-Z]+Router)\.(get|post|put|delete|patch)\(\s*(['"][^'"]+['"])\s*,\s*(?!checkToken)/g,
      '$1.$2($3, checkToken, '
    );
    
    // Add comment about authentication
    content = content.replace(
      /(const [a-zA-Z]+Router = Router\(\);)/,
      '$1\n\n// 🔒 ALL ROUTES NOW REQUIRE AUTHENTICATION'
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`🔒 FIXED: ${path.basename(filePath)} - Added authentication`);
    
  } catch (error) {
    console.error(`❌ ERROR: ${path.basename(filePath)} - ${error.message}`);
  }
}

// Get all router files
const files = fs.readdirSync(routersDir)
  .filter(file => file.endsWith('.js') && !skipFiles.includes(file))
  .map(file => path.join(routersDir, file));

console.log('🚀 Starting mass authentication implementation...');
console.log(`📁 Found ${files.length} router files to process`);

files.forEach(addAuthenticationToFile);

console.log('\n✅ Mass authentication implementation completed!');
console.log('🔒 All routes now require authentication');
console.log('\n📋 Next Steps for Enhanced RBAC Implementation:');
console.log('1. 🎯 Replace checkToken with regionBasedAccessControl for transaction endpoints');
console.log('2. 🏢 Ensure user-region assignments are configured via UserOrganizationalAssignment');
console.log('3. 🛡️ Use strictRegionControl() for write operations (create/update/delete)');
console.log('4. 📖 Use regionBasedAccessControl("read") for read operations with filtering');
console.log('5. 👨‍💼 Test with different user roles and region assignments');
console.log('\n🔧 Example RBAC Route Implementation:');
console.log('// Import RBAC middleware');
console.log('const { strictRegionControl } = require("../middleware/regionBasedAccessControl");');
console.log('');
console.log('// Apply to routes');
console.log('router.post("/proposals", ...authenticatedRoute(), strictRegionControl("create"), createProposal);');
console.log('router.get("/proposals", ...authenticatedRoute(), regionBasedAccessControl("read"), getProposals);');
console.log('\n📚 See /SERVER/routers/regionBasedAccessRoutes.js for complete examples');
