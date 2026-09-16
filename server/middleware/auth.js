const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'aapna_tiffin_jwt_secret_production_2026';

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Fetch fresh user state from DB
    const user = db.prepare(`SELECT id, email, role, preferred_language, is_blocked FROM users WHERE id = ?`).get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }
    if (user.is_blocked === 1) {
      return res.status(403).json({ error: 'Your account has been suspended by administration. Please contact support.' });
    }

    // Attach role-specific profile ID if available
    let profile = null;
    if (user.role === 'CUSTOMER') {
      profile = db.prepare(`SELECT * FROM customer_profiles WHERE user_id = ?`).get(user.id);
    } else if (user.role === 'PROVIDER') {
      profile = db.prepare(`SELECT * FROM provider_profiles WHERE user_id = ?`).get(user.id);
    }

    req.user = {
      ...user,
      profileId: profile ? profile.id : null,
      profile: profile || {}
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires role: ${allowedRoles.join(' or ')}` });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  authenticateJWT,
  requireRole
};
