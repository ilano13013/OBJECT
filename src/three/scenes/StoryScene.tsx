import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { AuraBottle } from '../products'
import { Backlight } from '../Backlight'
import { Studio } from '../Studio'

const { damp, smoothstep } = THREE.MathUtils

/** Camera keyframes across the scroll story: wide → side light → cap macro → hero. */
const KEYS = [
  { at: 0, cam: new THREE.Vector3(0, 0.3, 8.5), look: new THREE.Vector3(0, 0.1, 0), env: 0.25 },
  { at: 0.34, cam: new THREE.Vector3(2.4, 0.4, 4.4), look: new THREE.Vector3(0, 0.1, 0), env: 0.7 },
  { at: 0.67, cam: new THREE.Vector3(-1.1, 1.85, 2.6), look: new THREE.Vector3(0, 1.25, 0), env: 1 },
  { at: 1, cam: new THREE.Vector3(0, 0.15, 5.4), look: new THREE.Vector3(0, 0.25, 0), env: 1.25 },
]

const cam = new THREE.Vector3()
const look = new THREE.Vector3()
const lookNow = new THREE.Vector3(0, 0.1, 0)

function sample(p: number) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i]!
    const b = KEYS[i + 1]!
    if (p <= b.at) {
      const k = smoothstep(p, a.at, b.at)
      cam.lerpVectors(a.cam, b.cam, k)
      look.lerpVectors(a.look, b.look, k)
      return a.env + (b.env - a.env) * k
    }
  }
  const last = KEYS[KEYS.length - 1]!
  cam.copy(last.cam)
  look.copy(last.look)
  return last.env
}

/** Scroll-driven product film. `progress` (0..1) is written by ScrollTrigger. */
export function StoryScene({ progress, lite }: { progress: RefObject<number>; lite?: boolean }) {
  const bottle = useRef<THREE.Group>(null)
  const key = useRef<THREE.SpotLight>(null)
  const accent = useRef<THREE.PointLight>(null)
  const smoothed = useRef(0)
  const { camera, scene } = useThree()
  const wide = useThree((st) => st.size.width >= 768)

  useFrame((_, dt) => {
    smoothed.current = damp(smoothed.current, progress.current ?? 0, 4, dt)
    const p = smoothed.current
    const env = sample(p)
    // On desktop the copy sits left, so aim left of the product by an amount
    // proportional to distance: the bottle stays right of the text at any zoom.
    if (wide) look.x -= cam.distanceTo(look) * 0.17
    camera.position.lerp(cam, 1 - Math.exp(-6 * dt))
    lookNow.lerp(look, 1 - Math.exp(-6 * dt))
    camera.lookAt(lookNow)
    scene.environmentIntensity = env
    if (bottle.current) bottle.current.rotation.y = -0.5 + p * Math.PI * 1.75
    if (key.current) {
      key.current.intensity = 30 + p * 60
      key.current.position.x = -4 + p * 8
    }
    if (accent.current) accent.current.intensity = smoothstep(p, 0.55, 0.9) * 18
  })

  return (
    <>
      <Studio warm accent="#e8c9a4" intensity={0.25} />
      <spotLight ref={key} position={[-4, 5, 3]} angle={0.5} penumbra={1} color="#fff1de" intensity={30} />
      <pointLight ref={accent} position={[0, 1.5, -2.2]} color="#d7ff43" intensity={0} distance={6} />
      <Backlight base="#0b0a09" glow="#f3dcc0" position={[0, 0.3, -3]} size={[1.8, 7]} />
      <group ref={bottle}>
        <AuraBottle lite={lite} />
      </group>
    </>
  )
}
