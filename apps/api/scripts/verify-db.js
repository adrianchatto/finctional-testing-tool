import { createDatabasePool, verifySchema } from '../src/db.js';

const pool = createDatabasePool();

try {
  const result = await verifySchema(pool);
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
