import type { ReactNode } from 'react'
import { SceneCanvas } from '../SceneCanvas'
import { HeroScene } from './HeroScene'

export default function HeroCanvas({ reduced, mobile, fallback }: { reduced: boolean; mobile: boolean; fallback: ReactNode }) {
  return (
    <SceneCanvas
      className="absolute inset-0"
      label="The O of OBJECT. as a liquid chrome sculpture, circled by a lime full stop."
      camera={{ position: [0, 0, 6.8], fov: mobile ? 44 : 32 }}
      fallback={fallback}
    >
      <HeroScene reduced={reduced} mobile={mobile} />
    </SceneCanvas>
  )
}
