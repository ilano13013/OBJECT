import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Move3d } from 'lucide-react'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import { gsap, useGSAP } from '@/lib/gsap'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { ProductModel } from '@/three/ProductModel'
import { SceneCanvas } from '@/three/SceneCanvas'
import { Backlight } from '@/three/Backlight'
import { Studio } from '@/three/Studio'
import { useShowroomEnv } from '../frame'
import { fontClass, ModeBadge, PhotoMotion, PurchaseButton, themeVars } from '../parts'
import type { ShowroomConfig, ShowroomFeature } from '../types'

const { damp } = THREE.MathUtils

function OrbitStage({
  config,
  active,
  onSelect,
  reduced,
}: {
  config: ShowroomConfig
  active: string | null
  onSelect: (id: string | null) => void
  reduced: boolean
}) {
  const narrow = useThree((st) => st.size.width < 768)
  const group = useRef<THREE.Group>(null)
  const t0 = useRef<number | null>(null)
  const { entrance, speed, autoRotate } = config.animation

  useFrame((state, dt) => {
    if (!group.current) return
    t0.current ??= state.clock.elapsedTime
    const k = reduced ? 1 : Math.min(1, (state.clock.elapsedTime - t0.current) / (2.2 / speed))
    const e = 1 - Math.pow(1 - k, 4)
    if (entrance === 'rise') group.current.position.y = (1 - e) * -2.2
    if (entrance === 'orbit') group.current.rotation.y = damp(group.current.rotation.y, (1 - e) * -Math.PI * 1.2, 6, dt)
    group.current.scale.setScalar(entrance === 'fade' ? 0.9 + e * 0.1 : 1)
    state.scene.environmentIntensity = 0.1 + e * 0.95
  })

  return (
    <>
      <Studio accent={config.theme.accent} />
      <Backlight base={config.theme.background} glow={config.theme.accent} position={[0, 0.2, -3]} size={[1.7, 7]} />
      <group ref={group}>
        {config.model && <ProductModel source={config.model} />}
        {config.features
          .filter((f): f is ShowroomFeature & { hotspot: [number, number, number] } => !!f.hotspot)
          .map((f, i) => (
            <Html key={f.id} position={f.hotspot} center zIndexRange={[20, 0]}>
              <button
                type="button"
                onClick={() => onSelect(active === f.id ? null : f.id)}
                aria-pressed={active === f.id}
                aria-label={`${f.title}: ${f.body}`}
                className="group relative grid size-11 cursor-pointer place-items-center"
              >
                <span
                  className="absolute size-7 rounded-full ring-1 ring-white/60 backdrop-blur-sm transition-transform duration-500 group-hover:scale-125"
                  style={{ animation: reduced ? undefined : `ping-soft 2.4s ${i * 0.4}s ease-out infinite` }}
                />
                <span className="relative size-2.5 rounded-full" style={{ backgroundColor: config.theme.accent }} />
              </button>
            </Html>
          ))}
      </group>
      <ContactShadows position={[0, -1.25, 0]} opacity={0.55} scale={7} blur={2.6} far={3} resolution={256} color="#000" />
      <OrbitControls
        target={narrow ? [0, -0.75, 0] : [0, 0, 0]}
        enablePan={false}
        enableZoom
        minDistance={3.6}
        maxDistance={12}
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.62}
        autoRotate={autoRotate && !reduced && active === null}
        autoRotateSpeed={0.6 * speed}
        enableDamping
        dampingFactor={0.06}
      />
    </>
  )
}

