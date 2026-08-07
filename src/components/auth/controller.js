const User = require('../user/models/User');
const UserStore = require('../user/store');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { sign } = jwt;
const SECRET = process.env.JWT_SECRET || 'change-me-please';
const ACCESS_TTL = process.env.JWT_EXPIRES_IN || '20m';

const isDeployed = process.env.NODE_ENV === 'production';

const tokenCookieDevelopment = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 20 * 60 * 1000
}

const tokenCookieProduction = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 20 * 60 * 1000
}

class AuthController {
    constructor() {
      this.store = new UserStore();
    }

  async logout(req, res) {
    try {
      // Clear the token cookie on logout
      res.clearCookie('tokenAuth');
      res.status(200).json({ message: 'Logout successful' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async me(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const user = await this.store.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      res.status(200).json({
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: userRoles,
        createdAt: user.createdAt
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

    async register(req, res) {
    try {
      const { name, surname, email, password } = req.body;
      if (!name || !surname || !email || !password) {
        return res.status(400).json({ error: 'Missing fields' });
      }
      const existing = await this.store.findByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const userData = {
        name,
        surname,
        email,
        passwordHash,
        // role defaults to guest via User model default
      };
      const user = new User(userData);
      const created = await this.store.create(user);
      const roles = Array.isArray(created.role) ? created.role : [created.role];
      const token = sign({ userId: String(created._id), role: roles, sessionIat: Math.floor(Date.now() / 1000), pwdv: user.passwordVersion || 0 }, SECRET, { expiresIn: ACCESS_TTL });
      // Send token as HttpOnly cookie
      res.cookie('tokenAuth', token, isDeployed
        ? tokenCookieProduction
        : tokenCookieDevelopment
      );
      res.status(201).json({ user: created });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Missing credentials' });
      }
      const user = await this.store.findByEmail(email);
      // Debug: log whether passwordHash exists for debugging login failures
      console.log('[AUTH] LOGIN attempt for', email, 'passwordHashPresent=', Boolean(user && user.passwordHash));
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const valid = bcrypt.compareSync(password, user.passwordHash || '');
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      const token = sign({ userId: String(user._id), role: userRoles, sessionIat: Math.floor(Date.now() / 1000), pwdv: user.passwordVersion || 0 }, SECRET, { expiresIn: ACCESS_TTL });
      res.cookie('tokenAuth', token, isDeployed
        ? tokenCookieProduction
        : tokenCookieDevelopment
      );
      const sanitizedUser = {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: userRoles,
        createdAt: user.createdAt
      };
      res.status(200).json({ user: sanitizedUser });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = AuthController;
