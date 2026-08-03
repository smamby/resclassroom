const AuthController = require('../controller');
const UserStore = require('../../user/store');

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
      role: ['admin'],
      createdAt: new Date(),
      passwordHash: 'secret-hash'
    });
    const req = { user: { id: 'abc' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.me(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.email).toBe('ana@mail.com');
    expect(body.role).toEqual(['admin']);
    expect(body.passwordHash).toBeUndefined();
  });
});
