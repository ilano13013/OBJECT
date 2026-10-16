import { RoundedBox } from '@react-three/drei'

/** AURA Nº 07 — weighted crystal flacon, amber juice, octagonal mirror cap. */
export function AuraBottle({ lite = false }: { lite?: boolean }) {
  return (
    <group>
      <RoundedBox args={[1.3, 1.9, 0.76]} radius={0.14} smoothness={lite ? 3 : 6} castShadow>
        {lite ? (
          <meshPhysicalMaterial color="#d99a5b" roughness={0.08} metalness={0} clearcoat={1} transparent opacity={0.82} />
        ) : (
          <meshPhysicalMaterial
            color="#fff7ee"
            roughness={0.03}
            metalness={0}
            transmission={1}
            thickness={1.5}
            ior={1.5}
            attenuationColor="#f1c48e"
            attenuationDistance={2.6}
            iridescence={0.15}
            iridescenceIOR={1.3}
            clearcoat={1}
            clearcoatRoughness={0.05}
            specularIntensity={1}
          />
        )}
      </RoundedBox>
      {/* Neck collar */}
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 0.16, 32]} />
        <meshStandardMaterial color="#c9ccd0" metalness={1} roughness={0.18} />
      </mesh>
      {/* Octagonal mirror cap */}
      <mesh position={[0, 1.38, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.58, 8]} />
        <meshStandardMaterial color="#e9e2d6" metalness={1} roughness={0.32} envMapIntensity={2.2} flatShading />
      </mesh>
      <mesh position={[0, 1.675, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[0.36, 0.4, 0.03, 8]} />
        <meshStandardMaterial color="#e9e2d6" metalness={1} roughness={0.32} envMapIntensity={2.2} flatShading />
      </mesh>
    </group>
  )
}
