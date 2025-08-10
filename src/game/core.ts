export type Facing = 'left' | 'right'

export type InputState = {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  light: boolean
  heavy: boolean
  special: boolean
  block: boolean
}

export type Robot = {
  id: string
  name: string
  color: string
  x: number
  y: number
  vx: number
  vy: number
  facing: Facing
  hp: number // 0..100
  power: number // 0..100
  onGround: boolean
  cooldown: number
}

export type Spark = { x: number; y: number; life: number }
export type Part = { x: number; y: number; vx: number; vy: number; life: number; color: string }

export class GameState {
  width = 1024
  height = 576
  gravity = 1500
  floor = 520

  p1: Robot
  p2: Robot
  input: { p1: InputState; p2: InputState }
  sparks: Spark[] = []
  parts: Part[] = []

  constructor(p1: Robot, p2: Robot) {
    this.p1 = p1
    this.p2 = p2
    this.input = {
      p1: emptyInput(),
      p2: emptyInput(),
    }
  }

  update({ p1, p2, dt }: { p1: InputState; p2: InputState; dt: number }) {
    this.input.p1 = p1
    this.input.p2 = p2

    stepRobot(this.p1, p1, dt)
    stepRobot(this.p2, p2, dt)

    // Face each other
    this.p1.facing = this.p1.x < this.p2.x ? 'right' : 'left'
    this.p2.facing = this.p2.x < this.p1.x ? 'right' : 'left'

    // Simple collision / attacks
    handleCombat(this, dt)

    // Bounds
    for (const r of [this.p1, this.p2]) {
      r.x = Math.max(40, Math.min(this.width - 40, r.x))
    }

    // Sparks decay
    this.sparks = this.sparks
      .map((s) => ({ ...s, life: s.life - dt * 2 }))
      .filter((s) => s.life > 0)

    // Parts physics
    this.parts = this.parts.map((p) => {
      p.vy += 1200 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.y >= this.floor) { p.y = this.floor; p.vy *= -0.35; p.vx *= 0.8 }
      p.life -= dt
      return p
    }).filter((p) => p.life > 0)

    return this
  }
}

export function createGame(p1Id: string = 'alpha', p2Id: string = 'bravo'): GameState {
  const rp1 = getRobotPreset(p1Id)
  const rp2 = getRobotPreset(p2Id)
  const p1 = createRobot(rp1.id, rp1.name, rp1.color, 300)
  const p2 = createRobot(rp2.id, rp2.name, rp2.color, 724)
  return new GameState(p1, p2)
}

export function createRobot(id: string, name: string, color: string, x: number): Robot {
  return {
    id, name, color, x, y: 520, vx: 0, vy: 0, facing: 'right', hp: 100, power: 0, onGround: true, cooldown: 0,
  }
}

function emptyInput(): InputState {
  return { left: false, right: false, up: false, down: false, light: false, heavy: false, special: false, block: false }
}

function stepRobot(r: Robot, input: InputState, dt: number) {
  const speed = 260
  const jump = 650

  // Horizontal
  r.vx = 0
  if (input.left) r.vx -= speed
  if (input.right) r.vx += speed

  // Vertical
  if (input.up && r.onGround) {
    r.vy = -jump
    r.onGround = false
  }

  // Gravity
  if (!r.onGround) r.vy += 1500 * dt

  // Integrate
  r.x += r.vx * dt
  r.y += r.vy * dt

  // Ground collision
  if (r.y >= 520) {
    r.y = 520
    r.vy = 0
    r.onGround = true
  }

  if (r.cooldown > 0) r.cooldown -= dt
}

function handleCombat(g: GameState, dt: number) {
  const a = g.p1
  const b = g.p2

  function tryHit(attacker: Robot, defender: Robot, kind: 'light' | 'heavy' | 'special', defenderInput: InputState) {
    const sp = kind === 'special' ? getSpecialStats(attacker.id) : null
    const reach = kind === 'light' ? 40 : kind === 'heavy' ? 60 : (sp?.reach ?? 90)
    let damage = kind === 'light' ? 6 : kind === 'heavy' ? 12 : (sp?.damage ?? 18)
    let knock = kind === 'light' ? 180 : kind === 'heavy' ? 260 : (sp?.knock ?? 320)

    const dir = attacker.facing === 'right' ? 1 : -1
    const handX = attacker.x + dir * reach
    const distance = Math.abs(handX - defender.x)

    if (distance < 40 && attacker.cooldown <= 0) {
      // blocking reduces damage and knock
      const blocked = defenderInput.block
      const dmg = blocked ? Math.ceil(damage * 0.4) : damage
      const kn = blocked ? Math.ceil(knock * 0.5) : knock
      defender.hp = Math.max(0, defender.hp - dmg)
      defender.vx += dir * kn
      defender.vy = -100
      defender.onGround = false
      attacker.cooldown = kind === 'light' ? 0.25 : kind === 'heavy' ? 0.45 : 0.8
      attacker.power = Math.min(100, attacker.power + 6)
      g.sparks.push({ x: defender.x, y: defender.y - 30, life: 1 })
      // flying parts
      for (let i = 0; i < (kind === 'special' ? 6 : 3); i++) {
        g.parts.push({
          x: defender.x + (Math.random()*20 - 10),
          y: defender.y - 40 + (Math.random()*10 - 5),
          vx: dir * (80 + Math.random()*140) + (Math.random()*40 - 20),
          vy: - (120 + Math.random()*140),
          life: 1.2 + Math.random()*0.6,
          color: defender.color,
        })
      }
    }
  }

  const ip1 = g.input.p1
  const ip2 = g.input.p2

  if (ip1.light) tryHit(a, b, 'light', ip2)
  if (ip1.heavy) tryHit(a, b, 'heavy', ip2)
  if (ip1.special && a.power >= 50) { tryHit(a, b, 'special', ip2); a.power -= 50 }

  if (ip2.light) tryHit(b, a, 'light', ip1)
  if (ip2.heavy) tryHit(b, a, 'heavy', ip1)
  if (ip2.special && b.power >= 50) { tryHit(b, a, 'special', ip1); b.power -= 50 }
}

export const defaultRobots = [
  { id: 'alpha', name: 'Alpha-01', color: '#38bdf8' },
  { id: 'bravo', name: 'BR-88', color: '#f472b6' },
  { id: 'gamma', name: 'G-3R', color: '#a3e635' },
]

export function getRobotPreset(id: string) {
  return defaultRobots.find(r => r.id === id) ?? defaultRobots[0]
}

function getSpecialStats(robotId: string): { reach: number; damage: number; knock: number } {
  switch (robotId) {
    case 'alpha':
      // Dash Lunge: fast, long reach, moderate damage
      return { reach: 110, damage: 14, knock: 300 }
    case 'bravo':
      // Rocket Uppercut: short reach, high damage/knock
      return { reach: 80, damage: 22, knock: 380 }
    case 'gamma':
      // EMP Burst: medium reach, lower damage but strong knock
      return { reach: 95, damage: 16, knock: 360 }
    default:
      return { reach: 90, damage: 18, knock: 320 }
  }
}
