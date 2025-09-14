/**
 * Script to fix overtime pay data structure for hierarchical access
 * Updates old records to have proper division/department/region structure
 */
const mongoose = require('mongoose');
const OvertimePay = require('./models/overtimePay');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

async function connectToDatabase() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
}

async function checkOvertimeData() {
  console.log('\n🔍 Checking current overtime pay data...');
  
  try {
    // Get all overtime records
    const allRecords = await OvertimePay.find({}).lean();
    console.log(`📊 Total overtime records: ${allRecords.length}`);
    
    // Check records with CENTRAL OFFICE
    const centralOfficeRecords = await OvertimePay.find({
      region: 'CENTRAL OFFICE'
    }).lean();
    console.log(`🏢 Records with "CENTRAL OFFICE": ${centralOfficeRecords.length}`);
    
    // Check records without division
    const noDivisionRecords = await OvertimePay.find({
      $or: [
        { division: { $exists: false } },
        { division: null },
        { division: '' }
      ]
    }).lean();
    console.log(`📝 Records without division: ${noDivisionRecords.length}`);
    
    // Show sample data
    if (allRecords.length > 0) {
      console.log('\n📋 Sample record structure:');
      const sample = allRecords[0];
      console.log({
        employeeFullName: sample.employeeFullName,
        region: sample.region,
        department: sample.department,
        division: sample.division,
        processBy: sample.processBy,
        createdAt: sample.createdAt
      });
    }
    
    return { allRecords, centralOfficeRecords, noDivisionRecords };
  } catch (error) {
    console.error('❌ Error checking data:', error);
    throw error;
  }
}

async function fixOvertimeDataStructure() {
  console.log('\n🔧 Fixing overtime data structure...');
  
  try {
    // Get user assignments to map proper organizational structure
    const assignments = await HierarchicalUserAssignment.find({}).lean();
    console.log(`👥 Found ${assignments.length} user assignments`);
    
    // Update records with CENTRAL OFFICE to proper structure
    const centralOfficeRecords = await OvertimePay.find({
      region: 'CENTRAL OFFICE'
    });
    
    console.log(`🔄 Updating ${centralOfficeRecords.length} records...`);
    
    for (const record of centralOfficeRecords) {
      // Find the user who processed this record
      const processBy = record.processBy;
      const assignment = assignments.find(a => 
        a.userId && a.userId.toString() && 
        (processBy.includes(a.userId.toString()) || 
         processBy.toLowerCase().includes('frances') || // Based on your user
         processBy.toLowerCase().includes('joshua'))
      );
      
      if (assignment) {
        const updateData = {};
        
        // Set region from assignment
        if (assignment.regionId) {
          updateData.region = assignment.regionId.Region || assignment.regionId.regionName || 'REGION I';
        }
        
        // Set department from assignment  
        if (assignment.departmentId) {
          updateData.department = assignment.departmentId.Department || assignment.departmentId.departmentName || 'CORPORATE PLANNING SERVICES';
        }
        
        // Set division from assignment
        if (assignment.divisionName) {
          updateData.division = assignment.divisionName;
        } else if (assignment.assignmentLevel === 'DIVISION') {
          updateData.division = 'MANAGEMENT INFORMATION DIVISION'; // Default based on your setup
        }
        
        await OvertimePay.findByIdAndUpdate(record._id, updateData);
        console.log(`✅ Updated record for ${record.employeeFullName}`);
      } else {
        // Default update for records without matching assignment
        await OvertimePay.findByIdAndUpdate(record._id, {
          region: 'REGION I',
          department: 'CORPORATE PLANNING SERVICES', 
          division: 'MANAGEMENT INFORMATION DIVISION'
        });
        console.log(`✅ Default update for ${record.employeeFullName}`);
      }
    }
    
    console.log('🎉 Data structure update completed!');
  } catch (error) {
    console.error('❌ Error fixing data:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectToDatabase();
    
    // Check current data
    const { centralOfficeRecords } = await checkOvertimeData();
    
    if (centralOfficeRecords.length > 0) {
      console.log('\n❓ Do you want to fix the data structure? (This will update records)');
      console.log('💡 This will change "CENTRAL OFFICE" records to proper hierarchical structure.');
      
      // For now, let's just run the fix
      await fixOvertimeDataStructure();
      
      // Check data after fix
      console.log('\n✅ Checking data after fix...');
      await checkOvertimeData();
    } else {
      console.log('✅ No records need updating!');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
main();