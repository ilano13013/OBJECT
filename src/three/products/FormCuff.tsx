import { useMemo } from 'react'
import * as THREE from 'three'

const R_OUT = 1
const R_IN = 0.9
const DEPTH = 0.62
const GAP = 0.95

/** FORM Cuff 01 — open titanium cuff with an enamel lining. */
export function FormCuff() {
  const { body, lining } = useMemo(() => {
    const a0 = -Math.PI / 2 + GAP / 2
    const a1 = a0 + Math.PI * 2 - GAP
    const shape = new THREE.Shape()
    shape.absarc(0, 0, R_OUT, a0, a1, false)
    shape.absarc(0, 0, R_IN, a1, a0, true)
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: DEPTH,
      curveSegments: 120,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 5,
    })
    body.translate(0, 0, -DEPTH / 2)
    body.computeVertexNormals()

    // CylinderGeometry measures theta from +Z around Y; after a +90° turn
    // about X its angle in the XY plane is theta − π/2.
    // The bevel grows the shape by bevelSize, so the inner wall sits at R_IN − 0.03.
    const lining = new THREE.CylinderGeometry(R_IN - 0.036, R_IN - 0.036, DEPTH + 0.04, 120, 1, true, a0 + Math.PI / 2, a1 - a0)
    lining.rotateX(Math.PI / 2)
    return { body, lining }
  }, [])

  return (
    <group>
      <mesh geometry={body} castShadow>
        <meshPhysicalMaterial color="#b3b7bc" metalness={1} roughness={0.36} anisotropy={0.8} clearcoat={0.3} clearcoatRoughness={0.4} />
      </mesh>
      <mesh geometry={lining}>
        <meshStandardMaterial color="#c8f02a" roughness={0.45} metalness={0} side={THREE.BackSide} envMapIntensity={0.5} />
      </mesh>
    </group>
  )
}
