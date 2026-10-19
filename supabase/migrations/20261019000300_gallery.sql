-- OBJECT. — public gallery of published showrooms (Pinterest-style).
--
-- A showroom appears only while it is published AND its owner keeps
-- "Show in the OBJECT. gallery" on. Showrooms created from now on start
-- listed (the switch is shown when publishing); those published before the
-- gallery existed stay unlisted until their owner opts in.

alter table public.showrooms add column if not exists listed boolean not null default false;
alter table public.showrooms alter column listed set default true;
create index if not exists showrooms_gallery_idx on public.showrooms (published_at desc) where status = 'published' and listed;

create or replace function public.set_showroom_listed(p_id uuid, p_listed boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_showroom(p_id) then raise exception 'Showroom not found.' using errcode = 'P0002'; end if;
  update public.showrooms set listed = coalesce(p_listed, false) where id = p_id;
  return coalesce(p_listed, false);
end $$;
revoke execute on function public.set_showroom_listed(uuid, boolean) from public, anon;
grant execute on function public.set_showroom_listed(uuid, boolean) to authenticated;

-- What anyone may browse: only the public snapshot of listed, published showrooms.
create or replace function public.gallery_showrooms(
  p_limit integer default 24,
  p_before timestamptz default null,
  p_query text default null,
  p_mode text default null
)
returns table (
  slug text,
  product_name text,
  brand text,
  tagline text,
  cover text,
  cover_alt text,
  mode text,
  template text,
  background text,
  accent text,
  text_color text,
  published_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with q as (
    select nullif(btrim(replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_')), '') as term
  )
  select
    s.slug,
    c.published_json ->> 'productName',
    c.published_json ->> 'brand',
    c.published_json ->> 'tagline',
    c.published_json -> 'images' -> 0 ->> 'src',
    c.published_json -> 'images' -> 0 ->> 'alt',
    c.published_json ->> 'mode',
    s.template,
    c.published_json -> 'theme' ->> 'background',
    c.published_json -> 'theme' ->> 'accent',
    c.published_json -> 'theme' ->> 'text',
    s.published_at
  from public.showrooms s
  join public.showroom_content c on c.showroom_id = s.id
  cross join q
  where s.status = 'published' and s.listed and c.published_json is not null
    and (p_before is null or s.published_at < p_before)
    and (p_mode is null or c.published_json ->> 'mode' = p_mode)
    and (q.term is null
      or (c.published_json ->> 'productName') ilike '%' || q.term || '%'
      or (c.published_json ->> 'brand') ilike '%' || q.term || '%'
      or (c.published_json ->> 'tagline') ilike '%' || q.term || '%')
  order by s.published_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
$$;
grant execute on function public.gallery_showrooms(integer, timestamptz, text, text) to anon, authenticated;
