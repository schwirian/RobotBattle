import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { createGame, GameState, InputState, Robot, defaultRobots } from '@/game/core'
import { RobotSelect } from './RobotSelect'
import { useKeyboard } from '@/utils/useKeyboard'
import { getSocket } from '@/net/socket'

export function Battle({ mode, roomId, playerIndex = 0, onExit }: { mode: 'local' | 'online', roomId?: string, playerIndex?: 0 | 1, onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<GameState>(() => createGame())
  const [selecting, setSelecting] = useState(true)
  const [p1Sel, setP1Sel] = useState<string>('alpha')
  const [p2Sel, setP2Sel] = useState<string>('bravo')

  const p1Keys = useKeyboard({
    left: 'a', right: 'd', up: 'w', down: 's', light: 'f', heavy: 'g', special: 'h', block: 'v'
  })
  const p2Keys = useKeyboard({
    left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown', light: '1', heavy: '2', special: '3', block: '0'
  })

  // Main game loop
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const step = (now: number) => {
      const dt = Math.min(33, now - last) / 1000
      last = now
      setState((prev) => {
        const localP1 = keysToInput(p1Keys)
        const localP2 = keysToInput(p2Keys)
        let ip1 = localP1
        let ip2 = localP2
        if (mode === 'online') {
          if (playerIndex === 0) ip2 = prev.input.p2
          else ip1 = prev.input.p1
        }
        return prev.update({ p1: ip1, p2: ip2, dt })
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [mode, playerIndex, p1Keys, p2Keys])

  useEffect(() => {
    if (mode !== 'online' || !roomId) return
    const s = getSocket()
    const send = () => {
      const input = playerIndex === 0 ? keysToInput(p1Keys) : keysToInput(p2Keys)
      s.emit('sync_input', { roomId, input })
    }
    const onOpp = ({ input }: { id: string; input: InputState }) => {
      setState((prev) => {
        // copy to avoid mutating class in-place for TS state heuristics
        const next = new GameState(prev.p1, prev.p2)
        Object.assign(next, prev)
        if (playerIndex === 0) next.input.p2 = input
        else next.input.p1 = input
        return next
      })
    }
    const int = setInterval(send, 33)
    s.on('opponent_input', onOpp)
    return () => { clearInterval(int); s.off('opponent_input', onOpp) }
  }, [mode, roomId, playerIndex, p1Keys, p2Keys])

  // Render to canvas
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawArena(ctx, state)
  }, [state])

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-2">
        <button className="px-3 py-1 bg-zinc-700 rounded" onClick={onExit}>Back</button>
        <div className="flex-1 text-center">{mode.toUpperCase()} {roomId ? `(Room ${roomId})` : ''}</div>
      </div>
      <div className="relative">
        {selecting ? (
          <div className="p-4 flex gap-8">
            <div>
              <div className="mb-2 opacity-80">P1 Select</div>
              <RobotSelect onSelect={setP1Sel} />
            </div>
            <div>
              <div className="mb-2 opacity-80">P2 Select</div>
              <RobotSelect onSelect={setP2Sel} />
            </div>
            <div className="flex items-end">
              <button className="px-4 py-2 bg-emerald-600 rounded" onClick={() => {
                setState(createGame(p1Sel, p2Sel))
                setSelecting(false)
              }}>Start!</button>
            </div>
          </div>
        ) : null}
        <canvas ref={canvasRef} width={1024} height={576} className="rounded border border-zinc-700 bg-arena-bg" />
        {/* UI overlays */}
        <HUD state={state} />
      </div>
    </div>
  )
}

function keysToInput(keys: ReturnType<typeof useKeyboard>): InputState {
  return {
    left: keys.left, right: keys.right, up: keys.up, down: keys.down,
    light: keys.light, heavy: keys.heavy, special: keys.special, block: keys.block
  }
}

function drawArena(ctx: CanvasRenderingContext2D, s: GameState) {
  const { w, h } = { w: ctx.canvas.width, h: ctx.canvas.height }
  ctx.clearRect(0, 0, w, h)

  // Background grid
  ctx.fillStyle = '#0a0f1e'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#1b2745'
  ctx.lineWidth = 1
  for (let x = 0; x <= w; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y <= h; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // Robots
  for (const r of [s.p1, s.p2]) {
    drawRobot(ctx, r)
  }

  // Hit sparks
  for (const sp of s.sparks) {
    ctx.fillStyle = `rgba(255, ${Math.floor(180 + 50*Math.random())}, 0, ${sp.life.toFixed(2)})`
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 3 + Math.random()*2, 0, Math.PI*2); ctx.fill()
  }

  // Parts
  for (const p of s.parts) {
    ctx.fillStyle = p.color
    ctx.fillRect(p.x, p.y, 6, 3)
  }
}

function drawRobot(ctx: CanvasRenderingContext2D, r: Robot) {
  const { x, y, facing } = r
  ctx.save()
  ctx.translate(x, y)
  if (facing === 'left') { ctx.scale(-1, 1) }

  // Body
  ctx.fillStyle = r.color
  ctx.fillRect(-20, -60, 40, 60)
  // Head
  ctx.fillStyle = '#cbd5e1'
  ctx.fillRect(-12, -80, 24, 20)
  // Arms
  ctx.fillStyle = r.color
  ctx.fillRect(-28, -54, 16, 12)
  ctx.fillRect(12, -54, 16, 12)
  // Legs
  ctx.fillRect(-18, 0, 14, 18)
  ctx.fillRect(4, 0, 14, 18)

  // Special aura when power high
  if (r.power >= 80) {
    ctx.strokeStyle = 'rgba(0,255,255,0.6)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, -30, 40 + Math.sin(performance.now()/100)*2, 0, Math.PI*2); ctx.stroke()
  }

  ctx.restore()
}

function HUD({ state }: { state: GameState }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="flex justify-between p-2">
        <Bar label={state.p1.name} hp={state.p1.hp} power={state.p1.power}
             className="items-start" />
        <Bar label={state.p2.name} hp={state.p2.hp} power={state.p2.power}
             className="items-end" />
      </div>
    </div>
  )
}

function Bar({ label, hp, power, className }: { label: string, hp: number, power: number, className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="w-72 h-4 bg-zinc-800 rounded overflow-hidden border border-zinc-700">
        <div className="h-full bg-red-500" style={{ width: `${hp}%` }} />
      </div>
      <div className="w-72 h-2 bg-zinc-800 rounded overflow-hidden border border-zinc-700">
        <div className="h-full bg-cyan-400" style={{ width: `${power}%` }} />
      </div>
    </div>
  )
}
