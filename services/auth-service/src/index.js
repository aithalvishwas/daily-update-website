const { pool, migrate, waitForDb } = require('./db');
const { buildApp, createUser } = require('./app');

// Creates the first manager account from env vars if no manager exists yet.
async function seedManager() {
  const email = process.env.MANAGER_EMAIL;
  const password = process.env.MANAGER_PASSWORD;
  if (!email || !password) return;
  const { rows } = await pool.query("SELECT 1 FROM users WHERE role = 'manager' LIMIT 1");
  if (rows.length) return;
  await createUser(
    {
      name: process.env.MANAGER_NAME || 'Manager',
      email: email.trim().toLowerCase(),
      password,
      team: null,
    },
    'manager'
  );
  console.log(`Seeded manager account ${email}`);
}

async function main() {
  await waitForDb();
  await migrate();
  await seedManager();
  const port = Number(process.env.PORT || 4001);
  buildApp().listen(port, () => console.log(`auth-service listening on ${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
