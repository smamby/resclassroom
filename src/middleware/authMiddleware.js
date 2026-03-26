const { verify } = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change-me-please';

function getTokenFromCookies(cookieHeader) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const tok = cookies.find(c => c.startsWith('tokenAuth='));
  return tok ? tok.split('=')[1] : null;
}

function authenticate(req, res, next) {
  try {
    const token = getTokenFromCookies(req.headers.cookie);
    if (!token) {
      req.user = null;
      return next();
    }
    const payload = verify(token, SECRET);
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
}

module.exports = { authenticate };
