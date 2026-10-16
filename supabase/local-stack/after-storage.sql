-- Hosted Supabase grants these to the API roles; row-level policies decide access.
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant all on all sequences in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema storage to anon, authenticated, service_role;
alter table storage.buckets enable row level security;
