-- OBJECT. — initial schema (Phase C)
--
-- Security model
-- • Every private table has RLS on. Rows are reachable only through the
--   workspace the signed-in user owns.
-- • Column privileges decide WHAT a client may write. Status, publication,
--   billing and analytics columns are never writable from the browser; they
--   change only through the SECURITY DEFINER functions below (or the Stripe
--   webhook with the service role in Phase D).
-- • Visitors (signed in or not) read published showrooms only through
--   get_published_showroom(), which returns the published snapshot, never the
--   draft. No table is publicly readable.

-- ── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── Tables ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'My studio' check (char_length(name) between 1 and 80),
  -- Showrooms the Studio plan may keep published at once (configurable per workspace).
  studio_quota integer not null default 5 check (studio_quota between 0 and 1000),
  -- Extra publish slots granted manually (support, partners, test accounts).
  bonus_publish_slots integer not null default 0 check (bonus_publish_slots between 0 and 1000),
  created_at timestamptz not null default now()
);
create index workspaces_owner_idx on public.workspaces (owner_id);

create table public.showrooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$')
    check (slug not in ('new', 'studio', 'demo', 'admin', 'api', 'create', 'login', 'signup', 'account', 's')),
  template text not null check (template in ('orbit', 'editorial', 'gallery')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index showrooms_workspace_idx on public.showrooms (workspace_id, updated_at desc);
create index showrooms_published_idx on public.showrooms (slug) where status = 'published';
create trigger showrooms_touch before update on public.showrooms for each row execute function public.touch_updated_at();

create table public.showroom_content (
  showroom_id uuid primary key references public.showrooms (id) on delete cascade,
  product_name text not null default '' check (char_length(product_name) <= 60),
  description text not null default '' check (char_length(description) <= 2000),
  -- The editable draft: a full ShowroomConfig (src/showroom/types.ts).
  settings_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings_json) = 'object')
    check (pg_column_size(settings_json) < 262144),
  purchase_url text check (
    purchase_url is null
    or (char_length(purchase_url) <= 2048 and purchase_url ~* '^https?://[^/\s@:]+\.[^/\s@:]+(:[0-9]+)?([/?#]|$)')
  ),
  -- What visitors see. Written only by publish_showroom().
  published_json jsonb,
  updated_at timestamptz not null default now()
);
create trigger showroom_content_touch before update on public.showroom_content for each row execute function public.touch_updated_at();

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  showroom_id uuid not null references public.showrooms (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  storage_path text not null unique,
  asset_type text not null check (asset_type in ('image', 'model')),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'model/gltf-binary', 'model/gltf+json')),
  file_size bigint not null check (
    file_size > 0
    and ((asset_type = 'image' and file_size <= 15728640) or (asset_type = 'model' and file_size <= 52428800))
  ),
  original_name text check (original_name is null or char_length(original_name) <= 200),
  created_at timestamptz not null default now(),
  check ((asset_type = 'image') = (mime_type like 'image/%')),
  -- Files live at <workspace>/<showroom>/<asset id>.<ext>
  check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|glb|gltf)$'),
  check (split_part(storage_path, '/', 1) = workspace_id::text),
  check (split_part(storage_path, '/', 2) = showroom_id::text),
  check (split_part(split_part(storage_path, '/', 3), '.', 1) = id::text)
);
create index assets_showroom_idx on public.assets (showroom_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  showroom_id uuid references public.showrooms (id) on delete set null,
  stripe_session_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  amount_total integer check (amount_total is null or amount_total >= 0),
  currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_workspace_idx on public.orders (workspace_id);
create index orders_showroom_idx on public.orders (showroom_id) where status = 'paid';
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.showroom_analytics (
  id bigint generated always as identity primary key,
  showroom_id uuid not null references public.showrooms (id) on delete cascade,
  event_type text not null check (event_type in ('view', 'purchase_click')),
  -- Random per-browser-session id, never a cookie, IP or fingerprint.
  visitor_hash text check (visitor_hash is null or visitor_hash ~ '^[a-z0-9]{8,64}$'),
  created_at timestamptz not null default now()
);
create index analytics_showroom_time_idx on public.showroom_analytics (showroom_id, created_at desc);
create index analytics_dedupe_idx on public.showroom_analytics (showroom_id, event_type, visitor_hash, created_at desc);

-- ── Ownership helpers (bypass RLS internally, return booleans only) ────────

create or replace function public.is_workspace_owner(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspaces w where w.id = ws and w.owner_id = auth.uid())
$$;

create or replace function public.owns_showroom(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.showrooms s join public.workspaces w on w.id = s.workspace_id
    where s.id = sid and w.owner_id = auth.uid()
  )
$$;

-- ── New user → profile + workspace ─────────────────────────────────────────

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''));
  insert into public.workspaces (owner_id, name) values (new.id, 'My studio');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ── Row level security ─────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.showrooms enable row level security;
