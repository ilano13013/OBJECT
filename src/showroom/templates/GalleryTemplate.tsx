import { ContactShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { inkFor } from '@/lib/color'
import { gsap, useGSAP } from '@/lib/gsap'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { ProductModel } from '@/three/ProductModel'
import { SceneCanvas } from '@/three/SceneCanvas'
import { bodyFontFamily, fontClass, ModeBadge, PhotoMotion, PurchaseButton } from '../parts'
import type { ShowroomChapter, ShowroomConfig } from '../types'

const { damp, dampAngle } = (() => {
  const d = THREE.MathUtils.damp
  return {
    damp: d,
    dampAngle: (a: number, b: number, l: number, dt: number) => {
      const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a))
      return d(a, a + delta, l, dt)
    },
  }
})()

const TARGET = new THREE.Vector3(0, -0.35, 0)

function GalleryStage({
  config,
  chapter,
  drag,
  wall,
  reduced,
}: {
  config: ShowroomConfig
  chapter: ShowroomChapter | undefined
  drag: RefObject<number>
  wall: string
  reduced: boolean
}) {
  const model = useRef<THREE.Group>(null)
  const az = useRef(chapter?.angle ?? 0)
  const el = useRef(chapter?.elevation ?? 0.12)
  const dist = useRef(7.6)
  const intro = useRef(reduced ? 1 : 0)
  const spot = useRef<THREE.SpotLight>(null)
  const narrow = useThree((st) => st.size.width < 768)
  const wallColor = useRef(new THREE.Color(wall))
  const wallTarget = useMemo(() => new THREE.Color(wall), [wall])

  useFrame((state, dt) => {
    const speed = config.animation.speed
    const l = reduced ? 50 : 2.4 * speed
    intro.current = Math.min(1, intro.current + (dt * speed) / 2.2)
    const e = 1 - Math.pow(1 - intro.current, 3)
    az.current = dampAngle(az.current, chapter?.angle ?? 0, l, dt)
    el.current = damp(el.current, chapter?.elevation ?? 0.12, l, dt)
    dist.current = damp(dist.current, (narrow ? 9.6 : 7.6) / (chapter?.zoom ?? 1), l, dt)
    const r = dist.current
    const cam = state.camera
    cam.position.set(
      TARGET.x + r * Math.cos(el.current) * Math.sin(az.current),
      TARGET.y + r * Math.sin(el.current),
      TARGET.z + r * Math.cos(el.current) * Math.cos(az.current),
    )
    cam.lookAt(TARGET.x, TARGET.y + (chapter?.zoom ?? 1) * 0.05, TARGET.z)
    if (model.current) model.current.rotation.y = damp(model.current.rotation.y, drag.current ?? 0, 5, dt)
    if (spot.current) spot.current.intensity = 80 * e
    state.scene.background = wallColor.current.lerp(wallTarget, 1 - Math.exp(-5 * dt))
  })

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#8a8378', 0.6]} />
      <spotLight ref={spot} position={[0.6, 6, 1.8]} angle={0.42} penumbra={0.85} intensity={0} castShadow color="#fff6ea" />
      <directionalLight position={[-4, 2, 3]} intensity={0.5} />
      <group ref={model}>{config.model && <ProductModel source={config.model} />}</group>
      {/* Plinth */}
      <mesh position={[0, -1.15 - 0.9, 0]} receiveShadow>
        <boxGeometry args={[1.9, 1.8, 1.9]} />
        <meshStandardMaterial color="#f4f2ee" roughness={0.9} />
      </mesh>
      <ContactShadows position={[0, -1.149, 0]} opacity={0.5} scale={3.2} blur={2.8} far={1.6} resolution={256} frames={1} />
    </>
  )
}

