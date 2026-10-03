const express = require('express');
const helmet = require('helmet');
const { pool } = require('./db');
const { requireAuth, requireRole } = require('./auth');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 5000;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Reads ?from=&to= with a default window of the last 30 days.
function parseRange(query) {
  const from = query.from ?? daysAgo(30);
  const to = query.to ?? today();
  if (!isValidDate(from) || !isValidDate(to)) return { error: 'from/to must be YYYY-MM-DD' };
  if (from > to) return { error: 'from must be on or before to' };
  return { from, to };
}

function toLog(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    workDate: row.work_date,
    tasks: row.tasks,
    hours: row.hours === null ? null : Number(row.hours),
    blockers: row.blockers,
    updatedAt: row.updated_at,
  };
}

async function listLogs(userId, { from, to }) {
  const { rows } = await pool.query(
    `SELECT id, user_id, user_name, to_char(work_date, 'YYYY-MM-DD') AS work_date,
            tasks, hours, blockers, updated_at
     FROM work_logs
     WHERE user_id = $1 AND work_date BETWEEN $2 AND $3
     ORDER BY work_date DESC`,
    [userId, from, to]
  );
  return rows.map(toLog);
}

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Create or update the caller's log for a day (one entry per user per day).
  app.post('/api/logs', requireAuth, async (req, res, next) => {
    try {
      const body = req.body || {};
      const workDate = body.workDate ?? today();
      const tasks = typeof body.tasks === 'string' ? body.tasks.trim() : '';
      const blockers = typeof body.blockers === 'string' ? body.blockers.trim() : '';
      const hours = body.hours === undefined || body.hours === null || body.hours === ''
        ? null
        : Number(body.hours);

      if (!isValidDate(workDate)) return res.status(400).json({ error: 'workDate must be YYYY-MM-DD' });
      // Allow one day ahead of UTC so employees in timezones east of UTC can log their local "today".
      if (workDate > daysAgo(-1)) return res.status(400).json({ error: 'Cannot log work for a future date' });
      if (!tasks || tasks.length > MAX_TEXT) {
        return res.status(400).json({ error: `Describe your work (1 to ${MAX_TEXT} characters)` });
      }
      if (blockers.length > MAX_TEXT) return res.status(400).json({ error: 'Blockers text is too long' });
      if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 24)) {
        return res.status(400).json({ error: 'Hours must be between 0 and 24' });
      }

      const { rows } = await pool.query(
        `INSERT INTO work_logs (user_id, user_name, work_date, tasks, hours, blockers)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, work_date)
         DO UPDATE SET tasks = EXCLUDED.tasks, hours = EXCLUDED.hours,
                       blockers = EXCLUDED.blockers, user_name = EXCLUDED.user_name,
                       updated_at = now()
         RETURNING id, user_id, user_name, to_char(work_date, 'YYYY-MM-DD') AS work_date,
                   tasks, hours, blockers, updated_at`,
        [req.user.id, req.user.name, workDate, tasks, hours, blockers || null]
      );
      return res.status(201).json({ log: toLog(rows[0]) });
    } catch (err) {
      return next(err);
    }
  });

  app.get('/api/logs/me', requireAuth, async (req, res, next) => {
    try {
      const range = parseRange(req.query);
      if (range.error) return res.status(400).json({ error: range.error });
      return res.json({ logs: await listLogs(req.user.id, range) });
    } catch (err) {
      return next(err);
    }
  });

  app.delete('/api/logs/:id', requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
      // Scoped to the caller so nobody can delete another person's log.
      const { rowCount } = await pool.query(
        'DELETE FROM work_logs WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Log not found' });
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  });

  // Managers: activity overview per employee (last log date, entries in the last 7 days).
  app.get('/api/logs/overview', requireAuth, requireRole('manager'), async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT user_id,
                to_char(MAX(work_date), 'YYYY-MM-DD') AS last_log_date,
                COUNT(*) FILTER (WHERE work_date >= CURRENT_DATE - 6)::int AS logs_last_7_days
         FROM work_logs GROUP BY user_id`
      );
      return res.json({
        overview: rows.map((r) => ({
          userId: r.user_id,
          lastLogDate: r.last_log_date,
          logsLast7Days: r.logs_last_7_days,
        })),
      });
    } catch (err) {
      return next(err);
    }
  });

  // Managers: read any employee's logs.
  app.get('/api/logs/user/:userId', requireAuth, requireRole('manager'), async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
      const range = parseRange(req.query);
      if (range.error) return res.status(400).json({ error: range.error });
      return res.json({ logs: await listLogs(userId, range) });
    } catch (err) {
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

module.exports = { buildApp };
