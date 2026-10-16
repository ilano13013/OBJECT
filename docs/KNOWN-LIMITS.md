# Known limits (end of Phase A)

## Not built yet
- **Editor, accounts, dashboard, database, uploads, publishing, payments,
  analytics** (Phases B–D). `/create` states this; pricing buttons lead there.
  No checkout exists and nothing can be bought.
- No public `/s/:slug` route yet: only the three demo routes.

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
