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
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const valid = bcrypt.compareSync(password, user.passwordHash || '');
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = sign({ userId: user._id || user.id, role: user.role }, SECRET, { expiresIn: '1h' });
      res.cookie('tokenAuth', token, { httpOnly: true, sameSite: 'lax' });
      res.status(200).json({ user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = AuthController;
