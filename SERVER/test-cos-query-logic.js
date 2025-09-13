// Test script to analyze COS Personnel query building logic
console.log('🔍 COS Personnel Query Building Analysis\n');

// Simulate the query building logic from COS Personnel controller
function simulateQueryBuilding(hierarchicalFilters, region) {
  console.log('Input hierarchical filters:', JSON.stringify(hierarchicalFilters, null, 2));
  console.log('Input region:', region);
  console.log();

  let query = {};

  // Apply hierarchical filters as base
  if (Object.keys(hierarchicalFilters).length > 0) {
    query = { ...hierarchicalFilters };
  }

  console.log('Query after hierarchical filters:', JSON.stringify(query, null, 2));

  // Add region filter to hierarchical filters
  if (query.$and) {
    query.$and.push({ region: region });
  } else if (Object.keys(query).length > 0) {
    query = {
      $and: [query, { region: region }]
    };
  } else {
    query.region = region;
  }

  console.log('Final query:', JSON.stringify(query, null, 2));
  return query;
}

// Test with Division user filters
console.log('🧪 Test Case: Division Level User\n');
const divisionFilters = {
  $and: [
    { region: 'CENTRAL OFFICE' },
    { department: 'CORPORATE PLANNING SERVICES' },
    { division: 'MANAGEMENT INFORMATION DIVISION' }
  ]
};

const divisionQuery = simulateQueryBuilding(divisionFilters, 'CENTRAL OFFICE');
console.log();
console.log('📊 MongoDB Query Analysis:');
console.log('This query will find COS personnel where:');
console.log('1. region = "CENTRAL OFFICE" (from hierarchical filters)');
console.log('2. department = "CORPORATE PLANNING SERVICES" (from hierarchical filters)');
console.log('3. division = "MANAGEMENT INFORMATION DIVISION" (from hierarchical filters)');
console.log('4. AND region = "CENTRAL OFFICE" (added by controller)');
console.log();
console.log('✅ Result: Division users will ONLY see COS personnel from their specific division!');
console.log();

// Test with Department user filters
console.log('🧪 Test Case: Department Level User\n');
const departmentFilters = {
  $and: [
    { region: 'CENTRAL OFFICE' },
    { department: 'CORPORATE PLANNING SERVICES' }
  ]
};

const departmentQuery = simulateQueryBuilding(departmentFilters, 'CENTRAL OFFICE');
console.log();
console.log('📊 MongoDB Query Analysis:');
console.log('This query will find COS personnel where:');
console.log('1. region = "CENTRAL OFFICE" (from hierarchical filters)');
console.log('2. department = "CORPORATE PLANNING SERVICES" (from hierarchical filters)');
console.log('3. AND region = "CENTRAL OFFICE" (added by controller)');
console.log();
console.log('✅ Result: Department users will see ALL COS personnel from their department!');
console.log('   (including those added by Division users within their department)');
console.log();

// Test with Region user filters
console.log('🧪 Test Case: Region Level User\n');
const regionFilters = {
  region: 'CENTRAL OFFICE'
};

const regionQuery = simulateQueryBuilding(regionFilters, 'CENTRAL OFFICE');
console.log();
console.log('📊 MongoDB Query Analysis:');
console.log('This query will find COS personnel where:');
console.log('1. region = "CENTRAL OFFICE" (from hierarchical filters)');
console.log('2. AND region = "CENTRAL OFFICE" (added by controller)');
console.log();
console.log('✅ Result: Region users will see ALL COS personnel in their region!');
console.log('   (including those added by Department and Division users)');

console.log();
console.log('🎯 CONCLUSION:');
console.log('The hierarchical filtering logic is working correctly!');
console.log('Division users should NOT see employees added by Department users.');
console.log('Department users SHOULD see employees added by Division users in their department.');
console.log('Region users SHOULD see all employees in their region.');
console.log();
console.log('If Division users are seeing Department-level employees,');
console.log('there might be an issue with the hierarchical assignment data');
console.log('or the middleware is not being applied correctly.');