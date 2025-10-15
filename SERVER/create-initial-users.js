/**
 * Create Initial Hierarchical User Assignments
 * 
 * This script creates the 4 main budget users with correct workflow roles:
 * - Joshua Demafelez - BUDGET_ANALYST (divisionCreator)
 * - Andrie Barrameda - BUDGET_OFFICER (officeConsolidator, officeFinalVerifier)
 * - Nelson Eloso - BUDGET_COORDINATOR (divisionApprover)
 * - Reymund Edra - BUDGET_MANAGER (regionFinalVerifier)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

const MONGODB_URI = process.env.MONGODB_BUDGET_URL;

// Using CENTRAL OFFICE region and CORPORATE PLANNING SERVICES department
const NCR_REGION_ID = '68be0fba37907a9f5551c935'; // CENTRAL OFFICE
const PLANNING_DEPT_ID = '68be0fba37907a9f5551c93f'; // CORPORATE PLANNING SERVICES

const initialUsers = [
  {
    userId: 'joshua.demafelez',
    userName: 'Joshua Demafelez',
    email: 'joshua.demafelez@dreed.gov.ph',
    userRole: 'BUDGET_ANALYST',
    accessScope: 'DIVISION',
    assignmentLevel: 'DIVISION',
    regionId: NCR_REGION_ID,
    departmentId: PLANNING_DEPT_ID,
    divisionName: 'Budget Division',
    primaryRoles: ['BUDGET_ANALYST'],
    workflowRoles: ['divisionCreator'],
    rolePermissions: {
      CreateProposals: true,
      EditOwnProposals: true,
      EditAllProposals: false,
      DeleteProposals: false,
      ApproveProposals: false,
      canApproveProposals: false,
      ViewReports: true
    },
    isActive: true
  },
  {
    userId: 'andrie.barrameda',
    userName: 'Andrie Barrameda',
    email: 'andrie.barrameda@dreed.gov.ph',
    userRole: 'BUDGET_OFFICER',
    accessScope: 'OFFICE',
    assignmentLevel: 'OFFICE',
    regionId: NCR_REGION_ID,
    departmentId: PLANNING_DEPT_ID,
    divisionName: null,
    primaryRoles: ['BUDGET_OFFICER'],
    workflowRoles: ['officeConsolidator', 'officeFinalVerifier'],
    rolePermissions: {
      CreateProposals: true,
      EditOwnProposals: true,
      EditAllProposals: true,
      DeleteProposals: false,
      ApproveProposals: true,
      canApproveProposals: true,
      ViewReports: true
    },
    isActive: true
  },
  {
    userId: 'nelson.eloso',
    userName: 'Nelson Eloso',
    email: 'nelson.eloso@dreed.gov.ph',
    userRole: 'BUDGET_COORDINATOR',
    accessScope: 'DIVISION',
    assignmentLevel: 'DIVISION',
    regionId: NCR_REGION_ID,
    departmentId: PLANNING_DEPT_ID,
    divisionName: 'Budget Division',
    primaryRoles: ['BUDGET_COORDINATOR'],
    workflowRoles: ['divisionApprover'],
    rolePermissions: {
      CreateProposals: true,
      EditOwnProposals: true,
      EditAllProposals: true,
      DeleteProposals: false,
      ApproveProposals: true,
      canApproveProposals: true,
      ViewReports: true
    },
    isActive: true
  },
  {
    userId: 'reymund.edra',
    userName: 'Reymund Edra',
    email: 'reymund.edra@dreed.gov.ph',
    userRole: 'BUDGET_MANAGER',
    accessScope: 'FULL',
    assignmentLevel: 'FULL',
    regionId: null,
    departmentId: null,
    divisionName: null,
    primaryRoles: ['BUDGET_MANAGER'],
    workflowRoles: ['regionFinalVerifier'],
    rolePermissions: {
      CreateProposals: true,
      EditOwnProposals: true,
      EditAllProposals: true,
      DeleteProposals: true,
      ApproveProposals: true,
      canApproveProposals: true,
      ViewReports: true
    },
    isActive: true
  }
];

async function createInitialUsers() {
  try {
    console.log('🔌 Connecting to MongoDB (BUDGET - fmis_budget)...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing assignments
    console.log('🗑️  Clearing existing hierarchical assignments...');
    const deleteResult = await HierarchicalUserAssignment.deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} existing records\n`);

    // Create new assignments
    console.log('📝 Creating initial user assignments...\n');
    
    for (const userData of initialUsers) {
      const user = new HierarchicalUserAssignment(userData);
      await user.save();
      
      console.log(`✅ ${userData.userName}`);
      console.log(`   User ID: ${userData.userId}`);
      console.log(`   Role: ${userData.userRole}`);
      console.log(`   Level: ${userData.assignmentLevel}`);
      console.log(`   Workflow Roles: ${userData.workflowRoles.join(', ')}`);
      console.log(`   Division: ${userData.divisionName || '—'}`);
      console.log('');
    }

    // Verify creation
    console.log('\n📊 Verification:');
    console.log('==========================================');
    const count = await HierarchicalUserAssignment.countDocuments({ isActive: true });
    console.log(`Total active assignments: ${count}`);
    
    // Show summary by role
    console.log('\n📈 Summary by Role:');
    const analysts = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET_ANALYST', isActive: true });
    const coordinators = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET_COORDINATOR', isActive: true });
    const officers = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET_OFFICER', isActive: true });
    const managers = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET_MANAGER', isActive: true });
    
    console.log(`   BUDGET_ANALYST: ${analysts}`);
    console.log(`   BUDGET_COORDINATOR: ${coordinators}`);
    console.log(`   BUDGET_OFFICER: ${officers}`);
    console.log(`   BUDGET_MANAGER: ${managers}`);

    console.log('\n✅ Initial users created successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
createInitialUsers().catch(console.error);
