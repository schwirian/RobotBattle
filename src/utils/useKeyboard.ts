import { useEffect, useState } from 'react'

export function useKeyboard(keys: {
  left: string; right: string; up: string; down: string; light: string; heavy: string; special: string; block: string
}) {
  const [state, setState] = useState({ left: false, right: false, up: false, down: false, light: false, heavy: false, special: false, block: false })

  useEffect(() => {
    const map = Object.fromEntries(Object.entries(keys).map(([k, v]) => [v.toLowerCase(), k])) as Record<string, keyof typeof state>

    function set(key: string, down: boolean) {
      const which = map[key.toLowerCase()]
      if (!which) return
      setState((s) => ({ ...s, [which]: down }))
    }

    const onDown = (e: KeyboardEvent) => set(e.key, true)
    const onUp = (e: KeyboardEvent) => set(e.key, false)

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [JSON.stringify(keys)])

  return state
}
