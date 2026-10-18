-- OBJECT. — billing (Phase D)
--
-- Payments are recorded ONLY by the Stripe webhook running with the service
-- role. Browsers can read their own orders and subscription, never write them.

alter table public.workspaces add column if not exists stripe_customer_id text unique;
alter table public.orders add column if not exists stripe_payment_intent_id text unique;

-- One paid One Showroom purchase per showroom.
create unique index if not exists orders_one_paid_per_showroom on public.orders (showroom_id) where status = 'paid';

-- Every Stripe event is processed at most once (Stripe retries deliveries).
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- After a cancellation, an unpaid subscription or a refund: unpublish the
-- showrooms the workspace is no longer entitled to. Showrooms bought with
-- One Showroom stay live; among the others, the most recently published ones
-- are kept up to the allowance. Drafts are never deleted.
create or replace function public.enforce_entitlement(p_workspace uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  allowance integer;
  unpublished integer;
begin
  select (case when exists (select 1 from public.subscriptions s where s.workspace_id = w.id and s.status in ('active', 'trialing', 'past_due'))
               then w.studio_quota else 0 end) + w.bonus_publish_slots
    into allowance
  from public.workspaces w where w.id = p_workspace;
  if allowance is null then return 0; end if;

  with ranked as (
    select s.id, row_number() over (order by s.published_at desc nulls last, s.created_at desc) as rn
    from public.showrooms s
    where s.workspace_id = p_workspace and s.status = 'published'
      and not exists (select 1 from public.orders o where o.showroom_id = s.id and o.status = 'paid')
  ), dropped as (
    update public.showrooms s set status = 'draft'
    from ranked r where r.id = s.id and r.rn > allowance
    returning s.id
  )
  select count(*) into unpublished from dropped;
  return unpublished;
end $$;

revoke execute on function public.enforce_entitlement(uuid) from public, anon, authenticated;
grant execute on function public.enforce_entitlement(uuid) to service_role;

-- What the account page shows. Owner only.
create or replace function public.billing_overview()
returns table (
  plan text,
  subscription_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  has_customer boolean,
  paid_showrooms uuid[],
  allowance integer,
  used integer
)
language sql stable security definer set search_path = public as $$
  select
    e.plan,
    s.status,
    s.current_period_end,
    coalesce(s.cancel_at_period_end, false),
    w.stripe_customer_id is not null,
    coalesce((select array_agg(o.showroom_id) from public.orders o where o.workspace_id = w.id and o.status = 'paid' and o.showroom_id is not null), '{}'),
    e.allowance,
    e.used
  from public.workspaces w
  left join public.subscriptions s on s.workspace_id = w.id
  cross join lateral public.publish_entitlement(w.id) e
  where w.owner_id = auth.uid()
  order by w.created_at
  limit 1
$$;
grant execute on function public.billing_overview() to authenticated;
