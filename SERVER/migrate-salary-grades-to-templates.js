const mongoose = require('mongoose');
const path = require('path');

// Adjust require paths for the SERVER directory
const SalaryGrade = require('./models/SalarySelection');
const CPSCTemplate = require('./models/CPSCTemplate');

/**
 * Migration script to link existing salary grades to CPSC templates
 * This script assumes existing salary data should be linked to CPSC 1 template
 */

const migrateSalaryGradesToTemplates = async () => {
  try {
    console.log('Starting salary grade migration to CPSC templates...');

    // Get all existing salary grades
    const existingSalaryGrades = await SalaryGrade.find({});
    console.log(`Found ${existingSalaryGrades.length} existing salary grades`);

    if (existingSalaryGrades.length === 0) {
      console.log('No existing salary grades found. Migration complete.');
      return;
    }

    // Group salary grades by fiscal year and budget type
    // Since existing data doesn't have these fields, we'll need to determine them
    // For now, we'll create a default CPSC 1 template for current fiscal year and Initial budget type
    const currentYear = new Date().getFullYear();
    const defaultBudgetType = 'Initial';

    // Check if default template already exists
    let defaultTemplate = await CPSCTemplate.findOne({
      templateName: 'CPSC 1',
      fiscalYear: currentYear,
      budgetType: defaultBudgetType
    });

    if (!defaultTemplate) {
      // Create default CPSC 1 template
      defaultTemplate = new CPSCTemplate({
        templateName: 'CPSC 1',
        templateCode: 'CPSC1',
        fiscalYear: currentYear,
        budgetType: defaultBudgetType,
        description: 'Default CPSC 1 template for existing salary data',
        createdBy: 'system_migration'
      });

      await defaultTemplate.save();
      console.log('Created default CPSC 1 template');
    } else {
      console.log('Default CPSC 1 template already exists');
    }

    // Update all existing salary grades to link to the default template
    const updateResult = await SalaryGrade.updateMany(
      { cpscTemplate: { $exists: false } }, // Only update grades that don't have a template yet
      {
        $set: {
          cpscTemplate: defaultTemplate._id,
          templateName: 'CPSC 1',
          fiscalYear: currentYear,
          budgetType: defaultBudgetType,
          isActive: true,
          createdBy: 'system_migration',
          updatedAt: new Date()
        }
      }
    );

    console.log(`Updated ${updateResult.modifiedCount} salary grades with template information`);

    // Add all salary grades to the template's salaryGrades array
    const allGrades = await SalaryGrade.find({ cpscTemplate: defaultTemplate._id });
    const gradeIds = allGrades.map(grade => grade._id);

    await CPSCTemplate.findByIdAndUpdate(
      defaultTemplate._id,
      {
        $addToSet: { salaryGrades: { $each: gradeIds } },
        updatedAt: new Date()
      }
    );

    console.log(`Added ${gradeIds.length} salary grades to template's salaryGrades array`);

    // Verify migration
    const templateWithGrades = await CPSCTemplate.findById(defaultTemplate._id).populate('salaryGrades');
    console.log(`Migration verification: Template has ${templateWithGrades.salaryGrades.length} salary grades`);

    console.log('Salary grade migration to CPSC templates completed successfully!');

  } catch (error) {
    console.error('Error during salary grade migration:', error);
    throw error;
  }
};

// Run migration if this script is executed directly
if (require.main === module) {
  // Connect to MongoDB
  const dbUrl = process.env.MONGODB_BUDGET_URL || 'mongodb://localhost:27017/fmis_budget';

  mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    return migrateSalaryGradesToTemplates();
  })
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    mongoose.connection.close();
  });
}

module.exports = { migrateSalaryGradesToTemplates };