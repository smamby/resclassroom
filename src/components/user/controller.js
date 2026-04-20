const User = require('./models/User');
const UserStore = require('./store');

class UserController {
  constructor() {
    this.store = new UserStore();
  }

  async promoteUser(req, res) {
    try {
      const requester = req.user;
      if (!requester || !Array.isArray(requester.role) || !requester.role.includes('admin')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { id } = req.params;
      const { role } = req.body;
      const allowed = ['instructor'];
      if (!allowed.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const user = await this.store.findById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const currentRoles = Array.isArray(user.role) ? user.role : ['visitor'];
      if (!currentRoles.includes(role)) {
        const newRoles = [...currentRoles, role];
        await this.store.update(id, { role: newRoles, updatedAt: new Date() });
      }
      const updated = await this.store.findById(id);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async createUser(req, res) {
    try {
      const userData = {
        ...req.body,
        createdAt: new Date()
      };
      const user = new User(userData);
      const result = await this.store.create(user);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getUserById(req, res) {
    try {
      const requester = req.user;
      const requestedId = req.params.id;
      const requesterRoles = Array.isArray(requester?.role) ? requester.role : [];
      if (requesterRoles.includes('admin')) {
        const user = await this.store.findById(requestedId);
        if (user) {
          res.status(200).json(user);
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      } else if (requester && String(requester.id) === String(requestedId)) {
        const user = await this.store.findById(requestedId);
        if (user) {
          res.status(200).json(user);
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      } else {
        res.status(403).json({ error: 'Forbidden' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getUserByEmail(req, res) {
    try {
      const user = await this.store.findByEmail(req.params.email);
      if (user) {
        res.status(200).json(user);
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await this.store.findAll();
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateUser(req, res) {
    try {
      const requester = req.user;
      const requestedId = req.params.id;
      const requesterRoles = Array.isArray(requester?.role) ? requester.role : [];
      const isAdmin = requesterRoles.includes('admin');
      const isOwner = requester && String(requester.id) === String(requestedId);
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updates = {
        ...req.body,
        updatedAt: new Date()
      };
      if (isOwner && !isAdmin) {
        delete updates.role;
        delete updates.passwordHash;
      }
      const user = await this.store.update(req.params.id, updates);
      if (user) {
        res.status(200).json(user);
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteUser(req, res) {
    try {
      const result = await this.store.delete(req.params.id);
      if (result) {
        res.status(200).json({ message: 'User deleted successfully' });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = UserController;
