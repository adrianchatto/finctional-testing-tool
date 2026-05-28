import pg from 'pg';

const { Pool } = pg;

export function createDatabasePool(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return null;

  const url = new URL(databaseUrl);
  if (url.searchParams.get('sslmode') === 'require') {
    url.searchParams.set('sslmode', 'verify-full');
  }

  return new Pool({
    connectionString: url.toString(),
    ssl: databaseUrl.includes('supabase.co') || databaseUrl.includes('pooler.supabase.com')
      ? { rejectUnauthorized: false }
      : undefined
  });
}

export async function checkDatabase(pool) {
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'DATABASE_URL is not configured'
    };
  }

  const result = await pool.query('select now() as checked_at');
  return {
    configured: true,
    ok: true,
    checkedAt: result.rows[0].checked_at
  };
}

export async function verifySchema(pool) {
  if (!pool) {
    return {
      ok: false,
      checks: [
        {
          checkName: 'database_configured',
          passed: false,
          details: 'DATABASE_URL is not configured'
        }
      ]
    };
  }

  const expectedTables = [
    'organisations',
    'app_users',
    'projects',
    'project_members',
    'repositories',
    'ai_provider_configs',
    'project_ai_provider_overrides',
    'requirements',
    'stories',
    'acceptance_criteria',
    'test_cases',
    'test_executions',
    'evidence',
    'ai_usage_events',
    'audit_events'
  ];

  const tables = await pool.query(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [expectedTables]
  );
  const foundTables = new Set(tables.rows.map((row) => row.table_name));
  const missingTables = expectedTables.filter((tableName) => !foundTables.has(tableName));

  const bucket = await pool.query(
    `
      select id, public
      from storage.buckets
      where id = 'uat-evidence'
    `
  );

  const triggers = await pool.query(
    `
      select trigger_name
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'audit_events'
        and trigger_name = any($1::text[])
    `,
    [['audit_events_no_update', 'audit_events_no_delete']]
  );

  const rls = await pool.query(
    `
      select bool_and(relrowsecurity) as enabled
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = any($1::text[])
    `,
    [expectedTables]
  );

  const checks = [
    {
      checkName: 'tables_exist',
      passed: missingTables.length === 0,
      details: missingTables.length ? { missingTables } : { tableCount: expectedTables.length }
    },
    {
      checkName: 'evidence_bucket_exists',
      passed: bucket.rowCount === 1 && bucket.rows[0].public === false,
      details: bucket.rowCount === 1 ? bucket.rows[0] : 'uat-evidence bucket missing'
    },
    {
      checkName: 'audit_events_immutable_triggers_exist',
      passed: triggers.rowCount === 2,
      details: { triggerCount: triggers.rowCount }
    },
    {
      checkName: 'rls_enabled',
      passed: rls.rows[0]?.enabled === true,
      details: { enabled: rls.rows[0]?.enabled === true }
    }
  ];

  return {
    ok: checks.every((check) => check.passed),
    checks
  };
}
