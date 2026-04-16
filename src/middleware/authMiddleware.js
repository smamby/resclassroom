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
    // Skip if user is already set (e.g., by test shim)
    if (req.user) {
      return next();
    }
    const token = getTokenFromCookies(req.headers.cookie);
    if (!token) {
      req.user = null;
      return next();
    }
    const payload = verify(token, SECRET);
    const roles = Array.isArray(payload.role) ? payload.role : [payload.role];
    req.user = { id: String(payload.userId), role: roles };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
}

module.exports = { authenticate };
