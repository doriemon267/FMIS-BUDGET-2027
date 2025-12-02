const request = require('supertest');
const express = require('express');
// Mock requestContext to prevent DB lookups in resolveUserIdentity
jest.mock('../../utils/requestContext', () => ({
  resolveUserIdentity: async () => ({ userId: 'mock-user', displayName: 'Mock User', email: 'mock@example.com' }),
  getClientIp: () => '127.0.0.1'
}));
const { adminRoute } = require('../../middleware/securityMiddleware');

// Setup: a simple express app that exposes a route protected by adminRoute middleware
let app;
beforeAll(() => {
  // Force mock auth ON for tests
  process.env.ALLOW_MOCK_AUTH = 'true';
  process.env.DEBUG_LOGS = 'true';
  app = express();
  app.use(express.json());

  // Test admin-protected route
  app.get('/api/test-admin', ...adminRoute(), (req, res) => {
    return res.status(200).json({ success: true, user: req.user });
  });
});

afterAll(() => {
  // Clean-up env vars
  process.env.ALLOW_MOCK_AUTH = '';
  process.env.DEBUG_LOGS = '';
});

describe('Mock Auth Admin Route Tests', () => {
  test('403 when X-Dev-Roles is missing (default DEVELOPER role)', async () => {
    const res = await request(app)
      .get('/api/test-admin')
      .set('X-Dev-User-Id', '12345');

    expect(res.statusCode).toBe(403);
  });

  test('200 when X-Dev-Roles includes SUPER_ADMIN', async () => {
    const res = await request(app)
      .get('/api/test-admin')
      .set('X-Dev-User-Id', '12345')
      .set('X-Dev-Roles', 'SUPER_ADMIN');

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.user.Roles)).toBeTruthy();
    expect(res.body.user.Roles).toEqual(expect.arrayContaining(['SUPER_ADMIN']));
  });

  test('200 when X-Dev-Roles includes BUDGET_MANAGER (alias -> OVERALL_BUDGET_APPROVER)', async () => {
    const res = await request(app)
      .get('/api/test-admin')
      .set('X-Dev-User-Id', '67890')
      .set('X-Dev-Roles', 'BUDGET_MANAGER');

    expect(res.statusCode).toBe(200);
    expect(res.body.user.Roles).toEqual(expect.arrayContaining(['OVERALL_BUDGET_APPROVER']));
  });
});
