# Deploying With Coolify and Supabase

This guide describes how to deploy the current MVP release candidate with Coolify, and how to prepare it to use a Supabase Postgres database that can later be reused from Azure.

## Current State

The repository currently contains:

- `apps/api` - Fastify API
- `apps/web` - React/Vite frontend
- in-memory MVP storage for users, projects, test cases, executions, evidence, and audit events
- no production database persistence yet

That means:

- You can deploy the app to Coolify now for demo/staging.
- Data will not survive container restarts until the API persistence layer is moved from in-memory storage to Supabase Postgres.
- The Supabase setup below defines the target production database contract.

## Recommended Deployment Shape

Use three resources:

1. Supabase hosted project for Postgres.
2. Coolify API application for `apps/api`.
3. Coolify web application for `apps/web`.

Keep Supabase separate from Coolify. This makes the later Azure move easier because Azure will point to the same Supabase project and connection strings.

## Supabase Setup

Create a Supabase project first.

In the Supabase dashboard, collect:

- Project URL
- anon public key, if the frontend later needs Supabase client access
- service role key, server-side only if needed later
- Postgres connection string
- transaction pooler connection string

For a Node API running in a container, prefer the Supabase transaction pooler connection string for normal web traffic:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:6543/postgres?sslmode=require
```

Keep a direct connection string separately for migrations and one-off admin tasks:

```env
DIRECT_DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
```

Use the connection strings from the Supabase dashboard rather than hand-building them. The examples above are only shape references.

## Database Schema Target

The current in-memory store should eventually be replaced by tables similar to:

```sql
create table organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  email text not null unique,
  name text not null,
  roles text[] not null default array['Viewer'],
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  name text not null,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}',
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table repositories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  provider text not null default 'github',
  owner text not null,
  name text not null,
  url text not null,
  default_branch text not null default 'main',
  connected_at timestamptz not null default now()
);

