// Core game logic for Robot Battle
// Clean, corrected implementation: movement, combat, specials, particles, effects, and simple round system.

export type Facing = 1 | -1;

export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean; // jump
  down: boolean; // crouch (unused)
  light: boolean;
  heavy: boolean;
  special: boolean;
  block: boolean;
};

export type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
export type Part = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; size: number; color: string };
export type Effect = { kind: 'empRing'; x: number; y: number; r: number; vr: number; life: number; color: string };

export type SpecialState =
  | { kind: 'none' }
  | { kind: 'dash'; timer: number }
  | { kind: 'uppercut'; timer: number }
  | { kind: 'laser'; timer: number }
  | { kind: 'emp'; timer: number };

export type RobotId = 'atlas' | 'bolt' | 'nova' | 'titan';

export type Robot = {
  id: RobotId;
  name: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: Facing;
  onGround: boolean;
  hp: number; // 0..100
  power: number; // 0..100
  attacking: boolean;
  attackTimer: number;
  attackKind: 'none' | 'light' | 'heavy' | 'special';
  blocking: boolean;
  specialState: SpecialState;
  hitFlash: number; // frames remaining for hit flash
  recoverTimer: number; // cannot start a new attack during recovery
  stunTimer: number; // cannot act while stunned (after being hit)
  lastLight: boolean;
  lastHeavy: boolean;
  lastSpecial: boolean;
  hitConnected: boolean; // whether current attack has already connected
  airAttack: boolean; // attack started while airborne
  knockedDown: boolean; // temporarily incapacitated on ground
  getUpTimer: number; // frames remaining before getting up
  knockdownOnLand: boolean; // flag to trigger knockdown when landing after launch
};

export type RobotPreset = {
  id: RobotId;
  name: string;
  color: string;
  speed: number; // horizontal speed
  jump: number; // jump impulse
  gravity: number; // per tick gravity
  light: { damage: number; reach: number; knock: number; duration: number };
  heavy: { damage: number; reach: number; knock: number; duration: number };
  special: { cost: number; damage: number; reach: number; knock: number; duration: number; kind: 'dash' | 'uppercut' | 'laser' | 'emp' };
};

export const defaultRobots: RobotPreset[] = [
  {
    id: 'atlas',
    name: 'Atlas',
    color: '#7dd3fc',
    speed: 4.5,
    jump: 14,
    gravity: 0.8,
    light: { damage: 6, reach: 40, knock: 6, duration: 10 },
    heavy: { damage: 12, reach: 60, knock: 9, duration: 16 },
    special: { cost: 30, damage: 18, reach: 70, knock: 14, duration: 24, kind: 'dash' },
  },
  {
    id: 'bolt',
    name: 'Bolt',
    color: '#facc15',
    speed: 5.2,
    jump: 13,
    gravity: 0.85,
    light: { damage: 5, reach: 44, knock: 5, duration: 10 },
    heavy: { damage: 10, reach: 62, knock: 8, duration: 16 },
    special: { cost: 28, damage: 16, reach: 84, knock: 12, duration: 22, kind: 'laser' },
  },
  {
    id: 'nova',
    name: 'Nova',
    color: '#f472b6',
    speed: 4.2,
    jump: 15,
    gravity: 0.78,
    light: { damage: 6, reach: 46, knock: 6, duration: 12 },
    heavy: { damage: 11, reach: 64, knock: 9, duration: 18 },
    special: { cost: 35, damage: 20, reach: 72, knock: 16, duration: 26, kind: 'uppercut' },
  },
  {
    id: 'titan',
    name: 'Titan',
    color: '#a78bfa',
    speed: 3.8,
    jump: 12.5,
    gravity: 0.9,
    light: { damage: 7, reach: 40, knock: 7, duration: 12 },
    heavy: { damage: 14, reach: 58, knock: 12, duration: 18 },
    special: { cost: 32, damage: 0, reach: 0, knock: 0, duration: 20, kind: 'emp' },
  },
];

export const ARENA_W = 1024;
export const ARENA_H = 576;
const FLOOR_Y = 480; // y of floor baseline

export class GameState {
  w = ARENA_W;
  h = ARENA_H;
  gravity = 0.9;
  floor = FLOOR_Y;

