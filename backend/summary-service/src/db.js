const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS summaries (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL,
      period_from  DATE NOT NULL,
      period_to    DATE NOT NULL,
      log_count    INTEGER NOT NULL,
      summary      TEXT NOT NULL,
      source       VARCHAR(20) NOT NULL,
      model        VARCHAR(100),
      generated_by INTEGER NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS summaries_user_created_idx ON summaries (user_id, created_at DESC)'
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
