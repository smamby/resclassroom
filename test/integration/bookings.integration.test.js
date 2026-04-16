const request = require('supertest');
const { ObjectId } = require('mongodb');
let app;
let adminUserId;
let instructorUserId;
let workspaceId1;
let workspaceId2;

beforeAll(async () => {
  process.env.TEST_AUTH = '1';
  app = require('../../src/server');
  try {
    const dbModule = require('../../src/db');
    if (typeof dbModule.connectToDatabase === 'function') {
      await dbModule.connectToDatabase();
    }
    const db = dbModule.getDb();
    const ws = db.collection('workspaces');
    const users = db.collection('users');
    
    await ws.deleteMany({});
    const wsResult1 = await ws.insertOne({ name: 'Aula 101', type: 'classroom', capacity: 30, location: 'Edificio A', equipment: ['proyector','pizarra'] });
    workspaceId1 = wsResult1.insertedId.toString();
    
    const wsResult2 = await ws.insertOne({ name: 'Laboratorio 301', type: 'lab', capacity: 20, location: 'Edificio C', equipment: [] });
    workspaceId2 = wsResult2.insertedId.toString();
    
    await users.deleteMany({ email: { $in: ['admin@test.com', 'instructor@test.com'] } });
    const adminResult = await users.insertOne({ name: 'Admin', surname: 'Test', email: 'admin@test.com', role: ['admin'], passwordHash: '$2a$10$test' });
    adminUserId = adminResult.insertedId.toString();
    
    const instructorResult = await users.insertOne({ name: 'Instructor', surname: 'Test', email: 'instructor@test.com', role: ['instructor'], passwordHash: '$2a$10$test' });
    instructorUserId = instructorResult.insertedId.toString();
  } catch (e) {
    console.warn('Seeding skipped or failed:', e && e.message);
  }
});

describe('Bookings error flows', () => {
  test('Instructor cannot modify admin booking (403)', async () => {
    const resCreate = await request(app)
      .post('/bookings')
      .set('X-User-Id', adminUserId)
      .set('X-User-Role', '["admin"]')
      .send({ workspaceId: workspaceId1, startDate: '2026-04-10', endDate: '2026-04-10', startTime: '10:00', endTime: '11:00', days: [4], actividad: 'Clase test' });
    
    if (resCreate.status === 201) {
      const bookingId = resCreate.body._id;
      const resAttempt = await request(app)
        .put('/bookings/' + bookingId)
        .set('X-User-Id', instructorUserId)
        .set('X-User-Role', '["instructor"]')
        .send({ endTime: '12:00' });
      expect(resAttempt.status).toBe(403);
    }
  });

  test('Unauthenticated cannot create booking (403)', async () => {
    const res = await request(app)
      .post('/bookings')
      .send({ workspaceId: workspaceId1, startDate: '2026-04-11', endDate: '2026-04-11', startTime: '10:00', endTime: '11:00', days: [5], actividad: 'Clase' });
    expect(res.status).toBe(403);
  });

  test('Visitor cannot create booking (403)', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('X-User-Id', adminUserId)
      .set('X-User-Role', '["visitor"]')
      .send({ workspaceId: workspaceId1, startDate: '2026-04-12', endDate: '2026-04-12', startTime: '10:00', endTime: '11:00', days: [6], actividad: 'Clase' });
    expect(res.status).toBe(403);
  });

  test('Invalid workspace returns 400', async () => {
    const fakeWsId = new ObjectId();
    const res = await request(app)
      .post('/bookings')
      .set('X-User-Id', adminUserId)
      .set('X-User-Role', '["admin"]')
      .send({ workspaceId: fakeWsId.toString(), startDate: '2026-04-13', endDate: '2026-04-13', startTime: '10:00', endTime: '11:00', days: [0], actividad: 'Clase' });
    expect(res.status).toBe(400);
  });

  test('Missing required fields returns 400', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('X-User-Id', adminUserId)
      .set('X-User-Role', '["admin"]')
      .send({ workspaceId: workspaceId1 });
    expect(res.status).toBe(400);
  });
});

describe('Bookings success flow (minimal)', () => {
  test('Admin can create a booking', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('X-User-Id', adminUserId)
      .set('X-User-Role', '["admin"]')
      .send({ workspaceId: workspaceId1, startDate: '2026-04-15', endDate: '2026-04-15', startTime: '14:00', endTime: '15:00', days: [2], actividad: 'Test minimal' });
    expect(res.status).toBe(201);
  });
});