const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_logs (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      user_name  VARCHAR(100) NOT NULL,
      work_date  DATE NOT NULL,
      tasks      TEXT NOT NULL,
      hours      NUMERIC(4, 1) CHECK (hours >= 0 AND hours <= 24),
      blockers   TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, work_date)
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS work_logs_user_date_idx ON work_logs (user_id, work_date DESC)'
  );
}

// Retries the first connection so the service survives starting before Postgres is ready.
async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

module.exports = { pool, migrate, waitForDb };
