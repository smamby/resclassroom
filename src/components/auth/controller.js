const User = require('../user/models/User');
const UserStore = require('../user/store');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { sign } = jwt;
const SECRET = process.env.JWT_SECRET || 'change-me-please';

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
      // Issue token
      const token = sign({ userId: created._id || created.id, role: created.role }, SECRET, { expiresIn: '1h' });
      // Send token as HttpOnly cookie
      res.cookie('tokenAuth', token, { httpOnly: true, sameSite: 'lax' });
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
      const token = sign({ userId: user._id || user.id, role: user.role }, SECRET, { expiresIn: '20m' });
      res.cookie('tokenAuth', token, { httpOnly: true, sameSite: 'lax' });
      // Sanitize user object for the response to avoid leaking passwordHash
      const sanitizedUser = {
        _id: user._id,
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      };
      res.status(200).json({ user: sanitizedUser });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = AuthController;