alter table public.showroom_content enable row level security;
alter table public.assets enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.showroom_analytics enable row level security;

create policy "own profile: read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile: update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "own workspaces: read" on public.workspaces for select to authenticated using (owner_id = auth.uid());
create policy "own workspaces: rename" on public.workspaces for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own showrooms: read" on public.showrooms for select to authenticated using (public.is_workspace_owner(workspace_id));
create policy "own showrooms: update" on public.showrooms for update to authenticated
  using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy "own showrooms: delete" on public.showrooms for delete to authenticated using (public.is_workspace_owner(workspace_id));
-- No table-level public read: visitors go through get_published_showroom(),
-- which returns the published snapshot and nothing else.

create policy "own content: read" on public.showroom_content for select to authenticated using (public.owns_showroom(showroom_id));
create policy "own content: update" on public.showroom_content for update to authenticated
  using (public.owns_showroom(showroom_id)) with check (public.owns_showroom(showroom_id));

create policy "own assets: read" on public.assets for select to authenticated using (public.is_workspace_owner(workspace_id));
create policy "own assets: add" on public.assets for insert to authenticated
  with check (public.is_workspace_owner(workspace_id) and public.owns_showroom(showroom_id)
              and exists (select 1 from public.showrooms s where s.id = showroom_id and s.workspace_id = assets.workspace_id));
create policy "own assets: delete" on public.assets for delete to authenticated using (public.is_workspace_owner(workspace_id));

create policy "own subscription: read" on public.subscriptions for select to authenticated using (public.is_workspace_owner(workspace_id));
create policy "own orders: read" on public.orders for select to authenticated using (public.is_workspace_owner(workspace_id));
create policy "own analytics: read" on public.showroom_analytics for select to authenticated using (public.owns_showroom(showroom_id));

-- ── Column privileges: what the browser may write ──────────────────────────

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;

grant select on public.showrooms to authenticated;
grant update (title, template) on public.showrooms to authenticated;
grant delete on public.showrooms to authenticated;

-- Owners read their own published snapshot too (rows are still limited by RLS); they can never write it.
grant select (showroom_id, product_name, description, settings_json, purchase_url, published_json, updated_at) on public.showroom_content to authenticated;

grant select on public.assets to authenticated;
grant insert (id, showroom_id, workspace_id, storage_path, asset_type, mime_type, file_size, original_name) on public.assets to authenticated;
grant delete on public.assets to authenticated;

grant select on public.subscriptions, public.orders, public.showroom_analytics to authenticated;

-- ── Showroom lifecycle (the only way to change status and publication) ────

-- URL-safe slug: accents folded, lowercase, hyphenated.
create or replace function public.slugify(input text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(input, '')),
      'àáâãäåāçćčèéêëēėęìíîïīįñńòóôõöøōùúûüūýÿžźżšśłđ',
      'aaaaaaaccceeeeeeeiiiiiinnoooooooouuuuuyyzzzsslld'),
    '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.unique_slug(wanted text, except_id uuid default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  root text := public.slugify(wanted);
  candidate text;
  n integer := 1;
