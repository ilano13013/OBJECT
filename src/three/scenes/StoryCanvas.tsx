import type { ReactNode, RefObject } from 'react'
import { SceneCanvas } from '../SceneCanvas'
import { StoryScene } from './StoryScene'

export default function StoryCanvas({ progress, fallback }: { progress: RefObject<number>; fallback: ReactNode }) {
  return (
    <SceneCanvas
      className="absolute inset-0"
      label="A perfume bottle turning under moving studio light while the camera moves closer."
      camera={{ position: [0, 0.3, 8.5], fov: 30 }}
      fallback={fallback}
    >
      <StoryScene progress={progress} />
    </SceneCanvas>
  )
}
