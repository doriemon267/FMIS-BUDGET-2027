/**
 * Script to add missing submission workflow fields to Employee Benefits models
 */
const fs = require('fs');
const path = require('path');

const modelsToUpdate = [
  'mealAllowance.js',
  'medicalAllowance.js', 
  'childrenAllowance.js',
  'subsistenceAllowanceST.js',
  'subsistenceAllowanceMDS.js'
];

const submissionWorkflowFields = `    // Submission workflow fields
    status: { type: String, default: 'Not Submitted' },
    originalLevel: { type: String }, // DIVISION, DEPARTMENT, or REGION`;

async function addSubmissionWorkflowFields() {
  console.log('🔧 Adding submission workflow fields to Employee Benefits models...\n');
  
  for (const modelFile of modelsToUpdate) {
    const modelPath = path.join(__dirname, 'models', modelFile);
    
    try {
      if (fs.existsSync(modelPath)) {
        let content = fs.readFileSync(modelPath, 'utf8');
        
        // Check if submission workflow fields already exist
        if (content.includes('Submission workflow fields') || content.includes('originalLevel')) {
          console.log(`✅ ${modelFile}: Already has submission workflow fields`);
          continue;
        }
        
        // Find the location to insert fields (before budgetType or timestamps)
        let insertPosition = -1;
        
        // Try to find budgetType field
        const budgetTypeMatch = content.match(/budgetType:\s*\{[^}]*\},?\s*$/m);
        if (budgetTypeMatch) {
          insertPosition = content.indexOf(budgetTypeMatch[0]) + budgetTypeMatch[0].length;
        } else {
          // Try to find the closing of the schema object
          const schemaEndMatch = content.match(/\s*}\s*,\s*{\s*timestamps:/);
          if (schemaEndMatch) {
            insertPosition = content.indexOf(schemaEndMatch[0]);
          }
        }
        
        if (insertPosition > -1) {
          // Insert submission workflow fields
          const newContent = content.slice(0, insertPosition) + 
            ',\n' + submissionWorkflowFields + '\n' + 
            content.slice(insertPosition);
          
          // Write back to file
          fs.writeFileSync(modelPath, newContent, 'utf8');
          console.log(`✅ ${modelFile}: Added submission workflow fields`);
        } else {
          console.log(`⚠️  ${modelFile}: Could not find insertion point`);
        }
        
      } else {
        console.log(`❌ ${modelFile}: File not found`);
      }
    } catch (error) {
      console.error(`❌ ${modelFile}: Error -`, error.message);
    }
  }
  
  console.log('\n🎉 Finished adding submission workflow fields!');
}

// Run the script
if (require.main === module) {
  addSubmissionWorkflowFields();
}

module.exports = { addSubmissionWorkflowFields };