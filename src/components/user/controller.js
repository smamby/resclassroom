const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const UserStore = require('./store');
const BookingStore = require('../bookings/store');
const EmailService = require('../reset-password/emailService');
const ROLES = require('../../../common/roles');

const { sign } = jwt;
const SECRET = process.env.JWT_SECRET || 'change-me-please';
const ACCESS_TTL = process.env.JWT_EXPIRES_IN || '20m';
const DELETE_TOKEN_TTL_MS = 20 * 60 * 1000;
const isDeployed = process.env.NODE_ENV === 'production';
const tokenCookieDevelopment = { httpOnly: true, sameSite: 'lax', maxAge: 20 * 60 * 1000 };
const tokenCookieProduction = { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 20 * 60 * 1000 };

class UserController {
  constructor() {
    this.store = new UserStore();
    this.bookingStore = new BookingStore();
    this.emailService = new EmailService();
  }

  async updateMyProfile(req, res) {
    try {
      const body = req.body || {};
      const allowed = ['name', 'surname'];
      const forbidden = Object.keys(body).filter(k => !allowed.includes(k));
      if (forbidden.length > 0) {
        return res.status(400).json({ error: `Campo no permitido: ${forbidden[0]}` });
      }
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const surname = typeof body.surname === 'string' ? body.surname.trim() : '';
      if (!name || !surname) {
        return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
      }
      const updated = await this.store.update(req.user.id, { name, surname, updatedAt: new Date() });
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async changeMyPassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
      }
      const user = await this.store.findByIdFull(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (!bcrypt.compareSync(currentPassword, user.passwordHash || '')) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }
      const passwordHash = bcrypt.hashSync(newPassword, 10);
      const passwordVersion = (user.passwordVersion || 0) + 1;
      await this.store.update(req.user.id, { passwordHash, passwordVersion, updatedAt: new Date() });
      // Re-emitir token con el nuevo pwdv: la sesión actual sigue viva, las demás mueren
      const roles = Array.isArray(user.role) ? user.role : [user.role];
      const token = sign(
        { userId: String(user._id), role: roles, sessionIat: Math.floor(Date.now() / 1000), pwdv: passwordVersion },
        SECRET,
        { expiresIn: ACCESS_TTL }
      );
      res.cookie('tokenAuth', token, isDeployed ? tokenCookieProduction : tokenCookieDevelopment);
      const updated = await this.store.findById(req.user.id);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async promoteUser(req, res) {
    try {
      const requester = req.user;
      if (!requester || !Array.isArray(requester.role) || !requester.role.includes(ROLES.ADMIN)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { id } = req.params;
      const { role } = req.body;
      const allowed = [ROLES.INSTRUCTOR];
      if (!allowed.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const user = await this.store.findById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const currentRoles = Array.isArray(user.role) ? user.role : [ROLES.VISITOR];
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
      if (requesterRoles.includes(ROLES.ADMIN)) {
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
        // Sanitizar: no exponer credenciales ni tokens de reseteo
        const { passwordHash, resetPasswordToken, resetPasswordExpires, ...safe } = user;
        res.status(200).json(safe);
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
      const isAdmin = requesterRoles.includes(ROLES.ADMIN);
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
