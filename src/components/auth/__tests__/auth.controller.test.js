const AuthController = require('../controller');
const UserStore = require('../../user/store');
const ROLES = require('../../../../common/roles');

jest.mock('../../user/store');

describe('AuthController.me', () => {
  let controller;
  beforeEach(() => {
    controller = new AuthController();
    jest.clearAllMocks();
  });

  test('returns 401 without req.user', async () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.me(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  test('returns 401 when user not found', async () => {
    UserStore.prototype.findById.mockResolvedValue(null);
    const req = { user: { id: 'abc' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.me(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns sanitized user with role array on success', async () => {
    UserStore.prototype.findById.mockResolvedValue({
      _id: 'abc',
      name: 'Ana',
      surname: 'Gomez',
      email: 'ana@mail.com',
      role: [ROLES.ADMIN],
      createdAt: new Date(),
      passwordHash: 'secret-hash'
    });
    const req = { user: { id: 'abc' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.me(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.email).toBe('ana@mail.com');
    expect(body.role).toEqual([ROLES.ADMIN]);
    expect(body.passwordHash).toBeUndefined();
  });
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SECRET = require('../../../../common/jwtSecret');

describe('AuthController.login', () => {
  let controller;
  beforeEach(() => {
    controller = new AuthController();
    jest.clearAllMocks();
  });

  test('signs token with current passwordVersion as pwdv', async () => {
    const passwordHash = bcrypt.hashSync('pass123', 10);
    UserStore.prototype.findByEmail.mockResolvedValue({
      _id: 'u1', name: 'Ana', surname: 'Gomez', email: 'ana@mail.com',
      role: [ROLES.INSTRUCTOR], passwordHash, passwordVersion: 3, createdAt: new Date()
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), cookie: jest.fn() };
    await controller.login({ body: { email: 'ana@mail.com', password: 'pass123' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const token = res.cookie.mock.calls[0][1];
    const payload = jwt.verify(token, SECRET);
    expect(payload.pwdv).toBe(3);
  });

  test('returns 401 on wrong password', async () => {
    const passwordHash = bcrypt.hashSync('pass123', 10);
    UserStore.prototype.findByEmail.mockResolvedValue({
      _id: 'u1', email: 'ana@mail.com', passwordHash, role: [ROLES.VISITOR]
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.login({ body: { email: 'ana@mail.com', password: 'wrong' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('AuthController.logout', () => {
  let controller;
  beforeEach(() => {
    controller = new AuthController();
    jest.clearAllMocks();
  });

  test('increments tokenVersion from a valid token and clears cookie', async () => {
    const token = jwt.sign(
      { userId: 'u9', role: [ROLES.INSTRUCTOR], sessionIat: Math.floor(Date.now() / 1000), pwdv: 0, tv: 0 },
      SECRET,
      { expiresIn: '20m' }
    );
    const req = { headers: { cookie: `tokenAuth=${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), clearCookie: jest.fn() };
    await controller.logout(req, res);
    expect(UserStore.prototype.incrementTokenVersion).toHaveBeenCalledWith('u9');
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('does not increment tokenVersion when token is invalid but still clears cookie', async () => {
    const req = { headers: { cookie: 'tokenAuth=not-a-jwt' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), clearCookie: jest.fn() };
    await controller.logout(req, res);
    expect(UserStore.prototype.incrementTokenVersion).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
