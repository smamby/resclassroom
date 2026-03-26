const BookingController = require('../controller');
jest.mock('../../db', () => ({
  getDb: jest.fn()
}));

describe('BookingController create flow', () => {
  let controller;
  let mockDbInstance;
  let mockData;
  beforeEach(() => {
    mockData = { bookings: [], workspaces: [{ _id: 'w1', name: 'WS1' }] };
    const bookingsCol = {
      insertOne: async (doc) => { doc._id = 'b1'; mockData.bookings.push(doc); return { insertedId: doc._id }; },
      findOne: async (f) => mockData.bookings.find(b => b._id === f._id || b.id === f.id),
      findAll: async () => mockData.bookings,
      find: (f) => ({ toArray: async () => mockData.bookings.filter(b => (f.workspaceId ? b.workspaceId === f.workspaceId : true) && (f.date ? b.date === f.date : true)) }),
      findOneAndUpdate: async (f, u) => {
        const idx = mockData.bookings.findIndex(b => b._id === f._id || b.id === f.id);
        if (idx >= 0) {
          Object.assign(mockData.bookings[idx], u.$set);
          return { value: mockData.bookings[idx] };
        }
        return { value: null };
      },
      deleteOne: async (f) => {
        const idx = mockData.bookings.findIndex(b => b._id === f._id || b.id === f.id);
        if (idx >= 0) { mockData.bookings.splice(idx, 1); return { deletedCount: 1 }; }
        return { deletedCount: 0 };
      }
    };

    const workspacesCol = {
      findOne: async () => mockData.workspaces[0]
    };

    mockDbInstance = { collection: (name) => (name === 'bookings' ? bookingsCol : workspacesCol) };
    const db = require('../../db');
    db.getDb.mockReturnValue(mockDbInstance);
    controller = new BookingController();
  });

  test('admin can create a booking', async () => {
    const req = { user: { id: 'u1', role: 'admin' }, body: { workspaceId: 'w1', date: '2026-04-01', startTime: '10:00', endTime: '11:00', actividad: 'A' } };
    const res = { code: null, body: null, status(code) { this.code = code; return this; }, json(payload) { this.body = payload; return this; } };
    await controller.createBooking(req, res);
    expect(res.code).toBe(201);
    expect(res.body._id).toBe('b1');
  });

  test('solape prevents creation (409)', async () => {
    // Pre-seed existing booking for same workspace/date/time
    mockData.bookings.push({ _id: 'b2', workspaceId: 'w1', date: '2026-04-01', startTime: '10:00', endTime: '11:00', userId: 'u2', actividad: 'A' });
    const req = { user: { id: 'u1', role: 'admin' }, body: { workspaceId: 'w1', date: '2026-04-01', startTime: '10:30', endTime: '11:30', actividad: 'A' } };
    const res = { code: null, body: null, status(code) { this.code = code; return this; }, json(payload) { this.body = payload; return this; } };
    await controller.createBooking(req, res);
    expect(res.code).toBe(409);
    expect(res.body).toHaveProperty('error');
  });
});
