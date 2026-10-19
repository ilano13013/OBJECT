-- Sign-up through an OAuth provider creates the same profile + workspace.
\set QUIET on
insert into auth.users (email, raw_user_meta_data) values
  ('g@example.com', '{"full_name": "Atelier Google", "iss": "https://accounts.google.com"}'),
  ('gh@example.com', '{"user_name": "octomaker"}'),
  ('mail@example.com', '{"display_name": "Mail Maker"}');
select tests.ok((select display_name = 'Atelier Google' from public.profiles p join auth.users u on u.id = p.id where u.email = 'g@example.com'), 'Google full name becomes the display name');
select tests.ok((select display_name = 'octomaker' from public.profiles p join auth.users u on u.id = p.id where u.email = 'gh@example.com'), 'GitHub user name is used when no full name');
select tests.ok((select display_name = 'Mail Maker' from public.profiles p join auth.users u on u.id = p.id where u.email = 'mail@example.com'), 'email sign-up keeps the name typed in the form');
select tests.ok((select count(*) = 3 from public.workspaces w join auth.users u on u.id = w.owner_id where u.email in ('g@example.com', 'gh@example.com', 'mail@example.com')), 'every new account gets its studio');
