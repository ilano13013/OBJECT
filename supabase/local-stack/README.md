# Local Supabase-compatible stack

For development and end-to-end tests when Docker / the Supabase CLI are not
available. Not used in production.

Pieces (put them in `$BIN`, default `/tmp/objbin`):

- `postgrest` — PostgREST v12 static binary (GitHub releases)
- `auth` — Supabase Auth (GoTrue) v2 binary + its `migrations/` folder (GitHub releases)
- `storage-src` — `supabase/storage` v1.11.x, `npm ci && npm run build && npm rebuild fs-xattr`
- `keys.env` — `ANON=` and `SERVICE=` JWTs signed with the stack secret (HS256)

Then, with a PostgreSQL 16 superuser at `127.0.0.1:54329`:

```bash
supabase/local-stack/start.sh   # prints VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=$ANON npx playwright test -c playwright.cloud.config.ts
supabase/local-stack/stop.sh
```

With Docker available, `npx supabase start` is the simpler equivalent.
