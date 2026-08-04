const { verify, sign } = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change-me-please';
// TTL del access token (se renueva de forma deslizante mientras haya actividad)
const ACCESS_TTL = process.env.JWT_EXPIRES_IN || '20m';
// Tope absoluto de la sesión: aunque haya actividad, la sesión muere a los 40 min
const SESSION_TTL_MS = 40 * 60 * 1000;
// Si al token le quedan menos de 5 min, se re-firma uno nuevo (sliding refresh)
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

function getTokenFromCookies(cookieHeader) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const tok = cookies.find(c => c.startsWith('tokenAuth='));
  return tok ? tok.split('=')[1] : null;
}

function setTokenCookie(res, token) {
  res.cookie('tokenAuth', token, { httpOnly: true, sameSite: 'lax', maxAge: 20 * 60 * 1000 });
}

// Verifica el token y, si corresponde, lo renueva (sliding refresh).
// Devuelve el payload si es válido, o null si hubo error (ya respondió).
function verifyAndMaybeRefresh(req, res, token) {
  let payload;
  try {
    payload = verify(token, SECRET);
  } catch (err) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return null;
  }

  // Momento de inicio de sesión (compat con tokens viejos sin sessionIat)
  let sessionIat = payload.sessionIat || payload.iat || Math.floor(Date.now() / 1000);
  // Compat con tokens emitidos antes del fix: se firmaba sessionIat en milisegundos
  if (sessionIat > 1e11) {
    sessionIat = Math.floor(sessionIat / 1000);
  }
  const sessionStartMs = sessionIat * 1000;

  // Tope absoluto de sesión: aunque haya actividad, no superar los 40 min
  if (Date.now() > sessionStartMs + SESSION_TTL_MS) {
    res.clearCookie('tokenAuth');
    res.status(401).json({ error: 'Session expired' });
    return null;
  }

  // Sliding refresh: si el token está por expirar, se re-firma uno nuevo
  const expiresAtMs = (payload.exp || 0) * 1000;
  if (expiresAtMs - Date.now() < REFRESH_THRESHOLD_MS) {
    const roles = Array.isArray(payload.role) ? payload.role : [payload.role];
    const newToken = sign({ userId: payload.userId, role: roles, sessionIat }, SECRET, { expiresIn: ACCESS_TTL });
    setTokenCookie(res, newToken);
    payload = verify(newToken, SECRET);
  }

  return payload;
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
    const payload = verifyAndMaybeRefresh(req, res, token);
    if (!payload) return;
    const roles = Array.isArray(payload.role) ? payload.role : [payload.role];
    req.user = { id: String(payload.userId), role: roles };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
}

function authenticateAdmin(req, res, next) {
  try {
    // Skip if user is already set (e.g., by test shim)
    if (req.user && req.user.role && Array.isArray(req.user.role) && req.user.role.includes('admin')) {
      return next();
    }
    const token = getTokenFromCookies(req.headers.cookie);
    if (!token) {
      req.user = null;
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    const payload = verifyAndMaybeRefresh(req, res, token);
    if (!payload) return;
    const roles = Array.isArray(payload.role) ? payload.role : [payload.role];
    if (!roles.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = { id: String(payload.userId), role: roles };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
}


module.exports = { authenticate, authenticateAdmin };
