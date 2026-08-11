const request = require('supertest');
const { ObjectId } = require('mongodb');
const ROLES = require('../../common/roles');

let app;
let instructorId;
let seededSubcoIds = [];
// Roster completo de subco de la DB (los sembrados + los pre-existentes): la
// resolución exige que voten TODOS los subco actuales, no solo los de test.
let subcoIds = [];
let workspaceId;
let createdCourseIds = [];
let createdWorkspaceIds = [];
let runMarker;

const USERS_COL = 'users';
const WORKSPACES_COL = 'workspaces';
const COURSES_COL = 'courses';
const BOOKINGS_COL = 'bookings';

function voteBody(vote) {
  return { vote };
}

// Vota como un subco (headers con rol). Los votos se registran en el curso.
function vote(courseId, userId, option) {
  return request(app)
    .post(`/courses/${courseId}/vote`)
    .set('X-User-Id', userId)
    .set('X-User-Role', JSON.stringify([ROLES.SUBCO]))
    .send(voteBody(option));
}

function coursePayload(wsId, title) {
  return {
    title: title || `Curso Integración ${runMarker}`,
    type: 'taller',
    description: 'Test',
    schedule: {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      blocks: [{ label: 'Teórica', workspaceId: wsId, isPublicSpace: false, days: [2, 4], startTime: '19:00', endTime: '22:00' }]
    },
    color: '#3B82F6'
  };
}

async function createAndSubmit(title) {
  // Cada curso usa un workspace propio: si compartieran uno solo, los soft
  // bookings pending de los tests anteriores colisionarían al enviar el curso.
  const dbModule = require('../../src/db');
  const db = dbModule.getDb();
  const ws = await db.collection(WORKSPACES_COL).insertOne({
    name: `Aula Test ${runMarker}`, type: 'aula', capacity: 20,
    location: 'Sede Test', equipment: [], createdBy: instructorId, createdAt: new Date()
  });
  const wsId = String(ws.insertedId);
  createdWorkspaceIds.push(wsId);

  const createRes = await request(app)
    .post('/courses')
    .set('X-User-Id', instructorId)
    .set('X-User-Role', JSON.stringify([ROLES.INSTRUCTOR]))
    .send(coursePayload(wsId, title));
  const courseId = createRes.body._id;
  createdCourseIds.push(courseId);
  await request(app)
    .post(`/courses/${courseId}/submit`)
    .set('X-User-Id', instructorId)
    .set('X-User-Role', JSON.stringify([ROLES.INSTRUCTOR]));
  return courseId;
}

beforeAll(async () => {
  process.env.TEST_AUTH = '1';
  app = require('../../src/server');
  runMarker = Date.now().toString(36);
  try {
    const dbModule = require('../../src/db');
    if (typeof dbModule.connectToDatabase === 'function') await dbModule.connectToDatabase();
    const db = dbModule.getDb();

    const ins = await db.collection(USERS_COL).insertOne({
      name: `Inst ${runMarker}`, surname: 'Test', email: `inst-${runMarker}@test.com`,
      role: [ROLES.INSTRUCTOR], passwordHash: 'x', createdAt: new Date()
    });
    instructorId = String(ins.insertedId);

    for (let i = 0; i < 4; i++) {
      const s = await db.collection(USERS_COL).insertOne({
        name: `Subco ${i}`, surname: 'Test', email: `subco${i}-${runMarker}@test.com`,
        role: [ROLES.SUBCO], passwordHash: 'x', createdAt: new Date()
      });
      seededSubcoIds.push(String(s.insertedId));
    }

    // La resolución exige que voten TODOS los subco de la DB, no solo los de test:
    // se captura el roster completo (incluye los subcos pre-existentes de la DB real).
    const allSubcos = await db.collection(USERS_COL).find({ role: ROLES.SUBCO }).toArray();
    subcoIds = allSubcos.map(u => String(u._id));

    const ws = await db.collection(WORKSPACES_COL).insertOne({
      name: `Aula Test ${runMarker}`, type: 'aula', capacity: 20,
      location: 'Sede Test', equipment: [], createdBy: instructorId, createdAt: new Date()
    });
    workspaceId = String(ws.insertedId);
  } catch (e) {
    console.warn('Seeding skipped or failed:', e && e.message);
  }
});

