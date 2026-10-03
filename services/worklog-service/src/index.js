const { migrate, waitForDb } = require('./db');
const { buildApp } = require('./app');

async function main() {
  await waitForDb();
  await migrate();
  const port = Number(process.env.PORT || 4002);
  buildApp().listen(port, () => console.log(`worklog-service listening on ${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
