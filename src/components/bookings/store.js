const getDb = require('../../db').getDb;
const { ObjectId } = require('mongodb');

class BookingStore {
  async create(data) {
    const db = getDb();
    const collection = db.collection('bookings');
    // Debug: log what we are attempting to insert
    console.log('[BOOKINGS] Inserting booking:', data);
    const result = await collection.insertOne(data);
    console.log('[BOOKINGS] Insert result:', result);
    return { ...data, _id: result.insertedId };
  }

  async findById(id) {
    const db = getDb();
    const collection = db.collection('bookings');
    // Try to convert to ObjectId if a valid hex string is provided
    let queryId = id;
    try {
      if (ObjectId.isValid(id)) {
        queryId = new ObjectId(id);
      }
    } catch (e) {
      // ignore and fall back to using the raw id
    }
    return await collection.findOne({ $or: [{ _id: queryId }, { id: id }] });
  }

  async findAll() {
    const db = getDb();
    const collection = db.collection('bookings');
    return await collection.find({ deleted: { $ne: true } }).toArray();
  }

  async update(id, updates) {
    const db = getDb();
    const collection = db.collection('bookings');
    // Normalize id to ObjectId when possible for _id matching
    let queryId = id;
    if (ObjectId.isValid(id)) {
      queryId = new ObjectId(id);
    }
    const result = await collection.findOneAndUpdate(
      { $or: [{ _id: queryId }, { id: id }] },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result;
  }

  async delete(id) {
    const db = getDb();
    const collection = db.collection('bookings');
    // Normalize id to ObjectId for _id matching
    let queryId = id;
    if (ObjectId.isValid(id)) {
      queryId = new ObjectId(id);
    }
    const result = await collection.deleteOne({ $or: [{ _id: queryId }, { id: id }] });
    return result.deletedCount > 0;
  }

// Find bookings by workspace (excluding expired ones)
  async findByWorkspace(workspaceId) {
    const db = getDb();
    const collection = db.collection('bookings');
    // Excluir reservas con endDate anterior a hoy
    const today = new Date().toISOString().split('T')[0];
    return await collection.find({ 
      workspaceId,
      deleted: { $ne: true },
      $or: [
        { endDate: { $gte: today } },
        { endDate: { $exists: false } },
        { endDate: null }
      ]
    }).toArray();
  }

  // Find all bookings by workspace (no date filter - for overlap checking)
  async findByWorkspaceAll(workspaceId) {
    const db = getDb();
    const collection = db.collection('bookings');
    return await collection.find({ workspaceId, deleted: { $ne: true } }).toArray();
  }

  // Extra helper to find bookings by workspace and date for solape checks
  async findByWorkspaceAndDate(workspaceId, date) {
    const db = getDb();
    const collection = db.collection('bookings');
    return await collection.find({ workspaceId, date }).toArray();
  }

  // Reservas activas/futuras confirmadas de un usuario (las que se marcan al borrar cuenta)
  async findActiveByUser(userId) {
    const db = getDb();
    const collection = db.collection('bookings');
    const today = new Date().toISOString().split('T')[0];
    return await collection.find({
      userId,
      status: 'confirmed',
      deleted: { $ne: true },
      $or: [
        { endDate: { $gte: today } },
        { endDate: { $exists: false } },
        { endDate: null }
      ]
    }).toArray();
  }

  // Soft-delete de las reservas activas de un usuario (nunca hard-delete)
  async softDeleteActiveByUser(userId) {
    const db = getDb();
    const collection = db.collection('bookings');
    const today = new Date().toISOString().split('T')[0];
    const result = await collection.updateMany(
      {
        userId,
        status: 'confirmed',
        $or: [
          { endDate: { $gte: today } },
          { endDate: { $exists: false } },
          { endDate: null }
        ]
      },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
    return result.modifiedCount || 0;
  }
}

module.exports = BookingStore;
