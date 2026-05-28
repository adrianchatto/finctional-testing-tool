-- AI-driven functional testing and UAT platform schema.
-- Run this in Supabase SQL Editor or through a migration runner.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('Admin', 'Project Manager', 'Tester', 'Viewer');
  end if;

  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type project_status as enum ('active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'test_result_status') then
    create type test_result_status as enum ('pass', 'fail', 'blocked', 'not-run');
  end if;

  if not exists (select 1 from pg_type where typname = 'test_case_type') then
    create type test_case_type as enum ('functional', 'negative');
  end if;

  if not exists (select 1 from pg_type where typname = 'ai_provider') then
    create type ai_provider as enum ('openai', 'anthropic', 'gemini', 'azure-openai', 'aws-bedrock');
  end if;
end $$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  email text not null,
  name text not null,
  roles app_role[] not null default array['Viewer'::app_role],
  disabled boolean not null default false,
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_lowercase check (email = lower(email)),
  constraint app_users_roles_not_empty check (array_length(roles, 1) is not null)
);

create unique index if not exists app_users_email_unique on app_users(email);
create index if not exists app_users_organisation_id_idx on app_users(organisation_id);
create index if not exists app_users_auth_user_id_idx on app_users(auth_user_id);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  description text,
  status project_status not null default 'active',
  metadata jsonb not null default '{}',
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_organisation_id_idx on projects(organisation_id);
create index if not exists projects_status_idx on projects(status);
create index if not exists projects_created_by_idx on projects(created_by);

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role app_role not null,
  assigned_by uuid references app_users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on project_members(user_id);

create table if not exists repositories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  provider text not null default 'github',
  owner text not null,
  name text not null,
  url text not null,
  default_branch text not null default 'main',
  metadata jsonb not null default '{}',
  connected_by uuid references app_users(id) on delete set null,
  connected_at timestamptz not null default now(),
  constraint repositories_provider_supported check (provider in ('github'))
);

create index if not exists repositories_project_id_idx on repositories(project_id);
create unique index if not exists repositories_project_url_unique on repositories(project_id, url);

create table if not exists ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  provider ai_provider not null,
  model text not null,
  encrypted_api_key text not null,
  is_default boolean not null default false,
  connection_status text not null default 'untested',
  updated_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_provider_configs_organisation_id_idx on ai_provider_configs(organisation_id);
create unique index if not exists ai_provider_configs_one_default_per_org
  on ai_provider_configs(organisation_id)
  where is_default;

