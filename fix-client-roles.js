const fs = require('fs');
const path = require('path');

const filesToFix = [
  './CLIENT/src/components/capitaloutlay/CapitalOutlayTableEnhanced.jsx',
  './CLIENT/src/components/guards/RegionAssignmentGuard.jsx',
  './CLIENT/src/components/myproposal/BudgetOfficerEditView.jsx',
  './CLIENT/src/components/myproposal/ProposalDetailsDialog.jsx',
  './CLIENT/src/components/workflow/ProposalDetailsWithTables.jsx',
  './CLIENT/src/components/workflow/WorkflowActions.jsx',
  './CLIENT/src/layout/CustomDrawer.jsx',
  './CLIENT/src/pages/AllProposalsPage.jsx',
  './CLIENT/src/pages/HierarchicalUserAssignmentPage.jsx'
];

const replacements = [
  { from: /'BUDGET_PREPARER'/g, to: "'BUDGET PREPARER'" },
  { from: /"BUDGET_PREPARER"/g, to: '"BUDGET PREPARER"' },
  { from: /'BUDGET_REVIEWER'/g, to: "'BUDGET REVIEWER'" },
  { from: /"BUDGET_REVIEWER"/g, to: '"BUDGET REVIEWER"' },
  { from: /'BUDGET_APPROVER'/g, to: "'BUDGET APPROVER'" },
  { from: /"BUDGET_APPROVER"/g, to: '"BUDGET APPROVER"' },
  { from: /'BUDGET_PLANNING_ANALYST'/g, to: "'BUDGET PLANNING ANALYST'" },
  { from: /"BUDGET_PLANNING_ANALYST"/g, to: '"BUDGET PLANNING ANALYST"' },
  { from: /'BUDGET_OFFICER'/g, to: "'BUDGET OFFICER'" },
  { from: /"BUDGET_OFFICER"/g, to: '"BUDGET OFFICER"' },
  { from: /'OVERALL_BUDGET_APPROVER'/g, to: "'OVERALL BUDGET APPROVER'" },
  { from: /"OVERALL_BUDGET_APPROVER"/g, to: '"OVERALL BUDGET APPROVER"' },
  { from: /'BUDGET_ADMIN'/g, to: "'BUDGET ADMIN'" },
  { from: /"BUDGET_ADMIN"/g, to: '"BUDGET ADMIN"' },
  { from: /'SUPER_ADMIN'/g, to: "'SUPER ADMIN'" },
  { from: /"SUPER_ADMIN"/g, to: '"SUPER ADMIN"' },
  { from: /'BUDGET_MANAGER'/g, to: "'BUDGET MANAGER'" },
  { from: /"BUDGET_MANAGER"/g, to: '"BUDGET MANAGER"' },
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let changed = false;

  replacements.forEach(({ from, to }) => {
    if (from.test(content)) {
      content = content.replace(from, to);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Fixed: ${filePath}`);
  } else {
    console.log(`⏭️  No changes: ${filePath}`);
  }
});

console.log('\n✅ Done! All client files have been updated.');
