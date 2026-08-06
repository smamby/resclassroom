const request = require('supertest');
const express = require('express');
const ROLES = require('../../../../common/roles');

jest.mock('../../../db', () => ({
  getDb: jest.fn(() => ({
    collection: () => ({
      findOne: async () => null
    })
  }))
}));

describe('User network auth protection', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/users', require('../network'));
  });

  test('POST /users returns 401 without admin token', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Ana', surname: 'Gomez', email: 'ana@mail.com', role: [ROLES.INSTRUCTOR] });
    expect(res.status).toBe(401);
  });

  test('GET /users returns 401 without admin token', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  test('GET /users/email/:email is public and returns 404 for unknown email', async () => {
    const res = await request(app).get('/users/email/nadie@mail.com');
    expect(res.status).toBe(404);
  });
});
