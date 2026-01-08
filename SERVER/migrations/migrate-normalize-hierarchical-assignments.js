/**
 * Migration script: Normalize HierarchicalUserAssignment assignmentLevel and workflowRoles
 * Usage: node migrate-normalize-hierarchical-assignments.js
 */
const mongoose = require('mongoose');
require('../models/HierarchicalUserAssignment');
const HierarchicalUserAssignment = mongoose.model('HierarchicalUserAssignment');
require('dotenv').config();

const mapping = {
  'RESPONSIBILITY_CENTER': 'DIVISION_LEVEL',
  'DIVISION': 'DIVISION_LEVEL',
  'OFFICE': 'DEPARTMENT_REGIONAL_LEVEL',
  'DEPARTMENT': 'DEPARTMENT_REGIONAL_LEVEL',
  'REGION': 'BUDGET_AND_REVENUE_DIVISION'
};

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL || process.env.MONGODB_MAIN_URL;
  if (!uri) {
    throw new Error('MONGODB_URI (or MONGODB_BUDGET_URL / MONGODB_MAIN_URL) must be set');
  }
  await mongoose.connect(uri);
  const docs = await HierarchicalUserAssignment.find({}).lean();
  let changed = 0;
  for (const d of docs) {
    const doc = await HierarchicalUserAssignment.findById(d._id);
    let modified = false;
    if (doc.assignmentLevel && mapping[doc.assignmentLevel]) {
      doc.legacyAssignmentLevel = doc.assignmentLevel;
      doc.assignmentLevel = mapping[doc.assignmentLevel];
      modified = true;
    }
    if (Array.isArray(doc.workflowRoles) && doc.workflowRoles.length > 0) {
      const canonical = (role) => {
        const key = String(role).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const map = {
          'BUDGETPREPARER': 'BUDGET_PREPARER',
          'BUDGETREVIEWER': 'BUDGET_REVIEWER',
          'BUDGETAPPROVER': 'BUDGET_APPROVER',
          'BUDGETPLANNINGANALYST': 'budgetAnalyst',
          'BUDGETANALYST': 'budgetAnalyst',
          'BUDGETOFFICER': 'budgetOfficer',
          'OVERALLBUDGETAPPROVER': 'overallBudgetApprover',
          'BUDGETADMIN': 'BUDGET_ADMIN',
          'DIVISIONCREATOR': 'divisionCreator',
          'DIVISIONREVIEWER': 'divisionReviewer',
          'DIVISIONAPPROVER': 'divisionApprover',
          'OFFICECREATOR': 'officeCreator',
          'OFFICEAPPROVER': 'officeApprover',
          'DEPARTMENTCREATOR': 'departmentCreator',
          'DEPARTMENTCONSOLIDATOR': 'departmentConsolidator',
          'DEPARTMENTSUBMISSION': 'departmentSubmission',
          'OFFICECONSOLIDATOR': 'officeConsolidator',
          'OFFICESUBMISSION': 'officeSubmission',
          'OFFICEFINALVERIFIER': 'officeFinalVerifier',
          'REGIONCREATOR': 'regionCreator',
          'REGIONFINALVERIFIER': 'regionFinalVerifier',
          'BUDGETMANAGER': 'overallBudgetApprover'
        };
        return map[key] || null;
      };

      const allowed = new Set([
        'divisionCreator','divisionReviewer','divisionApprover',
        'officeCreator','officeApprover',
        'budgetAnalyst','budgetOfficer','overallBudgetApprover','budgetAdmin',
        'BUDGET_PREPARER','BUDGET_REVIEWER','BUDGET_APPROVER','BUDGET_PLANNING_ANALYST','BUDGET_OFFICER','OVERALL_BUDGET_APPROVER','BUDGET_ADMIN',
        'departmentCreator','departmentConsolidator','departmentSubmission','officeConsolidator','officeSubmission','officeFinalVerifier','regionCreator','regionFinalVerifier'
      ]);

      const normalizedRoles = doc.workflowRoles.map(r => canonical(r)).filter(Boolean).filter(r => allowed.has(r));
      const uniq = Array.from(new Set(normalizedRoles));
      if (uniq.length > 0 && JSON.stringify(uniq) !== JSON.stringify(doc.workflowRoles)) {
        doc.workflowRoles = uniq;
        modified = true;
      }
    }
    if (modified) {
      await doc.save();
      changed++;
    }
  }
  console.log(`Normalization complete. Updated ${changed} document(s).`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
