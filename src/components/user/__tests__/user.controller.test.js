const UserController = require('../controller');
const UserStore = require('../store');
const ROLES = require('../../../../common/roles');

jest.mock('../store');
jest.mock('../../bookings/store');
jest.mock('../../reset-password/emailService');

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
      role: ROLES.VISITOR,
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
      role: [ROLES.INSTRUCTOR]
    });
    const req = {
      body: { name: 'Ana', surname: 'Gomez', email: 'ana@mail.com', role: [ROLES.INSTRUCTOR] }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.createUser(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].role).toEqual([ROLES.INSTRUCTOR]);
  });
});

const bcrypt = require('bcryptjs');

describe('UserController.updateMyProfile', () => {
  let controller;
  beforeEach(() => {
    controller = new UserController();
    jest.clearAllMocks();
  });

  test('rejects email and other non-permitted fields', async () => {
    const req = { user: { id: 'u1' }, body: { name: 'Ana', surname: 'Gomez', email: 'x@y.com' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.updateMyProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('Campo no permitido: email');
  });

  test('requires name and surname', async () => {
    const req = { user: { id: 'u1' }, body: { name: '', surname: '' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.updateMyProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updates only trimmed name and surname', async () => {
    UserStore.prototype.update.mockResolvedValue({ _id: 'u1', name: 'Ana', surname: 'Nuevo', email: 'a@b.com' });
    const req = { user: { id: 'u1' }, body: { name: '  Ana ', surname: 'Nuevo' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.updateMyProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const updateArg = UserStore.prototype.update.mock.calls[0][1];
    expect(updateArg.name).toBe('Ana');
    expect(updateArg.surname).toBe('Nuevo');
  });
});

describe('UserController.changeMyPassword', () => {
  let controller;
  beforeEach(() => {
    controller = new UserController();
    jest.clearAllMocks();
  });

  test('rejects missing fields', async () => {
    const req = { user: { id: 'u1' }, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.changeMyPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 401 on wrong current password', async () => {
    const hash = bcrypt.hashSync('actual', 10);
    UserStore.prototype.findByIdFull.mockResolvedValue({ _id: 'u1', passwordHash: hash, role: [ROLES.VISITOR] });
    const req = { user: { id: 'u1' }, body: { currentPassword: 'incorrecta', newPassword: 'nueva' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.changeMyPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error).toBe('Contraseña actual incorrecta');
  });

  test('updates hash, increments passwordVersion and re-issues cookie', async () => {
    const hash = bcrypt.hashSync('actual', 10);
    UserStore.prototype.findByIdFull.mockResolvedValue({ _id: 'u1', passwordHash: hash, role: [ROLES.INSTRUCTOR], passwordVersion: 2 });
    UserStore.prototype.update.mockResolvedValue({ _id: 'u1', role: [ROLES.INSTRUCTOR], passwordVersion: 3 });
    UserStore.prototype.findById.mockResolvedValue({ _id: 'u1', name: 'Ana', role: [ROLES.INSTRUCTOR], passwordVersion: 3 });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), cookie: jest.fn() };
    const req = { user: { id: 'u1' }, body: { currentPassword: 'actual', newPassword: 'nueva' } };
    await controller.changeMyPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const updateArg = UserStore.prototype.update.mock.calls[0][1];
    expect(updateArg.passwordVersion).toBe(3);
    expect(updateArg.passwordHash).toEqual(expect.any(String));
    expect(res.cookie).toHaveBeenCalledWith('tokenAuth', expect.any(String), expect.any(Object));
  });
});