begin
  root := left(root, 52);
  if char_length(root) < 3 then root := 'showroom'; end if;
  candidate := root;
  while exists (select 1 from public.showrooms where slug = candidate and id is distinct from except_id)
        or candidate in ('new', 'studio', 'demo', 'admin', 'api', 'create', 'login', 'signup', 'account') loop
    n := n + 1;
    candidate := root || '-' || n;
  end loop;
  return candidate;
end $$;

create or replace function public.create_showroom(p_title text, p_template text, p_settings jsonb)
returns public.showrooms
language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  s public.showrooms;
begin
  if auth.uid() is null then raise exception 'Sign in to create a showroom.' using errcode = '28000'; end if;
  select id into ws from public.workspaces where owner_id = auth.uid() order by created_at limit 1;
  if ws is null then raise exception 'No workspace for this account.' using errcode = 'P0002'; end if;
  if (select count(*) from public.showrooms where workspace_id = ws) >= 200 then
    raise exception 'This workspace already has 200 showrooms. Delete some before creating more.' using errcode = '54000';
  end if;
  insert into public.showrooms (workspace_id, title, slug, template)
  values (ws, left(coalesce(p_title, ''), 120), public.unique_slug(p_title), p_template)
  returning * into s;
  insert into public.showroom_content (showroom_id, product_name, settings_json)
  values (s.id, left(coalesce(p_title, ''), 60), coalesce(p_settings, '{}'::jsonb) || jsonb_build_object('slug', s.slug));
  return s;
end $$;

-- Saves the draft. Derived columns are computed here, never trusted from the client.
create or replace function public.save_draft(p_id uuid, p_settings jsonb)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  url text := nullif(p_settings ->> 'purchaseUrl', '');
  tpl text := p_settings ->> 'template';
  saved timestamptz;
begin
  if not public.owns_showroom(p_id) then raise exception 'Showroom not found.' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_settings) <> 'object' then raise exception 'Invalid showroom data.' using errcode = '22023'; end if;
  update public.showroom_content set
    settings_json = p_settings || jsonb_build_object('slug', (select slug from public.showrooms where id = p_id), 'isDemo', false),
    product_name = left(coalesce(p_settings ->> 'productName', ''), 60),
    description = left(coalesce(p_settings ->> 'description', ''), 2000),
    purchase_url = url
  where showroom_id = p_id
  returning updated_at into saved;
  update public.showrooms set
    title = left(coalesce(p_settings ->> 'productName', ''), 120),
    template = case when tpl in ('orbit', 'editorial', 'gallery') then tpl else template end
  where id = p_id;
  return saved;
end $$;

create or replace function public.set_showroom_slug(p_id uuid, p_slug text) returns text
language plpgsql security definer set search_path = public as $$
declare
  clean text := left(public.slugify(p_slug), 60);
begin
  if not public.owns_showroom(p_id) then raise exception 'Showroom not found.' using errcode = 'P0002'; end if;
  if char_length(clean) < 3 then raise exception 'Use at least 3 letters or numbers.' using errcode = '22023'; end if;
  if exists (select 1 from public.showrooms where slug = clean and id <> p_id) then
    raise exception '“%” is already used by another showroom.', clean using errcode = '23505';
  end if;
  update public.showrooms set slug = clean where id = p_id;
  update public.showroom_content set
    settings_json = settings_json || jsonb_build_object('slug', clean),
    published_json = case when published_json is null then null else published_json || jsonb_build_object('slug', clean) end
  where showroom_id = p_id;
  return clean;
end $$;

