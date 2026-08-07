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
    const { passwordHash, resetPasswordToken, resetPasswordExpires, deleteAccountToken, deleteAccountExpires, _id, ...rest } = user;
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
      const { passwordHash, resetPasswordToken, resetPasswordExpires, deleteAccountToken, deleteAccountExpires, _id, ...rest } = u;
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
    // Driver v6+: findOneAndUpdate devuelve el documento directamente;
    // en versiones anteriores venía envuelto en { value }. Sanitizar ambos.
    const doc = (result && result.value) ? result.value : result;
    if (doc) {
      const { passwordHash, resetPasswordToken, resetPasswordExpires, deleteAccountToken, deleteAccountExpires, _id, ...rest } = doc;
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

  // Devuelve el documento completo (incluye passwordHash), para verificar contraseñas
  async findByIdFull(id) {
    const db = getDb();
    const collection = db.collection('users');
    const oid = toObjectId(id);
    return await collection.findOne({ _id: oid });
  }

  // Registra el token de confirmación de borrado de cuenta
  async setDeleteToken(userId, token, expires) {
    const db = getDb();
    const collection = db.collection('users');
    await collection.updateOne(
      { _id: toObjectId(userId) },
      { $set: { deleteAccountToken: token, deleteAccountExpires: expires } }
    );
  }

  // Busca usuario por token de borrado no expirado
  async findByDeleteToken(token) {
    const db = getDb();
    const collection = db.collection('users');
    return await collection.findOne({
      deleteAccountToken: token,
      deleteAccountExpires: { $gt: Date.now() }
    });
  }

  // Limpia el token de borrado (cancelación o expiración)
  async clearDeleteToken(userId) {
    const db = getDb();
    const collection = db.collection('users');
    await collection.updateOne(
      { _id: toObjectId(userId) },
      { $set: { deleteAccountToken: null, deleteAccountExpires: null } }
    );
  }
}

module.exports = UserStore;