  p1: Robot;
  p2: Robot;
  p1Preset: RobotPreset;
  p2Preset: RobotPreset;

  // particles/effects
  sparks: Spark[] = [];
  parts: Part[] = [];
  effects: Effect[] = [];

  // round system
  round = 1;
  p1Wins = 0;
  p2Wins = 0;
  roundOver = false;
  roundCooldown = 0; // ticks until next round starts

  // hitstop and screen shake
  hitstop = 0; // frames to pause gameplay on hit
  shake = 0; // current shake magnitude
  shakeTime = 0; // frames remaining to shake

  // match configuration and banners
  roundsToWin = 2;
  matchOver = false;
  roundIntroTimer = 0; // frames to show round or final banners

  // inputs (shape expected by components)
  input: { p1: InputState; p2: InputState } = { p1: emptyInput(), p2: emptyInput() };

  // Allow constructing by ids or by existing robots (for shallow cloning in UI code)
  constructor(p1Arg: RobotId | Robot = 'atlas', p2Arg: RobotId | Robot = 'bolt', opts?: { roundsToWin?: number }) {
    if (typeof p1Arg === 'object' && typeof p2Arg === 'object') {
      // Construct from robots
      this.p1 = p1Arg as Robot;
      this.p2 = p2Arg as Robot;
      this.p1Preset = getRobotPreset(this.p1.id);
      this.p2Preset = getRobotPreset(this.p2.id);
    } else {
      const p1Id = p1Arg as RobotId;
      const p2Id = p2Arg as RobotId;
      this.p1Preset = getRobotPreset(p1Id);
      this.p2Preset = getRobotPreset(p2Id);
      this.p1 = createRobot(this.p1Preset, 300, this.floor - 120, 1);
      this.p2 = createRobot(this.p2Preset, 724, this.floor - 120, -1);
    }
    this.gravity = (this.p1Preset.gravity + this.p2Preset.gravity) / 2;
    if (opts?.roundsToWin && opts.roundsToWin > 0) this.roundsToWin = opts.roundsToWin;
    this.roundIntroTimer = 120;
  }

  resetPositions() {
    this.p1.x = 300; this.p1.y = this.floor - this.p1.h; this.p1.vx = 0; this.p1.vy = 0; this.p1.onGround = true; this.p1.facing = 1;
    this.p2.x = 724; this.p2.y = this.floor - this.p2.h; this.p2.vx = 0; this.p2.vy = 0; this.p2.onGround = true; this.p2.facing = -1;
    this.p1.attacking = false; this.p1.attackTimer = 0; this.p1.attackKind = 'none'; this.p1.blocking = false; this.p1.specialState = { kind: 'none' };
    this.p2.attacking = false; this.p2.attackTimer = 0; this.p2.attackKind = 'none'; this.p2.blocking = false; this.p2.specialState = { kind: 'none' };
  this.p1.stunTimer = 0; this.p1.recoverTimer = 0; this.p1.hitConnected = false; this.p1.lastLight = false; this.p1.lastHeavy = false; this.p1.lastSpecial = false;
  this.p2.stunTimer = 0; this.p2.recoverTimer = 0; this.p2.hitConnected = false; this.p2.lastLight = false; this.p2.lastHeavy = false; this.p2.lastSpecial = false;
  }

  startNextRound() {
    this.round += 1;
    this.p1.hp = 100; this.p2.hp = 100;
    this.p1.power = Math.min(this.p1.power + 15, 100);
    this.p2.power = Math.min(this.p2.power + 15, 100);
    this.sparks = []; this.parts = []; this.effects = [];
    this.resetPositions();
    this.roundOver = false;
    this.roundCooldown = 0;
    this.roundIntroTimer = 120;
  }

