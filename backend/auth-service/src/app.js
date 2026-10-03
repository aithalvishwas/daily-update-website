const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { signToken, requireAuth, requireRole } = require('./auth');

const BCRYPT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, team: row.team };
}

function validateNewUser(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const team = typeof body.team === 'string' ? body.team.trim().slice(0, 100) : null;
  if (!name || name.length > 100) return { error: 'Name is required (max 100 characters)' };
  if (!EMAIL_RE.test(email) || email.length > 255) return { error: 'A valid email is required' };
  if (password.length < 8 || password.length > 128) {
    return { error: 'Password must be 8 to 128 characters' };
  }
  return { name, email, password, team: team || null };
}

async function createUser({ name, email, password, team }, role) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, team)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, team`,
    [name, email, hash, role, team]
  );
  return rows[0];
}

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  // Slow down password guessing and signup spam.
  const credentialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT || 20),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Self sign-up always creates an employee. Managers are seeded or created by a manager.
  app.post('/api/auth/register', credentialLimiter, async (req, res, next) => {
    try {
      const input = validateNewUser(req.body || {});
      if (input.error) return res.status(400).json({ error: input.error });
      const user = await createUser(input, 'employee');
      return res.status(201).json({ token: signToken(user), user: publicUser(user) });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
      return next(err);
    }
  });

  app.post('/api/auth/login', credentialLimiter, async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = rows[0];
      // Same response for unknown email and wrong password so accounts can't be enumerated.
      const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
      if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
      return res.json({ token: signToken(user), user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (!rows[0]) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: publicUser(rows[0]) });
    } catch (err) {
      return next(err);
    }
  });

  // Managers: list all employees.
  app.get('/api/users', requireAuth, requireRole('manager'), async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, email, role, team FROM users
         WHERE role = 'employee' ORDER BY name ASC`
      );
      return res.json({ users: rows });
    } catch (err) {
      return next(err);
    }
  });

  app.get('/api/users/:id', requireAuth, requireRole('manager'), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (!rows[0]) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: publicUser(rows[0]) });
    } catch (err) {
      return next(err);
    }
  });

  // Managers: create an employee or another manager account.
  app.post('/api/users', requireAuth, requireRole('manager'), async (req, res, next) => {
    try {
      const input = validateNewUser(req.body || {});
      if (input.error) return res.status(400).json({ error: input.error });
      const role = req.body.role === 'manager' ? 'manager' : 'employee';
      const user = await createUser(input, role);
      return res.status(201).json({ user: publicUser(user) });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
      return next(err);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { buildApp, createUser };
