const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');

/**
 * Unit test (no server) to validate that userRole is persisted on the model
 * and create/update preserves the provided userRole.
 */
describe('HierarchicalUserAssignment userRole persistence', () => {
  beforeAll(async () => {
    const uri = process.env.MONGODB_BUDGET_URL || 'mongodb://127.0.0.1:27017/fmis_budget_test';
    await mongoose.connect(uri);
    await HierarchicalUserAssignment.deleteMany({ userId: 'test-user-role' });
  });

  afterAll(async () => {
    await HierarchicalUserAssignment.deleteMany({ userId: 'test-user-role' });
    await mongoose.disconnect();
  });

  test('persists BUDGET_COORDINATOR on RC level', async () => {
    const created = await HierarchicalUserAssignment.create({
      userId: 'test-user-role',
      userName: 'Test User',
      email: 'test@user.local',
      userRole: 'BUDGET_COORDINATOR',
      assignmentLevel: 'DIVISION', // RC maps to DIVISION in model
      regionId: new mongoose.Types.ObjectId(),
      departmentId: new mongoose.Types.ObjectId(),
      divisionName: 'TEST-RC',
    });

    expect(created.userRole).toBe('BUDGET_COORDINATOR');

    // Update should not drop userRole
    created.divisionName = 'TEST-RC-2';
    await created.save();

    const reloaded = await HierarchicalUserAssignment.findById(created._id);
    expect(reloaded.userRole).toBe('BUDGET_COORDINATOR');
  });
});
