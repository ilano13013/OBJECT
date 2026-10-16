import { EnvironmentPortal, Lightformer } from '@react-three/drei'
import studioHdr from '@pmndrs/assets/hdri/studio.exr'
import { Component, type ReactNode } from 'react'
import * as THREE from 'three'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'

let studioTexture: THREE.DataTexture | null | undefined

/**
 * Decodes the bundled studio HDRI (CC0, ~110 KB) straight from its inline
 * base64, with no fetch(): sandboxed hosts often forbid fetching data: URLs,
 * which would otherwise take the whole scene down.
 */
function getStudioTexture(): THREE.DataTexture | null {
  if (studioTexture !== undefined) return studioTexture
  try {
    const base64 = studioHdr.slice(studioHdr.indexOf(',') + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const loader = new EXRLoader().setDataType(THREE.HalfFloatType)
    const exr = loader.parse(bytes.buffer)
    const tex = new THREE.DataTexture(exr.data, exr.width, exr.height, exr.format, exr.type)
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.LinearSRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    tex.flipY = false
    tex.needsUpdate = true
    studioTexture = tex
  } catch (error) {
    console.warn('[OBJECT.] Studio HDRI unavailable, using authored lights only.', error)
    studioTexture = null
  }
  return studioTexture
}

class EnvBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

interface StudioProps {
  /** Colour of the accent strip light reflected in chrome and glass. */
  accent?: string
  intensity?: number
  /** Warm (tungsten) or neutral key light. */
  warm?: boolean
}

function Formers({ accent, keyColor }: { accent: string; keyColor: string }) {
  return (
    <>
      {/* Overhead softbox */}
      <Lightformer form="rect" intensity={2.6} color={keyColor} position={[0, 5, -2]} scale={[8, 4, 1]} />
      {/* Tall side strips: the long vertical highlights on chrome */}
      <Lightformer form="rect" intensity={3} color={keyColor} position={[-5, 0.5, 1]} scale={[1.2, 9, 1]} />
      <Lightformer form="rect" intensity={1.6} color={keyColor} position={[5, 0.5, -1]} scale={[0.8, 9, 1]} />
      {/* Accent kicker */}
      <Lightformer form="rect" intensity={2.2} color={accent} position={[3, -1, 4]} scale={[4, 0.6, 1]} />
      {/* Floor bounce */}
      <Lightformer form="rect" intensity={0.12} color="#8a8d92" position={[0, -5, 0]} scale={[12, 12, 1]} />
      {/* Rim from behind */}
      <Lightformer form="ring" intensity={1.4} color={keyColor} position={[0, 1, -6]} scale={3} />
    </>
  )
}

/**
 * Photo studio: the bundled HDRI plus authored softboxes and strips, baked once
 * into an environment map. If the HDRI cannot be decoded, the authored lights
 * alone still light the product.
 */
export function Studio({ accent = '#d7ff43', intensity = 1, warm = false }: StudioProps) {
  const keyColor = warm ? '#fff1de' : '#ffffff'
  const map = getStudioTexture()
  const plain = (
    <EnvironmentPortal resolution={256} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={['#050506']} />
      <Formers accent={accent} keyColor={keyColor} />
    </EnvironmentPortal>
  )
  if (!map) return plain
  return (
    <EnvBoundary fallback={plain}>
      <EnvironmentPortal map={map} resolution={256} frames={1} environmentIntensity={intensity}>
        <Formers accent={accent} keyColor={keyColor} />
      </EnvironmentPortal>
    </EnvBoundary>
  )
}
