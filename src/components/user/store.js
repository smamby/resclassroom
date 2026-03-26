const getDb = require('../../db').getDb;

class UserStore {
  async create(data) {
    const db = getDb();
    const collection = db.collection('users');
    const result = await collection.insertOne(data);
    const sanitized = {
      _id: result.insertedId,
      id: data.id,
      name: data.name,
      surname: data.surname,
      email: data.email,
      role: data.role,
      createdAt: data.createdAt
    };
    return sanitized;
  }

  async findById(id) {
    const db = getDb();
    const collection = db.collection('users');
    const user = await collection.findOne({ $or: [{ _id: id }, { id: id }] });
    if (!user) return null;
    const { passwordHash, _id, ...rest } = user;
    return { _id, ...rest };
  }

  async findByEmail(email) {
    const db = getDb();
    const collection = db.collection('users');
    const user = await collection.findOne({ email: email.toLowerCase() });
    if (!user) return null;
    const { passwordHash, _id, ...rest } = user;
    return { _id, ...rest };
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
    const result = await collection.findOneAndUpdate(
      { $or: [{ _id: id }, { id: id }] },
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
    const result = await collection.deleteOne({ $or: [{ _id: id }, { id: id }] });
    return result.deletedCount > 0;
  }
}

module.exports = UserStore;
