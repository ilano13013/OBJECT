import { ContactShadows, OrbitControls } from '@react-three/drei'
import { ProductModel } from '@/three/ProductModel'
import { SceneCanvas } from '@/three/SceneCanvas'
import { Studio } from '@/three/Studio'

/**
 * Inspect a stored model before using it: drag to turn, scroll or pinch to
 * zoom. Loads the file through the same loader as showrooms, so what you see
 * here is what visitors get.
 */
export default function ModelViewer({ storagePath, name }: { storagePath: string; name: string }) {
  return (
    <SceneCanvas
      className="absolute inset-0 touch-none"
      label={`${name}, 3D model preview. Drag to rotate, scroll or pinch to zoom.`}
      camera={{ position: [0, 0.4, 6.4], fov: 32 }}
      pauseOffscreen={false}
      interactive
      fallback={<div className="grid size-full place-items-center p-6 text-center text-sm text-ash">3D preview unavailable on this device. The model is saved and will show in showrooms on devices with WebGL.</div>}
    >
      <Studio />
      <ProductModel source={{ kind: 'upload', assetId: storagePath, name }} />
      <ContactShadows position={[0, -1.25, 0]} opacity={0.5} scale={7} blur={2.6} far={3} resolution={256} color="#000" />
      <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={11} enableDamping dampingFactor={0.08} autoRotate autoRotateSpeed={0.8} />
    </SceneCanvas>
  )
}
