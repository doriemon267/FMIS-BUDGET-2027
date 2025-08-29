const fs = require('fs');
const path = require('path');

// List of router files to secure
const routersToSecure = [
  'consolidatedReportsRoutes.js',
  'consolidatedPersonnelServicesRoutes.js',
  'consolidatedCapitalOutlayRoutes.js',
  'fiscalYearRoutes.js',
  'employeeCourtAppearanceRoutes.js',
  'loyaltyPayRoutes.js',
  'medicalAllowanceRoutes.js',
  'mealAllowanceRoutes.js',
  'overtimeRoutes.js',
  'childrenAllowanceRoutes.js',
  'titleMappingRoutes.js',
  'subsistenceAllowanceSTRoutes.js',
  'subsistenceAllowanceMDSRoutes.js',
  'SpecialCounselAllowanceRoutes.js',
  'statsRoutes.js',
  'UserOrganizationalAssignmentRoutes.js',
  'setupRoutes.js',
  'reports.routes.js',
  'proposalRoutesRBAC.js',
  'annex.js',
  'AccountingEntryList_router.js',
  'BudgetManagerOrgRoutes.js',
  'Department.js',
  'test_router.js',
  'Status.js',
  'PositionTitle.js',
  'personnel.js',
  'EmployeeList_router.js'
];

const routersDir = path.join(__dirname, 'routers');

routersToSecure.forEach(filename => {
  const filePath = path.join(routersDir, filename);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if checkToken is already imported
    if (!content.includes("require('../middleware/checkToken')") && 
        !content.includes("require('../middleware/check_token')")) {
      
      // Find the first router creation line
      const routerPatterns = [
        /const\s+\w+Router\s*=\s*express\.Router\(\)/,
        /const\s+\w+Router\s*=\s*Router\(\)/,
        /const\s+router\s*=\s*express\.Router\(\)/,
        /const\s+router\s*=\s*Router\(\)/
      ];
      
      let routerMatch = null;
      let patternIndex = -1;
      
      routerPatterns.forEach((pattern, index) => {
        const match = content.match(pattern);
        if (match && !routerMatch) {
          routerMatch = match;
          patternIndex = index;
        }
      });
      
      if (routerMatch) {
        // Add checkToken import after existing requires
        const requirePattern = /const.*require.*;\n/g;
        const requires = content.match(requirePattern);
        
        if (requires && requires.length > 0) {
          const lastRequire = requires[requires.length - 1];
          const lastRequireIndex = content.lastIndexOf(lastRequire) + lastRequire.length;
          
          // Insert checkToken import
          const checkTokenImport = "const checkToken = require('../middleware/checkToken');\n";
          content = content.slice(0, lastRequireIndex) + checkTokenImport + content.slice(lastRequireIndex);
          
          // Add authentication middleware after router creation
          const routerCreationIndex = content.indexOf(routerMatch[0]) + routerMatch[0].length;
          const authMiddleware = "\n\n// Apply authentication to all routes\n" + 
                                routerMatch[0].split('=')[0].trim() + ".use(checkToken);";
          
          content = content.slice(0, routerCreationIndex) + authMiddleware + content.slice(routerCreationIndex);
          
          // Write the updated content
          fs.writeFileSync(filePath, content);
          console.log(`✅ Secured: ${filename}`);
        }
      } else {
        console.log(`⚠️  Could not find router pattern in: ${filename}`);
      }
    } else {
      console.log(`✅ Already secured: ${filename}`);
    }
  } else {
    console.log(`❌ File not found: ${filename}`);
  }
});

console.log('🔒 Route security update completed!');
