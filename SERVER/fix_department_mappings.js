const mongoose = require('mongoose');
const mongoUrl = 'mongodb://172.16.4.98:27017/fmis_budget';

mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  try {
    const db = mongoose.connection.db;
    
    // Get all collections
    const mappings = await db.collection('departmentdivisionmappings').find({}).toArray();
    const departments = await db.collection('departments').find({}).toArray();
    const regions = await db.collection('regions').find({}).toArray();

    // Create lookup maps
    const regionMap = {};
    regions.forEach(r => {
      regionMap[r._id.toString()] = r.Region;
    });

    const deptMap = {};
    departments.forEach(d => {
      deptMap[d._id.toString()] = d.Department;
    });

    console.log('\n=== ANALYZING DEPARTMENT MAPPING ISSUES ===\n');

    // Group mappings by departmentId
    const deptMappings = {};
    const mappingsByDept = {};
    
    mappings.forEach(m => {
      const deptId = m.departmentId.toString();
      const regionId = m.regionId.toString();
      const regionName = regionMap[regionId] || 'UNKNOWN';
      
      if (!deptMappings[deptId]) {
        deptMappings[deptId] = [];
      }
      deptMappings[deptId].push({
        region: regionName,
        regionId: regionId,
        divisions: m.divisions?.length || 0,
        mappingId: m._id
      });

      if (!mappingsByDept[deptId]) {
        mappingsByDept[deptId] = [];
      }
      mappingsByDept[deptId].push(m);
    });

    // Check for issues
    const issues = [];
    const problems = {};

    Object.keys(deptMappings).forEach(deptId => {
      const dept = departments.find(d => d._id.toString() === deptId);
      const mappingList = deptMappings[deptId];
      
      if (mappingList.length > 1) {
        const deptName = dept ? dept.Department : 'UNKNOWN';
        const regions = mappingList.map(m => m.region).join(', ');
        
        console.log(`\n⚠️  "${deptName}" (${deptId})`);
        console.log(`   Mapped to multiple regions: ${regions}`);
        console.log(`   Divisions per region:`);
        
        mappingList.forEach(m => {
          console.log(`     - ${m.region}: ${m.divisions} divisions`);
        });

        issues.push({
          deptId,
          deptName,
          regionCount: mappingList.length,
          regions: mappingList.map(m => m.region),
          shouldFix: true
        });
      }
    });

    console.log('\n\n=== DEPARTMENTS WITHOUT MAPPINGS ===\n');
    let nMappingCount = 0;
    departments.forEach(dept => {
      if (!deptMappings[dept._id.toString()]) {
        nMappingCount++;
        console.log(`${nMappingCount}. "${dept.Department}" (ID: ${dept._id})`);
      }
    });

    console.log('\n\n=== RECOMMENDATION ===\n');
    
    if (issues.length > 0) {
      console.log(`Found ${issues.length} departments with multiple region mappings.\n`);
      console.log('OPTIONS:\n');
      console.log('1. CREATE SEPARATE DEPARTMENTS per region:');
      console.log('   - Create new Department records for each region');
      console.log('   - Update mappings to reference the correct regional department\n');
      
      console.log('2. FIX EXISTING MAPPINGS:');
      console.log('   - Keep one department per name');
      console.log('   - Ensure each mapping has correct regionId\n');

      console.log('\nTo proceed with OPTION 1 (Create separate departments per region):');
      console.log('Run: node create_regional_departments.js\n');
      
      console.log('\nTo proceed with OPTION 2 (Keep existing structure):');
      console.log('Verify all departmentId references in mappings are correct.\n');
    }

    console.log(`\nTotal issues found: ${issues.length}`);
    console.log(`Total departments: ${departments.length}`);
    console.log(`Total mappings: ${mappings.length}`);
    console.log(`Total regions: ${regions.length}`);

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    mongoose.connection.close();
  }
}).catch(err => {
  console.error('Connection failed:', err.message);
});