  // Components call update({ p1, p2, dt }) and expect a GameState return
  update(inp: { p1: InputState; p2: InputState; dt?: number }): GameState {
    // Match over: only drift particles/effects
    if (this.matchOver) {
      this.updateParticlesAndEffects();
      return this;
    }
    // If round over, only update effects/particles and countdown
    if (this.roundOver) {
      this.updateParticlesAndEffects();
      if (this.roundCooldown > 0) {
        this.roundCooldown--;
        if (this.roundCooldown === 0) this.startNextRound();
      }
      return this;
    }

    // Hitstop: pause physics/combat for a few frames on impact for juice
    if (this.hitstop > 0) {
      this.hitstop--;
      this.updateParticlesAndEffects();
      return this;
    }

    // intro timer countdown
    if (this.roundIntroTimer > 0) this.roundIntroTimer--;

    // store inputs for online sync code usage
    this.input.p1 = inp.p1; this.input.p2 = inp.p2;

  // Determine facing by positions
    this.p1.facing = this.p1.x <= this.p2.x ? 1 : -1;
    this.p2.facing = this.p2.x >= this.p1.x ? -1 : 1;

    // Step robots physics and actions
    stepRobot(this.p1, this.p1Preset, inp.p1, this);
    stepRobot(this.p2, this.p2Preset, inp.p2, this);

  // Keep inside arena
    this.constrain(this.p1);
    this.constrain(this.p2);

  // Decay hit flash
  if (this.p1.hitFlash > 0) this.p1.hitFlash--;
  if (this.p2.hitFlash > 0) this.p2.hitFlash--;

    // Resolve combat collisions/attacks
    this.handleCombat();

    // Update particles/effects
    this.updateParticlesAndEffects();
    return this;
  }

  private constrain(r: Robot) {
    if (r.x < 40) { r.x = 40; r.vx = Math.max(0, r.vx); }
    if (r.x > this.w - 40) { r.x = this.w - 40; r.vx = Math.min(0, r.vx); }
    // floor
    const floorY = this.floor - r.h;
    if (r.y >= floorY) { r.y = floorY; r.vy = 0; r.onGround = true; }
  }

