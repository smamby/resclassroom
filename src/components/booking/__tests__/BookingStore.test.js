const BookingStore = require('../store');

// Mock the MongoDB wrapper
jest.mock('../../db', () => ({
  getDb: jest.fn()
}));

describe('BookingStore', () => {
  let mockDbInstance;
  let mockData;
  beforeEach(() => {
    mockData = { bookings: [], workspaces: [{ _id: 'w1', name: 'WS1' }] };

    const bookingsCol = {
      insertOne: async (doc) => {
        doc._id = 'b1';
        mockData.bookings.push(doc);
        return { insertedId: doc._id };
      },
      findOne: async (filter) => mockData.bookings.find(b => b._id === filter._id || b.id === filter.id),
      findAll: async () => mockData.bookings,
      find: (filter) => ({ toArray: async () => mockData.bookings.filter(b =>
        (filter.workspaceId ? b.workspaceId === filter.workspaceId : true) && (filter.date ? b.date === filter.date : true)
      )) }),
      findOneAndUpdate: async (filter, update) => {
        const idx = mockData.bookings.findIndex(b => b._id === filter._id || b.id === filter.id);
        if (idx >= 0) {
          Object.assign(mockData.bookings[idx], update.$set);
          return { value: mockData.bookings[idx] };
        }
        return { value: null };
      },
      deleteOne: async (filter) => {
        const idx = mockData.bookings.findIndex(b => b._id === filter._id || b.id === filter.id);
        if (idx >= 0) {
          mockData.bookings.splice(idx, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      }
    };

    const workspacesCol = {
      findOne: async (filter) => mockData.workspaces.find(w => w._id === (filter.$or?.[0]._id || filter._id) || w.id === filter.id)
    };

    mockDbInstance = {
      collection: (name) => (name === 'bookings' ? bookingsCol : workspacesCol)
    };

    // Patch the DB mock
    const dbModule = require('../../db');
    dbModule.getDb.mockReturnValue(mockDbInstance);
  });

  test('should create a booking and return with _id', async () => {
    const store = new BookingStore();
    const result = await store.create({ workspaceId: 'w1', date: '2026-04-01', startTime: '10:00', endTime: '11:00', userId: 'u1', actividad: 'A' });
    expect(result._id).toBe('b1');
    expect(result.workspaceId).toBe('w1');
  });

  test('should find a booking by id', async () => {
    // Seed a booking
    mockData.bookings.push({ _id: 'b1', workspaceId: 'w1', date: '2026-04-01', startTime: '10:00', endTime: '11:00', userId: 'u1', actividad: 'A' });
    const store = new BookingStore();
    const found = await store.findById('b1');
    expect(found).toBeDefined();
    expect(found._id).toBe('b1');
  });

  test('should update a booking', async () => {
    mockData.bookings.push({ _id: 'b1', workspaceId: 'w1', date: '2026-04-01', startTime: '10:00', endTime: '11:00', userId: 'u1', actividad: 'A' });
    const store = new BookingStore();
    const updated = await store.update('b1', { endTime: '12:00' });
    expect(updated.value.endTime).toBe('12:00');
  });

  test('should delete a booking', async () => {
    mockData.bookings.push({ _id: 'b1', workspaceId: 'w1', date: '2026-04-01', startTime: '10:00', endTime: '11:00', userId: 'u1', actividad: 'A' });
    const store = new BookingStore();
    const del = await store.delete('b1');
    expect(del).toBe(true);
  });

  test('should find bookings by workspace and date', async () => {
    mockData.bookings.push({ _id: 'b1', workspaceId: 'w1', date: '2026-04-02', startTime: '09:00', endTime: '10:00', userId: 'u1', actividad: 'A' });
    const store = new BookingStore();
    const list = await store.findByWorkspaceAndDate('w1', '2026-04-02');
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});
