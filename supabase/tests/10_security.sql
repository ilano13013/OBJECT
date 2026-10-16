-- Security & lifecycle tests for the OBJECT. schema.
-- Run on a database with 00_supabase_stub.sql + all migrations applied:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/10_security.sql
-- Every check raises (and stops the run) on failure.

\set QUIET on
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create table if not exists tests.ids (k text primary key, v text);
grant select, insert on tests.ids to anon, authenticated;
truncate tests.ids;

create or replace function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on function tests.ok(boolean, text) to anon, authenticated;

create or replace function tests.id(key text) returns text language sql stable as $$ select v from tests.ids where k = key $$;
grant execute on function tests.id(text) to anon, authenticated;

-- Impersonation helpers (transaction-local, like PostgREST does).
create or replace function tests.login(key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tests.id(key), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
grant execute on function tests.login(text), tests.logout() to anon, authenticated, postgres;

-- ── Fixtures: two merchants ────────────────────────────────────────────────
insert into auth.users (email, raw_user_meta_data) values
  ('alice@example.com', '{"display_name":"Alice"}'),
  ('bruno@example.com', '{}');
insert into tests.ids select 'alice', id::text from auth.users where email = 'alice@example.com';
insert into tests.ids select 'bruno', id::text from auth.users where email = 'bruno@example.com';
insert into tests.ids select 'ws_alice', w.id::text from public.workspaces w join auth.users u on u.id = w.owner_id where u.email = 'alice@example.com';
insert into tests.ids select 'ws_bruno', w.id::text from public.workspaces w join auth.users u on u.id = w.owner_id where u.email = 'bruno@example.com';

select tests.ok((select count(*) = 2 from public.profiles), 'signup trigger creates a profile per user');
select tests.ok((select display_name = 'Alice' from public.profiles where email = 'alice@example.com'), 'display name copied from signup metadata');
select tests.ok((select count(*) = 2 from public.workspaces), 'signup trigger creates a workspace per user');

-- ── Alice creates and edits a showroom ─────────────────────────────────────
begin;
select tests.login('alice');
insert into tests.ids select 'cuff', id::text from public.create_showroom('Cuff 01', 'editorial', '{"mode":"photo","images":[],"productName":"Cuff 01"}');
select tests.ok((select slug = 'cuff-01' from public.showrooms where id = tests.id('cuff')::uuid), 'slug derived from the title');
select tests.ok((select status = 'draft' from public.showrooms where id = tests.id('cuff')::uuid), 'new showrooms start as drafts');
select public.save_draft(tests.id('cuff')::uuid, format('{"mode":"photo","template":"editorial","productName":"Cuff 01","description":"Titanium","images":[{"src":"asset:%s/%s/11111111-1111-1111-1111-111111111111.webp","alt":"Cuff"}],"purchaseUrl":"https://shop.example.com/cuff"}', tests.id('ws_alice'), tests.id('cuff'))::jsonb);
select tests.ok((select product_name = 'Cuff 01' and purchase_url = 'https://shop.example.com/cuff' from public.showroom_content where showroom_id = tests.id('cuff')::uuid), 'save_draft derives columns server-side');

-- No plan, no slot: publishing is refused by the server.
select tests.ok((select not ok and issues[1] like 'Your plan has no free publishing slot%' from public.publish_showroom(tests.id('cuff')::uuid)), 'publish refused without an entitlement');
commit;

-- Grant Alice one slot (as an operator would), then publish.
update public.workspaces set bonus_publish_slots = 1 where id = tests.id('ws_alice')::uuid;
begin;
select tests.login('alice');
select tests.ok((select ok from public.publish_showroom(tests.id('cuff')::uuid)), 'publish succeeds with a free slot');
select tests.ok((select status = 'published' from public.showrooms where id = tests.id('cuff')::uuid), 'status is published');
-- Editing after publishing changes the draft only.
select public.save_draft(tests.id('cuff')::uuid, format('{"mode":"photo","template":"editorial","productName":"Cuff 01 (edit)","images":[{"src":"asset:%s/%s/11111111-1111-1111-1111-111111111111.webp","alt":"Cuff"}]}', tests.id('ws_alice'), tests.id('cuff'))::jsonb);
commit;

-- ── Alice cannot bypass the server ─────────────────────────────────────────
begin;
select tests.login('alice');
do $$ begin
  begin update public.showrooms set status = 'published' where id = tests.id('cuff')::uuid; raise exception 'FAILED: status writable';
  exception when insufficient_privilege then raise notice 'ok - status column is not writable by clients'; end;
  begin update public.showroom_content set published_json = '{}' where showroom_id = tests.id('cuff')::uuid; raise exception 'FAILED: published_json writable';
  exception when insufficient_privilege then raise notice 'ok - published snapshot is not writable by clients'; end;
  begin update public.workspaces set bonus_publish_slots = 99 where id = tests.id('ws_alice')::uuid; raise exception 'FAILED: quota writable';
  exception when insufficient_privilege then raise notice 'ok - quota columns are not writable by clients'; end;
  begin insert into public.orders (workspace_id, stripe_session_id, status) values (tests.id('ws_alice')::uuid, 'cs_fake', 'paid'); raise exception 'FAILED: orders writable';
  exception when insufficient_privilege then raise notice 'ok - clients cannot create paid orders'; end;
  begin insert into public.subscriptions (workspace_id, status) values (tests.id('ws_alice')::uuid, 'active'); raise exception 'FAILED: subscriptions writable';
  exception when insufficient_privilege then raise notice 'ok - clients cannot grant themselves a subscription'; end;
  begin insert into public.showroom_analytics (showroom_id, event_type) values (tests.id('cuff')::uuid, 'view'); raise exception 'FAILED: analytics writable';
  exception when insufficient_privilege then raise notice 'ok - analytics only through track_event'; end;
end $$;
rollback;

-- ── Bruno sees nothing private of Alice ────────────────────────────────────
begin;
select tests.login('bruno');
select tests.ok((select count(*) = 0 from public.showroom_content), 'other merchants cannot read drafts');
select tests.ok((select count(*) = 0 from public.workspaces where id = tests.id('ws_alice')::uuid), 'other merchants cannot read workspaces');
select tests.ok((select count(*) = 0 from public.profiles where email = 'alice@example.com'), 'other merchants cannot read profiles');
select tests.ok((select count(*) = 0 from public.publish_entitlement(tests.id('ws_alice')::uuid)), 'entitlements are private');
do $$ begin
  begin perform public.save_draft(tests.id('cuff')::uuid, '{"productName":"hacked"}'); raise exception 'FAILED: foreign save';
  exception when no_data_found then raise notice 'ok - cannot save another merchant''s draft'; end;
  begin perform public.publish_showroom(tests.id('cuff')::uuid); raise exception 'FAILED: foreign publish';
  exception when no_data_found then raise notice 'ok - cannot publish another merchant''s showroom'; end;
  begin perform public.unpublish_showroom(tests.id('cuff')::uuid); raise exception 'FAILED: foreign unpublish';
  exception when no_data_found then raise notice 'ok - cannot unpublish another merchant''s showroom'; end;
  begin perform public.showroom_stats(tests.id('cuff')::uuid, 7); raise exception 'FAILED: foreign stats';
  exception when no_data_found then raise notice 'ok - cannot read another merchant''s statistics'; end;
  begin perform public.set_showroom_slug(tests.id('cuff')::uuid, 'stolen'); raise exception 'FAILED: foreign slug';
  exception when no_data_found then raise notice 'ok - cannot rename another merchant''s showroom'; end;
  begin
    insert into public.assets (showroom_id, workspace_id, storage_path, asset_type, mime_type, file_size)
    values (tests.id('cuff')::uuid, tests.id('ws_alice')::uuid, tests.id('ws_alice') || '/' || tests.id('cuff') || '/22222222-2222-2222-2222-222222222222.webp', 'image', 'image/webp', 10);
    raise exception 'FAILED: foreign asset row';
  exception when insufficient_privilege then raise notice 'ok - cannot attach files to another merchant''s showroom'; end;
  begin
    insert into storage.objects (bucket_id, name) values ('showroom-assets', tests.id('ws_alice') || '/' || tests.id('cuff') || '/x.webp');
    raise exception 'FAILED: foreign upload';
  exception when insufficient_privilege then raise notice 'ok - cannot upload into another merchant''s folder'; end;
end $$;
select tests.ok((select count(*) = 0 from public.showrooms), 'other merchants do not see published showrooms in their own list');
delete from public.showrooms where id = tests.id('cuff')::uuid;
select set_config('role', 'postgres', true);
select tests.ok((select count(*) = 1 from public.showrooms where id = tests.id('cuff')::uuid), 'cannot delete another merchant''s showroom');
rollback;

-- ── Visitors read the published snapshot only ─────────────────────────────
begin;
select tests.logout();
select tests.ok((select config ->> 'productName' = 'Cuff 01' from public.get_published_showroom('cuff-01')), 'visitors get the published snapshot, not the newer draft');
do $$ begin
  begin perform 1 from public.showrooms; raise exception 'FAILED: anon reads showrooms table';
  exception when insufficient_privilege then raise notice 'ok - no table is publicly readable; only the published snapshot via RPC'; end;
end $$;
do $$ begin
  begin perform 1 from public.showroom_content; raise exception 'FAILED: anon reads content';
  exception when insufficient_privilege then raise notice 'ok - visitors cannot read draft content'; end;
  begin perform public.save_draft(tests.id('cuff')::uuid, '{}'); raise exception 'FAILED: anon executes save_draft';
  exception when insufficient_privilege then raise notice 'ok - visitors cannot call owner functions'; end;
end $$;
select public.track_event('cuff-01', 'view', 'visitor0001');
select public.track_event('cuff-01', 'view', 'visitor0001');
select public.track_event('cuff-01', 'view', 'visitor0002');
select public.track_event('cuff-01', 'purchase_click', 'visitor0002');
select public.track_event('cuff-01', 'teleport', 'visitor0002');
select public.track_event('does-not-exist', 'view', 'visitor0003');
select public.track_event('cuff-01', 'view', '<script>');
commit;

begin;
select tests.login('alice');
select tests.ok((select sum(views) = 3 and sum(visitors) = 2 and sum(clicks) = 1 from public.showroom_stats(tests.id('cuff')::uuid, 7)),
  'stats: reloads deduplicated, bad events ignored, invalid visitor ids kept anonymous');
select tests.ok((select count(*) = 7 from public.showroom_stats(tests.id('cuff')::uuid, 7)), 'stats return one row per day');
commit;

-- ── Storage: visitors read only files the live version uses ────────────────
begin;
select tests.login('alice');
insert into public.assets (id, showroom_id, workspace_id, storage_path, asset_type, mime_type, file_size, original_name)
values ('11111111-1111-1111-1111-111111111111', tests.id('cuff')::uuid, tests.id('ws_alice')::uuid,
        tests.id('ws_alice') || '/' || tests.id('cuff') || '/11111111-1111-1111-1111-111111111111.webp', 'image', 'image/webp', 2048, 'cuff.webp'),
       ('33333333-3333-3333-3333-333333333333', tests.id('cuff')::uuid, tests.id('ws_alice')::uuid,
        tests.id('ws_alice') || '/' || tests.id('cuff') || '/33333333-3333-3333-3333-333333333333.webp', 'image', 'image/webp', 2048, 'draft-only.webp');
insert into storage.objects (bucket_id, name) values
  ('showroom-assets', tests.id('ws_alice') || '/' || tests.id('cuff') || '/11111111-1111-1111-1111-111111111111.webp'),
  ('showroom-assets', tests.id('ws_alice') || '/' || tests.id('cuff') || '/33333333-3333-3333-3333-333333333333.webp');
do $$ begin
  begin
    insert into public.assets (showroom_id, workspace_id, storage_path, asset_type, mime_type, file_size)
    values (tests.id('cuff')::uuid, tests.id('ws_alice')::uuid, tests.id('ws_alice') || '/' || tests.id('cuff') || '/44444444-4444-4444-4444-444444444444.webp', 'image', 'image/webp', 99999999);
    raise exception 'FAILED: oversize asset';
  exception when check_violation then raise notice 'ok - oversize files rejected by the database'; end;
  begin
    insert into public.assets (showroom_id, workspace_id, storage_path, asset_type, mime_type, file_size)
    values (tests.id('cuff')::uuid, tests.id('ws_alice')::uuid, '../../etc/passwd', 'image', 'image/webp', 10);
    raise exception 'FAILED: path traversal';
  exception when check_violation then raise notice 'ok - storage paths must follow workspace/showroom/asset'; end;
  begin
    insert into public.assets (showroom_id, workspace_id, storage_path, asset_type, mime_type, file_size)
    values (tests.id('cuff')::uuid, tests.id('ws_alice')::uuid, tests.id('ws_alice') || '/' || tests.id('cuff') || '/55555555-5555-5555-5555-555555555555.html', 'image', 'text/html', 10);
    raise exception 'FAILED: html asset';
  exception when check_violation then raise notice 'ok - only image and model types are accepted'; end;
end $$;
commit;

begin;
select tests.logout();
select tests.ok((select count(*) = 1 from storage.objects where name like '%11111111-1111-1111-1111-111111111111.webp'), 'visitors can read a file the published version uses');
select tests.ok((select count(*) = 0 from storage.objects where name like '%33333333-3333-3333-3333-333333333333.webp'), 'visitors cannot read draft-only files');
commit;

begin;
select tests.login('bruno');
select tests.ok((select count(*) = 1 from storage.objects), 'another merchant sees only published files of others, not drafts');
commit;

-- ── Unpublish: link stops working ──────────────────────────────────────────
begin;
select tests.login('alice');
select public.unpublish_showroom(tests.id('cuff')::uuid);
commit;
begin;
select tests.logout();
select tests.ok((select count(*) = 0 from public.get_published_showroom('cuff-01')), 'unpublished showrooms are no longer public');
select tests.ok((select count(*) = 0 from storage.objects), 'files of unpublished showrooms are private again');
commit;

-- ── Quota: Studio plan with quota 1 ────────────────────────────────────────
update public.workspaces set bonus_publish_slots = 0, studio_quota = 1 where id = tests.id('ws_alice')::uuid;
insert into public.subscriptions (workspace_id, status) values (tests.id('ws_alice')::uuid, 'active');
begin;
select tests.login('alice');
insert into tests.ids select 'vase', id::text from public.create_showroom('Vase', 'gallery', '{}');
select public.save_draft(tests.id('vase')::uuid, '{"mode":"photo","productName":"Vase","images":[{"src":"asset:x","alt":"Vase"}]}');
select tests.ok((select ok from public.publish_showroom(tests.id('cuff')::uuid)), 'studio plan: first showroom publishes');
select tests.ok((select not ok from public.publish_showroom(tests.id('vase')::uuid)), 'studio plan: quota blocks the second');
select tests.ok((select ok from public.publish_showroom(tests.id('cuff')::uuid)), 'republishing a live showroom does not use another slot');
select tests.ok((select plan = 'studio' and allowance = 1 and used = 1 from public.publish_entitlement(tests.id('ws_alice')::uuid)), 'entitlement reports plan and usage');
commit;

-- A One Showroom purchase unlocks that showroom regardless of quota.
insert into public.orders (workspace_id, showroom_id, stripe_session_id, status) values (tests.id('ws_alice')::uuid, tests.id('vase')::uuid, 'cs_test_1', 'paid');
begin;
select tests.login('alice');
select tests.ok((select ok from public.publish_showroom(tests.id('vase')::uuid)), 'a paid One Showroom order unlocks publishing');
commit;

-- Cancelled subscription: no new publishing beyond paid showrooms.
update public.subscriptions set status = 'canceled' where workspace_id = tests.id('ws_alice')::uuid;
begin;
select tests.login('alice');
insert into tests.ids select 'lamp', id::text from public.create_showroom('Lamp', 'orbit', '{}');
select public.save_draft(tests.id('lamp')::uuid, '{"mode":"photo","productName":"Lamp","images":[{"src":"asset:y","alt":"Lamp"}]}');
select tests.ok((select not ok from public.publish_showroom(tests.id('lamp')::uuid)), 'cancelled subscription: no new slots');
commit;

-- Slugs are unique and validated.
begin;
select tests.login('alice');
do $$ begin
  begin perform public.set_showroom_slug(tests.id('lamp')::uuid, 'cuff-01'); raise exception 'FAILED: duplicate slug';
  exception when unique_violation then raise notice 'ok - slugs are unique'; end;
  begin perform public.set_showroom_slug(tests.id('lamp')::uuid, 'x'); raise exception 'FAILED: short slug';
  exception when invalid_parameter_value then raise notice 'ok - slugs need 3+ characters'; end;
end $$;
select tests.ok((select public.set_showroom_slug(tests.id('lamp')::uuid, 'Lampe Été!') = 'lampe-ete'), 'slugs are normalised (accents folded)');
commit;

-- Deleting an account removes everything it owned.
delete from auth.users where email = 'alice@example.com';
select tests.ok((select count(*) = 0 from public.showrooms) and (select count(*) = 0 from public.assets), 'account deletion cascades to showrooms and assets');

\echo 'ALL SECURITY TESTS PASSED'
