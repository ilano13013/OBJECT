# OBJECT.

**The immersive product studio.** *Don't just show it. Make it unforgettable.*

OBJECT. lets independent brands turn a product into an interactive showroom:
upload, design, publish a shareable link. No code.

> **Status: Phases A, B and C complete.** Landing page, three demo
> showrooms, the showroom editor, and the SaaS foundation: accounts,
> Supabase schema with row-level security, cloud file storage, public
> links, statistics.
>
> Two modes, chosen at build time:
> - **Cloud** when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set:
>   sign-up / sign-in, data in Supabase, links work everywhere.
>   Setup guide: [`docs/SUPABASE.md`](docs/SUPABASE.md).
> - **Local** otherwise: no accounts, showrooms stored in this browser.
>
> Payments (Phase D) are next. Nothing can be purchased; publishing in cloud
> mode needs a slot granted by an operator until Stripe is connected.

## Routes

| Route | What it is |
|---|---|
| `/` | Landing: WebGL hero (chrome **O**), pinned scroll film, demos index, how it works, pricing, FAQ |
| `/demo/aura` | **AURA** Nº 07: fragrance · *Orbit* template · True 3D, hotspots, drag to turn |
| `/demo/form` | **FORM** Cuff 01: accessory · *Editorial* template · Photo Motion |
| `/demo/mono` | **MONO** Vessel III: home object · *Gallery* template · True 3D, views, wall colours |
| `/studio` | My showrooms: drafts and published, duplicate, delete |
| `/studio/new` | Onboarding: template → photos or 3D model → product name |
| `/studio/:id` | Editor: settings on the left, live preview (desktop / phone), save status, publish |
| `/studio/:id/preview` | Full-screen preview of the draft |
| `/studio/:id/stats` | Views, visitors, purchase clicks, click rate over 7 / 30 days |
| `/account` | Profile, studio name, plan and publishing slots, sign out |
| `/login`, `/auth/callback`, `/auth/reset` | Sign in / create account / email links / password reset (cloud mode) |
| `/s/:slug` | The published, read-only showroom |

AURA, FORM and MONO are fictional brands, modelled procedurally in Three.js.
They are labelled as such on every page.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · GSAP + ScrollTrigger ·
Three.js · React Three Fiber · Drei · Supabase (Postgres + RLS, Auth,
Storage) · Vitest · Playwright · ESLint. Planned: Stripe (Checkout, Billing,
Customer Portal). Hosted on Vercel.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build → dist/
npm run preview      # serve dist/ on :4173
```

## Quality

```bash
npm run typecheck    # tsc -b
npm run lint         # eslint
npm test             # vitest (unit)
npm run test:e2e     # playwright: desktop + iPhone 13 viewport (local mode)
supabase/tests/run.sh                                   # SQL security tests (needs PostgreSQL)
npx playwright test -c playwright.cloud.config.ts      # cloud-mode e2e (needs a Supabase-compatible stack)
```

Playwright uses the system Chromium at `/opt/pw-browsers/chromium` when it
exists (cloud dev containers); set `CHROMIUM_PATH` to override, or run
`npx playwright install chromium` locally.

## Regenerating demo renders

The FORM imagery and the demo posters are studio renders of the procedural
models, captured from a dev-only route:

```bash
npm run dev &
node scripts/capture-renders.mjs /tmp/renders
python3 scripts/to-webp.py /tmp/renders src/assets/renders
```

## Docs

- [`DESIGN.md`](DESIGN.md): design system, motion, 3D and honesty rules
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): code layout and the plan for phases B–E
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): putting it online (Vercel)
- [`docs/SUPABASE.md`](docs/SUPABASE.md): connecting Supabase (French)
- [`docs/KNOWN-LIMITS.md`](docs/KNOWN-LIMITS.md): what is not done yet
