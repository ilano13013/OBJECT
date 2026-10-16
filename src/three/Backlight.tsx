import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * A soft vertical light slit behind the product, the way perfume and glass
 * are shot: transparent materials need something bright behind them to
 * refract. Opaque (so transmission can see it) and faded into `base` so its
 * edges disappear into the page background.
 */
export function Backlight({
  base = '#09090b',
  glow = '#f5e6d0',
  position = [0, 0.2, -2.6],
  size = [1.6, 6],
}: {
  base?: string
  glow?: string
  position?: [number, number, number]
  size?: [number, number]
}) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 512
    const ctx = c.getContext('2d')!
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 128, 512)
    const h = ctx.createLinearGradient(0, 0, 128, 0)
    h.addColorStop(0, base)
    h.addColorStop(0.42, glow)
    h.addColorStop(0.58, glow)
    h.addColorStop(1, base)
    ctx.fillStyle = h
    ctx.fillRect(0, 0, 128, 512)
    const v = ctx.createLinearGradient(0, 0, 0, 512)
    v.addColorStop(0, base)
    v.addColorStop(0.3, 'rgba(0,0,0,0)')
    v.addColorStop(0.7, 'rgba(0,0,0,0)')
    v.addColorStop(1, base)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, 128, 512)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [base, glow])

  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
