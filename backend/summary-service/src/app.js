const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('./db');
const { requireAuth, requireRole } = require('./auth');
const { summarize } = require('./summarizer');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';
const WORKLOG_SERVICE_URL = process.env.WORKLOG_SERVICE_URL || 'http://worklog-service:4002';
const ALLOWED_DAYS = [7, 14, 30];

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

class UpstreamError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Calls another service with the caller's own token, so that service enforces its own access rules.
async function callService(url, authorization) {
  const res = await fetch(url, { headers: { Authorization: authorization } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new UpstreamError(res.status, body.error || `Upstream error ${res.status}`);
  return body;
}

function toSummary(row) {
  return {
    id: row.id,
    userId: row.user_id,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    logCount: row.log_count,
    summary: row.summary,
    source: row.source,
    model: row.model,
    createdAt: row.created_at,
  };
}

const SUMMARY_COLUMNS = `id, user_id, to_char(period_from, 'YYYY-MM-DD') AS period_from,
  to_char(period_to, 'YYYY-MM-DD') AS period_to, log_count, summary, source, model, created_at`;

function parseUserId(req, res) {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: 'Invalid user id' });
    return null;
  }
  return userId;
}

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '2kb' }));

  // AI calls cost money, so cap how many summaries one manager can generate.
  const generateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: Number(process.env.SUMMARY_RATE_LIMIT || 30),
    keyGenerator: (req) => `user:${req.user.id}`,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Summary limit reached, please try again later' },
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Managers: latest saved summary for an employee.
  app.get('/api/summaries/:userId', requireAuth, requireRole('manager'), async (req, res, next) => {
    try {
      const userId = parseUserId(req, res);
      if (userId === null) return undefined;
      const { rows } = await pool.query(
        `SELECT ${SUMMARY_COLUMNS} FROM summaries WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      return res.json({ summary: rows[0] ? toSummary(rows[0]) : null });
    } catch (err) {
      return next(err);
    }
  });

  // Managers: generate a fresh AI summary of an employee's logs for the last N days.
  app.post(
    '/api/summaries/:userId',
    requireAuth,
    requireRole('manager'),
    generateLimiter,
    async (req, res, next) => {
      try {
        const userId = parseUserId(req, res);
        if (userId === null) return undefined;
        const days = Number(req.body?.days ?? 7);
        if (!ALLOWED_DAYS.includes(days)) {
          return res.status(400).json({ error: `days must be one of ${ALLOWED_DAYS.join(', ')}` });
        }
        const from = daysAgo(days - 1);
        const to = daysAgo(0);
        const auth = req.headers.authorization;

        const [{ user }, { logs }] = await Promise.all([
          callService(`${AUTH_SERVICE_URL}/api/users/${userId}`, auth),
          callService(`${WORKLOG_SERVICE_URL}/api/logs/user/${userId}?from=${from}&to=${to}`, auth),
        ]);

        if (!logs.length) {
          return res.status(422).json({ error: `${user.name} has no work logs in the last ${days} days` });
        }

        const result = await summarize({ employeeName: user.name, from, to, logs });
        const { rows } = await pool.query(
          `INSERT INTO summaries
             (user_id, period_from, period_to, log_count, summary, source, model, generated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING ${SUMMARY_COLUMNS}`,
          [userId, from, to, logs.length, result.text, result.source, result.model, req.user.id]
        );
        return res.status(201).json({ summary: toSummary(rows[0]) });
      } catch (err) {
        if (err instanceof UpstreamError) {
          return res.status(err.status === 404 ? 404 : 502).json({ error: err.message });
        }
        return next(err);
      }
    }
  );

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    return res.status(500).json({ error: 'Could not generate summary' });
  });

  return app;
}

module.exports = { buildApp };
