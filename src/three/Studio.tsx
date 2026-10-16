import { Environment, Lightformer } from '@react-three/drei'
import studioHdr from '@pmndrs/assets/hdri/studio.exr'

interface StudioProps {
  /** Colour of the accent strip light reflected in chrome and glass. */
  accent?: string
  intensity?: number
  /** Warm (tungsten) or neutral key light. */
  warm?: boolean
}

/**
 * Photo studio: a small bundled studio HDRI (CC0, ~110 KB, no network fetch)
 * plus authored softboxes and strips, baked once into an environment map.
 */
export function Studio({ accent = '#d7ff43', intensity = 1, warm = false }: StudioProps) {
  const key = warm ? '#fff1de' : '#ffffff'
  return (
    <Environment files={studioHdr} resolution={256} frames={1} environmentIntensity={intensity}>
      {/* Overhead softbox */}
      <Lightformer form="rect" intensity={2.6} color={key} position={[0, 5, -2]} scale={[8, 4, 1]} />
      {/* Tall side strips: the long vertical highlights on chrome */}
      <Lightformer form="rect" intensity={3} color={key} position={[-5, 0.5, 1]} scale={[1.2, 9, 1]} />
      <Lightformer form="rect" intensity={1.6} color={key} position={[5, 0.5, -1]} scale={[0.8, 9, 1]} />
      {/* Accent kicker */}
      <Lightformer form="rect" intensity={2.2} color={accent} position={[3, -1, 4]} scale={[4, 0.6, 1]} />
      {/* Floor bounce */}
      <Lightformer form="rect" intensity={0.12} color="#8a8d92" position={[0, -5, 0]} scale={[12, 12, 1]} />
      {/* Rim from behind */}
      <Lightformer form="ring" intensity={1.4} color={key} position={[0, 1, -6]} scale={3} />
    </Environment>
  )
}
