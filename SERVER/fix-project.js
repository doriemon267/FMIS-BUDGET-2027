const fs = require('fs');
const path = require('path');

// 1. Mga files na kailangang burahin (Backups / Duplicates / Trash)
const filesToDelete = [
  'controllers/personnel_service_controller_final.js',
  'controllers/personnel_service_controller_fixed.js',
  'controllers/personnel_service_controller_simplified_v2.js',
  'controllers/consolidatedCapitalOutlayController_backup.js',
  'controllers/employeeListController.js.backup',
  'controllers/auth_controller.js',
  'controllers/incomeCategoriesController.js',
  'controllers/test.pdf',
  'models/Income_Categories.js',
  'models/PS_Annexes.js',
  'middleware/check_token.js'
];

// 2. Pagpapalit ng pangalan ng Files (File Renaming)
const filesToRename = [
  // Assets
  { from: 'assets/Bagong_Pilipinas.png', to: 'assets/bagong-pilipinas.png' },
  { from: 'assets/Seal.png', to: 'assets/seal.png' },

  // Controllers
  { from: 'controllers/AuthController.js', to: 'controllers/authController.js' },
  { from: 'controllers/BudgetManagerOrgController.js', to: 'controllers/budgetManagerOrgController.js' },
  { from: 'controllers/annex_controller.js', to: 'controllers/annexController.js' },
  { from: 'controllers/category_controller.js', to: 'controllers/categoryController.js' },
  { from: 'controllers/iasOMCost.controller.js', to: 'controllers/iasOmCostController.js' },
  { from: 'controllers/IncomeCategoryController.js', to: 'controllers/incomeCategoryController.js' },
  { from: 'controllers/reports.controller.js', to: 'controllers/reportController.js' },
  { from: 'controllers/personnel_service_controller.js', to: 'controllers/personnelServiceController.js' },

  // Models
  { from: 'models/assigned_role.js', to: 'models/AssignedRole.js' },
  { from: 'models/capitalOutlay.js', to: 'models/CapitalOutlay.js' },
  { from: 'models/childrenAllowance.js', to: 'models/ChildrenAllowance.js' },
  { from: 'models/employee_master.js', to: 'models/EmployeeMaster.js' },
  { from: 'models/mooeProposals.js', to: 'models/MooeProposal.js' }
];

// 3. Pag-update ng require() / import text sa loob ng mga `.js` files
const replacements = [
  // Controllers
  { old: 'AuthController', new: 'authController' },
  { old: 'BudgetManagerOrgController', new: 'budgetManagerOrgController' },
  { old: 'annex_controller', new: 'annexController' },
  { old: 'category_controller', new: 'categoryController' },
  { old: 'iasOMCost.controller', new: 'iasOmCostController' },
  { old: 'IncomeCategoryController', new: 'incomeCategoryController' },
  { old: 'incomeCategoriesController', new: 'incomeCategoryController' },
  { old: 'reports.controller', new: 'reportController' },
  { old: 'personnel_service_controller', new: 'personnelServiceController' },
  { old: 'auth_controller', new: 'authController' },

  // Models
  { old: 'assigned_role', new: 'AssignedRole' },
  { old: 'capitalOutlay', new: 'CapitalOutlay' },
  { old: 'childrenAllowance', new: 'ChildrenAllowance' },
  { old: 'employee_master', new: 'EmployeeMaster' },
  { old: 'mooeProposals', new: 'MooeProposal' },
  { old: 'Income_Categories', new: 'IncomeCategory' },
  { old: 'PS_Annexes', new: 'PsAnnex' },

  // Middleware
  { old: 'check_token', new: 'checkToken' },

  // Assets
  { old: 'Bagong_Pilipinas.png', new: 'bagong-pilipinas.png' },
  { old: 'Seal.png', new: 'seal.png' }
];

// Recursive scanner para sa lahat ng JS files
function getAllJsFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        getAllJsFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.js')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

console.log('🚀 Simula ng Automatic Fix...\n');

// Step 1: Burahin ang mga basura/duplicates
console.log('--- Step 1: Pagbura ng Backup / Duplicate Files ---');
filesToDelete.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`[DELETED] ${file}`);
  }
});

// Step 2: I-rename ang files
console.log('\n--- Step 2: Pag-rename ng Files ---');
filesToRename.forEach(({ from, to }) => {
  const oldPath = path.join(__dirname, from);
  const newPath = path.join(__dirname, to);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`[RENAMED] ${from} -> ${to}`);
  }
});

// Step 3: I-update ang mga require/import lines sa lahat ng JS files
console.log('\n--- Step 3: Pag-update ng Imports sa Lahat ng JS Files ---');
const jsFiles = getAllJsFiles(__dirname);

jsFiles.forEach(filePath => {
  if (filePath.endsWith('fix-project.js')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  replacements.forEach(({ old: oldStr, new: newStr }) => {
    const regex = new RegExp(oldStr, 'g');
    content = content.replace(regex, newStr);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    const relativePath = path.relative(__dirname, filePath);
    console.log(`[UPDATED IMPORTS] ${relativePath}`);
  }
});

console.log('\n✅ Tapos na! Maayos na ang filenames at na-update na ang lahat ng imports.');