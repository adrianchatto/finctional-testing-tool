# Supabase Database Setup

Use this when configuring the database manually through the Supabase dashboard.

## Files

- Migration: `supabase/migrations/001_initial_uat_platform_schema.sql`
- Verification SQL: `supabase/verify_schema.sql`

## Run The Migration

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Create a new query.
4. Paste the full contents of `supabase/migrations/001_initial_uat_platform_schema.sql`.
5. Run it.

The migration creates:

- core product tables
- role/status/provider enums
- project membership
- repository metadata
- requirements, stories, acceptance criteria, and test cases
- manual test executions
- evidence metadata
- AI provider config and project override tables
- AI usage events
- immutable audit events
- `uat-evidence` Supabase Storage bucket
- RLS enabled on application tables

## Verify The Schema

After the migration runs:

1. Open a new SQL query.
2. Paste the contents of `supabase/verify_schema.sql`.
3. Run it.
4. Confirm every `passed` value is `true`.

You can also verify from the API package once `DATABASE_URL` is configured:

```sh
npm run db:verify --workspace @functional-testing-tool/api
```

The command prints JSON. `ok` should be `true`.

## Important Runtime Note

RLS is enabled, but end-user RLS policies are not yet defined because the app has not been wired to Supabase Auth or Entra ID. Until that is implemented, the server-side API should access Supabase using a trusted server-side credential only.

Do not expose any of these to the frontend:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- AI provider API keys
- `JWT_SECRET`

## Next Application Work

The database will exist after this migration, but the API currently still uses in-memory repositories. The next implementation step is replacing the in-memory store in `apps/api/src/app.js` with Supabase-backed repository functions.
