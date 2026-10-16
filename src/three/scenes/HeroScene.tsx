import { Float, MeshDistortMaterial } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { pointer } from '@/lib/pointer'
import { Studio } from '../Studio'

const { damp } = THREE.MathUtils

/**
 * The hero: the O of OBJECT. as a liquid-chrome sculpture, surfacing out of
 * darkness while its lime full stop orbits it. Leans toward the pointer; on touch it drifts on its own.
 */
export function HeroScene({ reduced = false, mobile = false }: { reduced?: boolean; mobile?: boolean }) {
  const tilt = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Group>(null)
  const scene = useThree((s) => s.scene)
  const intro = useRef(reduced ? 1 : 0)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    intro.current = Math.min(1, intro.current + dt / 2.4)
    const e = 1 - Math.pow(1 - intro.current, 4)
    scene.environmentIntensity = 0.05 + e * 1.05

    const px = pointer.active ? pointer.x : Math.sin(t * 0.25) * 0.5
    const py = pointer.active ? pointer.y : Math.cos(t * 0.21) * 0.3
    if (tilt.current) {
      tilt.current.rotation.y = damp(tilt.current.rotation.y, px * 0.45, 2.5, dt)
      tilt.current.rotation.x = damp(tilt.current.rotation.x, -py * 0.3, 2.5, dt)
      tilt.current.position.x = damp(tilt.current.position.x, px * 0.18, 2, dt)
      tilt.current.position.y = mobile ? -0.1 : -0.42
      tilt.current.scale.setScalar((0.72 + e * 0.28) * (mobile ? 0.78 : 0.86))
    }
    if (spin.current && !reduced) {
      spin.current.rotation.z += dt * 0.12
      spin.current.rotation.y = Math.sin(t * 0.2) * 0.35
    }
    if (halo.current && !reduced) {
      halo.current.rotation.z += dt * 0.12
      halo.current.rotation.x = 1.15 + Math.sin(t * 0.3) * 0.08
    }
  })

  return (
    <>
      <Studio intensity={0.05} />
      <group ref={tilt}>
        <Float speed={reduced ? 0 : 1.3} rotationIntensity={0.25} floatIntensity={0.7}>
          <group rotation={[0.35, -0.5, 0.12]}>
            <mesh ref={spin}>
              <torusGeometry args={[1.08, 0.5, mobile ? 48 : 96, mobile ? 96 : 220]} />
              <MeshDistortMaterial
                color="#d4d8dc"
                metalness={1}
                roughness={0.07}
                distort={reduced ? 0.06 : 0.14}
                speed={reduced ? 0 : 1.1}
              />
            </mesh>
          </group>
        </Float>
        <group ref={halo} rotation={[1.15, 0.25, 0]}>
          <mesh>
            <torusGeometry args={[2.25, 0.005, 8, 260]} />
            <meshBasicMaterial color="#d7ff43" toneMapped={false} transparent opacity={0.85} />
          </mesh>
          <mesh position={[2.25, 0, 0]}>
            <sphereGeometry args={[0.085, 32, 32]} />
            <meshBasicMaterial color="#d7ff43" toneMapped={false} />
          </mesh>
        </group>
        <Float speed={reduced ? 0 : 2} floatIntensity={1.2} rotationIntensity={1}>
          <mesh position={[-2.3, 1.2, -1.2]} rotation={[0.6, 0.4, 0.2]}>
            <boxGeometry args={[0.32, 0.32, 0.32]} />
            <meshStandardMaterial color="#252529" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[2.1, -1.35, 0.6]}>
            <sphereGeometry args={[0.17, 48, 48]} />
            <meshStandardMaterial color="#e6e8eb" metalness={1} roughness={0.03} />
          </mesh>
        </Float>
      </group>
    </>
  )
}
