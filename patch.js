const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'SERVER', 'controllers');

const updates = [
  {
    file: 'childrenAllowanceController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'],
    numberFields: ['noOfDependents', 'amount'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region']
  },
  {
    file: 'employeeCourtAppearanceController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'],
    numberFields: ['daysPresent', 'rate', 'amount'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region']
  },
  {
    file: 'loyaltyPayController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region', 'milestoneYear'],
    numberFields: ['amount', 'yearsOfService'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region', 'milestoneYear']
  },
  {
    file: 'mealAllowanceController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'],
    numberFields: ['daysPresent', 'amount'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region']
  },
  {
    file: 'medicalAllowanceController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'],
    numberFields: ['amount'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region']
  },
  {
    file: 'overtimePayController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region', 'processBy'],
    numberFields: ['weekdayHours', 'weekendHours', 'monthlySalary', 'amount'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeFullName', 'positionTitle', 'processBy', 'fiscalYear', 'employeeNumber', 'department']
  },
  {
    file: 'subsistenceAllowanceController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'],
    numberFields: ['daysPresent', 'amount'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region']
  },
  {
    file: 'subsistenceAllowanceMDSController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'],
    numberFields: ['daysPresent', 'amount'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region']
  },
  {
    file: 'subsistenceAllowanceSTController.js',
    textFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'],
    numberFields: ['daysPresent', 'amount'],
    dateFields: ['processDate', 'createdAt', 'updatedAt'],
    searchFields: ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region']
  }
];

updates.forEach(config => {
  const filePath = path.join(controllersDir, config.file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Inject require if not exists
  if (!content.includes('applyTableFilters')) {
    content = `const { applyTableFilters } = require('../utils/controller_get_process');\n` + content;
  }

  // Find the if (search) { ... } block
  let startIndex = content.indexOf('if (search) {');
  if (startIndex === -1) {
    startIndex = content.indexOf('if(search) {');
  }
  
  if (startIndex !== -1) {
    let braceCount = 0;
    let endIndex = -1;
    let started = false;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        started = true;
      } else if (content[i] === '}') {
        braceCount--;
      }
      
      if (started && braceCount === 0) {
        endIndex = i;
        break;
      }
    }
    
    if (endIndex !== -1) {
      // In overtimePayController, there is an extra `const n = ...` after the search if, wait, it's inside the if(search) block!
      // So replacing the whole if (search) block is perfectly safe and handles it all.
      
      const replacement = `
    // Apply dynamic table filters
    applyTableFilters(
      query, 
      req.query, 
      ${JSON.stringify(config.textFields)}, 
      ${JSON.stringify(config.numberFields)}, 
      ${JSON.stringify(config.dateFields)}, 
      ${JSON.stringify(config.searchFields)}
    );
      `;
      
      content = content.substring(0, startIndex) + replacement + content.substring(endIndex + 1);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Patched ${config.file}`);
    } else {
      console.log(`Could not find end of if(search) in ${config.file}`);
    }
  } else {
    console.log(`Could not find if(search) in ${config.file}`);
  }
});
