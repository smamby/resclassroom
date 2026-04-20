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
    const users = db.collection('users');

    // Usar admin existente - ID hardcodeado
    adminUserId = '69dd6c955e909313b229385a';

    // Verificar que existe
    const adminUser = await users.findOne({ _id: new ObjectId(adminUserId) });
    if (!adminUser) {
      throw new Error('Admin no existe');
    }

    // Instructor usa mismo admin para tests
    instructorUserId = adminUserId;

    // Workspaces existentes hardcodeados
    workspaceId1 = '69e663085cc39bef7e8aa710'; // Zona precalentamiento
    workspaceId2 = '69e663325cc39bef7e8aa711'; // Murito
  } catch (e) {
    console.warn('Seeding skipped or failed:', e && e.message);
  }
});

afterAll(async () => {
  try {
    const dbModule = require('../../src/db');
    const db = dbModule.getDb();
    // Borrar todos los bookings de test (por actividad que contenga ciertas palabras)
    await db.collection('bookings').deleteMany({ 
      actividad: { $in: ['Test minimal', 'Clase test', 'Clase', 'Clase 1', 'Clase 2', 'Clase Martes'] }
    });
  } catch (e) {
    console.warn('Cleanup skipped:', e && e.message);
  }
});

describe('Bookings validation', () => {
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