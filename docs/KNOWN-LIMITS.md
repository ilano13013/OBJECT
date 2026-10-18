# Known limits (end of Phase D)

## Not built yet
- **Payments run in Stripe test mode only.** Live keys are refused by the
  server until `ALLOW_LIVE_PAYMENTS=true`.
- **Not yet connected to a real Stripe account.** Checkout/portal calls were
  tested against `stripe-mock` (Stripe’s official API mock) and webhooks
  with payloads signed exactly as Stripe signs them; the hosted Checkout and
  portal pages themselves were not exercised.
- VAT: prices are shown as fixed amounts; configure Stripe Tax (or VAT-
  inclusive prices) before a real launch.
- Studio quota changes (e.g. from 5 to 10) are made per workspace in SQL;
  there is no admin UI.
- **Not yet connected to a real Supabase project.** The schema, policies and
  cloud flows were tested on PostgreSQL 16 with Supabase Auth (GoTrue),
  PostgREST and Supabase Storage run locally, not on supabase.com.
- **Local mode** (no Supabase variables, and the claude.ai preview):
  showrooms live in the browser that created them; links work on that device
  only; statistics show example data, labelled as such.
- **Account deletion** is not self-service yet (needs a server function with
  the service role).
- Orphaned files: if a browser closes between a file upload and its database
  record, the file can stay in storage. A periodic clean-up job is planned.
- Rate limiting relies on Supabase defaults (auth) and visit de-duplication;
  no extra per-IP limits yet.
- Uploaded models: GLB or self-contained glTF up to 50 MB; Meshopt
  compression works, **Draco and KTX2 textures are not supported yet**.
- Hotspot positions are set with Height / Around sliders, not by clicking on
  the model.

## Product truth
- Demo products are procedural Three.js models, not scans or photographs.
  The FORM "photos" are renders of that model, used to demonstrate Photo
  Motion mode.
- OBJECT. does not convert photos to 3D, and the site never claims it does.

## Technical
- The 3D chunk is ~400 KB gzip (Three.js + R3F + Drei + a 110 KB HDRI). It is
  lazy-loaded, but first 3D frame on slow 4G takes a few seconds; type and
  CTAs render immediately.
- Glass transmission (AURA) costs an extra render pass; on low-end devices it
  may run below 60 fps. A `lite` material variant exists in `AuraBottle` and
  can be switched on per device in Phase E.
- Headless/software WebGL (CI) is slow; e2e tests allow longer timeouts and
  assert on content, not on animation frames.
- Tested on Chromium (desktop and iPhone 13 viewport emulation). Not yet
  verified on a physical iPhone with Safari/WebKit.
- `THREE.Clock` deprecation warning comes from React Three Fiber itself and
  is harmless.
