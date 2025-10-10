const {
  resolveUserIdentity,
  getClientIp,
  clearIdentityCache,
  __private
} = require('../utils/requestContext');

const { normalizeIp } = __private;

describe('requestContext utilities', () => {
  beforeEach(() => {
    clearIdentityCache();
  });

  test('getClientIp prioritizes forwarded headers', () => {
    const req = {
      headers: {
        'x-forwarded-for': '203.0.113.7, 10.0.0.2'
      },
      connection: {
        remoteAddress: '10.1.1.1'
      },
      ip: '::1'
    };

    expect(getClientIp(req)).toBe('203.0.113.7');
  });

  test('getClientIp normalizes IPv4-mapped IPv6 addresses', () => {
    const req = {
      headers: {},
      connection: {
        remoteAddress: '::ffff:192.168.1.9'
      },
      ip: '::ffff:10.10.10.10'
    };

    expect(getClientIp(req)).toBe('192.168.1.9');
  });

  test('resolveUserIdentity returns payload display name and email when available', async () => {
    const req = {
      user: {
        userId: '416461',
        displayName: 'Budget Officer One',
        email: 'officer.one@example.com'
      },
      headers: {}
    };

    const identity = await resolveUserIdentity({ req });

    expect(identity).toMatchObject({
      userId: '416461',
      displayName: 'Budget Officer One',
      email: 'officer.one@example.com',
      source: 'payload'
    });
  });

  test('resolveUserIdentity uses header-based name when payload lacks display name', async () => {
    const req = {
      user: {
        userId: '512347'
      },
      headers: {
        'x-user-name': 'Officer Two'
      }
    };

    const identity = await resolveUserIdentity({ req });

    expect(identity).toMatchObject({
      userId: '512347',
      displayName: 'Officer Two'
    });
    expect(identity.source).toBe('payload');
  });

  test('normalizeIp trims Forwarded header syntax and port numbers', () => {
    expect(normalizeIp('for="203.0.113.5:443"')).toBe('203.0.113.5');
    expect(normalizeIp('203.0.113.9:8080')).toBe('203.0.113.9');
  });
});
