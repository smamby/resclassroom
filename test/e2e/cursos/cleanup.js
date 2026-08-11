const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const STATE_FILE = path.join(__dirname, 'state.json');
const DB_URI = `mongodb+srv://mamby_db_admin:${process.env.DB_ATLAS}@resclassroom.s0mi2bf.mongodb.net/resclassroom`;

(async () => {
  if (!fs.existsSync(STATE_FILE)) {
    console.log('CLEANUP: no state.json, nada que limpiar');
    return;
  }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const client = new MongoClient(DB_URI);
  await client.connect();
  const db = client.db('resclassroom');
  const users = db.collection('users');
  const workspaces = db.collection('workspaces');
  const courses = db.collection('courses');
  const bookings = db.collection('bookings');

  const toId = (s) => new ObjectId(s);
  const courseIds = (await courses.find({ proposedBy: state.instructorId }).toArray()).map((c) => c._id.toString());

  const del = {};
  if (courseIds.length) {
    del.bookings = (await bookings.deleteMany({ courseId: { $in: courseIds } })).deletedCount;
  }
  del.courses = courseIds.length
    ? (await courses.deleteMany({ _id: { $in: courseIds.map(toId) } })).deletedCount
    : 0;
  del.workspace = (await workspaces.deleteMany({ _id: { $in: [toId(state.workspaceId)] } })).deletedCount;
  del.users = (await users.deleteMany({ _id: { $in: [toId(state.instructorId), toId(state.subcoId)] } })).deletedCount;

  console.log('CLEANUP OK', JSON.stringify(del));
  fs.unlinkSync(STATE_FILE);
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
