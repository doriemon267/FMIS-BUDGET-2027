const SalaryGrade = require('../models/SalarySelection');
const CPSCTemplate = require('../models/CPSCTemplate');
/** List salary table (Permanent & Casual) with pagination, search, filter */
exports.getSalaryTableList = async (req, res) => {
  try {
    const { limit = 20, offset = 0, q = '', salaryGrade = '', jobGrade = '', sortField = 'salary_grade', sortDir = 'asc' } = req.query;
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = parseInt(offset, 10) || 0;

    const filter = {};
    if (q && q.trim()) {
      const qr = q.trim();
      filter.$or = [
        { salary_grade: { $regex: qr, $options: 'i' } },
        { job_grade: { $regex: qr, $options: 'i' } },
      ];
    }
    if (salaryGrade) filter.salary_grade = { $regex: salaryGrade, $options: 'i' };
    if (jobGrade) filter.job_grade = { $regex: jobGrade, $options: 'i' };

    const sort = { [sortField]: sortDir === 'desc' ? -1 : 1 };

    const [docs, totalRecords] = await Promise.all([
      SalaryGrade.find(filter).sort(sort).skip(skip).limit(lim).lean(),
      SalaryGrade.countDocuments(filter),
    ]);

    const rows = docs.map((d) => {
      const rates = d.rates instanceof Map ? d.rates : (d.rates && typeof d.rates === 'object' ? new Map(Object.entries(d.rates)) : new Map());
      const step1 = rates.get('1') ?? rates.get(1);
      const step2 = rates.get('2') ?? rates.get(2);
      const step3 = rates.get('3') ?? rates.get(3);
      const step4 = rates.get('4') ?? rates.get(4);
      const step5 = rates.get('5') ?? rates.get(5);
      const step6 = rates.get('6') ?? rates.get(6);
      const step7 = rates.get('7') ?? rates.get(7);
      const step8 = rates.get('8') ?? rates.get(8);
      return {
        _id: d._id,
        salaryGrade: d.salary_grade || '',
        jobGrade: d.job_grade || '',
        step1, step2, step3, step4, step5, step6, step7, step8,
      };
    });

    res.status(200).json({ rows, totalRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all Salary Grades
exports.getSalaryGrades = async (req, res) => {
  try {
    const salary_grade = req.query.salary_grade || '';
    const grades = await SalaryGrade.find({
      salary_grade: { $regex: salary_grade, $options: 'i' },
    });
    res.status(200).json({ grades }); // {grades: [{salary_grade: '1'}, {salary_grade: '2'}, ...]}
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// Get Job Grades based on selected Salary Grade
exports.getJobGrades = async (req, res) => {
  try {
    const { salary_grade } = req.params;
    // Logging
    const grade = await SalaryGrade.findOne({ salary_grade });
    if (!grade) {
      console.error(`Salary Grade not found: ${salary_grade}`); // Logging
      return res.status(404).json({ error: 'Salary Grade not found' });
    }
    // Logging
    res.json({ job_grade: grade.job_grade });
  } catch (err) {
    console.error(`Error fetching job grades: ${err.message}`); // Logging
    res.status(500).json({ error: err.message });
  }
};
// Get Steps based on selected Job Grade
exports.getSteps = async (req, res) => {
  try {
    const { job_grade } = req.params;
    // Logging
    const grade = await SalaryGrade.findOne({ job_grade });
    if (!grade) {
      console.error(`Job Grade not found: ${job_grade}`); // Logging
      return res.status(404).json({ error: 'Job Grade not found' });
    }
    // Logging
    res.json({ steps: grade.steps });
  } catch (err) {
    console.error(`Error fetching steps: ${err.message}`); // Logging
    res.status(500).json({ error: err.message });
  }
};
// Get Rate based on Step
exports.getRate = async (req, res) => {
  try {
    const { job_grade, step } = req.params;
    // Logging
    const grade = await SalaryGrade.findOne({ job_grade });
    if (!grade) {
      console.error(`Job Grade not found: ${job_grade}`); // Logging
      return res.status(404).json({ error: 'Job Grade not found' });
    }
    const rate = grade.rates.get(step);
    // Logging
    res.json({ rate });
  } catch (err) {
    console.error(`Error fetching rate: ${err.message}`); // Logging
    res.status(500).json({ error: err.message });
  }
};
// Create Rate based on Job Grade
// Get Rate based on Job Grade and Step for CASUAL employees (Nationwide Standard)
exports.getRateByJobGradeAndStep = async (req, res) => {
  try {
    const { job_grade, step } = req.params;

    // Find the document with the matching job_grade
    const casualSalaryInfo = await SalaryGrade.findOne({
      job_grade: job_grade,
    });

    if (!casualSalaryInfo) {
      console.error(`Job Grade not found: ${job_grade}`);
      return res.status(404).json({ error: `Job Grade ${job_grade} not found.` });
    }

    // The rates map is keyed by step (e.g., "1", "2", etc.)
    const rate = casualSalaryInfo.rates.get(step);

    if (rate === undefined || rate === null) {
      console.error(`Rate not found for job grade: ${job_grade}, step: ${step}`);
      return res.status(404).json({ error: 'Rate not found for this job grade and step combination.' });
    }

    res.json({ rate });
  } catch (err) {
    console.error(`Error fetching casual rate: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// ==================== CPSC Template Management ====================

// Get all CPSC templates
exports.getCPSCTemplates = async (req, res) => {
  try {
    const templates = await CPSCTemplate.find().populate('salaryGrades');
    res.status(200).json({ templates });
  } catch (err) {
    console.error(`Error fetching CPSC templates: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Get CPSC template by ID
exports.getCPSCTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await CPSCTemplate.findById(id).populate('salaryGrades');
    if (!template) {
      return res.status(404).json({ error: 'CPSC Template not found' });
    }
    res.status(200).json({ template });
  } catch (err) {
    console.error(`Error fetching CPSC template: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Create new CPSC template
exports.createCPSCTemplate = async (req, res) => {
  try {
    const { templateName, templateCode, fiscalYear, budgetType, description, createdBy } = req.body;

    // Check if template already exists for this fiscal year and budget type
    const existingTemplate = await CPSCTemplate.findOne({
      fiscalYear,
      budgetType,
      templateName
    });

    if (existingTemplate) {
      return res.status(400).json({
        error: 'CPSC Template already exists for this fiscal year, budget type, and template name'
      });
    }

    const newTemplate = new CPSCTemplate({
      templateName,
      templateCode,
      fiscalYear,
      budgetType,
      description,
      createdBy
    });

    const savedTemplate = await newTemplate.save();
    res.status(201).json({ template: savedTemplate });
  } catch (err) {
    console.error(`Error creating CPSC template: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Update CPSC template
exports.updateCPSCTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating fiscal year, budget type, and template name as they form the unique key
    delete updates.fiscalYear;
    delete updates.budgetType;
    delete updates.templateName;

    const updatedTemplate = await CPSCTemplate.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    ).populate('salaryGrades');

    if (!updatedTemplate) {
      return res.status(404).json({ error: 'CPSC Template not found' });
    }

    res.status(200).json({ template: updatedTemplate });
  } catch (err) {
    console.error(`Error updating CPSC template: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Delete CPSC template
exports.deleteCPSCTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template has associated salary grades
    const template = await CPSCTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ error: 'CPSC Template not found' });
    }

    if (template.salaryGrades && template.salaryGrades.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete template with associated salary grades. Remove salary grades first.'
      });
    }

    await CPSCTemplate.findByIdAndDelete(id);
    res.status(200).json({ message: 'CPSC Template deleted successfully' });
  } catch (err) {
    console.error(`Error deleting CPSC template: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// ==================== Template-based Salary Operations ====================

// Get salary grades by CPSC template
exports.getSalaryGradesByTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const salaryGrades = await SalaryGrade.find({ cpscTemplate: templateId });
    res.status(200).json({ salaryGrades });
  } catch (err) {
    console.error(`Error fetching salary grades by template: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Get salary grades by fiscal year and budget type
exports.getSalaryGradesByFiscalYearAndBudgetType = async (req, res) => {
  try {
    const { fiscalYear, budgetType } = req.params;
    const salaryGrades = await SalaryGrade.find({
      fiscalYear: parseInt(fiscalYear),
      budgetType
    }).populate('cpscTemplate');
    res.status(200).json({ salaryGrades });
  } catch (err) {
    console.error(`Error fetching salary grades by fiscal year and budget type: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Create salary grade with template association
exports.createSalaryGradeWithTemplate = async (req, res) => {
  try {
    const { salary_grade, job_grade, steps, rates, cpscTemplate, templateName, fiscalYear, budgetType, createdBy } = req.body;

    // Verify template exists
    const template = await CPSCTemplate.findById(cpscTemplate);
    if (!template) {
      return res.status(404).json({ error: 'CPSC Template not found' });
    }

    // Check if salary grade already exists for this template
    const existingGrade = await SalaryGrade.findOne({
      cpscTemplate,
      salary_grade
    });

    if (existingGrade) {
      return res.status(400).json({
        error: 'Salary grade already exists for this CPSC template'
      });
    }

    const newSalaryGrade = new SalaryGrade({
      salary_grade,
      job_grade,
      steps,
      rates,
      cpscTemplate,
      templateName,
      fiscalYear,
      budgetType,
      createdBy
    });

    const savedGrade = await newSalaryGrade.save();

    // Add salary grade to template's salaryGrades array
    template.salaryGrades.push(savedGrade._id);
    await template.save();

    res.status(201).json({ salaryGrade: savedGrade });
  } catch (err) {
    console.error(`Error creating salary grade with template: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Update salary grade
exports.updateSalaryGrade = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedGrade = await SalaryGrade.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    ).populate('cpscTemplate');

    if (!updatedGrade) {
      return res.status(404).json({ error: 'Salary Grade not found' });
    }

    res.status(200).json({ salaryGrade: updatedGrade });
  } catch (err) {
    console.error(`Error updating salary grade: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Delete salary grade
exports.deleteSalaryGrade = async (req, res) => {
  try {
    const { id } = req.params;

    const grade = await SalaryGrade.findById(id);
    if (!grade) {
      return res.status(404).json({ error: 'Salary Grade not found' });
    }

    // Remove from template's salaryGrades array
    await CPSCTemplate.findByIdAndUpdate(
      grade.cpscTemplate,
      { $pull: { salaryGrades: id } }
    );

    await SalaryGrade.findByIdAndDelete(id);
    res.status(200).json({ message: 'Salary Grade deleted successfully' });
  } catch (err) {
    console.error(`Error deleting salary grade: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

// Get active salary grades for a specific fiscal year and budget type
exports.getActiveSalaryGrades = async (req, res) => {
  try {
    const { fiscalYear, budgetType } = req.params;
    const salaryGrades = await SalaryGrade.find({
      fiscalYear: parseInt(fiscalYear),
      budgetType,
      isActive: true
    }).populate('cpscTemplate');
    res.status(200).json({ salaryGrades });
  } catch (err) {
    console.error(`Error fetching active salary grades: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};