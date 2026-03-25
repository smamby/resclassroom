const request = require('supertest');
let app;

beforeAll(async () => {
  process.env.TEST_AUTH = '1';
  // Import app after enabling test auth shim
  app = require('../../src/server');
  // Seed database with required data (two workspaces, two users)
  try {
    const dbModule = require('../../src/db');
    // Ensure DB is initialized
    if (typeof dbModule.connectToDatabase === 'function') {
      await dbModule.connectToDatabase();
    }
    const db = dbModule.getDb();
    const ws = db.collection('workspaces');
    const users = db.collection('users');
    await ws.updateOne({ id: 'p7qaiwzsy' }, { $setOnInsert: { id: 'p7qaiwzsy', name: 'Aula 101', type: 'classroom', capacity: 30, location: 'Edificio A', equipment: ['proyector','pizarra'] } }, { upsert: true });
    await ws.updateOne({ id: 'dghrpgopb' }, { $setOnInsert: { id: 'dghrpgopb', name: 'Laboratorio 301', type: 'lab', capacity: 20, location: 'Edificio C', equipment: [] } }, { upsert: true });
    await users.updateOne({ id: '8mvq0gtpg' }, { $setOnInsert: { id: '8mvq0gtpg', name: 'Juan', surname: 'Perez', email: 'juan.perez@test.com', role: 'admin' } }, { upsert: true });
    await users.updateOne({ id: 'mhrzs3j93' }, { $setOnInsert: { id: 'mhrzs3j93', name: 'Maria', surname: 'Garcia', email: 'maria@test.com', role: 'instructor' } }, { upsert: true });
  } catch (e) {
    // Ignore seed errors in environments where DB is already seeded
    console.warn('Seeding skipped or failed:', e && e.message);
  }
});

describe('Bookings integration with real DB', () => {
  test('Admin creates a booking (workspace p7qaiwzsy, 2026-04-03 10:00-11:00)', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('X-User-Id', '8mvq0gtpg')
      .set('X-User-Role', 'admin')
      .send({ workspaceId: 'p7qaiwzsy', date: '2026-04-03', startTime: '10:00', endTime: '11:00', actividad: 'Clase' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    // store id for later tests
    global.createdBookingId = res.body._id || res.body.id;
  });

  test('Admin creates overlapping booking should be 409 (solape)', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('X-User-Id', '8mvq0gtpg')
      .set('X-User-Role', 'admin')
      .send({ workspaceId: 'p7qaiwzsy', date: '2026-04-03', startTime: '10:30', endTime: '11:30', actividad: 'Clase' });
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });
  
  test('Instructor attempts to modify admin booking should be forbidden', async () => {
    const bookingId = global.createdBookingId;
    const res = await request(app)
      .put(`/bookings/${bookingId}`)
      .set('X-User-Id', 'mhrzs3j93')
      .set('X-User-Role', 'instructor')
      .send({ endTime: '12:00' });
    // Should be forbidden since instructor doesn't own the booking
    expect(res.status).toBe(403);
  });

  test('Instructor creates their own booking and updates it', async () => {
    const resCreate = await request(app)
      .post('/bookings')
      .set('X-User-Id', 'mhrzs3j93')
      .set('X-User-Role', 'instructor')
      .send({ workspaceId: 'dghrpgopb', date: '2026-04-04', startTime: '09:00', endTime: '10:00', actividad: 'Reunion' });
    expect(resCreate.status).toBe(201);
    const id = resCreate.body._id || resCreate.body.id;
    // Update their own booking
    const resUpdate = await request(app)
      .put(`/bookings/${id}`)
      .set('X-User-Id', 'mhrzs3j93')
      .set('X-User-Role', 'instructor')
      .send({ endTime: '11:00' });
    expect(resUpdate.status).toBe(200);
  });
});
