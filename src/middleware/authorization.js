function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Simple owner check: ownerGetter should be a function taking (req) and returning owner id
function requireOwnResource(ownerGetter) {
  return (req, res, next) => {
    const ownerId = ownerGetter(req);
    if (!req.user || req.user.id !== ownerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { requireRole, requireOwnResource };
