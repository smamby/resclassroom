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
const BookingStore = require('../../bookings/store');
const EmailService = require('../../reset-password/emailService');

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

describe('UserController.deleteMyAccount', () => {
  let controller;
  beforeEach(() => {
    controller = new UserController();
    jest.clearAllMocks();
  });

  test('returns 401 on wrong password', async () => {
    const hash = bcrypt.hashSync('actual', 10);
    UserStore.prototype.findByIdFull.mockResolvedValue({ _id: 'u1', email: 'a@b.com', passwordHash: hash });
    const req = { user: { id: 'u1' }, body: { password: 'incorrecta' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteMyAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('creates token, sends email and reports active bookings', async () => {
    const hash = bcrypt.hashSync('actual', 10);
    UserStore.prototype.findByIdFull.mockResolvedValue({ _id: 'u1', email: 'a@b.com', passwordHash: hash });
    BookingStore.prototype.findActiveByUser.mockResolvedValue([{ _id: 'b1' }, { _id: 'b2' }]);
    EmailService.prototype.sendDeleteAccountEmail.mockResolvedValue({ messageId: 'x' });
    const req = { user: { id: 'u1' }, body: { password: 'actual' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteMyAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.activeBookings).toBe(2);
    expect(body.message).toContain('correo');
    expect(UserStore.prototype.setDeleteToken).toHaveBeenCalled();
    expect(EmailService.prototype.sendDeleteAccountEmail).toHaveBeenCalledWith('a@b.com', expect.stringContaining('/delete-account/'));
  });

  test('returns 500 and clears token when email fails', async () => {
    const hash = bcrypt.hashSync('actual', 10);
    UserStore.prototype.findByIdFull.mockResolvedValue({ _id: 'u1', email: 'a@b.com', passwordHash: hash });
    EmailService.prototype.sendDeleteAccountEmail.mockRejectedValue(new Error('smtp down'));
    const req = { user: { id: 'u1' }, body: { password: 'actual' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteMyAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(UserStore.prototype.clearDeleteToken).toHaveBeenCalled();
  });
});

describe('UserController.cancelDeleteAccount', () => {
  test('clears delete token', async () => {
    const controller = new UserController();
    const req = { user: { id: 'u1' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.cancelDeleteAccount(req, res);
    expect(UserStore.prototype.clearDeleteToken).toHaveBeenCalledWith('u1');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('UserController.deleteAccountByToken', () => {
  let controller;
  beforeEach(() => {
    controller = new UserController();
    jest.clearAllMocks();
  });

  test('returns 400 for invalid or expired token', async () => {
    UserStore.prototype.findByDeleteToken.mockResolvedValue(null);
    const req = { params: { token: 'bad' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), clearCookie: jest.fn() };
    await controller.deleteAccountByToken(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('soft-deletes bookings, deletes user and clears cookie', async () => {
    UserStore.prototype.findByDeleteToken.mockResolvedValue({ _id: 'u1' });
    BookingStore.prototype.softDeleteActiveByUser.mockResolvedValue(2);
    UserStore.prototype.delete.mockResolvedValue(true);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), clearCookie: jest.fn() };
    const req = { params: { token: 'valid-token' } };
    await controller.deleteAccountByToken(req, res);
    expect(BookingStore.prototype.softDeleteActiveByUser).toHaveBeenCalledWith('u1');
    expect(UserStore.prototype.delete).toHaveBeenCalledWith('u1');
    expect(res.clearCookie).toHaveBeenCalledWith('tokenAuth');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('UserController /me endpoints require authentication', () => {
  let controller;
  beforeEach(() => {
    controller = new UserController();
    jest.clearAllMocks();
  });

  test('updateMyProfile returns 401 when req.user is null', async () => {
    const req = { user: null, body: { name: 'Ana', surname: 'Gomez' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.updateMyProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('changeMyPassword returns 401 when req.user is null', async () => {
    const req = { user: null, body: { currentPassword: 'a', newPassword: 'b' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.changeMyPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('deleteMyAccount returns 401 when req.user is null', async () => {
    const req = { user: null, body: { password: 'a' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteMyAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('cancelDeleteAccount returns 401 when req.user is null', async () => {
    const req = { user: null, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.cancelDeleteAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('UserController.updateUser email immutability', () => {
  test('owner update strips email from updates', async () => {
    const controller = new UserController();
    UserStore.prototype.update.mockResolvedValue({ _id: 'u1', name: 'Ana', surname: 'Gomez', email: 'old@mail.com' });
    const req = {
      user: { id: 'u1', role: [ROLES.VISITOR] },
      params: { id: 'u1' },
      body: { name: 'Ana', surname: 'Gomez', email: 'new@mail.com' }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.updateUser(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const updateArg = UserStore.prototype.update.mock.calls[0][1];
    expect(updateArg).not.toHaveProperty('email');
  });
});
