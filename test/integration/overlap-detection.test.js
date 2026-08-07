const request = require('supertest');
const { ObjectId } = require('mongodb');
const ROLES = require('../../common/roles');
let app;
let adminUserId;
let workspaceId1;
let createdBookingIds = [];
let runMarker;

beforeAll(async () => {
  process.env.TEST_AUTH = '1';
  app = require('../../src/server');
  runMarker = Date.now().toString(36);
  try {
    const dbModule = require('../../src/db');
    if (typeof dbModule.connectToDatabase === 'function') {
      await dbModule.connectToDatabase();
    }
    const users = dbModule.getDb().collection('users');

    // Admin existente hardcodeado
    adminUserId = '69dd6c955e909313b229385a';

    // Verificar que existe
    const adminUser = await users.findOne({ _id: new ObjectId(adminUserId) });
    if (!adminUser) {
      throw new Error('Admin no existe');
    }

    // Workspace existente hardcodeado
    workspaceId1 = '69e6635b5cc39bef7e8aa712'; // Quincho
  } catch (e) {
    console.warn('Seeding skipped:', e && e.message);
  }
});

afterAll(async () => {
  // Limpieza por _id exacto: solo borra lo que el test creó, nunca datos reales
  if (createdBookingIds.length === 0) return;
  try {
    const dbModule = require('../../src/db');
    const db = dbModule.getDb();
    const oids = createdBookingIds.map(id => new ObjectId(id));
    await db.collection('bookings').deleteMany({ _id: { $in: oids } });
  } catch (e) {
    console.warn('Cleanup skipped:', e && e.message);
  }
});

describe('Detección de solapamientos', () => {
  test('Mismo día mismo horario DEBE rechazarse (409)', async () => {
    // 2026-04-13 = LUNES = day 1 (en Argentina timezone)
    // Reserva 1: lunes 19:00-21:00
    const res1 = await request(app)
      .post('/bookings')
      .set('X-User-Id', adminUserId)
      .set('X-User-Role', ROLES.ADMIN)
      .send({
        workspaceId: workspaceId1,
        startDate: '2026-04-13',
        endDate: '2026-04-13',
        startTime: '19:00',
        endTime: '21:00',
        days: [1], // lunes
        actividad: `Clase 1 ${runMarker}`,
        color: '#FF0000'
      });

    console.log('=== RESERVA 1 (lunes 19:00-21:00) ===');
    console.log('Status:', res1.status);
    console.log('Body:', JSON.stringify(res1.body, null, 2));

    expect(res1.status).toBe(201);
    if (res1.body && res1.body._id) {
      createdBookingIds.push(res1.body._id);
    }

    // Reserva 2: lunes 20:00-22:00 - DEBE solapar y rechazarse
    const res2 = await request(app)
      .post('/bookings')
      .set('X-User-Id', adminUserId)
      .set('X-User-Role', ROLES.ADMIN)
      .send({
        workspaceId: workspaceId1,
        startDate: '2026-04-13',
        endDate: '2026-04-13',
        startTime: '20:00',
        endTime: '22:00',
        days: [1], // lunes
        actividad: `Clase 2 ${runMarker}`,
        color: '#00FF00'
      });

    console.log('=== RESERVA 2 (lunes 20:00-22:00, debe rechazarse) ===');
    console.log('Status:', res2.status);
    console.log('Body:', JSON.stringify(res2.body, null, 2));

    expect(res2.status).toBe(409);
    expect(res2.body.error).toContain('Solape');
  });

  test('Día diferente DEBE aceptarse', async () => {
    // 2026-04-14 = martes = day 2
    // Reserva: martes 19:00-21:00 (día diferente al lunes)
    const res1 = await request(app)
      .post('/bookings')
      .set('X-User-Id', adminUserId)
      .set('X-User-Role', ROLES.ADMIN)
      .send({
        workspaceId: workspaceId1,
        startDate: '2026-04-14',
        endDate: '2026-04-14',
        startTime: '19:00',
        endTime: '21:00',
        days: [2], // martes
        actividad: `Clase Martes ${runMarker}`,
        color: '#0000FF'
      });

    console.log('=== RESERVA DÍA DIFERENTE ===');
    console.log('Status:', res1.status);

    expect(res1.status).toBe(201);
    if (res1.body && res1.body._id) {
      createdBookingIds.push(res1.body._id);
    }
  });
});
