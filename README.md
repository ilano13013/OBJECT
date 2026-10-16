# OBJECT.

**The immersive product studio.** *Don't just show it. Make it unforgettable.*

OBJECT. lets independent brands turn a product into an interactive showroom:
upload, design, publish a shareable link. No code.

> **Status: Phase A (Visual Experience) — complete.**
> The landing page and three demo showrooms are live code. The editor,
> accounts, database and payments (Phases B–D) are **not built yet**; the
> "Create your showroom" route says so explicitly. Nothing can be purchased.

## What's in Phase A

| Route | What it is |
|---|---|
| `/` | Landing: WebGL hero (chrome **O**), pinned scroll film, demos index, how it works, pricing, FAQ |
| `/demo/aura` | **AURA** Nº 07: fragrance · *Orbit* template · True 3D, hotspots, drag to turn |
| `/demo/form` | **FORM** Cuff 01: accessory · *Editorial* template · Photo Motion |
| `/demo/mono` | **MONO** Vessel III: home object · *Gallery* template · True 3D, views, wall colours |
| `/create` | Honest placeholder until the studio opens |

AURA, FORM and MONO are fictional brands, modelled procedurally in Three.js.
They are labelled as such on every page.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · GSAP + ScrollTrigger ·
Three.js · React Three Fiber · Drei · Vitest · Playwright · ESLint.
Planned: Supabase (Postgres, Auth, Storage) and Stripe (Checkout, Billing,
Customer Portal), hosted on Vercel.

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
npm run test:e2e     # playwright: desktop + iPhone 13 viewport
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
python3 scripts/to-webp.py /tmp/renders public/renders
```

## Docs

- [`DESIGN.md`](DESIGN.md): design system, motion, 3D and honesty rules
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): code layout and the plan for phases B–E
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): putting it online (Vercel)
- [`docs/KNOWN-LIMITS.md`](docs/KNOWN-LIMITS.md): what is not done yet