/** TEMPLATE 03 — GALLERY. The product as a work of art: plinth, wall, angles, label. */
export function GalleryTemplate({ config }: { config: ShowroomConfig }) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const views = config.chapters.length > 0 ? config.chapters : [{ id: 'front', title: 'Front', body: '', angle: 0 }]
  const [index, setIndex] = useState(0)
  const backdrops = config.backdrops?.length ? config.backdrops : [config.theme.background]
  const [wall, setWall] = useState(backdrops[0]!)
  const ink = inkFor(wall, config.theme.text, '#f2f0eb')
  const mutedInk = ink === '#f2f0eb' ? '#b4b6b9' : config.theme.muted
  const drag = useRef(0)
  const dragStart = useRef<{ x: number; base: number } | null>(null)
  const display = fontClass(config.theme.displayFont)
  const chapter = views[index]
  const show3d = config.mode === 'true3d' && !!config.model
  const photo = config.images[Math.min(index, config.images.length - 1)]

  const go = useCallback((d: number) => setIndex((i) => (i + d + views.length) % views.length), [views.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  useGSAP(
    () => {
      if (reduced) return
      gsap.from('[data-gal-in]', { opacity: 0, y: 16, stagger: 0.08, delay: 0.8 / config.animation.speed })
    },
    { scope: root, dependencies: [reduced] },
  )

  useGSAP(
    () => {
      if (reduced) return
      gsap.fromTo('[data-gal-caption]', { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.9 })
    },
    { scope: root, dependencies: [index, reduced] },
  )

  return (
    <div
      ref={root}
      className="relative min-h-[calc(var(--sr-vh)*100)] overflow-hidden transition-colors duration-700"
      style={{ fontFamily: bodyFontFamily(config.theme.bodyFont), backgroundColor: wall, color: ink, ['--sr-accent' as string]: ink, ['--sr-on-accent' as string]: wall }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[calc(var(--sr-vh)*68)] touch-pan-y @3xl:inset-0 @3xl:h-auto"
        onPointerDown={(e) => {
          // Capture so a release outside the stage still ends the drag.
          e.currentTarget.setPointerCapture?.(e.pointerId)
          dragStart.current = { x: e.clientX, base: drag.current }
        }}
        onPointerMove={(e) => {
          if (!dragStart.current) return
          drag.current = dragStart.current.base + (e.clientX - dragStart.current.x) * 0.01
        }}
        onPointerUp={() => (dragStart.current = null)}
        onPointerCancel={() => (dragStart.current = null)}
        onLostPointerCapture={() => (dragStart.current = null)}
      >
        {show3d ? (
          <SceneCanvas
            className="absolute inset-0"
            label={`${config.productName} on a gallery plinth, ${chapter?.title ?? ''} view. Drag to turn.`}
            camera={{ position: [0, 0.6, 6.4], fov: 30 }}
            pauseOffscreen={false}
            shadows
            fallback={
              photo ? <PhotoMotion image={photo} className="absolute inset-[14%_12%_30%] @3xl:inset-[10%_30%_14%]" fit="contain" /> : null
            }
          >
            <GalleryStage config={config} chapter={chapter} drag={drag} wall={wall} reduced={reduced} />
          </SceneCanvas>
        ) : photo ? (
          <PhotoMotion key={photo.src} image={photo} className="absolute inset-[14%_12%_34%] @3xl:inset-[10%_30%_14%]" fit="contain" priority />
        ) : null}
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-[calc(var(--sr-vh)*100)] flex-col justify-between px-[var(--gutter)] pb-6 pt-32 @3xl:pb-10 @3xl:pt-36">
        <div className="flex items-start justify-between gap-4">
          <h1 data-gal-in className={`${display} text-[clamp(2.4rem,6vw,5.5rem)]`}>
            {config.productName}
          </h1>
          <span data-gal-in className="pointer-events-auto" style={{ color: mutedInk }}>
            <ModeBadge mode={show3d ? 'true3d' : 'photo'} />
          </span>
        </div>

        <div className="grid gap-6 @max-3xl:mt-[calc(var(--sr-vh)*44)] @3xl:grid-cols-12 @3xl:items-end">
          {/* Angle navigation */}
          <div data-gal-in className="pointer-events-auto @3xl:col-span-5">
            <div data-gal-caption aria-live="polite" className="mb-5 max-w-xs">
              <p className="meta" style={{ color: mutedInk }}>
                {String(index + 1).padStart(2, '0')} / {String(views.length).padStart(2, '0')} · {chapter?.title}
              </p>
              {chapter?.body && <p className="mt-2 text-sm leading-relaxed">{chapter.body}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                className="grid size-12 cursor-pointer place-items-center rounded-full ring-1 ring-inset ring-current/30 transition-colors hover:bg-current/10"
                aria-label="Previous view"
              >
                <ArrowLeft aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="grid size-12 cursor-pointer place-items-center rounded-full ring-1 ring-inset ring-current/30 transition-colors hover:bg-current/10"
                aria-label="Next view"
              >
                <ArrowRight aria-hidden className="size-5" />
              </button>
              <div role="tablist" aria-label="Views" className="ml-3 hidden gap-1 @2xl:flex">
                {views.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    onClick={() => setIndex(i)}
                    className="meta min-h-11 cursor-pointer rounded-full px-3 transition-colors"
                    style={{ backgroundColor: i === index ? ink : 'transparent', color: i === index ? wall : mutedInk }}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Wall label */}
          <aside
            data-gal-in
            aria-label="Wall label"
            className="pointer-events-auto w-full max-w-sm justify-self-end p-5 @3xl:col-span-4 @3xl:col-start-9 @3xl:p-6"
            style={{ backgroundColor: ink === '#f2f0eb' ? 'rgb(255 255 255 / 0.06)' : 'rgb(255 255 255 / 0.55)', backdropFilter: 'blur(10px)' }}
          >
            <p className="meta" style={{ color: mutedInk }}>
              {config.brand}
            </p>
            <p className="mt-2 font-serif text-2xl italic">{config.productName}</p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: mutedInk }}>
              {config.tagline}
            </p>
            <dl className="mt-4 space-y-1 text-sm">
              {config.details.map((d) => (
                <div key={d.label} className="flex justify-between gap-4">
                  <dt style={{ color: mutedInk }}>{d.label}</dt>
                  <dd className="text-right">{d.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              {config.price && <span className="text-lg font-semibold tabular-nums">{config.price}</span>}
              <PurchaseButton config={config} className="!min-h-12 !px-5 !py-2.5 !text-sm" />
            </div>
            {backdrops.length > 1 && (
              <div className="mt-5 flex items-center gap-3 border-t pt-4" style={{ borderColor: 'color-mix(in srgb, currentColor 18%, transparent)' }}>
                <span className="meta" style={{ color: mutedInk }}>
                  Wall
                </span>
                <div role="radiogroup" aria-label="Wall colour" className="flex gap-1">
                  {backdrops.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={wall === c}
                      aria-label={`Wall colour ${c}`}
                      onClick={() => setWall(c)}
                      className="grid size-11 cursor-pointer place-items-center"
                    >
                      <span
                        className="size-6 rounded-full transition-transform"
                        style={{
                          backgroundColor: c,
                          boxShadow: wall === c ? `0 0 0 2px ${wall}, 0 0 0 3.5px ${ink}` : 'inset 0 0 0 1px rgb(0 0 0 / 0.15)',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
      <p className="sr-only">{config.description}</p>
    </div>
  )
}
