-- OBJECT. — AI 3D generation (Tripo) and the workspace model library
--
-- Generations are reserved, confirmed and released ONLY by the server (service
-- role). Browsers read their own history and library; they can never write a
-- generation, change a quota or add a model to the library directly.
--
-- Quota rule: an active, paid Studio subscription gives `ai_generation_quota`
-- generations (5) per billing period. The period is the subscription's current
-- period, so the renewal Stripe sends (new current_period_end) starts a fresh
-- count. A One Showroom purchase gives no generation.

alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.workspaces add column if not exists ai_generation_quota integer not null default 5
  check (ai_generation_quota between 0 and 1000);

-- ── Library: models a workspace can reuse in any of its showrooms ──────────

create table if not exists public.library_models (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null default 'Untitled model' check (char_length(name) between 1 and 120),
  storage_path text not null unique,
  file_size bigint not null check (file_size > 0),
  source text not null check (source in ('ai')),
  generation_id uuid,
  -- First photo the model was generated from, shown as its thumbnail.
  preview_path text,
  created_at timestamptz not null default now(),
  check (storage_path ~ '^[0-9a-f-]{36}/library/[0-9a-f-]{36}\.glb$'),
  check (split_part(storage_path, '/', 1) = workspace_id::text)
);
create index if not exists library_models_workspace_idx on public.library_models (workspace_id, created_at desc);

alter table public.library_models enable row level security;
revoke all on public.library_models from anon, authenticated;
create policy "own library: read" on public.library_models for select to authenticated using (public.is_workspace_owner(workspace_id));
create policy "own library: rename" on public.library_models for update to authenticated
  using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy "own library: delete" on public.library_models for delete to authenticated using (public.is_workspace_owner(workspace_id));
grant select, delete on public.library_models to authenticated;
grant update (name) on public.library_models to authenticated;

-- ── Generations: one row per request sent (or about to be sent) to Tripo ───

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Client-chosen key: the same click delivered twice reserves only once.
  request_id uuid not null,
  -- reserved  : quota held, Tripo not called yet
  -- running   : Tripo task submitted
  -- succeeded : model stored in the library (consumes the quota)
  -- failed    : refused for the content itself (consumes the quota)
  -- released  : technical failure, the quota is given back
  status text not null default 'reserved' check (status in ('reserved', 'running', 'succeeded', 'failed', 'released')),
  mode text not null check (mode in ('single', 'multiview')),
  name text not null default 'Untitled model' check (char_length(name) between 1 and 120),
  input_paths text[] not null check (cardinality(input_paths) between 1 and 4),
  period_start timestamptz,
  period_end timestamptz not null,
  tripo_task_id text,
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  library_model_id uuid references public.library_models (id) on delete set null,
  -- Short lease so two concurrent status checks never store the model twice.
  finalizing_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workspace_id, request_id)
);
create index if not exists ai_generations_period_idx on public.ai_generations (workspace_id, period_end);
create index if not exists ai_generations_recent_idx on public.ai_generations (workspace_id, created_at desc);
create trigger ai_generations_touch before update on public.ai_generations for each row execute function public.touch_updated_at();

alter table public.ai_generations enable row level security;
revoke all on public.ai_generations from anon, authenticated;
create policy "own generations: read" on public.ai_generations for select to authenticated using (public.is_workspace_owner(workspace_id));
grant select on public.ai_generations to authenticated;

-- A reservation the server never turned into a Tripo task (crash, timeout)
-- stops holding quota after 15 minutes.
create or replace function public.ai_generation_counts(p_status text, p_created timestamptz) returns boolean
language sql stable as $$
  select p_status in ('running', 'succeeded', 'failed')
      or (p_status = 'reserved' and p_created > now() - interval '15 minutes')
$$;

-- Quota state of a workspace. Internal: callers check ownership first.
create or replace function public.ai_quota_state(p_workspace uuid)
returns table (
  eligible boolean,
  reason text,
  quota integer,
  used integer,
  period_start timestamptz,
  period_end timestamptz,
  in_progress uuid
)
language plpgsql stable security definer set search_path = public as $$
declare
  w public.workspaces;
  s public.subscriptions;
