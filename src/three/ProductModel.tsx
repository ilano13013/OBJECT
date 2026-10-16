import { Center, useGLTF } from '@react-three/drei'
import { use, useMemo } from 'react'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { ModelSource } from '@/showroom/types'
import { assetBlob } from '@/studio/assets'
import { ProceduralModel } from './products'

/** Target size (largest dimension) every model is normalised to. */
const TARGET = 2.4

/**
 * glTF is data only (meshes, materials, textures); Three.js never executes
 * anything from a model file. We also drop cameras and lights so an imported
 * file cannot alter the studio set-up, and scale it to a common size.
 */
function normalise(scene: THREE.Object3D) {
  const root = scene.clone(true)
  const strip: THREE.Object3D[] = []
  root.traverse((o) => {
    if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera) strip.push(o)
    if ((o as THREE.Mesh).isMesh) o.castShadow = true
  })
  strip.forEach((o) => o.removeFromParent())
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
  root.scale.setScalar(TARGET / Math.max(size.x, size.y, size.z, 0.0001))
  return root
}

function HostedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const object = useMemo(() => normalise(scene), [scene])
  return (
    <Center>
      <primitive object={object} />
    </Center>
  )
}

const parsed = new Map<string, Promise<GLTF>>()

/** Parses an uploaded model straight from its stored bytes (no network fetch). */
function loadUpload(assetId: string): Promise<GLTF> {
  let p = parsed.get(assetId)
  if (!p) {
    p = (async () => {
      const blob = await assetBlob(assetId)
      if (!blob) throw new Error('Model file not found.')
      const buffer = await blob.arrayBuffer()
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
      return new Promise<GLTF>((resolve, reject) => loader.parse(buffer, '', resolve, reject))
    })()
    p.catch(() => parsed.delete(assetId))
    parsed.set(assetId, p)
  }
  return p
}

function UploadedModel({ assetId }: { assetId: string }) {
  const gltf = use(loadUpload(assetId))
  const object = useMemo(() => normalise(gltf.scene), [gltf])
  return (
    <Center>
      <primitive object={object} />
    </Center>
  )
}

export function ProductModel({ source, lite }: { source: ModelSource; lite?: boolean }) {
  switch (source.kind) {
    case 'gltf':
      return <HostedModel url={source.url} />
    case 'upload':
      return <UploadedModel assetId={source.assetId} />
    case 'procedural':
      return <ProceduralModel id={source.id} lite={lite} />
  }
}
