const { ObjectId } = require('mongodb');
const getDb = require('../../db').getDb;

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id)) return new ObjectId(id);
  return id;
}

class CourseStore {
  async create(data) {
    const db = getDb();
    const col = db.collection('courses');
    const result = await col.insertOne(data);
    return { ...data, _id: result.insertedId };
  }

  async findById(id) {
    const db = getDb();
    const col = db.collection('courses');
    return await col.findOne({ _id: toObjectId(id) });
  }

  async findByStatus(status) {
    const db = getDb();
    const col = db.collection('courses');
    return await col.find({ status }).sort({ updatedAt: -1 }).toArray();
  }

  async findAll() {
    const db = getDb();
    const col = db.collection('courses');
    return await col.find({}).sort({ updatedAt: -1 }).toArray();
  }

  async update(id, updates) {
    const db = getDb();
    const col = db.collection('courses');
    const result = await col.findOneAndUpdate(
      { _id: toObjectId(id) },
      { $set: updates },
      { returnDocument: 'after' }
    );
    // Driver v6+: devuelve el documento directo; en versiones anteriores { value }.
    const doc = (result && result.value) ? result.value : result;
    return doc;
  }

  async delete(id) {
    const db = getDb();
    const col = db.collection('courses');
    const result = await col.deleteOne({ _id: toObjectId(id) });
    return result.deletedCount > 0;
  }
}

module.exports = CourseStore;
