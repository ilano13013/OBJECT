-- Billing rules (Phase D). Run after 10_security.sql's helpers exist.
\set QUIET on
truncate tests.ids;
insert into auth.users (email) values ('carla@example.com');
insert into tests.ids select 'carla', id::text from auth.users where email = 'carla@example.com';
insert into tests.ids select 'ws_carla', w.id::text from public.workspaces w join auth.users u on u.id = w.owner_id where u.email = 'carla@example.com';

-- Carla has a Studio subscription with quota 2 and three published showrooms.
update public.workspaces set studio_quota = 2 where id = tests.id('ws_carla')::uuid;
insert into public.subscriptions (workspace_id, stripe_subscription_id, status) values (tests.id('ws_carla')::uuid, 'sub_1', 'active');
begin;
select tests.login('carla');
insert into tests.ids select 'a', id::text from public.create_showroom('Alpha', 'orbit', '{}');
insert into tests.ids select 'b', id::text from public.create_showroom('Bravo', 'orbit', '{}');
insert into tests.ids select 'c', id::text from public.create_showroom('Charlie', 'orbit', '{}');
select public.save_draft(tests.id(k)::uuid, '{"mode":"photo","productName":"X","images":[{"src":"asset:x","alt":"x"}]}') from unnest(array['a','b','c']) k;
select tests.ok((select ok from public.publish_showroom(tests.id('a')::uuid)), 'studio: first publishes');
select tests.ok((select ok from public.publish_showroom(tests.id('b')::uuid)), 'studio: second publishes');
select tests.ok((select not ok from public.publish_showroom(tests.id('c')::uuid)), 'studio: third blocked by quota 2');
commit;

-- Charlie is bought separately (One Showroom).
insert into public.orders (workspace_id, showroom_id, stripe_session_id, status) values (tests.id('ws_carla')::uuid, tests.id('c')::uuid, 'cs_c', 'paid');
begin;
select tests.login('carla');
select tests.ok((select ok from public.publish_showroom(tests.id('c')::uuid)), 'one showroom purchase publishes beyond the quota');
select tests.ok((select plan = 'studio' and allowance = 2 and used = 2 and cardinality(paid_showrooms) = 1 from public.billing_overview()), 'billing overview reflects plan, usage and purchases');
commit;

do $$ begin
  begin insert into public.orders (workspace_id, showroom_id, stripe_session_id, status) values (tests.id('ws_carla')::uuid, tests.id('c')::uuid, 'cs_c2', 'paid');
    raise exception 'FAILED: two paid orders for one showroom';
  exception when unique_violation then raise notice 'ok - one paid purchase per showroom'; end;
end $$;

-- Clients cannot call the enforcement function.
begin;
select tests.login('carla');
do $$ begin
  begin perform public.enforce_entitlement(tests.id('ws_carla')::uuid); raise exception 'FAILED: client can enforce';
  exception when insufficient_privilege then raise notice 'ok - only the server enforces entitlements'; end;
  begin perform 1 from public.stripe_events; raise exception 'FAILED: client reads stripe events';
  exception when insufficient_privilege then raise notice 'ok - Stripe event log is private'; end;
end $$;
rollback;

-- Subscription ends: showrooms beyond the remaining allowance go back to draft; the bought one stays.
update public.subscriptions set status = 'canceled' where workspace_id = tests.id('ws_carla')::uuid;
select tests.ok((select public.enforce_entitlement(tests.id('ws_carla')::uuid) = 2), 'cancellation unpublishes the two subscription showrooms');
select tests.ok((select status = 'published' from public.showrooms where id = tests.id('c')::uuid), 'the One Showroom purchase stays live');
select tests.ok((select count(*) = 3 from public.showrooms where workspace_id = tests.id('ws_carla')::uuid), 'drafts are kept, nothing is deleted');

-- Past due is a grace period: nothing is unpublished.
update public.subscriptions set status = 'past_due' where workspace_id = tests.id('ws_carla')::uuid;
begin;
select tests.login('carla');
select public.publish_showroom(tests.id('a')::uuid);
commit;
select tests.ok((select public.enforce_entitlement(tests.id('ws_carla')::uuid) = 0), 'past due keeps showrooms live during retries');

-- Refund of the One Showroom purchase: that showroom loses its slot.
update public.subscriptions set status = 'unpaid' where workspace_id = tests.id('ws_carla')::uuid;
update public.orders set status = 'refunded' where stripe_session_id = 'cs_c';
select public.enforce_entitlement(tests.id('ws_carla')::uuid);
select tests.ok((select count(*) = 0 from public.showrooms where workspace_id = tests.id('ws_carla')::uuid and status = 'published'), 'refund + unpaid subscription: everything unpublished');

\echo 'ALL BILLING TESTS PASSED'
