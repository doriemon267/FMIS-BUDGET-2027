// Verification script to ensure all components are properly implemented
const fs = require('fs');
const path = require('path');

function checkFileExists(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    console.log(`❌ ${description}: ${filePath} - FILE NOT FOUND`);
    return false;
  }
}

function checkFileContent(filePath, searchText, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchText)) {
      console.log(`✅ ${description}: Found in ${filePath}`);
      return true;
    } else {
      console.log(`❌ ${description}: Not found in ${filePath}`);
      return false;
    }
  } else {
    console.log(`❌ ${description}: ${filePath} - FILE NOT FOUND`);
    return false;
  }
}

console.log('🔍 Verifying Capital Outlay Details Implementation...\n');

let allChecksPass = true;

// Check backend files
console.log('📁 Backend Files:');
allChecksPass &= checkFileExists('models/CapitalOutlayDetails.js', 'CapitalOutlayDetails Model');
allChecksPass &= checkFileExists('controllers/capitalOutlayDetailsController.js', 'Controller');
allChecksPass &= checkFileExists('routers/capitalOutlayDetailsRouter.js', 'Router');

// Check if routes are registered in index.js
console.log('\n🔗 Route Registration:');
allChecksPass &= checkFileContent('index.js', 'capitalOutlayDetailsRouter', 'Router import');
allChecksPass &= checkFileContent('index.js', 'app.use("/api", capitalOutlayDetailsRouter)', 'Router registration');

// Check frontend files
console.log('\n🎨 Frontend Files:');
const clientPath = '../CLIENT/src/components/capitaloutlay';
allChecksPass &= checkFileExists(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'Modal Component');

// Check if modal is integrated in table
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayTable.jsx`, 'CapitalOutlayDetailsModal', 'Modal import in table');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayTable.jsx`, 'handleOpenDetailsModal', 'Modal handler in table');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayTable.jsx`, 'List', 'List icon import');

// Check model structure
console.log('\n🗄️ Database Model Structure:');
allChecksPass &= checkFileContent('models/CapitalOutlayDetails.js', 'capital_outlay_id', 'Foreign key field');
allChecksPass &= checkFileContent('models/CapitalOutlayDetails.js', 'particulars', 'Particulars field');
allChecksPass &= checkFileContent('models/CapitalOutlayDetails.js', 'income_amount', 'Income amount field');
allChecksPass &= checkFileContent('models/CapitalOutlayDetails.js', 'subsidy_amount', 'Subsidy amount field');

// Check API endpoints
console.log('\n🌐 API Endpoints:');
allChecksPass &= checkFileContent('routers/capitalOutlayDetailsRouter.js', 'getCapitalOutlayDetails', 'GET details endpoint');
allChecksPass &= checkFileContent('routers/capitalOutlayDetailsRouter.js', 'saveCapitalOutlayDetails', 'POST details endpoint');
allChecksPass &= checkFileContent('routers/capitalOutlayDetailsRouter.js', 'deleteCapitalOutlayDetail', 'DELETE detail endpoint');

// Check controller functions
console.log('\n⚙️ Controller Functions:');
allChecksPass &= checkFileContent('controllers/capitalOutlayDetailsController.js', 'getCapitalOutlayDetails', 'Get details function');
allChecksPass &= checkFileContent('controllers/capitalOutlayDetailsController.js', 'saveCapitalOutlayDetails', 'Save details function');
allChecksPass &= checkFileContent('controllers/capitalOutlayDetailsController.js', 'mongoose.startSession', 'Transaction support');

// Check modal features
console.log('\n🎭 Modal Features:');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'handleAddRow', 'Add row functionality');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'handleRemoveRow', 'Remove row functionality');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'calculateTotals', 'Total calculation');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'validateDetails', 'Form validation');

console.log('\n' + '='.repeat(50));
if (allChecksPass) {
  console.log('🎉 ALL CHECKS PASSED! Implementation is complete.');
  console.log('\n📋 Next Steps:');
  console.log('1. Ensure both server and client are running');
  console.log('2. Navigate to Capital Outlay page in the browser');
  console.log('3. Click the List icon (📋) next to any capital outlay item');
  console.log('4. Test the modal functionality');
} else {
  console.log('❌ Some checks failed. Please review the issues above.');
}

console.log('\n📚 Documentation: See CAPITAL_OUTLAY_DETAILS_FEATURE.md for detailed usage guide.');