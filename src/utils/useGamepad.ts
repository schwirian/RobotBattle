import { useEffect, useState } from 'react'

export type PadState = { left: boolean; right: boolean; up: boolean; down: boolean; light: boolean; heavy: boolean; special: boolean; block: boolean }

export function useGamepad(index: number = 0) : PadState {
  const [pad, setPad] = useState<PadState>({ left: false, right: false, up: false, down: false, light: false, heavy: false, special: false, block: false })

  useEffect(() => {
    let raf = 0
    const poll = () => {
      const pads = navigator.getGamepads?.() || []
      const gp = pads[index]
      if (gp) {
        // Standard mapping: axes[0]=left/right, axes[1]=up/down; buttons 0/1/2/3 face buttons
        const ax0 = gp.axes[0] || 0
        const ax1 = gp.axes[1] || 0
        const b = (i: number) => !!gp.buttons[i]?.pressed
        const next: PadState = {
          left: ax0 < -0.3, right: ax0 > 0.3, up: ax1 < -0.3, down: ax1 > 0.3,
          light: b(0), heavy: b(1), special: b(2), block: b(3),
        }
        setPad(next)
      }
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  }, [index])

  return pad
}
