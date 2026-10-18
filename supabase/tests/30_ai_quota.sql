-- AI generation quota (Tripo). Run after 10_security.sql's helpers exist.
-- reserve/release run as the server (service role); ai_quota as the user.
\set QUIET on
truncate tests.ids;
insert into auth.users (email) values ('free@example.com'), ('oneoff@example.com'), ('studio@example.com'), ('lapsed@example.com');
insert into tests.ids select split_part(u.email, '@', 1), u.id::text from auth.users u where u.email in ('free@example.com', 'oneoff@example.com', 'studio@example.com', 'lapsed@example.com');
insert into tests.ids select 'ws_' || split_part(u.email, '@', 1), w.id::text from public.workspaces w join auth.users u on u.id = w.owner_id
  where u.email in ('free@example.com', 'oneoff@example.com', 'studio@example.com', 'lapsed@example.com');

create or replace function tests.input(ws text) returns text[] language sql as $$
  select array[tests.id(ws) || '/ai-inputs/' || gen_random_uuid() || '/0.jpg']
$$;
-- Reserves and returns the error keyword, or 'ok'.
create or replace function tests.try_reserve(ws text, req uuid default gen_random_uuid()) returns text language plpgsql as $$
begin
  perform public.reserve_ai_generation(tests.id(ws)::uuid, req, tests.input(ws));
  return 'ok';
exception when raise_exception then return sqlerrm;
end $$;
create or replace function tests.finish_all(ws text) returns void language sql as $$
  update public.ai_generations set status = 'succeeded' where workspace_id = tests.id(ws)::uuid and status in ('reserved', 'running')
$$;

-- One Showroom purchase: a paid order, no subscription.
begin;
select tests.login('oneoff');
insert into tests.ids select 'oneoff_room', id::text from public.create_showroom('Bought', 'orbit', '{}');
commit;
insert into public.orders (workspace_id, showroom_id, stripe_session_id, status) values (tests.id('ws_oneoff')::uuid, tests.id('oneoff_room')::uuid, 'cs_ai_1', 'paid');

insert into public.subscriptions (workspace_id, stripe_subscription_id, status, current_period_start, current_period_end)
values (tests.id('ws_studio')::uuid, 'sub_ai_1', 'active', now() - interval '3 days', now() + interval '27 days');

select tests.ok(tests.try_reserve('ws_free') = 'not_subscribed', 'free account: generation refused');
select tests.ok(tests.try_reserve('ws_oneoff') = 'not_subscribed', 'One Showroom purchase only (49 €): generation refused');
select tests.ok((select count(*) = 0 from public.ai_generations where workspace_id in (tests.id('ws_free')::uuid, tests.id('ws_oneoff')::uuid)), 'refusals reserve nothing');

-- Active subscriber.
select tests.ok(tests.try_reserve('ws_studio', '00000000-0000-4000-8000-000000000001') = 'ok', 'active subscriber: generation allowed');
select tests.ok((select created = false from public.reserve_ai_generation(tests.id('ws_studio')::uuid, '00000000-0000-4000-8000-000000000001', tests.input('ws_studio'))), 'same request delivered twice: no second reservation');
select tests.ok((select count(*) = 1 from public.ai_generations where workspace_id = tests.id('ws_studio')::uuid), 'duplicate click reserves once');
select tests.ok(tests.try_reserve('ws_studio') = 'busy', 'a second generation waits for the one in progress');

select tests.finish_all('ws_studio');
select tests.try_reserve('ws_studio'); select tests.finish_all('ws_studio');
select tests.try_reserve('ws_studio'); select tests.finish_all('ws_studio');
select tests.try_reserve('ws_studio'); select tests.finish_all('ws_studio');
begin;
select tests.login('studio');
select tests.ok((select used = 4 and quota = 5 and eligible from public.ai_quota()), '4 of 5 used: shown as 1 remaining');
commit;
select tests.ok(tests.try_reserve('ws_studio') = 'ok', '4 used: the fifth is allowed');

-- Technical failure: quota restored.
select tests.ok((select public.release_ai_generation(id, 'Tripo unavailable') from public.ai_generations where workspace_id = tests.id('ws_studio')::uuid and status = 'reserved'), 'technical failure releases the reservation');
begin;
select tests.login('studio');
select tests.ok((select used = 4 and eligible from public.ai_quota()), 'released generation does not count');
commit;
select tests.ok((select not public.release_ai_generation(id, 'late') from public.ai_generations where workspace_id = tests.id('ws_studio')::uuid and status = 'succeeded' limit 1), 'a finished generation can never be released');

-- Voluntary regeneration: new request, new credit.
select tests.ok(tests.try_reserve('ws_studio') = 'ok', 'regeneration is a new request');
select tests.finish_all('ws_studio');
select tests.ok(tests.try_reserve('ws_studio') = 'quota_exhausted', '5 used: generation blocked');
begin;
select tests.login('studio');
select tests.ok((select used = 5 and not eligible and reason = 'quota_exhausted' from public.ai_quota()), 'exhausted quota is shown as 0 remaining');
commit;