begin
  select * into w from public.workspaces where id = p_workspace;
  if not found then
    return query select false, 'no_workspace'::text, 0, 0, null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;
  select * into s from public.subscriptions where workspace_id = p_workspace;

  -- Only a paid, current Studio period qualifies. Trials, failed renewals
  -- (past_due), cancellations and One Showroom purchases do not.
  if s.workspace_id is null or s.status <> 'active' then
    return query select false, 'not_subscribed'::text, w.ai_generation_quota, 0, null::timestamptz, null::timestamptz, null::uuid;
    return;
  end if;
  if s.current_period_end is null or s.current_period_end <= now() then
    return query select false, 'period_ended'::text, w.ai_generation_quota, 0, null::timestamptz, s.current_period_end, null::uuid;
    return;
  end if;

  return query
  with g as (
    select * from public.ai_generations x where x.workspace_id = p_workspace and x.period_end = s.current_period_end
  )
  select
    (select count(*) from g where public.ai_generation_counts(g.status, g.created_at)) < w.ai_generation_quota,
    case when (select count(*) from g where public.ai_generation_counts(g.status, g.created_at)) >= w.ai_generation_quota then 'quota_exhausted' else null end,
    w.ai_generation_quota,
    (select count(*)::int from g where public.ai_generation_counts(g.status, g.created_at)),
    coalesce(s.current_period_start, s.current_period_end - interval '1 month'),
    s.current_period_end,
    (select x.id from public.ai_generations x
      where x.workspace_id = p_workspace and public.ai_generation_counts(x.status, x.created_at) and x.status in ('reserved', 'running')
      order by x.created_at desc limit 1);
end $$;
revoke execute on function public.ai_quota_state(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_state(uuid) to service_role;

-- What the studio shows: the caller's own workspace only.
create or replace function public.ai_quota()
returns table (eligible boolean, reason text, quota integer, used integer, period_start timestamptz, period_end timestamptz, in_progress uuid)
language sql stable security definer set search_path = public as $$
  select q.* from public.workspaces w
  cross join lateral public.ai_quota_state(w.id) q
  where w.owner_id = auth.uid()
  order by w.created_at
  limit 1
$$;
revoke execute on function public.ai_quota() from public, anon;
grant execute on function public.ai_quota() to authenticated;

-- Atomically reserves one generation. The workspace row is locked, so
-- concurrent requests (several tabs, devices, double clicks) are serialised
-- and can never reserve more than the quota. Replaying the same request_id
-- returns the existing reservation instead of a second one.
create or replace function public.reserve_ai_generation(p_workspace uuid, p_request uuid, p_inputs text[], p_name text default 'Untitled model')
returns table (id uuid, status text, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  q record;
  existing public.ai_generations;
  new_id uuid;
begin
  perform 1 from public.workspaces w where w.id = p_workspace for update;
  if not found then raise exception 'no_workspace'; end if;

  select * into existing from public.ai_generations g where g.workspace_id = p_workspace and g.request_id = p_request;
  if found then
    return query select existing.id, existing.status, false;
    return;
  end if;

  if p_inputs is null or cardinality(p_inputs) not between 1 and 4 then raise exception 'invalid_inputs'; end if;
  if exists (select 1 from unnest(p_inputs) p where p !~ ('^' || p_workspace::text || '/ai-inputs/[0-9a-f-]{36}/[0-9]\.(jpg|png|webp)$')) then
    raise exception 'invalid_inputs';
  end if;

  -- Stale reservations give their quota back before counting.
  update public.ai_generations g set status = 'released', error_message = 'Reservation expired before generation started.', finished_at = now()
  where g.workspace_id = p_workspace and g.status = 'reserved' and g.created_at <= now() - interval '15 minutes';

  select * into q from public.ai_quota_state(p_workspace);
  if not q.eligible then raise exception '%', q.reason; end if;
  if q.in_progress is not null then raise exception 'busy'; end if;

  insert into public.ai_generations (workspace_id, request_id, mode, name, input_paths, period_start, period_end)
  values (p_workspace, p_request, case when cardinality(p_inputs) = 1 then 'single' else 'multiview' end,
          coalesce(nullif(left(btrim(p_name), 120), ''), 'Untitled model'), p_inputs, q.period_start, q.period_end)
  returning ai_generations.id into new_id;
  return query select new_id, 'reserved'::text, true;
end $$;
revoke execute on function public.reserve_ai_generation(uuid, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.reserve_ai_generation(uuid, uuid, text[], text) to service_role;

-- Gives the quota back after a technical failure. Never touches a finished generation.
create or replace function public.release_ai_generation(p_id uuid, p_message text) returns boolean
language sql security definer set search_path = public as $$
  with r as (
    update public.ai_generations set status = 'released', error_message = left(p_message, 300), finished_at = now(), finalizing_until = null
    where id = p_id and status in ('reserved', 'running')
    returning 1
  )
  select exists (select 1 from r)
$$;
revoke execute on function public.release_ai_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.release_ai_generation(uuid, text) to service_role;

-- Takes a 90-second lease to store a finished model; false if another request holds it.
create or replace function public.claim_ai_finalize(p_id uuid) returns boolean
language sql security definer set search_path = public as $$
  with c as (
    update public.ai_generations set finalizing_until = now() + interval '90 seconds', progress = 99
    where id = p_id and status = 'running' and (finalizing_until is null or finalizing_until < now())
    returning 1
  )
  select exists (select 1 from c)
$$;
revoke execute on function public.claim_ai_finalize(uuid) from public, anon, authenticated;
grant execute on function public.claim_ai_finalize(uuid) to service_role;

grant select, insert, update, delete on public.library_models, public.ai_generations to service_role;
