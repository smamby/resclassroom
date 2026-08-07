const UserStore = require('../store');

jest.mock('../../../db', () => ({ getDb: jest.fn() }));

describe('UserStore', () => {
  let usersCol;

  beforeEach(() => {
    usersCol = {
      findOne: jest.fn(),
      find: jest.fn(() => ({ toArray: jest.fn() })),
      insertOne: jest.fn(),
      findOneAndUpdate: jest.fn(() => ({ value: null })),
      updateOne: jest.fn(() => ({ modifiedCount: 1 })),
      deleteOne: jest.fn(() => ({ deletedCount: 1 }))
    };
    const mockDb = { collection: jest.fn(() => usersCol) };
    require('../../../db').getDb.mockReturnValue(mockDb);
  });

  test('findById strips passwordHash, reset tokens and delete tokens', async () => {
    usersCol.findOne.mockResolvedValue({
      _id: 'abc', name: 'Ana', email: 'a@b.com', passwordHash: 'h',
      resetPasswordToken: 'r', resetPasswordExpires: 1,
      deleteAccountToken: 'd', deleteAccountExpires: 2, passwordVersion: 0
    });
    const result = await new UserStore().findById('abc');
    expect(result.passwordHash).toBeUndefined();
    expect(result.resetPasswordToken).toBeUndefined();
    expect(result.deleteAccountToken).toBeUndefined();
    expect(result.passwordVersion).toBe(0);
  });

  test('findByIdFull returns document including passwordHash', async () => {
    usersCol.findOne.mockResolvedValue({ _id: 'abc', passwordHash: 'h', email: 'a@b.com' });
    const result = await new UserStore().findByIdFull('abc');
    expect(result.passwordHash).toBe('h');
  });

  test('setDeleteToken calls updateOne with token and expires', async () => {
    await new UserStore().setDeleteToken('507f1f77bcf86cd799439011', 'tok', 123456);
    expect(usersCol.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(Object) },
      { $set: { deleteAccountToken: 'tok', deleteAccountExpires: 123456 } }
    );
  });

  test('findByDeleteToken queries by token and future expiry', async () => {
    usersCol.findOne.mockResolvedValue(null);
    await new UserStore().findByDeleteToken('tok');
    expect(usersCol.findOne).toHaveBeenCalledWith({
      deleteAccountToken: 'tok',
      deleteAccountExpires: { $gt: expect.any(Number) }
    });
  });

  test('clearDeleteToken unsets delete tokens', async () => {
    await new UserStore().clearDeleteToken('507f1f77bcf86cd799439011');
    expect(usersCol.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(Object) },
      { $set: { deleteAccountToken: null, deleteAccountExpires: null } }
    );
  });
});
