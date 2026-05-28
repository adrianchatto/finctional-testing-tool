-- Supabase schema verification for the UAT platform.
-- Expected: all rows return true.

with expected_tables(table_name) as (
  values
    ('organisations'),
    ('app_users'),
    ('projects'),
    ('project_members'),
    ('repositories'),
    ('ai_provider_configs'),
    ('project_ai_provider_overrides'),
    ('requirements'),
    ('stories'),
    ('acceptance_criteria'),
    ('test_cases'),
    ('test_executions'),
    ('evidence'),
    ('ai_usage_events'),
    ('audit_events')
)
select
  'tables_exist' as check_name,
  count(*) = (select count(*) from expected_tables) as passed,
  array_agg(expected_tables.table_name order by expected_tables.table_name) filter (
    where information_schema.tables.table_name is null
  ) as missing
from expected_tables
left join information_schema.tables
  on information_schema.tables.table_schema = 'public'
 and information_schema.tables.table_name = expected_tables.table_name;

select
  'evidence_bucket_exists' as check_name,
  exists (
    select 1 from storage.buckets where id = 'uat-evidence'
  ) as passed;

select
  'audit_events_immutable_triggers_exist' as check_name,
  count(*) = 2 as passed
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'audit_events'
  and trigger_name in ('audit_events_no_update', 'audit_events_no_delete');

select
  'rls_enabled' as check_name,
  bool_and(relrowsecurity) as passed
from pg_class
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and pg_class.relname in (
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
  );
