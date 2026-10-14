const fs = require('fs');
const path = require('path');

// 1. Mga bakas o basura na kailangang burahin sa CLIENT folder
const filesToDelete = [
  // Context & Component backups
  'src/context/RegionContext_clean.jsx',
  'src/context/RegionContext_new.jsx',
  'src/global/components/floating_apps/FixedChatWindowClean.jsx',
  'src/components/fiscalyear/fiscal',
  
  // Pages & Test files
  'src/pages/DashBoard_old.jsx',
  'src/pages/flowchart TD.mmd',
  'src/pages/test.js',
  'src/pages/TestPage.jsx',

  // Middleware duplicate
  'src/middleware/regionMiddleware.js',

  // Root & Debug Junk
  'debug-division-issue.js',
  'debug-user-data.js',
  'FRONTEND_ENHANCEMENT_SUMMARY.txt',
  'lint-output.txt',
  'index.html.dev',
  'production_server.js.bak'
];

// 2. Pag-rename ng typos / inconsistent filenames
const filesToRename = [
  { 
    from: 'src/components/capitaloutlay/CapitalOutlayCustompage.jsx', 
    to: 'src/components/capitaloutlay/CapitalOutlayCustomPage.jsx' 
  }
];

console.log('🚀 Simula ng Client Cleanup...\n');

// Step 1: Burahin ang mga basura at backups
filesToDelete.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`[DELETED] ${file}`);
  }
});

// Step 2: I-rename ang typos
filesToRename.forEach(({ from, to }) => {
  const oldPath = path.join(__dirname, from);
  const newPath = path.join(__dirname, to);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`[RENAMED] ${from} -> ${to}`);
  }
});

console.log('\n✅ Malinis na ang CLIENT folder structure!');