/**
 * Create Initial Hierarchical User Assignments
 * 
 * This script creates the 4 main budget users with 6-step workflow roles:
 * - Joshua Demafelez - BUDGET_PLANNING_ANALYST (STEP 4 - divisionCreator)
 * - Andrie Barrameda - BUDGET_OFFICER (STEP 5 - officeConsolidator, officeFinalVerifier)
 * - Nelson Eloso - BUDGET REVIEWER (STEP 2 - divisionReviewer)
 * - Reymund Edra - OVERALL_BUDGET_APPROVER (STEP 6 - regionFinalVerifier)
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
    userRole: 'BUDGET_PLANNING_ANALYST',
    accessScope: 'DIVISION',
    assignmentLevel: 'DIVISION',
    regionId: NCR_REGION_ID,
    departmentId: PLANNING_DEPT_ID,
    divisionName: 'Budget Division',
    primaryRoles: ['BUDGET_PLANNING_ANALYST'],
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
    userRole: 'BUDGET REVIEWER',
    accessScope: 'DIVISION',
    assignmentLevel: 'DIVISION',
    regionId: NCR_REGION_ID,
    departmentId: PLANNING_DEPT_ID,
    divisionName: 'Budget Division',
    primaryRoles: ['BUDGET REVIEWER'],
    workflowRoles: ['divisionReviewer'],
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
    userRole: 'OVERALL_BUDGET_APPROVER',
    accessScope: 'FULL',
    assignmentLevel: 'FULL',
    regionId: null,
    departmentId: null,
    divisionName: null,
    primaryRoles: ['OVERALL_BUDGET_APPROVER'],
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
    
    // Show summary by 6-step workflow roles
    console.log('\n📈 Summary by 6-Step Workflow Role:');
    const preparers = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET PREPARER', isActive: true });
    const reviewers = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET REVIEWER', isActive: true });
    const approvers = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET APPROVER', isActive: true });
    const analysts = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET_PLANNING_ANALYST', isActive: true });
    const officers = await HierarchicalUserAssignment.countDocuments({ userRole: 'BUDGET_OFFICER', isActive: true });
    const approversOverall = await HierarchicalUserAssignment.countDocuments({ userRole: 'OVERALL_BUDGET_APPROVER', isActive: true });
    
    console.log(`   STEP 1 - PREPARER: ${preparers}`);
    console.log(`   STEP 2 - BUDGET REVIEWER: ${reviewers}`);
    console.log(`   STEP 3 - BUDGET APPROVER: ${approvers}`);
    console.log(`   STEP 4 - BUDGET_PLANNING_ANALYST: ${analysts}`);
    console.log(`   STEP 5 - BUDGET_OFFICER: ${officers}`);
    console.log(`   STEP 6 - OVERALL_BUDGET_APPROVER: ${approversOverall}`);

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
