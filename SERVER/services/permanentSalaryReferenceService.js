const mongoose = require('mongoose');
const Template = require('../models/CPSCTemplate');
const SalaryGrade = require('../models/SalarySelection');
const CPCSSalaryTable = require('../models/CPCSSalaryTable');
const { gradeNumber, referenceError } = require('../utils/permanentSalaryReference');

const templateLabel = template => `${template.templateName.replace('CPSC', 'CPCS')} — FY ${template.fiscalYear} / ${template.budgetType}${template.description ? ` — ${template.description}` : ''}`;

async function listSalaryReferences() {
  const templates = await Template.find({ isActive: true, templateName: { $in: ['CPSC 1', 'CPSC 2'] } })
    .select('_id templateName fiscalYear budgetType description').sort({ fiscalYear: -1 }).lean();
  return {
    cpcs1: templates.filter(row => row.templateName === 'CPSC 1').map(row => ({ id: String(row._id), label: templateLabel(row) })),
    cpcs2: [
      ...templates.filter(row => row.templateName === 'CPSC 2').map(row => ({ id: String(row._id), label: templateLabel(row) })),
      { id: 'CURRENT_CPCS2', label: 'CPCS 2 — Employee Salary Table' },
    ],
  };
}

async function loadReference(id, matchBy, role) {
  if (!['SG', 'JG'].includes(matchBy)) throw referenceError(`${role}: choose SG or JG matching.`);
  let rows;
  let label;
  if (role === 'CPCS 2' && id === 'CURRENT_CPCS2') {
    rows = await CPCSSalaryTable.find({}).lean();
    label = 'CPCS 2 — Employee Salary Table';
  } else {
    if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) throw referenceError(`Select a valid ${role} reference table.`);
    const template = await Template.findOne({ _id: id, isActive: true, templateName: role.replace('CPCS', 'CPSC') }).lean();
    if (!template) throw referenceError(`${role} reference table is missing or inactive.`);
    label = templateLabel(template);
    rows = await SalaryGrade.find({ cpscTemplate: template._id, isActive: { $ne: false } }).lean();
  }
  if (!rows.length) throw referenceError(`${role} reference table has no salary rates.`);
  return {
    id, label, matchBy,
    rows: rows.map(row => ({
      sg: gradeNumber(row.salary_grade ?? row.salaryGrade),
      jg: gradeNumber(row.job_grade ?? row.cpcs1JobGrade),
      rates: Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
        const step = String(index + 1);
        const value = row.rates instanceof Map ? row.rates.get(step) : row.rates?.[step] ?? row[`step${step}`];
        return [step, value == null || value === '' ? null : Number(value)];
      })),
    })),
  };
}

async function loadSalaryReferences(body) {
  const [cpcs1, cpcs2] = await Promise.all([
    loadReference(body.cpcs1Reference, body.cpcs1MatchBy || 'JG', 'CPCS 1'),
    loadReference(body.cpcs2Reference, body.cpcs2MatchBy || 'SG', 'CPCS 2'),
  ]);
  return { cpcs1, cpcs2 };
}

module.exports = { listSalaryReferences, loadSalaryReferences };