/** TEMPLATE 01 — ORBIT. Black, chrome, studio light, a central object you turn. */
export function OrbitTemplate({ config }: { config: ShowroomConfig }) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [active, setActive] = useState<string | null>(null)
  const feature = config.features.find((f) => f.id === active)
  const display = fontClass(config.theme.displayFont)
  const show3d = config.mode === 'true3d' && !!config.model
  const photo = config.images[0]
  const { narrow } = useShowroomEnv()

  useGSAP(
    () => {
      if (reduced) return
      gsap.from('[data-orbit-in]', { y: 30, opacity: 0, filter: 'blur(10px)', stagger: 0.09, duration: 1.4 / config.animation.speed, delay: 0.5 })
    },
    { scope: root, dependencies: [reduced] },
  )

  return (
    <div ref={root} className="relative min-h-[calc(var(--sr-vh)*100)] overflow-hidden" style={themeVars(config)}>
      <div className="absolute inset-x-0 top-0 h-[calc(var(--sr-vh)*100)]" style={{ background: `radial-gradient(55% 55% at 50% 45%, var(--sr-surface), var(--sr-bg) 75%)` }} />

      <div className="absolute inset-x-0 top-0 h-[calc(var(--sr-vh)*100)]">
        {show3d ? (
          <SceneCanvas
            className="absolute inset-0"
            label={`${config.productName} by ${config.brand}, interactive 3D model. Drag to rotate.`}
            camera={{ position: [0, 0.3, narrow ? 12 : 7.4], fov: 32 }}
            pauseOffscreen={false}
            fallback={
              photo ? (
                <PhotoMotion image={photo} className="absolute inset-0" />
              ) : (
                <div className="grid size-full place-items-center text-sm opacity-70">3D preview unavailable on this device.</div>
              )
            }
          >
            <OrbitStage config={config} active={active} onSelect={setActive} reduced={reduced} />
          </SceneCanvas>
        ) : photo ? (
          <PhotoMotion image={photo} className="absolute inset-[12%_10%_18%] @3xl:inset-[10%_28%]" fit="contain" priority />
        ) : null}
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-[calc(var(--sr-vh)*100)] flex-col justify-between gap-10 px-[var(--gutter)] pb-8 pt-32 @3xl:pb-12 @3xl:pt-36">
        <div className="flex items-start justify-between gap-4">
          <p data-orbit-in className="meta" style={{ color: 'var(--sr-muted)' }}>
            {config.brand}
          </p>
          <span data-orbit-in className="pointer-events-auto" style={{ color: 'var(--sr-muted)' }}>
            <ModeBadge mode={show3d ? 'true3d' : 'photo'} />
          </span>
        </div>

        <div className="grid gap-8 @3xl:grid-cols-12 @3xl:items-end">
          <div className="@3xl:col-span-7">
            <h1 data-orbit-in className={`${display} text-[clamp(3.2rem,9vw,9rem)]`}>
              {config.productName}
            </h1>
            <p data-orbit-in className="mt-4 max-w-md text-lg @3xl:text-xl">
              {config.tagline}
            </p>
          </div>
          <div className="pointer-events-auto flex flex-col gap-5 @3xl:col-span-4 @3xl:col-start-9">
            <p data-orbit-in className="max-w-sm text-sm leading-relaxed" style={{ color: 'var(--sr-muted)' }}>
              {config.description}
            </p>
            {config.price && (
              <p data-orbit-in className="meta">
                {config.price}
              </p>
            )}
            <div data-orbit-in>
              <PurchaseButton config={config} />
            </div>
          </div>
        </div>
      </div>

      {show3d && (
        <p
          className="meta pointer-events-none absolute right-[var(--gutter)] top-[13.5rem] z-10 hidden items-center gap-2 @3xl:flex"
          style={{ color: 'var(--sr-muted)' }}
        >
          <Move3d aria-hidden className="size-4" /> Drag to turn · tap the points
        </p>
      )}

      {/* Feature panel (hotspot target) + accessible list */}
      <aside aria-label="Product details" className="relative z-10 border-t px-[var(--gutter)] py-10" style={{ borderColor: 'color-mix(in srgb, var(--sr-text) 14%, transparent)' }}>
        <div aria-live="polite" className="sr-only">
          {feature ? `${feature.title}. ${feature.body}` : ''}
        </div>
        <ul className="grid gap-8 @3xl:grid-cols-3">
          {config.features.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setActive(active === f.id ? null : f.id)}
                aria-pressed={active === f.id}
                className="w-full cursor-pointer text-left transition-opacity"
                style={{ opacity: active && active !== f.id ? 0.45 : 1 }}
              >
                <span className="flex items-center gap-3 text-lg font-medium">
                  <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--sr-accent)' }} />
                  {f.title}
                </span>
                <span className="mt-2 block max-w-sm text-sm leading-relaxed" style={{ color: 'var(--sr-muted)' }}>
                  {f.body}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {config.details.length > 0 && (
          <dl className="mt-12 grid grid-cols-2 gap-6 @3xl:grid-cols-4">
            {config.details.map((d) => (
              <div key={d.label}>
                <dt className="meta" style={{ color: 'var(--sr-muted)' }}>
                  {d.label}
                </dt>
                <dd className="mt-1">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </aside>
    </div>
  )
}
