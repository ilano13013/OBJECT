-- Public gallery: only listed + published showrooms, only their public snapshot.
\set QUIET on
truncate tests.ids;
insert into auth.users (email) values ('gallery@example.com');
insert into tests.ids select 'g', id::text from auth.users where email = 'gallery@example.com';
begin;
select tests.login('g');
insert into tests.ids select 'listed', id::text from public.create_showroom('Amber Lamp', 'orbit', '{}');
insert into tests.ids select 'hidden', id::text from public.create_showroom('Secret Chair', 'orbit', '{}');
insert into tests.ids select 'draft', id::text from public.create_showroom('Draft Vase', 'orbit', '{}');
select public.save_draft(tests.id(k)::uuid, ('{"mode":"photo","productName":"' || n || '","brand":"Nord","images":[{"src":"asset:x","alt":"x"}]}')::jsonb)
  from (values ('listed', 'Amber Lamp'), ('hidden', 'Secret Chair'), ('draft', 'Draft Vase')) v(k, n);
commit;
update public.workspaces set bonus_publish_slots = 5 where owner_id = tests.id('g')::uuid;
begin;
select tests.login('g');
select tests.ok((select listed from public.showrooms where id = tests.id('listed')::uuid), 'new showrooms start listed');
select public.publish_showroom(tests.id('listed')::uuid);
select public.publish_showroom(tests.id('hidden')::uuid);
select public.set_showroom_listed(tests.id('hidden')::uuid, false);
select public.save_draft(tests.id('listed')::uuid, '{"mode":"photo","productName":"Unpublished rename","brand":"Nord","images":[{"src":"asset:x","alt":"x"}]}');
commit;
begin;
select tests.logout();
select tests.ok((select count(*) = 1 from public.gallery_showrooms() where brand = 'Nord'), 'anonymous visitors see only the listed, published showroom');
select tests.ok((select product_name = 'Amber Lamp' from public.gallery_showrooms() where brand = 'Nord'), 'the gallery shows the published snapshot, never the draft');
select tests.ok((select count(*) = 1 from public.gallery_showrooms(24, null, 'amber', null)), 'search by product name');
select tests.ok((select count(*) = 0 from public.gallery_showrooms(24, null, 'chair', null)), 'unlisted showrooms are not searchable');
select tests.ok((select count(*) = 0 from public.gallery_showrooms(24, null, '%', null) where brand = 'Nord' and product_name <> 'Amber Lamp'), 'search wildcards are escaped');
select tests.ok((select count(*) = 0 from public.gallery_showrooms(24, null, null, 'true3d') where brand = 'Nord'), 'filter by presentation mode');
do $$ begin
  begin perform public.set_showroom_listed(tests.id('listed')::uuid, false); raise exception 'FAILED: anon can unlist';
  exception when insufficient_privilege then raise notice 'ok - only owners change listing'; end;
end $$;
rollback;
insert into auth.users (email) values ('other-g@example.com');
insert into tests.ids select 'og', id::text from auth.users where email = 'other-g@example.com';
begin;
select tests.login('og');
do $$ begin
  begin perform public.set_showroom_listed(tests.id('listed')::uuid, false); raise exception 'FAILED: stranger can unlist';
  exception when sqlstate 'P0002' then raise notice 'ok - another account cannot unlist someone else''s showroom'; end;
end $$;
rollback;
select public.unpublish_showroom(tests.id('listed')::uuid) from (select tests.login('g')) l;
select tests.ok((select count(*) = 0 from public.gallery_showrooms() where brand = 'Nord'), 'unpublishing removes it from the gallery');
