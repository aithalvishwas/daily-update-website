const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'manager')),
      team          VARCHAR(100),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
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