  private updateParticlesAndEffects() {
    // sparks
    for (const s of this.sparks) {
      s.x += s.vx; s.y += s.vy; s.vy += 0.2; s.life -= 1;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    // parts
    for (const p of this.parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.rot += p.vr; p.life -= 1;
      if (p.y > this.floor - 8) { p.y = this.floor - 8; p.vy *= -0.4; p.vx *= 0.8; p.vr *= 0.8; }
    }
    this.parts = this.parts.filter(p => p.life > 0.5);
    // effects
    for (const e of this.effects) {
      if (e.kind === 'empRing') { e.r += e.vr; e.life -= 1; e.vr *= 0.98; }
    }
    this.effects = this.effects.filter(e => e.life > 0);

    // screen shake decay
    if (this.shakeTime > 0) {
      this.shakeTime--;
      this.shake *= 0.9;
      if (this.shake < 0.2) this.shake = 0;
    } else {
      this.shake = 0;
    }
  }

  private handleCombat() {
    // process attacks and apply hits
    const tryHit = (attacker: Robot, aPreset: RobotPreset, defender: Robot, dPreset: RobotPreset) => {
  if (!attacker.attacking) return;
  if (attacker.hitConnected) return; // prevent multi-hit from one swing
      const atkKind = attacker.attackKind;
      const base = atkKind === 'light' ? aPreset.light : atkKind === 'heavy' ? aPreset.heavy : aPreset.special;
      // active frames: middle of the attack window
      const active = attacker.attackTimer > 2 && attacker.attackTimer < base.duration - 2;
      if (!active) return;
      const reachX = attacker.x + attacker.facing * (attacker.w / 2 + base.reach);
      const reachY = attacker.y + attacker.h / 2;
      const distX = Math.abs(defender.x - reachX);
      const distY = Math.abs(defender.y + defender.h / 2 - reachY);
      const inRange = distX < base.reach && distY < attacker.h * 0.75;
      if (!inRange) return;

      // apply damage and knockback
      let dmg = base.damage;
      let knock = base.knock;
      if (defender.blocking) {
        dmg *= 0.4; knock *= 0.5; // block reduces
        defender.power = Math.min(100, defender.power + 4);
      }
  defender.hp = Math.max(0, defender.hp - dmg);
  // knockback AWAY from attacker along attacker's facing
  defender.vx += attacker.facing * (knock * 0.8);
  defender.vy -= Math.max(0, knock * 0.3);
      // slight recoil on attacker to create spacing
      attacker.vx += attacker.facing * -(Math.max(0.5, knock * 0.2));
      attacker.power = Math.min(100, attacker.power + 6);

      // apply hitstun (shorter on block)
      let stun = defender.blocking
        ? (atkKind === 'light' ? 6 : atkKind === 'heavy' ? 9 : 12)
        : (atkKind === 'light' ? 12 : atkKind === 'heavy' ? 18 : 22);
      // special-case uppercut: launch higher and push back more, cause knockdown on landing
      if (atkKind === 'special' && aPreset.special.kind === 'uppercut') {
        defender.vy -= Math.max(10, aPreset.jump * 0.9);
        defender.vx += attacker.facing * (base.knock * 1.0);
        defender.knockdownOnLand = true;
        stun += 6;
      }
      defender.stunTimer = Math.max(defender.stunTimer, stun);
      // interrupt defender's attack
      defender.attacking = false; defender.attackTimer = 0; defender.attackKind = 'none';
  // add small hit recovery on attacker to avoid re-mash strings during hitstop
  attacker.recoverTimer = Math.max(attacker.recoverTimer, Math.floor((base.duration * 0.25)))
  // mark hit as connected so it won't hit multiple times per swing
      attacker.hitConnected = true;

  // sparks
      for (let i = 0; i < 6; i++) {
        this.sparks.push({ x: defender.x, y: defender.y + defender.h * 0.6, vx: (Math.random()-0.5)*6, vy: -Math.random()*5, life: 16 + Math.random()*10, color: '#ffd166' });
      }
      // parts
      const partsCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < partsCount; i++) {
        this.parts.push({ x: defender.x, y: defender.y + defender.h * 0.4, vx: (Math.random()-0.5)*4, vy: -Math.random()*3, rot: Math.random()*Math.PI, vr: (Math.random()-0.5)*0.2, life: 50 + Math.random()*40, size: 4 + Math.random()*5, color: defender.color });
      }

  // mark defender hit flash
  defender.hitFlash = Math.max(defender.hitFlash, 8);

  // Hitstop & screen shake
  const kind = atkKind;
  let stop = kind === 'light' ? 4 : kind === 'heavy' ? 8 : 10;
  if (defender.blocking) stop = Math.floor(stop * 0.6);
  this.hitstop = Math.max(this.hitstop, stop);
  const shakeStrength = kind === 'light' ? 4 : kind === 'heavy' ? 8 : 10;
  this.shakeTime = Math.max(this.shakeTime, stop);
  this.shake = Math.max(this.shake, shakeStrength);

  // KO check and round end
      if (defender.hp <= 0 && !this.roundOver) {
        if (attacker === this.p1) this.p1Wins++; else this.p2Wins++;
        this.roundOver = true;
        // match end check
        if (this.p1Wins >= this.roundsToWin || this.p2Wins >= this.roundsToWin) {
          this.matchOver = true;
          this.roundCooldown = 240;
        } else {
          this.roundCooldown = 180; // ~3s at 60fps
        }
      }
    };

    tryHit(this.p1, this.p1Preset, this.p2, this.p2Preset);
    tryHit(this.p2, this.p2Preset, this.p1, this.p1Preset);
  }
}

export function emptyInput(): InputState {
  return { left: false, right: false, up: false, down: false, light: false, heavy: false, special: false, block: false };
}

export function createGame(p1Id: RobotId = 'atlas', p2Id: RobotId = 'bolt', opts?: { roundsToWin?: number }) {
  return new GameState(p1Id, p2Id, opts);
}

export function createRobot(p: RobotPreset, x: number, y: number, facing: Facing): Robot {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    x, y,
    w: 48,
    h: 120,
    vx: 0,
    vy: 0,
    facing,
    onGround: true,
    hp: 100,
    power: 0,
    attacking: false,
    attackTimer: 0,
    attackKind: 'none',
    blocking: false,
    specialState: { kind: 'none' },
  hitFlash: 0,
  recoverTimer: 0,
  stunTimer: 0,
  lastLight: false,
  lastHeavy: false,
  lastSpecial: false,
  hitConnected: false,
  airAttack: false,
  knockedDown: false,
  getUpTimer: 0,
  knockdownOnLand: false,
  };
}

