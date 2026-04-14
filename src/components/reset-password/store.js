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

class ResetPasswordStore {
  async findByToken(token) {
    const db = getDb();
    const collection = db.collection('users');
    return await collection.findOne({ 
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
  }

  async setResetToken(email, token, expires) {
    const db = getDb();
    const collection = db.collection('users');
    const result = await collection.updateOne(
      { email: email.toLowerCase() },
      { $set: { resetPasswordToken: token, resetPasswordExpires: expires } }
    );
    return result.modifiedCount > 0;
  }

  async updatePassword(userId, newPasswordHash) {
    const db = getDb();
    const collection = db.collection('users');
    const result = await collection.updateOne(
      { _id: toObjectId(userId) },
      { 
        $set: { passwordHash: newPasswordHash },
        $unset: { resetPasswordToken: '', resetPasswordExpires: '' }
      }
    );
    return result.modifiedCount > 0;
  }
}

module.exports = ResetPasswordStore;
