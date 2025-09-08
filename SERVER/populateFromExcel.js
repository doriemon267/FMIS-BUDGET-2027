console.log('🚀 Starting populateFromExcel.js script...');

const mongoose = require('mongoose');
const XLSX = require('xlsx');

console.log('📦 Loaded dependencies successfully');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Models
const Region = require('./models/Region');
const Department = require('./models/Department');
const DepartmentDivisionMapping = require('./models/OrganizationStructure');

async function parseExcelData() {
  console.log('📊 Parsing Excel data...');
  const workbook = XLSX.readFile('../../HIERAR.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = XLSX.utils.sheet_to_json(worksheet);

  console.log(`📋 Found ${excelData.length} rows in Excel file`);

  const regions = new Map();
  const departments = new Map();
  const mappings = [];

  let currentRegion = null;
  let currentDepartment = null;
  let currentDivision = null; // Track the current division for sections
  let currentDivisions = new Map();

  for (const row of excelData) {
    if (row.REGION) {
      // Save previous department if exists
      if (currentDepartment && currentRegion) {
        mappings.push({
          departmentName: currentDepartment,
          region: currentRegion,
          divisions: currentDivisions
        });
      }
      currentRegion = row.REGION;
      regions.set(currentRegion, currentRegion);
      currentDepartment = null;
      currentDivision = null;
      currentDivisions = new Map();
    }

    if (row.DEPARTMENT && row.DEPARTMENT.trim()) {
      // Save previous department if exists
      if (currentDepartment && currentRegion) {
        mappings.push({
          departmentName: currentDepartment,
          region: currentRegion,
          divisions: currentDivisions
        });
      }
      currentDepartment = row.DEPARTMENT;
      departments.set(currentDepartment, currentDepartment);
      currentDivision = null;
      currentDivisions = new Map();
    }

    if (row.DIVISION && row.DIVISION.trim()) {
      if (!currentDivisions.has(row.DIVISION)) {
        currentDivisions.set(row.DIVISION, new Set());
      }
      currentDivision = row.DIVISION; // Track current division for sections
    }

    // Handle sections
    if (row.SECTION && row.SECTION.trim() && currentDepartment) {
      // If we have a current division from the DIVISION column, use it
      if (currentDivision && currentDivisions.has(currentDivision)) {
        currentDivisions.get(currentDivision).add(row.SECTION);
      }
      // Otherwise, if there's only one division, use that
      else if (currentDivisions.size === 1) {
        const [divName] = currentDivisions.keys();
        currentDivisions.get(divName).add(row.SECTION);
      }
      // If no clear division, create a default one
      else if (currentDivisions.size === 0) {
        const defaultDivision = `${currentDepartment} DIVISION`;
        currentDivisions.set(defaultDivision, new Set([row.SECTION]));
        currentDivision = defaultDivision;
      }
      // If multiple divisions exist but no current division, try to infer from department name
      else {
        // For cases like DIVISION I, DIVISION II, etc., match the section to the correct division
        let matchedDivision = null;
        for (const [divName] of currentDivisions) {
          if (row.DEPARTMENT && divName.includes(row.DEPARTMENT)) {
            matchedDivision = divName;
            break;
          }
        }
        if (matchedDivision) {
          currentDivisions.get(matchedDivision).add(row.SECTION);
        } else {
          // Fallback: add to the first division
          const [firstDiv] = currentDivisions.keys();
          currentDivisions.get(firstDiv).add(row.SECTION);
        }
      }
    }
  }

  // Save the last department
  if (currentDepartment && currentRegion) {
    mappings.push({
      departmentName: currentDepartment,
      region: currentRegion,
      divisions: currentDivisions
    });
  }

  console.log(`✅ Parsed ${regions.size} regions, ${departments.size} departments, ${mappings.length} mappings`);
  return { regions: Array.from(regions.keys()), departments: Array.from(departments.keys()), mappings };
}

async function insertData({ regions, departments, mappings }) {
  try {
    console.log('🧹 Clearing existing data...');
    await DepartmentDivisionMapping.deleteMany({});
    await Department.deleteMany({});
    await Region.deleteMany({});

    // Insert Regions (normalize case)
    const regionDocs = [];
    const regionMap = new Map();
    for (const regionName of regions) {
      const normalizedName = regionName.toUpperCase();
      if (!regionMap.has(normalizedName)) {
        const doc = { Region: normalizedName };
        regionDocs.push(doc);
        regionMap.set(normalizedName, doc);
      }
    }
    if (regionDocs.length > 0) {
      const insertedRegions = await Region.insertMany(regionDocs);
      // Update map with actual _ids
      insertedRegions.forEach(region => {
        regionMap.set(region.Region, region);
      });
      console.log(`✅ Inserted ${regionDocs.length} regions`);
    }

    // Insert Departments
    const departmentDocs = [];
    const departmentMap = new Map();
    for (const deptName of departments) {
      const normalizedName = deptName.toUpperCase();
      if (!departmentMap.has(normalizedName)) {
        const doc = { Department: normalizedName };
        departmentDocs.push(doc);
        departmentMap.set(normalizedName, doc);
      }
    }
    if (departmentDocs.length > 0) {
      const insertedDepartments = await Department.insertMany(departmentDocs);
      // Update map with actual _ids
      insertedDepartments.forEach(dept => {
        departmentMap.set(dept.Department, dept);
      });
      console.log(`✅ Inserted ${departmentDocs.length} departments`);
    }

    // Insert Mappings with sections
    const mappingDocs = [];
    for (const mapping of mappings) {
      const dept = departmentMap.get(mapping.departmentName.toUpperCase());
      const reg = regionMap.get(mapping.region.toUpperCase());
      if (dept && reg) {
        // Convert divisions Map to array with sections
        const divisionsArray = [];
        for (const [divName, sections] of mapping.divisions) {
          divisionsArray.push({
            name: divName,
            code: divName.toUpperCase().replace(/\s+/g, '_'),
            sections: Array.from(sections).map(sectionName => ({
              name: sectionName,
              code: sectionName.toUpperCase().replace(/\s+/g, '_'),
              isActive: true
            })),
            isActive: true
          });
        }

        mappingDocs.push({
          departmentId: dept._id,
          departmentName: mapping.departmentName,
          divisions: divisionsArray,
          hasSubDivisions: divisionsArray.length > 0,
          regionId: reg._id
        });
      } else {
        console.log(`⚠️ Skipping mapping: dept=${mapping.departmentName}, region=${mapping.region}`);
        console.log(`   Found dept: ${!!dept}, reg: ${!!reg}`);
      }
    }
    if (mappingDocs.length > 0) {
      await DepartmentDivisionMapping.insertMany(mappingDocs);
      console.log(`✅ Inserted ${mappingDocs.length} department-division mappings with sections`);
    }

    console.log('🎉 Data insertion complete!');
  } catch (error) {
    console.error('❌ Error inserting data:', error);
  }
}

async function main() {
  console.log('🔄 Starting main execution...');
  await connectDB();
  const data = await parseExcelData();
  console.log('Parsed data:', {
    regions: data.regions.length,
    departments: data.departments.length,
    mappings: data.mappings.length
  });

  // Log sample mapping with sections
  if (data.mappings.length > 0) {
    console.log('Sample mapping:', {
      departmentName: data.mappings[0].departmentName,
      region: data.mappings[0].region,
      divisionsCount: data.mappings[0].divisions.size,
      sampleDivisions: Array.from(data.mappings[0].divisions.keys()).slice(0, 2)
    });
  }

  await insertData(data);
  await mongoose.disconnect();
  console.log('✅ Script completed successfully!');
}

console.log('🎯 Calling main function...');
main().catch(console.error);