create table requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  title text not null,
  prompt text not null,
  ai_response text,
  ai_suggestions jsonb not null default '{}',
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table stories (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid references requirements(id),
  project_id uuid references projects(id),
  title text not null,
  narrative text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table acceptance_criteria (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references stories(id),
  text text not null,
  editable boolean not null default true,
  provider text,
  model text,
  generated_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  story_id uuid references stories(id),
  title text not null,
  type text not null,
  preconditions jsonb not null default '[]',
  steps jsonb not null default '[]',
  expected_outcome text not null,
  critical boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table test_executions (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid references test_cases(id),
  project_id uuid references projects(id),
  status text not null,
  actual_outcome text,
  expected_outcome text,
  notes text,
  executed_by uuid references users(id),
  executed_at timestamptz not null default now()
);

create table evidence (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid references test_executions(id),
  test_case_id uuid references test_cases(id),
  project_id uuid references projects(id),
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  storage_path text not null,
  notes text,
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  actor_id uuid references users(id),
  actor_name text not null,
  action text not null,
  target text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  provider text not null,
  model text not null,
  encrypted_api_key text not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);
```

For evidence files, use Supabase Storage or another object store. Store only metadata and storage paths in Postgres.

## Required Environment Variables

Use the same environment variable names in Coolify and Azure.

API:

```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_URL=<supabase transaction pooler connection string>
DIRECT_DATABASE_URL=<supabase direct connection string for migrations>
JWT_SECRET=<long random secret>
APP_ORIGIN=https://<your-web-domain>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side-only key if using Supabase Storage/Auth APIs>
EVIDENCE_BUCKET=uat-evidence
```

Web:

```env
VITE_API_URL=https://<your-api-domain>
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key, only if frontend Supabase access is needed>
```

Do not expose:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- AI provider API keys
- `JWT_SECRET`

## Coolify Deployment Option A: Two Applications

This is the simplest Coolify setup.

### API Application

Create a new Coolify application from the GitHub repository.

Settings:

- Base directory: `apps/api`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Port: `3001`

Environment variables:

- Add the API variables from the previous section.
- Keep `HOST=0.0.0.0` inside Coolify so the container listens externally.

Health check:

```text
/health
```

Expected response:

```json
{"status":"ok"}
```

### Web Application

Create a second Coolify application from the same GitHub repository.

Settings:

- Base directory: `apps/web`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Port: Coolify-managed static serving port

Environment variables:

- Add the web variables from the previous section.
- `VITE_API_URL` must point at the public API URL.

## Coolify Deployment Option B: Docker Compose

Use this when you want one Coolify resource controlling both API and web containers.

The repository includes `docker-compose.coolify.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, and `apps/web/nginx.conf`.

In Coolify:

1. Create a new Docker Compose resource.
2. Select this GitHub repository.
3. Set the compose file path to `docker-compose.coolify.yml`.
4. Add the environment variables listed above.
5. Set the public web domain to the `web` service.
6. Set the public API domain to the `api` service.
7. Deploy.

The included compose file is:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3001
      HOST: 0.0.0.0
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_DATABASE_URL: ${DIRECT_DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      APP_ORIGIN: ${APP_ORIGIN}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      EVIDENCE_BUCKET: ${EVIDENCE_BUCKET}
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL}
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY}
    depends_on:
      api:
        condition: service_healthy
```

Example `apps/api/Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace @functional-testing-tool/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npm", "start"]
```

Example `apps/web/Dockerfile`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @functional-testing-tool/web
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
```

## DNS and TLS

Use separate hostnames:

```text
uat-api.example.com
uat.example.com
```

In Coolify:

- assign the API domain to the API resource
- assign the web domain to the web resource
- enable HTTPS/TLS
- set `APP_ORIGIN=https://uat.example.com`
- set `VITE_API_URL=https://uat-api.example.com`

## Deployment Checks

Before deployment:

```sh
npm test
npm run build
npm audit --omit=dev
```

After deployment:

```sh
curl https://uat-api.example.com/health
```

Expected:

```json
{"status":"ok"}
```

Then verify in the browser:

- login works
- project dashboard loads
- repository connection workflow works
- AI generation workflow returns deterministic output or real provider output
- manual execution can save actual result
- screenshot and document evidence can be uploaded and viewed
- audit log records key actions
- release readiness changes when tests fail or are blocked

## Moving Later To Azure

Keep Supabase unchanged.

On Azure, deploy:

- API to Azure Container Apps
- web app to Azure Static Web Apps, Azure Container Apps, or Azure App Service

Use the same environment variable names:

```env
DATABASE_URL
DIRECT_DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
EVIDENCE_BUCKET
JWT_SECRET
APP_ORIGIN
VITE_API_URL
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Only the application hostnames change:

```env
APP_ORIGIN=https://<azure-web-domain>
VITE_API_URL=https://<azure-api-domain>
```

The database migration does not change because Supabase remains the database.

## Production Hardening Checklist

Before a production release:

- Replace in-memory API stores with Supabase-backed repositories.
- Add migrations and run them with `DIRECT_DATABASE_URL`.
- Use pooled `DATABASE_URL` for runtime API queries.
- Move evidence binary content to Supabase Storage.
- Store only evidence metadata and storage paths in Postgres.
- Encrypt AI provider keys.
- Replace demo auth with signed JWT sessions and secure password hashing.
- Add rate limiting and request size limits.
- Add structured logging.
- Add backup/restore checks for Supabase.
- Add Playwright acceptance tests for deployed environments.
- Confirm Coolify environment variables are marked runtime-enabled.

## References

- Coolify applications: https://coolify.io/docs/applications/index
- Coolify environment variables: https://coolify.io/docs/knowledge-base/environment-variables
- Supabase connection strings: https://supabase.com/docs/reference/postgres/connection-strings
- Supabase SSL enforcement: https://supabase.com/docs/guides/platform/ssl-enforcement
- Supavisor connection terminology: https://supabase.com/docs/guides/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO
