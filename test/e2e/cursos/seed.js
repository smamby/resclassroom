const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const DB_URI = `mongodb+srv://mamby_db_admin:${process.env.DB_ATLAS}@resclassroom.s0mi2bf.mongodb.net/resclassroom`;
const STATE = path.join(__dirname, 'state.json');
const PASSWORD = 'E2ePass123!';
const EMAILS = { instructor: 'e2e-instructor@test.com', subco: 'e2e-subco@test.com' };

(async () => {
  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db('resclassroom');
  const users = db.collection('users');
  const workspaces = db.collection('workspaces');
  const courses = db.collection('courses');
  const bookings = db.collection('bookings');

  // Limpieza previa idempotente (también elimina restos de corridas abortadas)
  await users.deleteMany({ email: { $in: Object.values(EMAILS) } });
  await workspaces.deleteMany({ name: 'Aula E2E' });
  const staleIds = (await courses.find({ title: { $regex: '^Taller E2E' } }).toArray()).map((c) => c._id.toString());
  if (staleIds.length) {
    await bookings.deleteMany({ courseId: { $in: staleIds } });
    await courses.deleteMany({ _id: { $in: staleIds.map((id) => new ObjectId(id)) } });
  }

  const hash = bcrypt.hashSync(PASSWORD, 10);
  const now = new Date();

  const instructorId = (await users.insertOne({
    name: 'E2E Instructor', surname: 'Test', email: EMAILS.instructor,
    role: ['instructor'], passwordHash: hash, passwordVersion: 0, createdAt: now
  })).insertedId.toString();
  const subcoId = (await users.insertOne({
    name: 'E2E Subco', surname: 'Test', email: EMAILS.subco,
    role: ['subco'], passwordHash: hash, passwordVersion: 0, createdAt: now
  })).insertedId.toString();

  const workspaceId = (await workspaces.insertOne({
    name: 'Aula E2E', type: 'classroom', capacity: 30, location: 'Sede E2E',
    equipment: [], createdBy: instructorId, createdAt: now
  })).insertedId.toString();

  fs.writeFileSync(STATE, JSON.stringify({ instructorId, subcoId, workspaceId, emails: EMAILS, password: PASSWORD }, null, 2));
  console.log('SEED OK', JSON.stringify({ instructorId, subcoId, workspaceId }));
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
