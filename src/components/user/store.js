const getDb = require('../../db').getDb;

class UserStore {
  async create(data) {
    const db = getDb();
    const collection = db.collection('users');
    const result = await collection.insertOne(data);
    return { ...data, _id: result.insertedId };
  }

  async findById(id) {
    const db = getDb();
    const collection = db.collection('users');
    return await collection.findOne({ $or: [{ _id: id }, { id: id }] });
  }

  async findByEmail(email) {
    const db = getDb();
    const collection = db.collection('users');
    return await collection.findOne({ email: email.toLowerCase() });
  }

  async findAll() {
    const db = getDb();
    const collection = db.collection('users');
    return await collection.find({}).toArray();
  }

  async update(id, updates) {
    const db = getDb();
    const collection = db.collection('users');
    const result = await collection.findOneAndUpdate(
      { $or: [{ _id: id }, { id: id }] },
      { $set: updates },
      { returnDocument: 'after' }
    );
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
