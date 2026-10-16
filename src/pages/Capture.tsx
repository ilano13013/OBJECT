import { useParams, useSearchParams } from 'react-router'
import { Float } from '@react-three/drei'
import { SceneCanvas } from '@/three/SceneCanvas'
import { Studio } from '@/three/Studio'
import { Backlight } from '@/three/Backlight'
import { ProceduralModel } from '@/three/products'
import type { ProceduralModelId } from '@/showroom/types'

/**
 * Dev-only render booth used by scripts/capture-renders.ts to produce the
 * demo posters and FORM imagery. Not routed in production builds.
 */
export default function Capture() {
  const { id } = useParams()
  const [q] = useSearchParams()
  const bg = q.get('bg') ?? '#09090b'
  const rx = Number(q.get('rx') ?? 0.3)
  const ry = Number(q.get('ry') ?? -0.6)
  const rz = Number(q.get('rz') ?? 0)
  const z = Number(q.get('z') ?? 5.6)
  const y = Number(q.get('y') ?? 0)
  const accent = q.get('accent') ?? '#d7ff43'
  return (
    <div className="fixed inset-0" style={{ background: bg }}>
      <SceneCanvas className="absolute inset-0" label="render" camera={{ position: [0, y, z], fov: 30 }} fallback={null} gl={{ preserveDrawingBuffer: true, antialias: true }}>
        <Studio accent={accent} intensity={Number(q.get('env') ?? 1.1)} warm={id === 'aura-bottle'} />
        <Float speed={0}>
          <group rotation={[rx, ry, rz]}>
            <ProceduralModel id={id as ProceduralModelId} />
          </group>
        </Float>
        {q.get('backlight') && <Backlight base={bg} glow={q.get('backlight')!} />}
        <ambientLight intensity={Number(q.get('amb') ?? 0.3)} />
        <spotLight position={[2, 6, 4]} angle={0.5} penumbra={1} intensity={Number(q.get('spot') ?? 40)} />
      </SceneCanvas>
    </div>
  )
}
