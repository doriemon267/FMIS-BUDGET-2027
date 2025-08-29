const SalaryGrade = require('../models/SalarySelection');

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
    console.log(`Fetching job grades for salary grade: ${salary_grade}`); // Logging
    const grade = await SalaryGrade.findOne({ salary_grade });
    if (!grade) {
      console.error(`Salary Grade not found: ${salary_grade}`); // Logging
      return res.status(404).json({ error: 'Salary Grade not found' });
    }

    console.log(`Found job grade: ${grade.job_grade}`); // Logging
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
    console.log(`Fetching steps for job grade: ${job_grade}`); // Logging
    const grade = await SalaryGrade.findOne({ job_grade });
    if (!grade) {
      console.error(`Job Grade not found: ${job_grade}`); // Logging
      return res.status(404).json({ error: 'Job Grade not found' });
    }

    console.log(`Found steps: ${grade.steps}`); // Logging
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
    console.log(`Fetching rate for job grade: ${job_grade}, step: ${step}`); // Logging
    const grade = await SalaryGrade.findOne({ job_grade });
    if (!grade) {
      console.error(`Job Grade not found: ${job_grade}`); // Logging
      return res.status(404).json({ error: 'Job Grade not found' });
    }

    const rate = grade.rates.get(step);
    console.log(`Found rate: ${rate}`); // Logging
    res.json({ rate });
  } catch (err) {
    console.error(`Error fetching rate: ${err.message}`); // Logging
    res.status(500).json({ error: err.message });
  }
};
// Create Rate based on Job Grade
// Get Rate based on Job Grade and Step
exports.getRateByJobGradeAndStep = async (req, res) => {
  try {
    const { job_grade, step } = req.params;
    console.log(`Fetching rate for job grade: ${job_grade}, step: ${step}`); // Logging

    const grade = await SalaryGrade.findOne({ job_grade });
    if (!grade) {
      console.error(`Job Grade not found: ${job_grade}`); // Logging
      return res.status(404).json({ error: 'Job Grade not found' });
    }

    const rate = grade.rates.get(step);
    if (!rate) {
      console.error(`Rate not found for job grade: ${job_grade}, step: ${step}`); // Logging
      return res.status(404).json({ error: 'Rate not found for this step' });
    }

    console.log(`Found rate: ${rate}`); // Logging
    res.json({ rate });
  } catch (err) {
    console.error(`Error fetching rate: ${err.message}`); // Logging
    res.status(500).json({ error: err.message });
  }
};
