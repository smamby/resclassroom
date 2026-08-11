const request = require('supertest');
const express = require('express');
const ROLES = require('../../../../common/roles');

jest.mock('../../../db', () => ({
  getDb: jest.fn(() => ({
    collection: () => ({
      findOne: async () => null,
      find: () => ({ sort: () => ({ toArray: async () => [] }) }),
      insertOne: async () => ({ insertedId: 'c1' })
    })
  }))
}));

describe('Courses network', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Mismo shim que server.js (TEST_AUTH): headers x-user-id/x-user-role setean req.user.
    app.use((req, res, next) => {
      const id = req.headers['x-user-id'];
      const role = req.headers['x-user-role'];
      if (id && role) {
        try {
          const parsedRole = typeof role === 'string' ? JSON.parse(role) : role;
          req.user = { id, role: Array.isArray(parsedRole) ? parsedRole : [parsedRole] };
        } catch (e) {
          req.user = { id, role: [role] };
        }
      }
      next();
    });
    const auth = require('../../../middleware/authMiddleware');
    app.use('/courses', auth.authenticate, require('../network'));
  });

  test('POST /courses sin sesión devuelve 403 (convención: authenticate deja pasar y el controller rechaza)', async () => {
    const res = await request(app).post('/courses').send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  test('GET /courses es accesible sin sesión (visitor ve publicados)', async () => {
    const res = await request(app).get('/courses');
    expect(res.status).toBe(200);
  });

  test('POST /courses como instructor crea el curso', async () => {
    const res = await request(app)
      .post('/courses')
      .set('X-User-Id', 'i1')
      .set('X-User-Role', JSON.stringify([ROLES.INSTRUCTOR]))
      .send({ title: 'Escalada' });
    expect(res.status).toBe(201);
  });
});
