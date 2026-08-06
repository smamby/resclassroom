const { sign } = require('jsonwebtoken');
const { authenticate, authenticateAdmin } = require('../authMiddleware');
const ROLES = require('../../../common/roles');

const SECRET = process.env.JWT_SECRET || 'change-me-please';

function mockRes() {
  const res = { _status: null, _json: null, _cleared: false };
  res.status = jest.fn((code) => { res._status = code; return res; });
  res.json = jest.fn((body) => { res._json = body; return res; });
  res.clearCookie = jest.fn(() => { res._cleared = true; return res; });
  res.cookie = jest.fn(() => res);
  return res;
}

function cookieFor(payload, expiresIn = '20m') {
  return { headers: { cookie: `tokenAuth=${sign(payload, SECRET, { expiresIn })}` } };
}

describe('authenticateAdmin', () => {
  test('returns 401 when no token present', () => {
    const req = { headers: {} };
    const res = mockRes();
    authenticateAdmin(req, res, jest.fn());
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Admin authentication required');
  });

  test('returns 403 when token belongs to a visitor', () => {
    const req = cookieFor({ userId: 'v1', role: [ROLES.VISITOR], sessionIat: Math.floor(Date.now() / 1000) });
    const res = mockRes();
    authenticateAdmin(req, res, jest.fn());
    expect(res._status).toBe(403);
  });

  test('allows admin token through', () => {
    const req = cookieFor({ userId: 'a1', role: [ROLES.ADMIN], sessionIat: Math.floor(Date.now() / 1000) });
    const res = mockRes();
    const next = jest.fn();
    authenticateAdmin(req, res, next);
    expect(res._status).toBe(null);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('a1');
  });

  test('returns 401 for expired token', () => {
    const expired = sign({ userId: 'a1', role: [ROLES.ADMIN], sessionIat: Math.floor(Date.now() / 1000) }, SECRET, { expiresIn: '-1s' });
    const req = { headers: { cookie: `tokenAuth=${expired}` } };
    const res = mockRes();
    authenticateAdmin(req, res, jest.fn());
    expect(res._status).toBe(401);
  });
});

describe('authenticate', () => {
  test('sets user to null and continues when no token', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(null);
  });

  test('sets user from valid token', () => {
    const req = cookieFor({ userId: 'u1', role: [ROLES.INSTRUCTOR], sessionIat: Math.floor(Date.now() / 1000) });
    const res = mockRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(req.user.id).toBe('u1');
    expect(req.user.role).toEqual([ROLES.INSTRUCTOR]);
    expect(next).toHaveBeenCalled();
  });

  test('responds 401 and clears cookie when session exceeded 40 minutes', () => {
    // sessionIat hace 41 minutos => supera el tope absoluto de sesión
    const sessionIat = Math.floor(Date.now() / 1000) - 41 * 60;
    const req = cookieFor({ userId: 'u1', role: [ROLES.ADMIN], sessionIat }, '5m');
    const res = mockRes();
    authenticate(req, res, jest.fn());
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Session expired');
    expect(res._cleared).toBe(true);
  });

  test('normalizes legacy millisecond sessionIat so absolute cap still applies', () => {
    // Tokens viejos firmaban sessionIat en ms: hace 41 min debe contar como expirado
    const sessionIatMs = Date.now() - 41 * 60 * 1000;
    const req = cookieFor({ userId: 'u1', role: [ROLES.ADMIN], sessionIat: sessionIatMs }, '5m');
    const res = mockRes();
    authenticate(req, res, jest.fn());
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Session expired');
    expect(res._cleared).toBe(true);
  });
});