function stepRobot(r: Robot, preset: RobotPreset, input: InputState, g: GameState) {
  // decay timers
  if (r.recoverTimer > 0) r.recoverTimer--;
  if (r.stunTimer > 0) r.stunTimer--;

  // horizontal movement
  let targetVx = r.vx;
  if (r.stunTimer <= 0 && !r.attacking) {
    targetVx = 0;
    if (input.left) targetVx -= preset.speed;
    if (input.right) targetVx += preset.speed;
  } else {
    // apply slight friction while stunned
    targetVx *= r.onGround ? 0.9 : 0.98;
  }
  r.vx = targetVx;
  // jump
  if (input.up && r.onGround && r.stunTimer <= 0) {
    r.vy = -preset.jump;
    r.onGround = false;
  }
  // gravity
  r.vy += preset.gravity;
  // integrate
  r.x += r.vx;
  r.y += r.vy;
  // ground and landing events
  if (r.y >= g.floor - r.h) {
    const wasAir = !r.onGround;
    r.y = g.floor - r.h; r.vy = 0; r.onGround = true;
    if (wasAir && r.knockdownOnLand) {
      r.knockedDown = true;
      r.getUpTimer = 40; // time lying down
      r.stunTimer = 0;
      r.knockdownOnLand = false;
      r.attacking = false; r.attackTimer = 0; r.attackKind = 'none';
    }
  }
  // block (cannot block while stunned or knocked down)
  r.blocking = r.stunTimer <= 0 && !r.knockedDown && (input.block && !input.light && !input.heavy && !input.special);
  // attacks
  const lightPressed = input.light && !r.lastLight;
  const heavyPressed = input.heavy && !r.lastHeavy;
  const specialPressed = input.special && !r.lastSpecial;
  if (!r.attacking && r.stunTimer <= 0 && r.recoverTimer <= 0 && !r.knockedDown) {
    if (lightPressed) {
      startAttack(r, 'light');
    } else if (heavyPressed) {
      startAttack(r, 'heavy');
    } else if (specialPressed && r.power >= preset.special.cost) {
      r.power -= preset.special.cost;
      startAttack(r, 'special');
      // apply special movement/effects
      switch (preset.special.kind) {
        case 'dash':
          r.vx = r.facing * 8;
          break;
        case 'uppercut':
          r.vy = -preset.jump * 1.2;
          break;
        case 'laser':
          r.vx += -r.facing * 2;
          break;
        case 'emp':
          g.effects.push({ kind: 'empRing', x: r.x, y: r.y + r.h * 0.5, r: 10, vr: 6, life: 40, color: '#60a5fa' });
          break;
      }
    }
  }
  if (r.attacking) {
    r.attackTimer += 1;
    const base = r.attackKind === 'light' ? preset.light : r.attackKind === 'heavy' ? preset.heavy : preset.special;
    if (r.attackTimer >= base.duration) {
      r.attacking = false;
      r.attackTimer = 0;
      r.attackKind = 'none';
    // recovery after an attack
    r.recoverTimer = Math.max(6, Math.floor(base.duration * 0.6));
    }
  }

  // Knockdown/get-up flow
  if (r.knockedDown) {
    // while knocked down, no movement; count down get-up
    r.vx *= 0.8;
    if (r.onGround) {
      r.getUpTimer = Math.max(0, r.getUpTimer - 1);
      if (r.getUpTimer === 0) {
        r.knockedDown = false;
        r.stunTimer = 10; // brief vulnerability when standing
      }
    }
  }

  // latch buttons for edge detection
  r.lastLight = !!input.light;
  r.lastHeavy = !!input.heavy;
  r.lastSpecial = !!input.special;
}

function startAttack(r: Robot, kind: Robot['attackKind']) {
  r.attacking = true;
  r.attackTimer = 0;
  r.attackKind = kind;
  r.hitConnected = false;
  r.airAttack = !r.onGround;
}

export function getRobotPreset(id: RobotId): RobotPreset {
  const p = defaultRobots.find(r => r.id === id);
  return p ?? defaultRobots[0];
}
