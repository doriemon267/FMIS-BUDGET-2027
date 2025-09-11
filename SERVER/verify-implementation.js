// Verification script to ensure all components are properly implemented
const fs = require('fs');
const path = require('path');
function checkFileExists(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    return true;
  } else {
    return false;
  }
}
function checkFileContent(filePath, searchText, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchText)) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}
let allChecksPass = true;
// Check backend files
allChecksPass &= checkFileExists('models/CapitalOutlayDetails.js', 'CapitalOutlayDetails Model');
allChecksPass &= checkFileExists('controllers/capitalOutlayDetailsController.js', 'Controller');
allChecksPass &= checkFileExists('routers/capitalOutlayDetailsRouter.js', 'Router');
// Check if routes are registered in index.js
allChecksPass &= checkFileContent('index.js', 'capitalOutlayDetailsRouter', 'Router import');
allChecksPass &= checkFileContent('index.js', 'app.use("/api", capitalOutlayDetailsRouter)', 'Router registration');
// Check frontend files
const clientPath = '../CLIENT/src/components/capitaloutlay';
allChecksPass &= checkFileExists(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'Modal Component');
// Check if modal is integrated in table
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayTable.jsx`, 'CapitalOutlayDetailsModal', 'Modal import in table');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayTable.jsx`, 'handleOpenDetailsModal', 'Modal handler in table');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayTable.jsx`, 'List', 'List icon import');
// Check model structure
allChecksPass &= checkFileContent('models/CapitalOutlayDetails.js', 'capital_outlay_id', 'Foreign key field');
allChecksPass &= checkFileContent('models/CapitalOutlayDetails.js', 'particulars', 'Particulars field');
allChecksPass &= checkFileContent('models/CapitalOutlayDetails.js', 'income_amount', 'Income amount field');
allChecksPass &= checkFileContent('models/CapitalOutlayDetails.js', 'subsidy_amount', 'Subsidy amount field');
// Check API endpoints
allChecksPass &= checkFileContent('routers/capitalOutlayDetailsRouter.js', 'getCapitalOutlayDetails', 'GET details endpoint');
allChecksPass &= checkFileContent('routers/capitalOutlayDetailsRouter.js', 'saveCapitalOutlayDetails', 'POST details endpoint');
allChecksPass &= checkFileContent('routers/capitalOutlayDetailsRouter.js', 'deleteCapitalOutlayDetail', 'DELETE detail endpoint');
// Check controller functions
allChecksPass &= checkFileContent('controllers/capitalOutlayDetailsController.js', 'getCapitalOutlayDetails', 'Get details function');
allChecksPass &= checkFileContent('controllers/capitalOutlayDetailsController.js', 'saveCapitalOutlayDetails', 'Save details function');
allChecksPass &= checkFileContent('controllers/capitalOutlayDetailsController.js', 'mongoose.startSession', 'Transaction support');
// Check modal features
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'handleAddRow', 'Add row functionality');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'handleRemoveRow', 'Remove row functionality');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'calculateTotals', 'Total calculation');
allChecksPass &= checkFileContent(`${clientPath}/CapitalOutlayDetailsModal.jsx`, 'validateDetails', 'Form validation');
);
if (allChecksPass) {
  next to any capital outlay item');
  } else {
  }