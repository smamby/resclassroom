const { ObjectId } = require('mongodb');
const getDb = require('../../db').getDb;

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id)) {
    return new ObjectId(id);
  }
  return id;
}

class WorkspaceStore {
  async create(data) {
    const db = getDb();
    const collection = db.collection('workspaces');
    const result = await collection.insertOne(data);
    return { ...data, _id: result.insertedId };
  }

  async findById(id) {
    const db = getDb();
    const collection = db.collection('workspaces');
    const oid = toObjectId(id);
    return await collection.findOne({ _id: oid });
  }

  async findAll() {
    const db = getDb();
    const collection = db.collection('workspaces');
    return await collection.find({}).toArray();
  }

  async update(id, updates) {
    const db = getDb();
    const collection = db.collection('workspaces');
    const oid = toObjectId(id);
    const result = await collection.findOneAndUpdate(
      { _id: oid },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result;
  }

  async delete(id) {
    const db = getDb();
    const collection = db.collection('workspaces');
    const oid = toObjectId(id);
    const result = await collection.deleteOne({ _id: oid });
    return result.deletedCount > 0;
  }
}

module.exports = WorkspaceStore;
