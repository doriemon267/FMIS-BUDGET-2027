/**
 * Fix accessScope field for all users
 * 
 * The accessScope should match assignmentLevel:
 * - DIVISION (old) → RESPONSIBILITY_CENTER (new)
 * - DEPARTMENT (old) → OFFICE (new)
 * - FULL → FULL
 */

require('dotenv').config();
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

const MONGODB_URI = process.env.MONGODB_BUDGET_URL;

async function fixAccessScope() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const assignments = await HierarchicalUserAssignment.find({ isActive: true });
    
    console.log('📋 Fixing accessScope for all users...\n');
    
    for (const assignment of assignments) {
      const oldAccessScope = assignment.accessScope;
      let newAccessScope;
      
      // Map assignmentLevel to accessScope
      if (assignment.assignmentLevel === 'DIVISION') {
        newAccessScope = 'RESPONSIBILITY_CENTER';
      } else if (assignment.assignmentLevel === 'DEPARTMENT') {
        newAccessScope = 'OFFICE';
      } else if (assignment.assignmentLevel === 'FULL') {
        newAccessScope = 'FULL';
      } else {
        newAccessScope = assignment.assignmentLevel; // Already correct
      }
      
      if (oldAccessScope !== newAccessScope) {
        assignment.accessScope = newAccessScope;
        await assignment.save();
        
        console.log(`✅ ${assignment.userName}`);
        console.log(`   Old accessScope: ${oldAccessScope || 'undefined'}`);
        console.log(`   New accessScope: ${newAccessScope}`);
        console.log('');
      } else {
        console.log(`⏭️  ${assignment.userName} - accessScope already correct (${newAccessScope})\n`);
      }
    }

    console.log('\n✅ All accessScope fields fixed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixAccessScope().catch(console.error);
