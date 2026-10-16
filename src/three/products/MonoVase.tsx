import { useMemo } from 'react'
import * as THREE from 'three'

const WALL = 0.035

function throwLines() {
  const w = 4
  const h = 512
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const v = 128 + Math.sin(y * 0.55) * 30 + Math.sin(y * 0.13 + 1.3) * 24 + (Math.random() - 0.5) * 18
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, w, h)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

/** MONO Vessel III — thrown stoneware with a chalk glaze and visible throw lines. */
export function MonoVase({ color = '#ddd7cc' }: { color?: string }) {
  const { geometry, bump } = useMemo(() => {
    const curve = new THREE.SplineCurve([
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.44, 0.0),
      new THREE.Vector2(0.62, 0.22),
      new THREE.Vector2(0.8, 0.8),
      new THREE.Vector2(0.7, 1.45),
      new THREE.Vector2(0.34, 1.86),
      new THREE.Vector2(0.17, 2.1),
      new THREE.Vector2(0.2, 2.3),
    ])
    const outer = curve.getPoints(80)
    const inner = outer
      .slice(2)
      .reverse()
      .map((p) => new THREE.Vector2(Math.max(0.001, p.x - WALL), Math.max(0.06, p.y)))
    const lip = new THREE.Vector2(0.2 - WALL / 2, 2.31)
    const profile = [...outer, lip, ...inner]
    const geometry = new THREE.LatheGeometry(profile, 128)
    geometry.translate(0, -1.15, 0)
    geometry.computeVertexNormals()
    return { geometry, bump: throwLines() }
  }, [])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.92} metalness={0} bumpMap={bump} bumpScale={0.45} envMapIntensity={0.35} side={THREE.DoubleSide} />
    </mesh>
  )
}
