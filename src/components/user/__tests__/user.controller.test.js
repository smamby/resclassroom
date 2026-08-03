const UserController = require('../controller');
const UserStore = require('../store');

jest.mock('../store');

describe('UserController.getUserByEmail', () => {
  let controller;
  beforeEach(() => {
    controller = new UserController();
    jest.clearAllMocks();
  });

  test('returns 404 when user not found', async () => {
    UserStore.prototype.findByEmail.mockResolvedValue(null);
    const req = { params: { email: 'nadie@mail.com' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.getUserByEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('does not expose passwordHash nor reset tokens', async () => {
    UserStore.prototype.findByEmail.mockResolvedValue({
      _id: 'abc',
      name: 'Ana',
      surname: 'Gomez',
      email: 'ana@mail.com',
      role: 'visitor',
      passwordHash: 'secret-hash',
      resetPasswordToken: 'reset-token',
      resetPasswordExpires: new Date()
    });
    const req = { params: { email: 'ana@mail.com' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.getUserByEmail(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.email).toBe('ana@mail.com');
    expect(body.passwordHash).toBeUndefined();
    expect(body.resetPasswordToken).toBeUndefined();
    expect(body.resetPasswordExpires).toBeUndefined();
  });
});

describe('UserController.createUser', () => {
  let controller;
  beforeEach(() => {
    controller = new UserController();
    jest.clearAllMocks();
  });

  test('creates user with provided role (admin flow)', async () => {
    UserStore.prototype.create.mockResolvedValue({
      _id: 'abc',
      name: 'Ana',
      surname: 'Gomez',
      email: 'ana@mail.com',
      role: ['instructor']
    });
    const req = {
      body: { name: 'Ana', surname: 'Gomez', email: 'ana@mail.com', role: ['instructor'] }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.createUser(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].role).toEqual(['instructor']);
  });
});
