#!/usr/bin/env node

/**
 * 🔐 RBAC Integration Script for Existing Routes
 * 
 * This script helps integrate region-based access control into existing route files.
 * It identifies transaction endpoints and suggests RBAC middleware replacements.
 */

const fs = require('fs');
const path = require('path');

const routersDir = path.join(__dirname, 'routers');

// Transaction operations that should use RBAC
const transactionPatterns = [
  { pattern: /\.post\([^)]*\/proposals[^)]*\)/, operation: 'create', description: 'Create proposal' },
  { pattern: /\.put\([^)]*\/proposals[^)]*\)/, operation: 'update', description: 'Update proposal' },
  { pattern: /\.delete\([^)]*\/proposals[^)]*\)/, operation: 'delete', description: 'Delete proposal' },
  { pattern: /\.get\([^)]*\/proposals[^)]*\)/, operation: 'read', description: 'Get proposals' },
  { pattern: /\.post\([^)]*\/budget[^)]*\)/, operation: 'create', description: 'Create budget' },
  { pattern: /\.put\([^)]*\/budget[^)]*\)/, operation: 'update', description: 'Update budget' },
  { pattern: /\.delete\([^)]*\/budget[^)]*\)/, operation: 'delete', description: 'Delete budget' },
  { pattern: /\.get\([^)]*\/budget[^)]*\)/, operation: 'read', description: 'Get budget' },
  { pattern: /\.post\([^)]*\/income[^)]*\)/, operation: 'create', description: 'Create income' },
  { pattern: /\.put\([^)]*\/income[^)]*\)/, operation: 'update', description: 'Update income' },
  { pattern: /\.delete\([^)]*\/income[^)]*\)/, operation: 'delete', description: 'Delete income' },
  { pattern: /\.get\([^)]*\/income[^)]*\)/, operation: 'read', description: 'Get income' },
  { pattern: /\.post\([^)]*\/mooe[^)]*\)/, operation: 'create', description: 'Create MOOE' },
  { pattern: /\.put\([^)]*\/mooe[^)]*\)/, operation: 'update', description: 'Update MOOE' },
  { pattern: /\.delete\([^)]*\/mooe[^)]*\)/, operation: 'delete', description: 'Delete MOOE' },
  { pattern: /\.get\([^)]*\/mooe[^)]*\)/, operation: 'read', description: 'Get MOOE' }
];

// Files to skip (already have RBAC or don't need it)
const skipFiles = [
  'regionBasedAccessRoutes.js',  // Our new RBAC routes
  'UserOrganizationalAssignmentRoutes.js', // Already has RBAC
  'proposalRoutesRBAC.js', // Already has RBAC
  'excelUpload.js', // File upload, different security
  'test-endpoints.js' // Test files
];

/**
 * Analyze a route file for RBAC opportunities
 */
function analyzeRouteFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    // Skip files that don't need analysis
    if (skipFiles.includes(fileName)) {
      return null;
    }
    
    const analysis = {
      fileName,
      filePath,
      hasRBAC: false,
      hasAuthentication: false,
      transactionEndpoints: [],
      suggestions: []
    };
    
    // Check if file already has RBAC
    analysis.hasRBAC = content.includes('regionBasedAccessControl') || 
                       content.includes('strictRegionControl') ||
                       content.includes('proposalAccessControl');
    
    // Check if file has basic authentication
    analysis.hasAuthentication = content.includes('checkToken') || 
                                content.includes('authenticatedRoute');
    
    // Find transaction endpoints
    transactionPatterns.forEach(({ pattern, operation, description }) => {
      const matches = content.match(pattern);
      if (matches) {
        analysis.transactionEndpoints.push({
          match: matches[0],
          operation,
          description,
          line: getLineNumber(content, matches.index)
        });
      }
    });
    
    // Generate suggestions
    if (analysis.transactionEndpoints.length > 0 && !analysis.hasRBAC) {
      analysis.suggestions.push({
        type: 'RBAC_NEEDED',
        message: `File has ${analysis.transactionEndpoints.length} transaction endpoint(s) that should use RBAC`,
        priority: 'HIGH'
      });
      
      if (!analysis.hasAuthentication) {
        analysis.suggestions.push({
          type: 'AUTH_NEEDED',
          message: 'File needs basic authentication before RBAC can be implemented',
          priority: 'CRITICAL'
        });
      }
    }
    
    return analysis;
    
  } catch (error) {
    console.error(`❌ Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get line number for a character index
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\\n').length;
}

/**
 * Generate RBAC implementation suggestions
 */
function generateRBACImplementation(analysis) {
  if (!analysis || analysis.hasRBAC || analysis.transactionEndpoints.length === 0) {
    return [];
  }
  
  const implementations = [];
  
  // Add import statement
  implementations.push({
    type: 'IMPORT',
    code: `// Add RBAC middleware import
const { regionBasedAccessControl, strictRegionControl } = require('../middleware/regionBasedAccessControl');
const { authenticatedRoute } = require('../middleware/securityMiddleware');`
  });
  
  // Add route replacements
  analysis.transactionEndpoints.forEach(endpoint => {
    const { operation, description, match } = endpoint;
    
    let replacement;
    if (operation === 'read') {
      replacement = match.replace(
        /(router\.[a-z]+\([^,]+,\s*)(checkToken|[^,]+,\s*)(.+\))/,
        '$1...authenticatedRoute(), regionBasedAccessControl("read"), $3'
      );
    } else {
      replacement = match.replace(
        /(router\.[a-z]+\([^,]+,\s*)(checkToken|[^,]+,\s*)(.+\))/,
        `$1...authenticatedRoute(), strictRegionControl("${operation}"), $3`
      );
    }
    
    implementations.push({
      type: 'ROUTE_REPLACEMENT',
      description: description,
      operation: operation,
      original: match,
      replacement: replacement
    });
  });
  
  return implementations;
}

/**
 * Main analysis function
 */
function analyzeRoutesForRBAC() {
  console.log('🔍 Analyzing routes for RBAC implementation opportunities...');
  console.log('=====================================\\n');
  
  if (!fs.existsSync(routersDir)) {
    console.error('❌ Routers directory not found:', routersDir);
    return;
  }
  
  const files = fs.readdirSync(routersDir)
    .filter(file => file.endsWith('.js'))
    .map(file => path.join(routersDir, file));
  
  console.log(`📁 Found ${files.length} router files to analyze\\n`);
  
  const analyses = [];
  let needsRBAC = 0;
  let alreadySecured = 0;
  let totalTransactionEndpoints = 0;
  
  files.forEach(filePath => {
    const analysis = analyzeRouteFile(filePath);
    if (analysis) {
      analyses.push(analysis);
      
      if (analysis.hasRBAC) {
        alreadySecured++;
      } else if (analysis.transactionEndpoints.length > 0) {
        needsRBAC++;
      }
      
      totalTransactionEndpoints += analysis.transactionEndpoints.length;
    }
  });
  
  // Print summary
  console.log('📊 ANALYSIS SUMMARY');
  console.log('==================');
  console.log(`✅ Already secured with RBAC: ${alreadySecured} files`);
  console.log(`🔒 Need RBAC implementation: ${needsRBAC} files`);
  console.log(`🎯 Total transaction endpoints found: ${totalTransactionEndpoints}`);
  console.log('');
  
  // Print detailed analysis
  analyses.forEach(analysis => {
    if (analysis.transactionEndpoints.length > 0) {
      console.log(`📄 FILE: ${analysis.fileName}`);
      console.log(`   Path: ${analysis.filePath}`);
      console.log(`   RBAC Status: ${analysis.hasRBAC ? '✅ Implemented' : '❌ Not implemented'}`);
      console.log(`   Auth Status: ${analysis.hasAuthentication ? '✅ Has authentication' : '❌ No authentication'}`);
      console.log(`   Transaction Endpoints: ${analysis.transactionEndpoints.length}`);
      
      // Show endpoints
      analysis.transactionEndpoints.forEach(endpoint => {
        console.log(`     - ${endpoint.description} (${endpoint.operation}) - Line ${endpoint.line}`);
      });
      
      // Show suggestions
      if (analysis.suggestions.length > 0) {
        console.log('   Suggestions:');
        analysis.suggestions.forEach(suggestion => {
          const priority = suggestion.priority === 'CRITICAL' ? '🚨' : 
                          suggestion.priority === 'HIGH' ? '⚠️' : 'ℹ️';
          console.log(`     ${priority} ${suggestion.message}`);
        });
      }
      
      // Show implementation if needed
      if (!analysis.hasRBAC && analysis.transactionEndpoints.length > 0) {
        const implementations = generateRBACImplementation(analysis);
        if (implementations.length > 0) {
          console.log('   🔧 RBAC Implementation Suggestions:');
          implementations.forEach(impl => {
            if (impl.type === 'IMPORT') {
              console.log('     1. Add imports:');
              console.log(`        ${impl.code.replace(/\\n/g, '\\n        ')}`);
            } else if (impl.type === 'ROUTE_REPLACEMENT') {
              console.log(`     2. Replace ${impl.description}:`);
              console.log(`        From: ${impl.original}`);
              console.log(`        To:   ${impl.replacement}`);
            }
          });
        }
      }
      
      console.log('');
    }
  });
  
  // Print next steps
  console.log('🎯 NEXT STEPS');
  console.log('=============');
  console.log('1. Review the files that need RBAC implementation');
  console.log('2. Add the suggested imports and route modifications');
  console.log('3. Update controllers to use req.regionFilters for read operations');
  console.log('4. Test with users having different region assignments');
  console.log('5. Monitor logs for access violations');
  console.log('');
  console.log('📚 For detailed implementation guide, see:');
  console.log('   /SERVER/docs/RBAC_REGION_IMPLEMENTATION_GUIDE.md');
  console.log('');
  console.log('🧪 For working examples, see:');
  console.log('   /SERVER/routers/regionBasedAccessRoutes.js');
}

// Run the analysis
if (require.main === module) {
  analyzeRoutesForRBAC();
}

module.exports = {
  analyzeRouteFile,
  analyzeRoutesForRBAC,
  generateRBACImplementation
};
