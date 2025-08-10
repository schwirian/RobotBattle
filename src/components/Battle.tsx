import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { createGame, GameState, InputState, Robot, defaultRobots, RobotId, getRobotPreset } from '@/game/core'
import { RobotSelect } from './RobotSelect'
import { useKeyboard } from '@/utils/useKeyboard'
import { useGamepad } from '@/utils/useGamepad'
import { getSocket } from '@/net/socket'

export function Battle({ mode, roomId, playerIndex = 0, onExit }: { mode: 'local' | 'online', roomId?: string, playerIndex?: 0 | 1, onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<GameState>(() => createGame())
  const [selecting, setSelecting] = useState(true)
  const [p1Sel, setP1Sel] = useState<RobotId>('atlas')
  const [p2Sel, setP2Sel] = useState<RobotId>('bolt')
  const [roundsToWin, setRoundsToWin] = useState(2)

  const p1Keys = useKeyboard({
    left: 'a', right: 'd', up: 'w', down: 's', light: 'f', heavy: 'g', special: 'h', block: 'v'
  })
  const p2Keys = useKeyboard({
  left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown',
  // Actions near the right-hand arrow keys: , . / and ;
  light: ',', heavy: '.', special: '/', block: ';'
  })
  const p1Pad = useGamepad(0)
  const p2Pad = useGamepad(1)
  const resetTimeoutRef = useRef<number | null>(null)

  // Main game loop
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const step = (now: number) => {
      const dt = Math.min(33, now - last) / 1000
      last = now
      setState((prev) => {
        const localP1 = mergeInputs(keysToInput(p1Keys), p1Pad)
        const localP2 = mergeInputs(keysToInput(p2Keys), p2Pad)
        let ip1 = localP1
        let ip2 = localP2
        if (mode === 'online') {
          if (playerIndex === 0) ip2 = prev.input.p2
          else ip1 = prev.input.p1
        }
        const next = new GameState(prev.p1, prev.p2)
        Object.assign(next, prev)
        next.update({ p1: ip1, p2: ip2, dt })
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [mode, playerIndex, p1Keys, p2Keys, p1Pad, p2Pad])

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

  // Auto-return to character select after match over, unless user presses a key or clicks
  useEffect(() => {
    if (!state.matchOver) return
    const cancel = () => {
      if (resetTimeoutRef.current) { clearTimeout(resetTimeoutRef.current); resetTimeoutRef.current = null }
    }
    resetTimeoutRef.current = window.setTimeout(() => {
      // if still in match over state, return to select
      setSelecting(true)
      setState(createGame(p1Sel, p2Sel, { roundsToWin }))
    }, 6000)
    window.addEventListener('keydown', cancel)
    window.addEventListener('mousedown', cancel)
    return () => {
      window.removeEventListener('keydown', cancel)
      window.removeEventListener('mousedown', cancel)
      if (resetTimeoutRef.current) { clearTimeout(resetTimeoutRef.current); resetTimeoutRef.current = null }
    }
  }, [state.matchOver, p1Sel, p2Sel, roundsToWin])

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
            <div className="flex items-end gap-4">
              <div className="flex flex-col gap-1">
                <div className="text-sm opacity-80">Rounds to win</div>
                <select className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1"
                        value={roundsToWin}
                        onChange={(e) => setRoundsToWin(parseInt(e.target.value))}>
                  {[1,2,3,4,5].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <button className="px-4 py-2 bg-emerald-600 rounded" onClick={() => {
                setState(createGame(p1Sel, p2Sel, { roundsToWin }))
                setSelecting(false)
              }}>Start!</button>
            </div>
          </div>
        ) : null}
        <canvas ref={canvasRef} width={1024} height={576} className="rounded border border-zinc-700 bg-arena-bg" />
        {/* UI overlays */}
        <HUD state={state}
             onPlayAgain={() => {
               setState(createGame(state.p1.id as RobotId, state.p2.id as RobotId, { roundsToWin }))
             }}
             onChangeCharacters={() => {
               setState(createGame(p1Sel, p2Sel, { roundsToWin }))
               setSelecting(true)
             }}
        />
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

function mergeInputs(a: InputState, b: Partial<InputState>): InputState {
  return {
    left: !!(a.left || b.left),
    right: !!(a.right || b.right),
    up: !!(a.up || b.up),
    down: !!(a.down || b.down),
    light: !!(a.light || b.light),
    heavy: !!(a.heavy || b.heavy),
    special: !!(a.special || b.special),
    block: !!(a.block || b.block),
  }
}

function drawArena(ctx: CanvasRenderingContext2D, s: GameState) {
  const { w, h } = { w: ctx.canvas.width, h: ctx.canvas.height }
  ctx.clearRect(0, 0, w, h)

  // Background gradient + parallax grid
  // Screen shake offset
  const shakeX = (Math.random() - 0.5) * (s.shake || 0)
  const shakeY = (Math.random() - 0.5) * (s.shake || 0)
  ctx.save()
  ctx.translate(shakeX, shakeY)

  // Gradient sky
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0b1229')
  sky.addColorStop(1, '#0a0f1e')
  ctx.fillStyle = sky
  ctx.fillRect(-shakeX, -shakeY, w, h)

  // Parallax grid
  ctx.strokeStyle = '#1b274580'
  ctx.lineWidth = 1
  const offset = (performance.now() * 0.02) % 32
  for (let x = 0; x <= w; x += 32) {
    ctx.beginPath(); ctx.moveTo(x + offset, 0); ctx.lineTo(x + offset, h); ctx.stroke()
  }
  for (let y = 0; y <= h; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y + offset); ctx.lineTo(w, y + offset); ctx.stroke()
  }
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

  // Effects (EMP ring, etc.)
  for (const e of s.effects) {
    if (e.kind === 'empRing') {
      const alpha = Math.max(0, Math.min(1, e.life / 40))
      ctx.save()
      ctx.strokeStyle = `rgba(96,165,250,${0.35 * alpha})`
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke()
      // subtle glow
      ctx.strokeStyle = `rgba(96,165,250,${0.15 * alpha})`
      ctx.lineWidth = 8
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.92, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }
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

  // Vignette
  const rad = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.75)
  rad.addColorStop(0, 'rgba(0,0,0,0)')
  rad.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = rad
  ctx.fillRect(-shakeX, -shakeY, w, h)

  ctx.restore()
}

function drawRobot(ctx: CanvasRenderingContext2D, r: Robot) {
  const { x, y, facing } = r
  ctx.save()
  ctx.translate(x, y)
  // Knockdown pose: tilt and lower center
  if (r.knockedDown) {
    ctx.translate(0, 6)
    ctx.rotate(facing === 1 ? 0.25 : -0.25)
  }
  if (facing === -1) { ctx.scale(-1, 1) }

  // Soft ground shadow
  ctx.save()
  ctx.translate(0, 18)
  const shadow = ctx.createRadialGradient(0, 0, 6, 0, 0, 36)
  shadow.addColorStop(0, 'rgba(0,0,0,0.35)')
  shadow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shadow
  ctx.beginPath(); ctx.ellipse(0, 0, 32, 10, 0, 0, Math.PI*2); ctx.fill()
  ctx.restore()

  // Body with gradient and outline
  const bodyGrad = ctx.createLinearGradient(0, -80, 0, 0)
  bodyGrad.addColorStop(0, '#ffffff22')
  bodyGrad.addColorStop(1, r.color)
  ctx.fillStyle = bodyGrad
  ctx.strokeStyle = '#0b1229'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.rect(-20, -60, 40, 60); ctx.fill(); ctx.stroke()
  // Head
  ctx.fillStyle = '#cbd5e1'
  ctx.fillRect(-12, -80, 24, 20)
  ctx.strokeStyle = '#0b1229'; ctx.strokeRect(-12, -80, 24, 20)
  // Arms with simple posing
  ctx.fillStyle = r.color
  const armLift = r.attacking ? Math.min(10, r.attackTimer * 1.2) : (r.blocking ? 6 : 0)
  ctx.save(); ctx.translate(-28, -54 - armLift * 0.5); ctx.fillRect(0, 0, 16, 12); ctx.strokeStyle = '#0b1229'; ctx.strokeRect(0, 0, 16, 12); ctx.restore()
  ctx.save(); ctx.translate(12, -54 - armLift); ctx.fillRect(0, 0, 16, 12); ctx.strokeStyle = '#0b1229'; ctx.strokeRect(0, 0, 16, 12); ctx.restore()
  // Legs with slight stride
  const stride = Math.max(-6, Math.min(6, r.vx * 1.5))
  ctx.fillRect(-18 - stride*0.2, 0, 14, 18)
  ctx.fillRect(4 + stride*0.2, 0, 14, 18)
  ctx.strokeRect(-18 - stride*0.2, 0, 14, 18); ctx.strokeRect(4 + stride*0.2, 0, 14, 18)

  // Facing indicator: forward chevron near feet
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.moveTo(30, -10)
  ctx.lineTo(46, -18)
  ctx.lineTo(46, -2)
  ctx.closePath(); ctx.fill()

  // Eye visor with direction glow
  ctx.fillStyle = 'rgba(0,255,255,0.7)'
  ctx.fillRect(0, -72, 10, 6)
  ctx.globalAlpha = 0.35
  ctx.fillRect(10, -72, 8, 6)
  ctx.globalAlpha = 1

  // Hit flash overlay
  if (r.hitFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(-22, -82, 44, 104)
  }

  // Dazed stars when stunned
  if (r.stunTimer && r.stunTimer > 0) {
    ctx.save()
    ctx.translate(0, -90)
    ctx.fillStyle = 'rgba(255, 241, 118, 0.85)'
    for (let i = 0; i < 3; i++) {
      const ang = (performance.now() / 400) + i * 2
      ctx.beginPath(); ctx.arc(Math.cos(ang) * 14, Math.sin(ang) * 6, 3, 0, Math.PI*2); ctx.fill()
    }
    ctx.restore()
  }

  // Floor reflection
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.scale(1, -0.6)
  ctx.translate(0, 10)
  ctx.fillStyle = bodyGrad
  ctx.beginPath(); ctx.rect(-20, -60, 40, 60); ctx.fill()
  ctx.restore()

  // Special aura when power high
  if (r.power >= 80) {
    ctx.strokeStyle = 'rgba(0,255,255,0.6)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, -30, 40 + Math.sin(performance.now()/100)*2, 0, Math.PI*2); ctx.stroke()
  }

  // Attack animations
  if (r.attacking) {
    const preset = getRobotPreset(r.id)
    const base = r.attackKind === 'light' ? preset.light : r.attackKind === 'heavy' ? preset.heavy : preset.special
    const t = Math.min(1, Math.max(0, r.attackTimer / Math.max(1, base.duration)))
    const active = r.attackTimer > 2 && r.attackTimer < base.duration - 2
    const hand = { x: 28, y: -48 }
    // Air light becomes a downward kick
    if (r.airAttack && r.attackKind === 'light') {
      ctx.save()
      ctx.strokeStyle = active ? 'rgba(255,220,120,0.9)' : 'rgba(255,220,120,0.5)'
      ctx.lineWidth = 3
      const arcR = 22 + 10 * t
      ctx.beginPath(); ctx.arc(6, -4, arcR, 1.3, 2.3); ctx.stroke()
      ctx.restore()
    } else {
      if (r.attackKind === 'light') {
      // small slash arc
      ctx.save()
      ctx.strokeStyle = active ? 'rgba(255,220,120,0.9)' : 'rgba(255,220,120,0.5)'
      ctx.lineWidth = 3
      const arcR = 26 + 12 * t
      ctx.beginPath(); ctx.arc(hand.x, hand.y, arcR, -0.4, 0.9); ctx.stroke()
      ctx.restore()
      } else if (r.attackKind === 'heavy') {
      // bigger arc with thicker line
      ctx.save()
      ctx.strokeStyle = active ? 'rgba(255,170,80,0.95)' : 'rgba(255,170,80,0.55)'
      ctx.lineWidth = 5
      const arcR = 36 + 18 * t
      ctx.beginPath(); ctx.arc(hand.x - 4, hand.y - 2, arcR, -0.7, 1.2); ctx.stroke()
      ctx.restore()
      } else if (r.attackKind === 'special') {
        switch (preset.special.kind) {
        case 'laser': {
          // beam forward
          const len = 90 + preset.special.reach
          const thickness = 6 + 8 * (active ? 1 : 0.5)
          const alpha = active ? 0.9 : 0.6
          ctx.save()
          ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`
          ctx.fillRect(hand.x, hand.y - thickness/2, len, thickness)
          ctx.globalAlpha = 0.35
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.fillRect(hand.x, hand.y - 1, len, 2)
          ctx.restore()
          break
        }
        case 'dash': {
          // trailing afterimages and speed lines behind
          ctx.save()
          ctx.globalAlpha = 0.25
          for (let i = 1; i <= 3; i++) {
            ctx.translate(-8, 0)
            ctx.fillStyle = bodyGrad
            ctx.beginPath(); ctx.rect(-20, -60, 40, 60); ctx.fill()
          }
          ctx.globalAlpha = 1
          for (let i = 0; i < 4; i++) {
            const a = (1 - i / 4) * 0.5
            ctx.fillStyle = `rgba(125, 211, 252, ${a})`
            ctx.fillRect(-10 - i * 10, -52 + i * 2, 18, 6)
          }
          ctx.restore()
          break
        }
        case 'uppercut': {
          // vertical arc above
          ctx.save()
          ctx.strokeStyle = 'rgba(244, 114, 182, 0.9)'
          ctx.lineWidth = 4
          ctx.beginPath(); ctx.arc(6, -70, 28 + 10 * t, -Math.PI/2, 0); ctx.stroke()
          ctx.restore()
          break
        }
        case 'emp': {
          // body glow
          ctx.save()
          ctx.strokeStyle = 'rgba(96,165,250,0.9)'
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.rect(-24, -84, 48, 102); ctx.stroke()
          ctx.restore()
          break
        }
        }
      }
    }
  }

  ctx.restore()
}

function HUD({ state, onPlayAgain, onChangeCharacters }: { state: GameState, onPlayAgain: () => void, onChangeCharacters: () => void }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="flex justify-between p-2">
        <div className="flex flex-col">
          <Bar label={state.p1.name} hp={state.p1.hp} power={state.p1.power} wins={state.p1Wins} className="items-start" />
          <div className="mt-1 ml-1 flex gap-1">
            {Array.from({ length: state.p1Wins }).map((_, i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <Bar label={state.p2.name} hp={state.p2.hp} power={state.p2.power} wins={state.p2Wins} className="items-end" />
          <div className="mt-1 mr-1 flex gap-1">
            {Array.from({ length: state.p2Wins }).map((_, i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            ))}
          </div>
        </div>
      </div>

      {/* Round number top center */}
      {/* Round / Final Battle banner */}
      {state.roundIntroTimer > 0 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-zinc-300 text-sm tracking-widest">
          {isFinalBattle(state) ? 'FINAL BATTLE' : `Round ${state.round}`}
        </div>
      )}

      {/* KO banner when round ends */}
      {state.roundOver && (
        <div className="absolute inset-0 flex items-center justify-center">
          {!state.matchOver ? (
            <>
              <div className="text-6xl font-extrabold text-red-400 drop-shadow-[0_0_12px_rgba(255,0,0,0.5)]">KO!</div>
              <div className="absolute bottom-8 text-zinc-300 text-sm">
                Next round in {Math.ceil((state.roundCooldown || 0) / 60)}
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl font-extrabold text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">MATCH OVER</div>
              <div className="absolute bottom-10 flex gap-3 pointer-events-auto">
                <button className="px-4 py-2 bg-emerald-600 rounded text-white" onClick={onPlayAgain}>Play again</button>
                <button className="px-4 py-2 bg-zinc-700 rounded text-white" onClick={onChangeCharacters}>Change characters</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Bar({ label, hp, power, wins, className }: { label: string, hp: number, power: number, wins?: number, className?: string }) {
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

function isFinalBattle(state: GameState) {
  // Final battle if both players are 1 win away from winning the match
  const need = state.roundsToWin
  return state.p1Wins === need - 1 && state.p2Wins === need - 1
}
