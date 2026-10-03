const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

const TOKEN_TTL = process.env.JWT_TTL || '8h';

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: TOKEN_TTL, issuer: 'daily-update-auth' }
  );
}

// Verifies the bearer token and attaches { id, role, name } to req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'daily-update-auth',
    });
    req.user = { id: Number(payload.sub), role: payload.role, name: payload.name };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { signToken, requireAuth, requireRole };
