# Architecture

## Principle

One data model, one renderer. A showroom is a `ShowroomConfig`
(`src/showroom/types.ts`). Demo pages, the future editor preview and
published public pages all render through `<ShowroomRenderer config>`, so a
merchant previews exactly what visitors get.

```
src/
  lib/          framework-free helpers: url safety, colour contrast, plans, gsap, WebGL probe, pointer
  three/        3D layer
    SceneCanvas.tsx   every canvas: WebGL probe, error boundary, context-loss, DPR cap, off-screen pause
    Studio.tsx        bundled HDRI + Lightformers, baked once
    Backlight.tsx     light slit behind glass
    ProductModel.tsx  procedural model | user glTF (normalised, lights/cameras stripped)
    products/         AURA flacon, FORM cuff, MONO vase (procedural)
    scenes/           landing hero + scroll film (lazy-loaded chunks)
  showroom/
    types.ts          ShowroomConfig: the contract with the editor and database
    demos.ts          the three fictional demo configs
    parts.tsx         ModeBadge, DemoNotice, PurchaseButton, PhotoMotion, font/theme helpers
    templates/        Orbit · Editorial · Gallery
    ShowroomRenderer.tsx
  sections/     landing sections
  pages/        routes (Landing, DemoShowroom, Create, NotFound, dev-only Capture)
```

### Performance

- Landing JS before 3D: ~154 KB gzip (React + GSAP + app). The 3D engine
  (~400 KB gzip including the HDRI) is a lazy chunk loaded after first paint.
- Canvases: DPR ≤ 1.75, `frameloop="never"` when off-screen, environment maps
  rendered once, lower geometry detail on mobile.
- No WebGL, a crash, or a lost context → a 2D fallback; navigation is never
  blocked (`e2e/landing.spec.ts › falls back without WebGL`).

### Security (Phase A scope)

- Merchant purchase links go through `safeExternalUrl` (http/https only, no
  credentials, no `javascript:`/`data:`), open with
  `rel="noopener noreferrer nofollow"`.
- Imported glTF is data only; lights and cameras are stripped on load.
- No secrets exist in the frontend; `.env.example` marks which keys must stay
  server-side.

## Plan for the next phases

### Phase B: Product builder (done)
- `src/studio/repository.ts`: `ShowroomRepository` interface (list, get,
  create, saveDraft, setSlug, publish, unpublish, duplicate, remove) with a
  `LocalShowroomRepository`. Each showroom keeps a **draft** and a
  **published snapshot**: editing never changes what visitors see until the
  merchant publishes again.
- `src/studio/assets.ts`: files in IndexedDB, referenced as `asset:<id>`;
  resolved to blob: URLs for images, and parsed from bytes for models
  (`GLTFLoader.parse`, no network fetch).
- `src/studio/validation.ts`: uploads checked by **magic bytes** (JPEG, PNG,
  WebP, GLB), size limits, glTF with external URIs refused; publish
  requirements (name, media matching the mode, alt text, safe purchase URL).
- `ShowroomFrame` (`src/showroom/frame.tsx`): templates use container
  queries (`@3xl:`) and a `--sr-vh` unit, so the same template renders
  full-screen, in the editor's desktop preview and in its 390 px phone
  preview. Scroll animations follow the frame's scroller.
- Editor: autosave 500 ms after the last change (and on Cmd/Ctrl+S, route
  change, unload), save status, first-showroom checklist, publish dialog
  with copy link, unpublish confirmation, delete. Phones get Edit/Preview
  tabs and collapsible sections.

### Phase C: SaaS foundation (Supabase)
Tables: `profiles`, `workspaces`, `showrooms`, `showroom_content`
(`settings_json` = `ShowroomConfig` minus identity fields), `assets`,
`subscriptions`, `orders`, `showroom_analytics`. RLS: owners via
`workspaces.owner_id = auth.uid()`; anonymous `select` only on
`status = 'published'` showrooms and their content/assets. Storage bucket per
workspace prefix, MIME + size checks in a server function. Public route
`/s/:slug`.

### Phase D: Monetisation (Stripe test mode)
Vercel functions: `create-checkout-session` (One: payment, Studio:
subscription), `stripe-webhook` (signature verified; grants rights from
`checkout.session.completed`, `customer.subscription.*`,
`invoice.payment_failed`), `billing-portal`. Publishing checks quota
server-side (Postgres function), never from the client.

### Phase E: Quality & launch
Auth/RLS isolation tests, quota and webhook tests, Lighthouse on mid-tier
mobile, Impeccable audit pass, deployment.