-- What a workspace may publish right now.
create or replace function public.publish_entitlement(p_workspace uuid)
returns table (plan text, allowance integer, used integer)
language sql stable security definer set search_path = public as $$
  with sub as (
    select status from public.subscriptions where workspace_id = p_workspace
  ),
  studio as (
    select exists (select 1 from sub where status in ('active', 'trialing', 'past_due')) as on_studio
  )
  select
    case when (select on_studio from studio) then 'studio'
         when exists (select 1 from public.orders o where o.workspace_id = p_workspace and o.status = 'paid') then 'one'
         else 'none' end,
    (case when (select on_studio from studio) then w.studio_quota else 0 end) + w.bonus_publish_slots,
    (select count(*)::int from public.showrooms s
      where s.workspace_id = p_workspace and s.status = 'published'
        and not exists (select 1 from public.orders o where o.showroom_id = s.id and o.status = 'paid'))
  from public.workspaces w where w.id = p_workspace and w.owner_id = auth.uid()
$$;

create or replace function public.can_publish(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    -- a One Showroom purchase for this showroom
    exists (select 1 from public.orders o where o.showroom_id = p_id and o.status = 'paid')
    -- already live: republishing changes does not consume a slot
    or exists (select 1 from public.showrooms s where s.id = p_id and s.status = 'published')
    -- or a free slot in the workspace allowance (Studio quota + bonus)
    or exists (
      select 1 from public.showrooms s, lateral public.publish_entitlement(s.workspace_id) e
      where s.id = p_id and e.used < e.allowance
    )
$$;

create or replace function public.publish_showroom(p_id uuid)
returns table (ok boolean, issues text[], slug text, published_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  c public.showroom_content;
  s public.showrooms;
  problems text[] := '{}';
  mode text;
begin
  if not public.owns_showroom(p_id) then raise exception 'Showroom not found.' using errcode = 'P0002'; end if;
  select * into c from public.showroom_content where showroom_id = p_id;
  mode := c.settings_json ->> 'mode';
  if char_length(trim(c.product_name)) = 0 then problems := array_append(problems, 'Add a product name.'); end if;
  if mode = 'photo' and coalesce(jsonb_array_length(c.settings_json -> 'images'), 0) = 0 then
    problems := array_append(problems, 'Photo Motion needs at least one image.');
  end if;
  if mode = 'true3d' and (c.settings_json -> 'model') is null then
    problems := array_append(problems, 'True 3D needs a GLB or glTF model. Switch to Photo Motion to use images only.');
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(c.settings_json -> 'images', '[]'::jsonb)) i where trim(coalesce(i ->> 'alt', '')) = '') then
    problems := array_append(problems, 'Describe every image (alt text) so it works for screen readers.');
  end if;
  if array_length(problems, 1) is null and not public.can_publish(p_id) then
    problems := array_append(problems, 'Your plan has no free publishing slot. Choose One Showroom or Studio to publish.');
  end if;
  if array_length(problems, 1) is not null then
    return query select false, problems, null::text, null::timestamptz;
    return;
  end if;
  update public.showroom_content set published_json = settings_json where showroom_id = p_id;
  update public.showrooms set status = 'published', published_at = now() where id = p_id returning * into s;
  return query select true, '{}'::text[], s.slug, s.published_at;
end $$;

