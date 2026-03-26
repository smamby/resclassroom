const getDb = require('../../db').getDb;

class BookingStore {
  async create(data) {
    const db = getDb();
    const collection = db.collection('bookings');
    const result = await collection.insertOne(data);
    return { ...data, _id: result.insertedId };
  }

  async findById(id) {
    const db = getDb();
    const collection = db.collection('bookings');
    return await collection.findOne({ $or: [{ _id: id }, { id: id }] });
  }

  async findAll() {
    const db = getDb();
    const collection = db.collection('bookings');
    return await collection.find({}).toArray();
  }

  async update(id, updates) {
    const db = getDb();
    const collection = db.collection('bookings');
    const result = await collection.findOneAndUpdate(
      { $or: [{ _id: id }, { id: id }] },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result;
  }

  async delete(id) {
    const db = getDb();
    const collection = db.collection('bookings');
    const result = await collection.deleteOne({ $or: [{ _id: id }, { id: id }] });
    return result.deletedCount > 0;
  }

  // Extra helper to find bookings by workspace and date for solape checks
  async findByWorkspaceAndDate(workspaceId, date) {
    const db = getDb();
    const collection = db.collection('bookings');
    return await collection.find({ workspaceId, date }).toArray();
  }
}

module.exports = BookingStore;
