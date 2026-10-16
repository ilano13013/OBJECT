/**
 * Window-wide normalised pointer (-1..1), shared by every scene. Canvases sit
 * behind text, so R3F's own pointer (canvas-local) would miss most movement.
 */
export const pointer = { x: 0, y: 0, active: false }

let bound = false
export function bindPointer() {
  if (bound || typeof window === 'undefined') return
  bound = true
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
      pointer.active = true
    },
    { passive: true },
  )
}
