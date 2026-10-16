import { Center, useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { ModelSource } from '@/showroom/types'
import { ProceduralModel } from './products'

/** Target size (largest dimension) every model is normalised to. */
const TARGET = 2.4

function GltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const normalised = useMemo(() => {
    // glTF is data only (meshes, materials, textures). Three.js never executes
    // scripts from a model file; we additionally drop cameras and lights so an
    // imported file cannot alter the studio set-up.
    const root = scene.clone(true)
    const strip: THREE.Object3D[] = []
    root.traverse((o) => {
      if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera) strip.push(o)
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
    strip.forEach((o) => o.removeFromParent())
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const scale = TARGET / Math.max(size.x, size.y, size.z, 0.0001)
    root.scale.setScalar(scale)
    return root
  }, [scene])
  return (
    <Center>
      <primitive object={normalised} />
    </Center>
  )
}

export function ProductModel({ source, lite }: { source: ModelSource; lite?: boolean }) {
  if (source.kind === 'gltf') return <GltfModel url={source.url} />
  return <ProceduralModel id={source.id} lite={lite} />
}
