# Known limits (end of Phase B)

## Not built yet
- **Accounts, database, cloud storage, payments, quotas, statistics**
  (Phases C–D). No checkout exists and nothing can be bought.
- **Local mode.** Showrooms live in the browser that created them
  (localStorage for content, IndexedDB for files). A published `/s/:slug`
  link only works on that device until Phase C moves storage to Supabase.
  Clearing site data deletes them. Private browsing may block storage; the
  studio says so.
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
