const ROLES = require('../../../../common/roles');
const BookingController = require('../controller');

jest.mock('../store', () => {
  return jest.fn(() => ({
    findAll: jest.fn(async () => []),
    findById: jest.fn(async () => null),
    findByWorkspace: jest.fn(async () => []),
    findByWorkspaceAll: jest.fn(async () => []),
    create: jest.fn(async (b) => ({ ...b, _id: 'b1' })),
    update: jest.fn(async () => ({ value: {} })),
    delete: jest.fn(async () => true)
  }));
});
jest.mock('../../user/store', () => jest.fn(() => ({})));

describe('BookingController visibility', () => {
  let ctrl;
  beforeEach(() => {
    const Store = require('../store');
    Store.mockClear();
    Store.mockImplementation(() => ({
      findAll: jest.fn(async () => [
        { _id: 'b1', status: 'confirmed', workspaceId: 'w1', startDate: '2026-08-04', endDate: '2026-08-04', startTime: '19:00', endTime: '22:00', days: [2] },
        { _id: 'b2', status: 'pending', workspaceId: 'w1', startDate: '2026-08-06', endDate: '2026-08-06', startTime: '19:00', endTime: '22:00', days: [4] }
      ])
    }));
    ctrl = new BookingController();
  });

  function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  test('visitante (req.user null) no ve bookings pending', async () => {
    const res = makeRes();
    await ctrl.getAllBookings({ user: null, query: {} }, res);
    expect(res.json.mock.calls[0][0].map(b => b._id)).toEqual(['b1']);
  });

  test('instructor logueado sí ve pending', async () => {
    const res = makeRes();
    await ctrl.getAllBookings({ user: { id: 'i1', role: [ROLES.INSTRUCTOR] }, query: {} }, res);
    expect(res.json.mock.calls[0][0].map(b => b._id)).toEqual(['b1', 'b2']);
  });
});