-- A refused-for-content result (failed) still counts; stale reservations do not.
update public.subscriptions set current_period_start = now(), current_period_end = now() + interval '1 month' where workspace_id = tests.id('ws_studio')::uuid;
begin;
select tests.login('studio');
select tests.ok((select used = 0 and eligible from public.ai_quota()), 'confirmed renewal (new period): quota reset to 5');
commit;
select tests.ok((select count(*) = 6 from public.ai_generations where workspace_id = tests.id('ws_studio')::uuid), 'history of the previous period is kept');
select tests.try_reserve('ws_studio');
update public.ai_generations set created_at = now() - interval '20 minutes' where workspace_id = tests.id('ws_studio')::uuid and status = 'reserved';
begin;
select tests.login('studio');
select tests.ok((select used = 0 and in_progress is null from public.ai_quota()), 'a reservation never sent to Tripo stops counting after 15 minutes');
commit;
select tests.ok(tests.try_reserve('ws_studio') = 'ok', 'stale reservation does not block a new one');
select tests.ok((select count(*) = 1 from public.ai_generations where workspace_id = tests.id('ws_studio')::uuid and status = 'released' and error_message like 'Reservation expired%'), 'stale reservation is released');
update public.ai_generations set status = 'failed' where workspace_id = tests.id('ws_studio')::uuid and status = 'reserved';
begin;
select tests.login('studio');
select tests.ok((select used = 1 from public.ai_quota()), 'a result refused for its content counts');
commit;

-- Subscription ends or lapses.
insert into public.subscriptions (workspace_id, stripe_subscription_id, status, current_period_end)
values (tests.id('ws_lapsed')::uuid, 'sub_ai_2', 'active', now() - interval '1 day');
select tests.ok(tests.try_reserve('ws_lapsed') = 'period_ended', 'expired period: generation refused');
update public.subscriptions set status = 'canceled', current_period_end = now() + interval '5 days' where workspace_id = tests.id('ws_lapsed')::uuid;
select tests.ok(tests.try_reserve('ws_lapsed') = 'not_subscribed', 'cancelled subscription: generation refused');
update public.subscriptions set status = 'past_due' where workspace_id = tests.id('ws_lapsed')::uuid;
select tests.ok(tests.try_reserve('ws_lapsed') = 'not_subscribed', 'failed renewal payment (past due): generation refused');
update public.subscriptions set status = 'trialing' where workspace_id = tests.id('ws_lapsed')::uuid;
select tests.ok(tests.try_reserve('ws_lapsed') = 'not_subscribed', 'unpaid trial: generation refused');

-- Input paths must be the workspace's own photos.
do $$ begin
  begin
    perform public.reserve_ai_generation(tests.id('ws_studio')::uuid, gen_random_uuid(), array[tests.id('ws_free') || '/ai-inputs/' || gen_random_uuid() || '/0.jpg']);
    raise exception 'FAILED: foreign input accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid_inputs' then raise; end if;
    raise notice 'ok - another workspace''s photos are refused';
  end;
end $$;

-- The browser can read, never write.
begin;
select tests.login('studio');
do $$ begin
  begin perform public.reserve_ai_generation(tests.id('ws_studio')::uuid, gen_random_uuid(), tests.input('ws_studio')); raise exception 'FAILED: client reserves';
  exception when insufficient_privilege then raise notice 'ok - only the server reserves generations'; end;
  begin perform public.release_ai_generation(gen_random_uuid(), 'x'); raise exception 'FAILED: client releases';
  exception when insufficient_privilege then raise notice 'ok - only the server releases generations'; end;
  begin perform public.ai_quota_state(tests.id('ws_free')::uuid); raise exception 'FAILED: client reads any quota';
  exception when insufficient_privilege then raise notice 'ok - quota state of other workspaces is private'; end;
  begin insert into public.ai_generations (workspace_id, request_id, mode, input_paths, period_end) values (tests.id('ws_studio')::uuid, gen_random_uuid(), 'single', tests.input('ws_studio'), now()); raise exception 'FAILED: client inserts generation';
  exception when insufficient_privilege then raise notice 'ok - clients cannot insert generations'; end;
  begin update public.ai_generations set status = 'released'; raise exception 'FAILED: client updates generation';
  exception when insufficient_privilege then raise notice 'ok - clients cannot change a generation'; end;
  begin insert into public.library_models (workspace_id, storage_path, file_size, source) values (tests.id('ws_studio')::uuid, tests.id('ws_studio') || '/library/' || gen_random_uuid() || '.glb', 1, 'ai'); raise exception 'FAILED: client inserts model';
  exception when insufficient_privilege then raise notice 'ok - clients cannot add library models directly'; end;
end $$;
select tests.ok((select count(*) > 0 from public.ai_generations), 'subscriber reads their generation history');
commit;
begin;
select tests.login('free');
select tests.ok((select count(*) = 0 from public.ai_generations), 'other accounts see no generations');
select tests.ok((select not eligible and reason = 'not_subscribed' from public.ai_quota()), 'free account sees the locked state');
commit;

-- Ending the subscription keeps the library.
insert into public.library_models (workspace_id, storage_path, file_size, source) values (tests.id('ws_studio')::uuid, tests.id('ws_studio') || '/library/' || gen_random_uuid() || '.glb', 1024, 'ai');
update public.subscriptions set status = 'canceled' where workspace_id = tests.id('ws_studio')::uuid;
select tests.ok(tests.try_reserve('ws_studio') = 'not_subscribed', 'cancelled: new generations suspended');
begin;
select tests.login('studio');
select tests.ok((select count(*) = 1 from public.library_models), 'cancelled: generated models stay in the library');
commit;
