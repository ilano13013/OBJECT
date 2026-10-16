# OBJECT. — Design system

Direction: **Experimental Luxury / Digital Product Art.** A dark, lit studio
where the product is the only light source that matters. Type is monumental
and editorial; colour is almost absent so that one lime accent can carry
intent.

## Palette (pinned by the brief)

| Token | Hex | Role |
|---|---|---|
| `obsidian` | `#09090B` | Ground. Page background, studio darkness |
| `graphite` | `#252529` | Raised surfaces, featured pricing column, footer wordmark |
| `graphite-2` | `#17171A` | Secondary surface |
| `porcelain` | `#F2F0EB` | Primary text on dark; light "paper" sections |
| `silver` | `#BFC3C8` | Secondary text, chrome reflections (≥ 4.5:1 on obsidian) |
| `ash` | `#8E9297` | Tertiary text / metadata (≥ 4.5:1 on obsidian) |
| `lime` | `#D7FF43` | The one accent: primary CTA, full stop of the wordmark, focus ring, selection |

No gradients-as-decoration, no purple. Contrast pairs are unit-tested
(`src/lib/color.test.ts`).

## Type

- **Display:** Archivo Variable at `wdth 125`, weight 800, uppercase,
  tracking −0.04em, leading 0.86 (`.display`). Narrow cut `wdth 62`
  (`.display-narrow`) for gallery labels.
- **Editorial accent:** Instrument Serif Italic (`.serif-accent`), used for
  one or two words inside a display line, never a full heading.
- **Text:** Inter Tight Variable. Body 16–18px, leading 1.6, measure ≤ 65ch.
- **Metadata:** `.meta`: 12px, 0.14em tracking, uppercase, tabular numerals.

All fonts are self-hosted through Fontsource (no third-party requests).

## Composition

12-column grid with a fluid gutter `clamp(1rem, 4vw, 3.5rem)`. Compositions
are asymmetric: staggered step columns, offset chapters, headline lines split
across the viewport. Hairlines (`rgb(191 195 200 / .16)`) replace boxes and
cards. Radius is reserved for pills (buttons, badges) and is otherwise ~0.

## Motion

- One authored moment per surface: hero reveal, pinned scroll film, clip-path
  chapter reveals. Exponential ease-out (`expo.out`, `--ease-out-expo`).
- Scroll scrub ≈ 1; at most one pinned section per page.
- `prefers-reduced-motion`: no pinning, no scrub, chapters shown as a static
  list, 3D intros jump to their final state.
- Content entrances animate opacity (never `visibility`) so headings stay in
  the accessibility tree.

## 3D

- Studio lighting: bundled CC0 studio HDRI (`@pmndrs/assets`) plus authored
  Lightformers, baked once (`frames={1}`).
- Glass is backlit by a light slit (`<Backlight>`): transmission needs
  something bright behind it to refract.
- DPR capped at 1.75; canvases pause off-screen; WebGL loss or crash falls back
  to a CSS/2D composition (`SceneCanvas`).

## Honesty rules (product, not just copy)

- Demo brands carry a persistent "fictional brand" notice and a purchase
  button labelled **Demo** that never leaves the site.
- Every showroom shows a **True 3D** or **Photo Motion** badge. Photo Motion
  is never described as 3D. There is no photo-to-3D conversion.
- Demo imagery is rendered from the procedural models and described as such.
