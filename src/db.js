const { MongoClient } = require('mongodb');

let _db;
let _client;

async function connectToDatabase() {
  try {
    const db_pass = process.env.DB_ATLAS;

    const DB_URI = `mongodb+srv://mamby_db_admin:${db_pass}@resclassroom.s0mi2bf.mongodb.net/resclassroom`;

    _client = new MongoClient(DB_URI);
    await _client.connect();
    _db = _client.db('resclassroom');

    const collections = await _db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (!collectionNames.includes('workspaces')) {
      await _db.createCollection('workspaces');
      console.log('Created workspaces collection');
    }

    if (!collectionNames.includes('users')) {
      await _db.createCollection('users');
      console.log('Created users collection');
    }

    console.log('Connected to MongoDB resclassroom database');
    return _db;

  } catch (error) {
    console.error("ERROR CRÍTICO AL CONECTAR A LA DB:", error.message);
    process.exit(1);
  }
}


function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call connectToDatabase first.');
  }
  return _db;
}


async function closeDatabaseConnection() {
  if (_client) {
    await _client.close();
    _db = null;
    _client = null;
    console.log('Conexión a la base de datos MongoDB cerrada correctamente.');
  }
}


module.exports = {
  connectToDatabase,
  getDb,
  closeDatabaseConnection
};