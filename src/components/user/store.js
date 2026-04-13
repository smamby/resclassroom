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

class UserStore {
  async create(data) {
    const db = getDb();
    const collection = db.collection('users');
    const result = await collection.insertOne(data);
    return {
      _id: result.insertedId,
      name: data.name,
      surname: data.surname,
      email: data.email,
      role: data.role,
      createdAt: data.createdAt
    };
  }

  async findById(id) {
    const db = getDb();
    const collection = db.collection('users');
    const oid = toObjectId(id);
    const user = await collection.findOne({ _id: oid });
    if (!user) return null;
    const { passwordHash, _id, ...rest } = user;
    return { _id, ...rest };
  }

  async findByEmail(email) {
    const db = getDb();
    const collection = db.collection('users');
    return await collection.findOne({ email: email.toLowerCase() });
  }

  async findAll() {
    const db = getDb();
    const collection = db.collection('users');
    const users = await collection.find({}).toArray();
    return users.map(u => {
      const { passwordHash, _id, ...rest } = u;
      return { _id, ...rest };
    });
  }

  async update(id, updates) {
    const db = getDb();
    const collection = db.collection('users');
    const oid = toObjectId(id);
    const result = await collection.findOneAndUpdate(
      { _id: oid },
      { $set: updates },
      { returnDocument: 'after' }
    );
    if (result && result.value) {
      const { passwordHash, _id, ...rest } = result.value;
      return { _id, ...rest };
    }
    return result;
  }

  async delete(id) {
    const db = getDb();
    const collection = db.collection('users');
    const oid = toObjectId(id);
    const result = await collection.deleteOne({ _id: oid });
    return result.deletedCount > 0;
  }
}

module.exports = UserStore;