afterAll(async () => {
  try {
    const dbModule = require('../../src/db');
    const db = dbModule.getDb();
    const courseOids = createdCourseIds.map(id => new ObjectId(id));
    if (courseOids.length) {
      await db.collection(COURSES_COL).deleteMany({ _id: { $in: courseOids } });
      // Todos los bookings del flujo de cursos se linkean por courseId; se borran
      // por referencia al curso (incluye pending, confirmados y soft-deleted).
      await db.collection(BOOKINGS_COL).deleteMany({ courseId: { $in: createdCourseIds } });
    }
    const wsIds = createdWorkspaceIds.map(id => new ObjectId(id)).concat([new ObjectId(workspaceId)]);
    await db.collection(WORKSPACES_COL).deleteMany({ _id: { $in: wsIds } });
    // Solo se borran los usuarios sembrados por el test (por _id exacto): los
    // subco pre-existentes de la DB real nunca se tocan.
    const seededOids = seededSubcoIds.map(id => new ObjectId(id)).concat([new ObjectId(instructorId)]);
    await db.collection(USERS_COL).deleteMany({ _id: { $in: seededOids } });
  } catch (e) {
    console.warn('Cleanup skipped:', e && e.message);
  }
});

describe('Cursos integration', () => {
  test('instructor crea borrador y lo envía a votación (crea soft bookings)', async () => {
    const createRes = await request(app)
      .post('/courses')
      .set('X-User-Id', instructorId)
      .set('X-User-Role', JSON.stringify([ROLES.INSTRUCTOR]))
      .send(coursePayload(workspaceId));
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('propuesto');
    const courseId = createRes.body._id;
    createdCourseIds.push(courseId);

    const submitRes = await request(app)
      .post(`/courses/${courseId}/submit`)
      .set('X-User-Id', instructorId)
      .set('X-User-Role', JSON.stringify([ROLES.INSTRUCTOR]));
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe('en_votacion');

    const dbModule = require('../../src/db');
    const db = dbModule.getDb();
    const softs = await db.collection(BOOKINGS_COL).find({ courseId, status: 'pending' }).toArray();
    expect(softs.length).toBe(1);
  });

  test('no-subco no puede votar', async () => {
    const courseId = await createAndSubmit();
    // Voto como instructor (no subco): se usa el helper con rol propio porque
    // `vote` firma los votos con rol SUBCO por diseño.
    const res = await request(app)
      .post(`/courses/${courseId}/vote`)
      .set('X-User-Id', instructorId)
      .set('X-User-Role', JSON.stringify([ROLES.INSTRUCTOR]))
      .send(voteBody('positive'));
    expect(res.status).toBe(403);
  });

  test('al votar todos los subco se aprueba y los soft bookings pasan a confirmed', async () => {
    const courseId = await createAndSubmit();
    for (const sid of subcoIds) {
      const res = await vote(courseId, sid, 'positive');
      expect(res.status).toBe(200);
    }

    const dbModule = require('../../src/db');
    const db = dbModule.getDb();
    const course = await db.collection(COURSES_COL).findOne({ _id: new ObjectId(courseId) });
    expect(course.status).toBe('publicado');
    const bookings = await db.collection(BOOKINGS_COL).find({ courseId }).toArray();
    expect(bookings.every(b => b.status === 'confirmed')).toBe(true);
  });

  test('rechazo por voto en contra en mayoría y liberación de soft bookings', async () => {
    const courseId = await createAndSubmit();

    // Patrón 4: 2 en contra, 1 a favor, 1 abstención sobre los subco sembrados.
    await vote(courseId, seededSubcoIds[0], 'negative');
    await vote(courseId, seededSubcoIds[1], 'negative');
    await vote(courseId, seededSubcoIds[2], 'positive');
    await vote(courseId, seededSubcoIds[3], 'abstain');
    // Los subco pre-existentes de la DB también deben emitir su voto (abstención):
    // ratio 1/3 < 0.75 → rechazado.
    for (const sid of subcoIds) {
      if (seededSubcoIds.includes(sid)) continue;
      await vote(courseId, sid, 'abstain');
    }

    const dbModule = require('../../src/db');
    const db = dbModule.getDb();
    const course = await db.collection(COURSES_COL).findOne({ _id: new ObjectId(courseId) });
    expect(course.status).toBe('rechazado');
    const softs = await db.collection(BOOKINGS_COL).find({ courseId, deleted: { $ne: true } }).toArray();
    expect(softs.length).toBe(0);
  });

  test('visitante no ve propuestas en votación en /courses', async () => {
    // Título distinto para este curso: el de la aprobación quedó publicado (visible
    // para todos), así que el mismo título haría falsa la aserción de abajo.
    const secretTitle = `Curso Secreto ${runMarker}`;
    await createAndSubmit(secretTitle);
    const res = await request(app).get('/courses'); // sin headers → visitor
    expect(res.status).toBe(200);
    const titles = res.body.map(c => c.title);
    expect(titles).not.toContain(secretTitle);
  });
});