create table if not exists project_ai_provider_overrides (
  project_id uuid primary key references projects(id) on delete cascade,
  provider ai_provider not null,
  model text not null,
  updated_by uuid references app_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  prompt text not null,
  ai_response text,
  ai_suggestions jsonb not null default '{}',
  human_reviewed boolean not null default false,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requirements_project_id_idx on requirements(project_id);
create index if not exists requirements_created_by_idx on requirements(created_by);

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references requirements(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  narrative text not null,
  human_reviewed boolean not null default false,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_requirement_id_idx on stories(requirement_id);
create index if not exists stories_project_id_idx on stories(project_id);

create table if not exists acceptance_criteria (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  text text not null,
  editable boolean not null default true,
  human_reviewed boolean not null default false,
  provider ai_provider,
  model text,
  generated_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists acceptance_criteria_story_id_idx on acceptance_criteria(story_id);

create table if not exists test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  story_id uuid references stories(id) on delete set null,
  acceptance_criteria_id uuid references acceptance_criteria(id) on delete set null,
  title text not null,
  type test_case_type not null default 'functional',
  preconditions jsonb not null default '[]',
  steps jsonb not null default '[]',
  expected_outcome text not null,
  editable boolean not null default true,
  critical boolean not null default false,
  human_reviewed boolean not null default false,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists test_cases_project_id_idx on test_cases(project_id);
create index if not exists test_cases_story_id_idx on test_cases(story_id);
create index if not exists test_cases_critical_idx on test_cases(critical);

create table if not exists test_executions (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references test_cases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  status test_result_status not null,
  actual_outcome text,
  expected_outcome text,
  notes text,
  executed_by uuid references app_users(id) on delete set null,
  executed_at timestamptz not null default now(),
  constraint failed_or_blocked_requires_context check (
    status not in ('fail', 'blocked')
    or nullif(trim(coalesce(actual_outcome, '')), '') is not null
    or nullif(trim(coalesce(notes, '')), '') is not null
  )
);

create index if not exists test_executions_project_id_idx on test_executions(project_id);
create index if not exists test_executions_test_case_id_idx on test_executions(test_case_id);
create index if not exists test_executions_status_idx on test_executions(status);
create index if not exists test_executions_executed_at_idx on test_executions(executed_at desc);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references test_executions(id) on delete cascade,
  test_case_id uuid not null references test_cases(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  storage_bucket text not null default 'uat-evidence',
  storage_path text not null,
  notes text,
  uploaded_by uuid references app_users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists evidence_execution_id_idx on evidence(execution_id);
create index if not exists evidence_project_id_idx on evidence(project_id);
create unique index if not exists evidence_storage_location_unique on evidence(storage_bucket, storage_path);

create table if not exists ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  provider ai_provider not null,
  model text not null,
  prompt_type text not null,
  actor_id uuid references app_users(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_project_id_idx on ai_usage_events(project_id);
create index if not exists ai_usage_events_created_at_idx on ai_usage_events(created_at desc);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  actor_id uuid references app_users(id) on delete set null,
  actor_name text not null,
  action text not null,
  target text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_events_organisation_id_idx on audit_events(organisation_id);
create index if not exists audit_events_project_id_idx on audit_events(project_id);
create index if not exists audit_events_actor_id_idx on audit_events(actor_id);
create index if not exists audit_events_created_at_idx on audit_events(created_at desc);
create index if not exists audit_events_action_idx on audit_events(action);

create or replace function prevent_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events are immutable';
end;
$$;

drop trigger if exists audit_events_no_update on audit_events;
create trigger audit_events_no_update
before update on audit_events
for each row execute function prevent_audit_event_mutation();

drop trigger if exists audit_events_no_delete on audit_events;
create trigger audit_events_no_delete
before delete on audit_events
for each row execute function prevent_audit_event_mutation();

drop trigger if exists organisations_set_updated_at on organisations;
create trigger organisations_set_updated_at
before update on organisations
for each row execute function set_updated_at();

drop trigger if exists app_users_set_updated_at on app_users;
create trigger app_users_set_updated_at
before update on app_users
for each row execute function set_updated_at();

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
before update on projects
for each row execute function set_updated_at();

drop trigger if exists ai_provider_configs_set_updated_at on ai_provider_configs;
create trigger ai_provider_configs_set_updated_at
before update on ai_provider_configs
for each row execute function set_updated_at();

drop trigger if exists requirements_set_updated_at on requirements;
create trigger requirements_set_updated_at
before update on requirements
for each row execute function set_updated_at();

drop trigger if exists stories_set_updated_at on stories;
create trigger stories_set_updated_at
before update on stories
for each row execute function set_updated_at();

drop trigger if exists acceptance_criteria_set_updated_at on acceptance_criteria;
create trigger acceptance_criteria_set_updated_at
before update on acceptance_criteria
for each row execute function set_updated_at();

drop trigger if exists test_cases_set_updated_at on test_cases;
create trigger test_cases_set_updated_at
before update on test_cases
for each row execute function set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uat-evidence',
  'uat-evidence',
  false,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table organisations enable row level security;
alter table app_users enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table repositories enable row level security;
alter table ai_provider_configs enable row level security;
alter table project_ai_provider_overrides enable row level security;
alter table requirements enable row level security;
alter table stories enable row level security;
alter table acceptance_criteria enable row level security;
alter table test_cases enable row level security;
alter table test_executions enable row level security;
alter table evidence enable row level security;
alter table ai_usage_events enable row level security;
alter table audit_events enable row level security;

-- Server-side application code should use the Supabase service role or a dedicated
-- database role for now. End-user RLS policies should be added when auth is wired
-- to Supabase Auth or Entra ID.