create or replace function public.unpublish_showroom(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_showroom(p_id) then raise exception 'Showroom not found.' using errcode = 'P0002'; end if;
  update public.showrooms set status = 'draft' where id = p_id;
end $$;

-- Public, read-only: the published snapshot only.
create or replace function public.get_published_showroom(p_slug text)
returns table (id uuid, slug text, published_at timestamptz, config jsonb)
language sql stable security definer set search_path = public as $$
  select s.id, s.slug, s.published_at, c.published_json
  from public.showrooms s join public.showroom_content c on c.showroom_id = s.id
  where s.slug = p_slug and s.status = 'published' and c.published_json is not null
$$;

-- ── Analytics (privacy-respecting, no cookies) ─────────────────────────────

create or replace function public.track_event(p_slug text, p_event text, p_visitor text) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  if p_event not in ('view', 'purchase_click') then return; end if;
  if p_visitor is not null and p_visitor !~ '^[a-z0-9]{8,64}$' then p_visitor := null; end if;
  select id into sid from public.showrooms where slug = p_slug and status = 'published';
  if sid is null then return; end if;
  -- The same visitor reloading counts once per 30 minutes; clicks once per 5 minutes.
  if p_visitor is not null and exists (
    select 1 from public.showroom_analytics a
    where a.showroom_id = sid and a.event_type = p_event and a.visitor_hash = p_visitor
      and a.created_at > now() - case when p_event = 'view' then interval '30 minutes' else interval '5 minutes' end
  ) then return; end if;
  insert into public.showroom_analytics (showroom_id, event_type, visitor_hash) values (sid, p_event, p_visitor);
end $$;

create or replace function public.showroom_stats(p_id uuid, p_days integer default 30)
returns table (day date, views integer, visitors integer, clicks integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.owns_showroom(p_id) then raise exception 'Showroom not found.' using errcode = 'P0002'; end if;
  return query
  select d::date,
    count(*) filter (where a.event_type = 'view')::int,
    count(distinct a.visitor_hash) filter (where a.event_type = 'view')::int,
    count(*) filter (where a.event_type = 'purchase_click')::int
  from generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day') d
  left join public.showroom_analytics a on a.showroom_id = p_id and a.created_at >= d and a.created_at < d + interval '1 day'
  group by d order by d;
end $$;

create or replace function public.workspace_view_totals(p_days integer default 30)
returns table (showroom_id uuid, views integer, clicks integer)
language sql stable security definer set search_path = public as $$
  select s.id,
    count(a.*) filter (where a.event_type = 'view')::int,
    count(a.*) filter (where a.event_type = 'purchase_click')::int
  from public.showrooms s
  join public.workspaces w on w.id = s.workspace_id and w.owner_id = auth.uid()
  left join public.showroom_analytics a on a.showroom_id = s.id and a.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
  group by s.id
$$;

-- ── Function privileges ────────────────────────────────────────────────────

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_published_showroom(text) to anon, authenticated;
grant execute on function public.track_event(text, text, text) to anon, authenticated;
grant execute on function
  public.create_showroom(text, text, jsonb),
  public.save_draft(uuid, jsonb),
  public.set_showroom_slug(uuid, text),
  public.publish_showroom(uuid),
  public.unpublish_showroom(uuid),
  public.publish_entitlement(uuid),
  public.showroom_stats(uuid, integer),
  public.workspace_view_totals(integer),
  public.is_workspace_owner(uuid),
  public.owns_showroom(uuid)
to authenticated;

-- ── Storage: one private bucket, owner write, public read of published files ─

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('showroom-assets', 'showroom-assets', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- True when the object path starts with a workspace the caller owns. Compares
-- as text so a malformed path is simply refused rather than raising.
create or replace function public.owns_storage_path(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspaces w
    where w.owner_id = auth.uid() and w.id::text = (storage.foldername(object_name))[1]
  )
$$;
grant execute on function public.owns_storage_path(text) to authenticated;

create policy "showroom assets: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'showroom-assets' and public.owns_storage_path(name));

create policy "showroom assets: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'showroom-assets' and public.owns_storage_path(name));

create policy "showroom assets: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'showroom-assets' and public.owns_storage_path(name));

-- Visitors may read a file only if the live (published) snapshot references it.
create or replace function public.is_published_asset(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.assets a
    join public.showrooms s on s.id = a.showroom_id and s.status = 'published'
    join public.showroom_content c on c.showroom_id = s.id
    where a.storage_path = object_name
      -- the live snapshot references the file as asset:<storage path>
      and position(('asset:' || a.storage_path) in c.published_json::text) > 0
  )
$$;
grant execute on function public.is_published_asset(text) to anon, authenticated;

create policy "showroom assets: public read when published" on storage.objects for select to anon, authenticated
  using (bucket_id = 'showroom-assets' and public.is_published_asset(name));
