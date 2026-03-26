const { MongoClient } = require('mongodb');

let _db;

async function connectToDatabase() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  _db = client.db('resclassroom');

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
}

function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call connectToDatabase first.');
  }
  return _db;
}

module.exports = {
  connectToDatabase,
  getDb
};