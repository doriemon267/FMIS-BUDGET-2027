/**
 * Restore Hierarchical User Assignments
 * 
 * This script restores the hierarchicaluserassignments collection by:
 * 1. Reading all users from fmis_main.users collection
 * 2. Creating hierarchical assignments based on their roles and organizational data
 * 3. Applying correct workflow roles based on their budget role
 */

require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connections
const MONGODB_MAIN_URL = process.env.MONGODB_MAIN_URL || 'mongodb://127.0.0.1:27017/fmis_main';
const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

// Create separate connections
const mainConnection = mongoose.createConnection(MONGODB_MAIN_URL);
const budgetConnection = mongoose.createConnection(MONGODB_BUDGET_URL);

// User schema for main database
const UserSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  email: String,
  roles: [String],
  role: String,
  budgetRoles: [String],
  primaryRole: String,
  region: String,
  office: String,
  division: String,
  department: String,
  accessScope: String,
  isActive: Boolean
}, { collection: 'users' });

// HierarchicalUserAssignment schema for budget database
const HierarchicalUserAssignmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  email: String,
  userRole: String,
  accessScope: { type: String, required: true },
  assignmentLevel: { type: String, required: true },
  region: String,
  office: String,
  division: String,
  department: String,
  primaryRoles: [String],
  workflowRoles: [String],
  permissions: {
    canCreate: Boolean,
    canEdit: Boolean,
    canApprove: Boolean,
    canView: Boolean,
    canDelete: Boolean
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'hierarchicaluserassignments' });

const User = mainConnection.model('User', UserSchema);
const HierarchicalUserAssignment = budgetConnection.model('HierarchicalUserAssignment', HierarchicalUserAssignmentSchema);

// Helper function to determine workflow roles based on user role
function getWorkflowRoles(userRole, assignmentLevel) {
  const normalizedRole = (userRole || '').toUpperCase().trim();
  
  // Map user roles to workflow roles
  switch (normalizedRole) {
    case 'BUDGET_ANALYST':
    case 'BUDGETANALYST':
    case 'ANALYST':
      // Analysts are creators - division or office level
      return assignmentLevel === 'OFFICE' ? ['officeCreator'] : ['divisionCreator'];
    
    case 'BUDGET_REVIEWER':
    case 'BUDGETREVIEWER':
    case 'REVIEWER':
      // Reviewers approve division submissions
      return ['divisionApprover'];
    
    case 'BUDGET_OFFICER':
    case 'BUDGETOFFICER':
    case 'OFFICER':
      // Officers verify and consolidate
      return ['officeConsolidator', 'officeFinalVerifier'];
    
    case 'BUDGET_MANAGER':
    case 'BUDGETMANAGER':
    case 'MANAGER':
      // Managers are final approvers
      return ['regionFinalVerifier'];
    
    case 'BUDGET_ADMIN':
    case 'BUDGETADMIN':
    case 'ADMIN':
      // Admins have full access
      return ['regionFinalVerifier'];
    
    default:
      // Default for unknown roles - creator
      return assignmentLevel === 'OFFICE' ? ['officeCreator'] : ['divisionCreator'];
  }
}

// Helper function to determine assignment level
function determineAssignmentLevel(user) {
  const scope = (user.accessScope || '').toUpperCase();
  
  if (scope === 'FULL' || scope === 'NATIONAL') return 'FULL';
  if (user.office) return 'OFFICE';
  if (user.division) return 'DIVISION';
  if (user.department) return 'DEPARTMENT';
  if (user.region) return 'REGION';
  
  return 'DIVISION'; // Default
}

// Helper function to get user role
function getUserRole(user) {
  // Priority: primaryRole > role > first budgetRole > first role
  if (user.primaryRole) return user.primaryRole;
  if (user.role) return user.role;
  if (user.budgetRoles && user.budgetRoles.length > 0) return user.budgetRoles[0];
  if (user.roles && user.roles.length > 0) return user.roles[0];
  return 'BUDGET_ANALYST'; // Default
}

async function restoreHierarchicalAssignments() {
  try {
    console.log('🔌 Connecting to databases...');
    await Promise.all([
      mainConnection.asPromise(),
      budgetConnection.asPromise()
    ]);
    console.log('✅ Connected to both databases\n');

    // Get all active users from main database
    console.log('📋 Fetching users from fmis_main...');
    const users = await User.find({ isActive: true });
    console.log(`   Found ${users.length} active users\n`);

    // Clear existing hierarchical assignments
    console.log('🗑️  Clearing existing hierarchical assignments...');
    await HierarchicalUserAssignment.deleteMany({});
    console.log('   Cleared\n');

    // Create hierarchical assignments for each user
    console.log('📝 Creating hierarchical assignments...\n');
    const createdAssignments = [];

    for (const user of users) {
      const assignmentLevel = determineAssignmentLevel(user);
      const userRole = getUserRole(user);
      const workflowRoles = getWorkflowRoles(userRole, assignmentLevel);
      
      const assignment = new HierarchicalUserAssignment({
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        userRole: userRole,
        accessScope: user.accessScope || assignmentLevel,
        assignmentLevel: assignmentLevel,
        region: user.region,
        office: user.office,
        division: user.division,
        department: user.department,
        primaryRoles: user.budgetRoles || user.roles || [userRole],
        workflowRoles: workflowRoles,
        permissions: {
          canCreate: true,
          canEdit: true,
          canApprove: workflowRoles.some(r => r.includes('Approver') || r.includes('Verifier')),
          canView: true,
          canDelete: false
        },
        isActive: true
      });

      await assignment.save();
      createdAssignments.push({
        userName: user.userName,
        userRole: userRole,
        assignmentLevel: assignmentLevel,
        workflowRoles: workflowRoles,
        region: user.region,
        office: user.office,
        division: user.division
      });

      console.log(`   ✅ ${user.userName} (${userRole})`);
      console.log(`      Level: ${assignmentLevel}`);
      console.log(`      Workflow Roles: ${workflowRoles.join(', ')}`);
      console.log(`      Location: ${user.region || '—'} / ${user.office || '—'} / ${user.division || '—'}\n`);
    }

    console.log('\n📊 Restoration Results:');
    console.log('==========================================');
    console.log(`Total users processed: ${users.length}`);
    console.log(`Hierarchical assignments created: ${createdAssignments.length}\n`);

    // Summary by role
    const roleSummary = {};
    createdAssignments.forEach(a => {
      const role = a.userRole;
      if (!roleSummary[role]) {
        roleSummary[role] = { count: 0, levels: {} };
      }
      roleSummary[role].count++;
      roleSummary[role].levels[a.assignmentLevel] = (roleSummary[role].levels[a.assignmentLevel] || 0) + 1;
    });

    console.log('📈 Summary by Role:');
    console.log('==========================================');
    Object.entries(roleSummary).forEach(([role, data]) => {
      console.log(`\n${role}: ${data.count} users`);
      Object.entries(data.levels).forEach(([level, count]) => {
        console.log(`   ${level}: ${count}`);
      });
    });

    console.log('\n\n✅ Hierarchical assignments restored successfully!');

  } catch (error) {
    console.error('❌ Restoration error:', error);
  } finally {
    await mainConnection.close();
    await budgetConnection.close();
    console.log('\n👋 Disconnected from databases');
  }
}

// Run the restoration
restoreHierarchicalAssignments().catch(console.error);
