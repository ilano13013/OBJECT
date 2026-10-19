-- Accounts created with Google, Apple or GitHub: their name arrives as
-- full_name / name (or user_name on GitHub) instead of display_name.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, m ->> 'email', ''),
    nullif(left(btrim(coalesce(m ->> 'display_name', m ->> 'full_name', m ->> 'name', m ->> 'user_name', '')), 80), '')
  );
  insert into public.workspaces (owner_id, name) values (new.id, 'My studio');
  return new;
end $$;
