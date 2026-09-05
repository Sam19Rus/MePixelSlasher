// ============================================================
// НАЁМНИК ПУСТОТЫ — движок (бесконечный мир, 16-бит, canvas)
// ============================================================
import {
  RARITIES, ENEMY_DEFS, COMP_DEFS, COMP_UPGRADES, BIOMES, CAPSULE_COLORS,
  genWeapon, genArmor, rnd, pick, irand, clamp, weaponScore,
  type Weapon, type Armor, type CompUpgrade,
} from './data'
import { audio } from './audio'
import * as SP from './sprites'

const VIEW_H = 240
const CHUNK = 64

// ---------- шум ----------
function hash2(x: number, y: number, s: number) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 144665
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export interface Hooks {
  onSnap: (s: Record<string, unknown>) => void
  onStart: () => void
  onDeath: (s: Record<string, unknown>) => void
  onPause: (p: boolean) => void
  onToast: (t: { text: string; color?: string }) => void
}

interface Player {
  x: number; y: number; hp: number; maxHp: number; aim: number; walkT: number
  fireCd: number; mag: number; reloadT: number; slashT: number; slashCd: number
  dashT: number; dashCd: number; dashVX: number; dashVY: number; iframes: number; regenDelay: number
  kills: number; credits: number; weapons: unknown[]; cur: number; armor: unknown[]
  bonus: { hp: number; dmg: number; rate: number; speed: number; acc: number; crit: number }
  chestColor: string
}
interface Enemy {
  x: number; y: number; type: string; def: (typeof ENEMY_DEFS)['grunt']
  body: number; head: number; weapon: number; pal: { main: string; dark: string; accent: string }
  hp: number; maxHp: number; speed: number; dmg: number; r: number; flash: number
  windup: number; atkCd: number; aim: number; walkT: number; phase: number
  strafe: number; burst: number; shootT: number; swoopT: number; swoop: number
  kbx: number; kby: number; targetKind: number; score: number
}
interface Bullet { x: number; y: number; vx: number; vy: number; dmg: number; kind: string; color: string; r: number; explosive: number; pierce: boolean; friendly: boolean; life: number; hit: Set<unknown>; pierceLeft?: number }
interface Pickup { x: number; y: number; vx: number; vy: number; kind: 'coin' | 'weapon' | 'armor' | 'heart' | 'upgrade'; color: string; phase: number; val?: number; weapon?: unknown; armor?: unknown; slot?: number; up?: CompUpgrade; rej?: number }
interface Capsule { x: number; y: number; size: number; shape: number; cIdx: number; hp: number; maxHp: number; special: boolean; phase: number }
interface Companion { x: number; y: number; kind: string; def: (typeof COMP_DEFS)[0]; body: number; gun: number; pal: { main: string; dark: string; accent: string }; walkT: number; aim: number; phase: number; fireCd: number; flash: number; moving: boolean }
interface Pod { x: number; y: number; opened: boolean }
interface FallPod { x: number; y: number; t: number; dur: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }
interface Floater { x: number; y: number; text: string; color: string; life: number; size: number }
interface Obstacle { x: number; y: number; r: number }

const on = (t: EventTarget, ev: string, fn: EventListenerOrEventListenerObject, o?: AddEventListenerOptions) => {
  t.addEventListener(ev, fn, o)
  return [t, ev, fn, o] as [EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions?]
}

export class Engine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  mini: HTMLCanvasElement | null
  hooks: Hooks
  W = 427

  mode: 'menu' | 'game' = 'menu'
  paused = false
  keys: Record<string, boolean> = {}
  mouse = { x: 213, y: 120, down: false, rdown: false }

  camX = 0; camY = 0; shake = 0; hurtT = 0

  chunks = new Map<string, HTMLCanvasElement>()
  chunkOrder: string[] = []
  obstacles = new Map<string, Obstacle[]>()
  materialized = new Set<string>()
  seed = 1

  enemies: Enemy[] = []
  bullets: Bullet[] = []
  particles: Particle[] = []
  floaters: Floater[] = []
  capsules: Capsule[] = []
  pickups: Pickup[] = []
  companions: Companion[] = []
  compUp: Record<string, number> = {}
  pods: Pod[] = []
  fallPods: FallPod[] = []
  weather: Particle[] = []
  shuttle: { t: number; released: boolean } | null = null

  p = this.freshPlayer()
  spawnAnim = 0
  dead = false
  deadT = 0
  time = 0
  spawnT = 0
  nextDrop = 20
  beamT = -1
  transitioning = false
  snapT = 0
  spawnEnemyT = 0
  weatherT = 0
  miniT = 0

  stars: { x: number; y: number; z: number; tw: number }[] = []
  menuT = 0
  shootStar = { x: 0, y: 0, vx: 0, vy: 0, life: 0 }

  listeners: [EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions?][] = []
  destroyed = false
  last = 0
  raf = 0

  constructor(canvas: HTMLCanvasElement, mini: HTMLCanvasElement | null, hooks: Hooks) {
    this.canvas = canvas
    this.mini = mini
    this.ctx = canvas.getContext('2d')!
    this.hooks = hooks
    this.resize()
    for (let i = 0; i < 130; i++) this.stars.push({ x: rnd() * 600, y: rnd() * VIEW_H, z: 0.25 + rnd() * 0.75, tw: rnd() * 6 })
    this.bind()
    this.last = performance.now()
    const loop = (t: number) => {
      if (this.destroyed) return
      this.raf = requestAnimationFrame(loop)
      const dt = clamp((t - this.last) / 1000, 0, 0.05)
      this.last = t
      this.tick(dt)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    for (const [t, ev, fn, o] of this.listeners) t.removeEventListener(ev, fn, o)
  }

  bind() {
    this.listeners.push(
      on(window, 'resize', () => this.resize()),
      on(window, 'keydown', ((e: KeyboardEvent) => {
        this.keys[e.code] = true
        if (e.code === 'Space') e.preventDefault()
        if (this.mode !== 'game') return
        if (e.code === 'KeyR') this.startReload()
        if (e.code === 'KeyM') { audio.toggleMute(); this.hooks.onToast({ text: audio.muted ? 'ЗВУК ВЫКЛ' : 'ЗВУК ВКЛ', color: '#9aa7b8' }) }
        if (e.code === 'Escape' && !this.dead) { this.paused = !this.paused; this.hooks.onPause(this.paused) }
        if (/^Digit[1-5]$/.test(e.code)) this.switchTo(+e.code.slice(5) - 1)
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.tryDash()
      }) as EventListener),
      on(window, 'keyup', ((e: KeyboardEvent) => { this.keys[e.code] = false }) as EventListener),
      on(this.canvas, 'mousemove', ((e: MouseEvent) => {
        const r = this.canvas.getBoundingClientRect()
        this.mouse.x = (e.clientX - r.left) * (this.W / r.width)
        this.mouse.y = (e.clientY - r.top) * (VIEW_H / r.height)
      }) as EventListener),
      on(this.canvas, 'mousedown', ((e: MouseEvent) => {
        audio.ensure()
        if (e.button === 0) this.mouse.down = true
        if (e.button === 2) { this.mouse.rdown = true; if (this.mode === 'game' && !this.paused) this.trySlash() }
      }) as EventListener),
      on(window, 'mouseup', ((e: MouseEvent) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.rdown = false }) as EventListener),
      on(this.canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener),
      on(window, 'wheel', ((e: WheelEvent) => {
        if (this.mode !== 'game') return
        e.preventDefault()
        const w = this.p.weapons
        if (w.length > 1) this.switchTo((this.p.cur + (e.deltaY > 0 ? 1 : -1) + w.length) % w.length)
      }) as EventListener, { passive: false }),
    )
  }

  resize() {
    const vw = Math.max(320, Math.round((VIEW_H * window.innerWidth) / window.innerHeight))
    this.W = vw
    this.canvas.width = vw
    this.canvas.height = VIEW_H
    this.ctx.imageSmoothingEnabled = false
  }

  // уровень модуля отряда
  cu(id: string) { return this.compUp[id] || 0 }

  // ---------- биомы и чанки ----------
  biomeAt(x: number, y: number) {
    const n = vnoise(x * 0.0021, y * 0.0021, this.seed) * 0.72 + vnoise(x * 0.0063, y * 0.0063, this.seed + 7) * 0.28
    return clamp(Math.floor(n * 6.4), 0, 5)
  }
  groundColor(b: number, bx: number, by: number) {
    const bi = BIOMES[b]
    return bi.ground[Math.floor(hash2(bx, by, this.seed + 31) * bi.ground.length)]
  }

  chunkKey(cx: number, cy: number) { return cx + ',' + cy }

  getChunk(cx: number, cy: number): HTMLCanvasElement {
    const k = this.chunkKey(cx, cy)
    let c = this.chunks.get(k)
    if (!c) {
      c = document.createElement('canvas')
      c.width = CHUNK; c.height = CHUNK
      this.renderChunk(c, cx, cy)
      this.chunks.set(k, c)
      this.chunkOrder.push(k)
      if (this.chunkOrder.length > 260) {
        const old = this.chunkOrder.shift()!
        this.chunks.delete(old)
        this.obstacles.delete(old)
        this.materialized.delete(old)
      }
    }
    return c
  }

  renderChunk(c: HTMLCanvasElement, cx: number, cy: number) {
    const g = c.getContext('2d')!
    const x0 = cx * CHUNK, y0 = cy * CHUNK
    // земля: пиксель 2×2 с дизерингом
    for (let by = 0; by < CHUNK / 2; by++) {
      for (let bx = 0; bx < CHUNK / 2; bx++) {
        const wx = x0 + bx * 2, wy = y0 + by * 2
        const b = this.biomeAt(wx, wy)
        g.fillStyle = this.groundColor(b, bx + cx * 32, by + cy * 32)
        g.fillRect(bx * 2, by * 2, 2, 2)
        // кракелюры/трещины
        const cr = hash2(wx, wy, this.seed + 55)
        if (cr > 0.93) { g.fillStyle = BIOMES[b].crack; g.fillRect(bx * 2, by * 2, 2, 1) }
        else if (cr < 0.05) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(bx * 2, by * 2, 2, 2) }
        // пятна другого биома на границе
        const b2 = this.biomeAt(wx + 6, wy + 6)
        if (b2 !== b && hash2(wx, wy, this.seed + 77) > 0.5) {
          g.fillStyle = BIOMES[b2].ground[0]
          g.fillRect(bx * 2, by * 2, 2, 2)
        }
      }
    }
    // декорации и препятствия (детерминированные)
    const nDeco = Math.floor(hash2(cx, cy, this.seed + 91) * 4)
    const obs: Obstacle[] = []
    for (let i = 0; i < nDeco; i++) {
      const dx = hash2(cx, cy * 7 + i, this.seed + 93) * CHUNK
      const dy = hash2(cx * 13 + i, cy, this.seed + 97) * CHUNK
      const wx = x0 + dx, wy = y0 + dy
      const b = this.biomeAt(wx, wy)
      const kind = Math.floor(hash2(wx, wy, this.seed + 99) * 3)
      const col = BIOMES[b].decos[kind]
      if (kind === 0) {
        // валун (препятствие)
        const r = 4 + hash2(wx, wy, this.seed + 101) * 4
        g.fillStyle = 'rgba(0,0,0,0.3)'
        g.beginPath(); g.ellipse(dx, dy + r * 0.5, r, r * 0.4, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = col
        g.fillRect(dx - r, dy - r * 0.8, r * 2, r * 1.3)
        g.fillStyle = 'rgba(255,255,255,0.14)'
        g.fillRect(dx - r, dy - r * 0.8, r * 2, 2)
        g.fillStyle = 'rgba(0,0,0,0.25)'
        g.fillRect(dx - r, dy + r * 0.2, r * 2, r * 0.3)
        obs.push({ x: wx, y: wy, r })
      } else if (kind === 1) {
        // кристалл/шпиль
        const hgt = 6 + hash2(wx, wy, this.seed + 103) * 8
        g.fillStyle = 'rgba(0,0,0,0.28)'
        g.beginPath(); g.ellipse(dx, dy + 1, 4, 1.6, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = col
        g.beginPath(); g.moveTo(dx - 3, dy); g.lineTo(dx, dy - hgt); g.lineTo(dx + 3, dy); g.closePath(); g.fill()
        g.fillStyle = 'rgba(255,255,255,0.3)'
        g.fillRect(dx - 1, dy - hgt + 2, 1, hgt - 3)
      } else {
        // низкая растительность/вентиляционное пятно
        g.fillStyle = col
        for (let k = 0; k < 5; k++) {
          const px2 = dx - 4 + hash2(wx + k, wy, this.seed + 105) * 8
          const py2 = dy - 3 + hash2(wx, wy + k, this.seed + 107) * 6
          g.fillRect(px2, py2, 2, 2)
        }
      }
    }
    this.obstacles.set(this.chunkKey(cx, cy), obs)
  }

  nearObstacles(x: number, y: number, r: number): Obstacle[] {
    const res: Obstacle[] = []
    const cx0 = Math.floor((x - r - CHUNK) / CHUNK), cx1 = Math.floor((x + r + CHUNK) / CHUNK)
    const cy0 = Math.floor((y - r - CHUNK) / CHUNK), cy1 = Math.floor((y + r + CHUNK) / CHUNK)
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const k = this.chunkKey(cx, cy)
      if (!this.materialized.has(k)) { this.getChunk(cx, cy); this.materialized.add(k) }
      const o = this.obstacles.get(k)
      if (o) for (const ob of o) if (Math.hypot(ob.x - x, ob.y - y) < r + ob.r + 8) res.push(ob)
    }
    return res
  }

  pushOut(ent: { x: number; y: number }, r: number) {
    for (const o of this.nearObstacles(ent.x, ent.y, r)) {
      const dx = ent.x - o.x, dy = ent.y - o.y
      const d = Math.hypot(dx, dy), min = o.r + r - 2
      if (d < min && d > 0.01) { ent.x = o.x + (dx / d) * min; ent.y = o.y + (dy / d) * min }
    }
  }

  // ---------- игрок ----------
  freshPlayer(): Player {
    return {
      x: 0, y: 0, hp: 100, maxHp: 100, aim: 0, walkT: 0,
      fireCd: 0, mag: 0, reloadT: 0, slashT: 0, slashCd: 0, dashT: 0, dashCd: 0, dashVX: 0, dashVY: 0,
      iframes: 0, regenDelay: 0, kills: 0, credits: 0,
      weapons: [], cur: 0, armor: [null, null, null, null],
      bonus: { hp: 0, dmg: 0, rate: 0, speed: 0, acc: 0, crit: 5 },
      chestColor: '#4a5a6e',
    }
  }

  beginLaunch() {
    if (this.mode !== 'menu' || this.transitioning) return
    this.beamT = 0
    audio.teleport()
  }

  startGame() {
    this.seed = (Date.now() % 100000) + 1
    this.chunks.clear(); this.chunkOrder = []; this.obstacles.clear(); this.materialized.clear()
    this.enemies = []; this.bullets = []; this.particles = []; this.floaters = []
    this.capsules = []; this.pickups = []; this.companions = []; this.pods = []
    this.fallPods = []; this.weather = []; this.shuttle = null
    this.compUp = {}
    this.p = this.freshPlayer()
    const w = genWeapon(0, 0)
    this.p.weapons = [w]
    this.p.mag = w.mag
    this.time = 0; this.spawnT = 0; this.nextDrop = 20; this.dead = false; this.deadT = 0
    this.spawnAnim = 0.001; this.camX = 0; this.camY = 0; this.shake = 0
    this.spawnEnemyT = 2
    this.capsules.push(this.makeCapsule(240, 150, 1, true))
    this.capsules.push(this.makeCapsule(-160, -120, irand(0, 1), false))
    this.mode = 'game'
    this.transitioning = false
    this.beamT = -1
    this.hooks.onStart()
    this.hooks.onToast({ text: 'ТЕЛЕПОРТ ЗАВЕРШЁН. ЗАЧИСТИ СЕКТОР', color: '#3fe0ff' })
    this.burst(0, 0, 26, '#7dffea', 3)
    audio.teleport()
  }

  // ---------- основной цикл ----------
  tick(dt: number) {
    this.menuT += dt
    if (this.mode === 'menu') {
      if (this.beamT >= 0 && !this.transitioning) {
        this.beamT += dt * 1.15
        if (this.beamT >= 1.35) { this.transitioning = true; this.startGame() }
      }
      this.updateMenu(dt)
      this.drawMenu()
      return
    }
    if (!this.paused) {
      this.time += dt
      this.shake = Math.max(0, this.shake - dt * 14)
      this.hurtT = Math.max(0, this.hurtT - dt * 2.2)
      if (this.dead) {
        this.deadT -= dt
        this.updateFx(dt)
        if (this.deadT <= 0 && this.deadT > -1) {
          this.hooks.onDeath({ kills: this.p.kills, credits: this.p.credits, time: Math.floor(this.time), companions: this.companions.length })
          this.deadT = -10
        }
      } else {
        this.updateGame(dt)
      }
      this.draw()
    } else {
      this.draw()
    }
    this.snapT -= dt
    if (this.snapT <= 0) { this.snapT = 0.1; this.sendSnap() }
  }

  updateGame(dt: number) {
    const p = this.p
    // спавн-анимация телепорта
    if (this.spawnAnim < 1) {
      this.spawnAnim = Math.min(1, this.spawnAnim + dt * 1.1)
      if (rnd() < 0.5) this.particles.push({ x: p.x + (rnd() - 0.5) * 12, y: p.y + 10 - this.spawnAnim * 22, vx: (rnd() - 0.5) * 8, vy: -20 - rnd() * 20, life: 0.5, max: 0.5, color: '#7dffea', size: 1, grav: 0 })
    }
    this.updatePlayer(dt)
    this.updateEnemies(dt)
    this.updateCompanions(dt)
    this.updateBullets(dt)
    this.updatePickups(dt)
    this.updateFx(dt)
    this.updateWorld(dt)
  }

  updateFx(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i]
      pt.life -= dt
      if (pt.life <= 0) { this.particles.splice(i, 1); continue }
      pt.vy += pt.grav * dt
      pt.x += pt.vx * dt; pt.y += pt.vy * dt
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]
      f.life -= dt
      f.y -= 14 * dt
      if (f.life <= 0) this.floaters.splice(i, 1)
    }
  }

  updateWorld(dt: number) {
    const p = this.p
    // спавн врагов
    this.spawnEnemyT -= dt
    const interval = clamp(2.6 - p.kills * 0.02, 0.85, 2.6)
    if (this.spawnEnemyT <= 0 && this.enemies.length < 26) {
      this.spawnEnemyT = interval
      const n = 1 + (p.kills > 12 ? 1 : 0) + (p.kills > 30 ? 1 : 0)
      for (let i = 0; i < n; i++) this.spawnEnemy()
    }
    // капсулы вокруг игрока
    let near = 0
    for (const c of this.capsules) if (Math.hypot(c.x - p.x, c.y - p.y) < 560) near++
    if (near < 4 && rnd() < 0.02) {
      const a = rnd() * Math.PI * 2, d = 380 + rnd() * 220
      this.capsules.push(this.makeCapsule(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, irand(0, 3), rnd() < 0.08))
    }
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i]
      if (Math.hypot(c.x - p.x, c.y - p.y) > 1300) this.capsules.splice(i, 1)
    }
    // погода биома
    this.weatherT -= dt
    if (this.weatherT <= 0) {
      this.weatherT = 0.08
      const w = BIOMES[this.biomeAt(this.camX, this.camY)].weather
      if (w !== 'none' && this.weather.length < 90) {
        const wx = this.camX + (rnd() - 0.5) * this.W, wy = this.camY - VIEW_H / 2 - 10
        const col = w === 'ember' ? '#ff8a3d' : w === 'snow' ? '#d8f0f8' : w === 'spore' ? '#b6ff2e' : w === 'sand' ? '#c89a6e' : w === 'spark' ? '#3fe0ff' : '#787e8a'
        this.weather.push({ x: wx, y: wy, vx: (rnd() - 0.5) * 12 + (w === 'sand' ? 16 : 0), vy: 26 + rnd() * 22, life: 4, max: 4, color: col, size: w === 'ember' || w === 'spark' ? 1 : 1, grav: 0 })
      }
    }
    for (let i = this.weather.length - 1; i >= 0; i--) {
      const w = this.weather[i]
      w.life -= dt
      w.x += w.vx * dt; w.y += w.vy * dt
      if (w.life <= 0 || w.y > this.camY + VIEW_H / 2 + 10) this.weather.splice(i, 1)
    }
    // шаттл гильдии
    if (!this.shuttle && p.kills >= this.nextDrop) {
      this.shuttle = { t: 0, released: false }
      audio.shuttle()
      this.hooks.onToast({ text: 'ШАТТЛ ГИЛЬДИИ НА ПОДХОДЕ', color: '#f5a623' })
    }
    if (this.shuttle) {
      this.shuttle.t += dt
      const sx = -90 + (this.shuttle.t / 3.6) * (this.W + 200)
      if (!this.shuttle.released && sx >= this.W / 2) {
        this.shuttle.released = true
        this.fallPods.push({ x: p.x, y: p.y + 26, t: 0, dur: 1.6 })
      }
      if (this.shuttle.t > 3.8) this.shuttle = null
    }
    // падающие капсулы
    for (let i = this.fallPods.length - 1; i >= 0; i--) {
      const f = this.fallPods[i]
      f.t += dt
      if (rnd() < 0.5) this.particles.push({ x: f.x + (rnd() - 0.5) * 8, y: f.y - (1 - f.t / f.dur) * 100, vx: (rnd() - 0.5) * 10, vy: 20, life: 0.5, max: 0.5, color: 'rgba(200,210,220,0.5)', size: 2, grav: 0 })
      if (f.t >= f.dur) {
        this.fallPods.splice(i, 1)
        this.pods.push({ x: f.x, y: f.y, opened: false })
        this.burst(f.x, f.y, 20, '#c9d4de', 2.4)
        this.smoke(f.x, f.y, 12)
        this.shake = Math.max(this.shake, 3)
        audio.podLand()
      }
    }
    // открытие груза гильдии
    for (const pod of this.pods) {
      if (!pod.opened && Math.hypot(pod.x - p.x, pod.y - p.y) < 15) {
        pod.opened = true
        this.burst(pod.x, pod.y, 26, '#3fe0ff', 2.6)
        this.burst(pod.x, pod.y, 12, '#f5a623', 2)
        this.shake = Math.max(this.shake, 3)
        audio.capsuleBreak()
        this.hooks.onToast({ text: 'ГРУЗ ГИЛЬДИИ ВСКРЫТ', color: '#f5a623' })
        // синий или выше
        const rar = 2 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0)
        const w = genWeapon(clamp(rar, 2, 4))
        this.pickups.push({ x: pod.x, y: pod.y - 10, vx: 0, vy: 0, kind: 'weapon', color: RARITIES[w.rarity].color, phase: rnd() * 6, weapon: w })
        if (rnd() < 0.6) {
          const a = genArmor(clamp(rar, 2, 4))
          this.pickups.push({ x: pod.x + 12, y: pod.y, vx: 0, vy: 0, kind: 'armor', color: a.color, phase: rnd() * 6, armor: a, slot: ['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'].indexOf(a.slot) })
        }
        if (rnd() < 0.5) {
          const u = pick(COMP_UPGRADES)
          this.pickups.push({ x: pod.x - 12, y: pod.y, vx: 0, vy: 0, kind: 'upgrade', color: u.color, phase: rnd() * 6, up: u })
        }
        this.dropCoins(pod.x, pod.y + 8, irand(3, 5), 2)
      }
    }
    // камера
    this.camX += (p.x - this.camX) * Math.min(1, dt * 7)
    this.camY += (p.y - this.camY) * Math.min(1, dt * 7)
  }

  makeCapsule(x: number, y: number, size: number, special: boolean): Capsule {
    const maxHp = [18, 30, 52, 85][size]
    return { x, y, size, shape: irand(0, 3), cIdx: irand(0, CAPSULE_COLORS.length - 1), hp: maxHp, maxHp, special, phase: rnd() * 6 }
  }

  spawnEnemy() {
    const p = this.p
    const a = rnd() * Math.PI * 2
    const d = 200 + rnd() * 90
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d
    let type = 'grunt'
    const t = rnd()
    if (t < 0.4) type = 'grunt'
    else if (t < 0.65) type = 'gunner'
    else if (t < 0.85) type = 'flyer'
    else if (p.kills >= 5) type = 'brute'
    else type = 'grunt'
    const def = ENEMY_DEFS[type]
    const hpScale = 1 + p.kills * 0.012
    this.enemies.push({
      x, y, type, def,
      body: irand(0, def.bodies.length - 1),
      head: irand(0, def.heads.length - 1),
      weapon: irand(0, def.weapons.length - 1),
      pal: pick(def.palettes),
      hp: Math.round(def.hp * hpScale), maxHp: Math.round(def.hp * hpScale),
      speed: def.speed, dmg: def.dmg, r: def.r, flash: 0,
      windup: 0, atkCd: 0, aim: 0, walkT: rnd() * 6, phase: rnd() * 6,
      strafe: rnd() < 0.5 ? 1 : -1, burst: 0, shootT: 0, swoopT: 1.5 + rnd() * 2, swoop: 0,
      kbx: 0, kby: 0, targetKind: 0, score: def.score,
    })
  }

  // ---------- игрок: действия ----------
  updatePlayer(dt: number) {
    const p = this.p
    p.iframes = Math.max(0, p.iframes - dt)
    p.slashT = Math.max(0, p.slashT - dt)
    p.slashCd = Math.max(0, p.slashCd - dt)
    p.dashCd = Math.max(0, p.dashCd - dt)
    let mx = 0, my = 0
    if (this.keys.KeyW || this.keys.ArrowUp) my -= 1
    if (this.keys.KeyS || this.keys.ArrowDown) my += 1
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1
    const ml = Math.hypot(mx, my)
    if (ml > 0) { mx /= ml; my /= ml; p.walkT += dt }
    const spd = 74 * (1 + p.bonus.speed / 100)
    if (p.dashT > 0) {
      p.dashT -= dt
      p.x += p.dashVX * dt; p.y += p.dashVY * dt
      if (rnd() < 0.6) this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: 'rgba(63,224,255,0.5)', size: 4, grav: 0 })
    } else { p.x += mx * spd * dt; p.y += my * spd * dt }
    this.pushOut(p, 4)
    // прицел
    const wx = this.camX - this.W / 2 + this.mouse.x, wy = this.camY - VIEW_H / 2 + this.mouse.y
    p.aim = Math.atan2(wy - (p.y - 3), wx - p.x)
    // стрельба
    p.fireCd -= dt
    if (p.reloadT > 0) {
      p.reloadT -= dt
      if (p.reloadT <= 0) { const w = this.curWeapon(); if (w) { p.mag = w.mag; w.magCur = w.mag } }
    }
    const w = this.curWeapon()
    if (w && p.mag <= 0 && p.reloadT <= 0) this.startReload()
    if (this.mouse.down && p.fireCd <= 0 && p.reloadT <= 0 && this.spawnAnim >= 1) this.fire()
    if ((this.keys.Space) && p.slashCd <= 0) this.trySlash()
    // реген
    p.regenDelay -= dt
    if (p.regenDelay <= 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 2.4 * dt)
  }

  tryDash() {
    const p = this.p
    if (p.dashCd > 0 || this.dead || this.mode !== 'game') return
    let mx = 0, my = 0
    if (this.keys.KeyW || this.keys.ArrowUp) my -= 1
    if (this.keys.KeyS || this.keys.ArrowDown) my += 1
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1
    if (mx === 0 && my === 0) { mx = Math.cos(p.aim); my = Math.sin(p.aim) }
    const l = Math.hypot(mx, my)
    p.dashVX = (mx / l) * 300; p.dashVY = (my / l) * 300
    p.dashT = 0.18; p.dashCd = 1.05; p.iframes = Math.max(p.iframes, 0.22)
    audio.dash()
    this.burst(p.x, p.y, 6, '#3fe0ff', 1.5)
  }

  fire() {
    const p = this.p
    const w = this.curWeapon()
    if (!w || p.mag <= 0) return
    p.mag--
    w.magCur = p.mag
    p.fireCd = 1 / (w.rate * (1 + p.bonus.rate / 100))
    const acc = clamp(w.acc + p.bonus.acc / 100, 0.05, 0.99)
    const spread = (1 - acc) * 0.55
    for (let i = 0; i < w.pellets; i++) {
      const off = w.pellets > 1 ? (i - (w.pellets - 1) / 2) * 0.14 : 0
      const a = p.aim + off + (rnd() - 0.5) * spread
      const sp = w.speed
      this.bullets.push({ x: p.x + Math.cos(p.aim) * 10, y: p.y - 3 + Math.sin(p.aim) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: w.dmg * (1 + p.bonus.dmg / 100), kind: w.proj, color: w.color, r: w.proj === 'rocket' ? 3 : 2, explosive: w.explosive, pierce: w.pierce, friendly: true, life: w.proj === 'rocket' ? 2.2 : 1.1, hit: new Set() })
    }
    this.muzzle(p.x + Math.cos(p.aim) * 12, p.y - 3 + Math.sin(p.aim) * 12, w.color)
    this.shake = Math.max(this.shake, w.proj === 'rocket' || w.proj === 'rail' ? 1.6 : 0.5)
    audio.shoot(w.proj)
  }

  startReload() {
    const p = this.p
    const w = this.curWeapon()
    if (!w || p.reloadT > 0 || p.mag >= w.mag) return
    p.reloadT = w.reload
    audio.reload()
  }

  trySlash() {
    const p = this.p
    if (p.slashCd > 0 || this.dead) return
    p.slashT = 0.2; p.slashCd = 0.55
    audio.slash()
    const dmg = 16 * (1 + p.bonus.dmg / 100)
    let hitAny = false
    for (const e of [...this.enemies]) {
      const d = Math.hypot(e.x - p.x, e.y - p.y)
      if (d < 24) {
        const a = Math.atan2(e.y - p.y, e.x - p.x)
        let da = Math.abs(a - p.aim)
        if (da > Math.PI) da = Math.PI * 2 - da
        if (da < 1.3) {
          const crit = rnd() * 100 < p.bonus.crit
          this.damageEnemy(e, dmg * (crit ? 2 : 1), crit)
          hitAny = true
        }
      }
    }
    for (const c of [...this.capsules]) {
      if (Math.hypot(c.x - p.x, c.y - p.y) < 26) { this.damageCapsule(c, dmg * 0.7); hitAny = true }
    }
    // отражение вражеских пуль
    for (const b of this.bullets) if (!b.friendly) {
      const d = Math.hypot(b.x - p.x, b.y - p.y)
      if (d < 22) { const a = Math.atan2(b.y - p.y, b.x - p.x); let da = Math.abs(a - p.aim); if (da > Math.PI) da = Math.PI * 2 - da; if (da < 1.3) { b.life = 0; this.burst(b.x, b.y, 4, '#7dffea', 1) } }
    }
    if (hitAny) { audio.bladeHit(); this.shake = Math.max(this.shake, 1.2) }
  }

  curWeapon() { return this.p.weapons[this.p.cur] as (Weapon | undefined) }

  switchTo(i: number) {
    const p = this.p
    if (i === p.cur || i < 0 || i >= p.weapons.length) return
    const old = this.curWeapon()
    if (old) old.magCur = p.mag
    p.cur = i
    const w = this.curWeapon()
    if (w) { p.mag = w.magCur ?? w.mag; p.reloadT = 0 }
    audio.click()
  }

  // ---------- враги ----------
  updateEnemies(dt: number) {
    const p = this.p
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt)
      e.atkCd = Math.max(0, e.atkCd - dt)
      e.walkT += dt
      const dx = p.x - e.x, dy = p.y - e.y
      const d = Math.hypot(dx, dy) || 1
      e.aim = Math.atan2(dy, dx)
      if (e.windup > 0) {
        e.windup -= dt
        if (e.windup <= 0) {
          // удар
          if (d < (e.type === 'brute' ? 34 : 26)) this.damagePlayer(e.dmg)
          if (e.type === 'brute') { this.shake = Math.max(this.shake, 2.4); this.burst(e.x + Math.cos(e.aim) * 14, e.y + Math.sin(e.aim) * 14, 8, '#c89a6e', 2) }
          e.atkCd = e.type === 'brute' ? 1.4 : 0.8
        }
        continue
      }
      if (e.type === 'grunt') {
        if (d > 14) { e.x += (dx / d) * e.speed * dt; e.y += (dy / d) * e.speed * dt }
        if (d < 20 && e.atkCd <= 0) e.windup = 0.35
      } else if (e.type === 'brute') {
        if (d > 22) { e.x += (dx / d) * e.speed * dt; e.y += (dy / d) * e.speed * dt }
        if (d < 30 && e.atkCd <= 0) e.windup = 0.6
      } else if (e.type === 'gunner') {
        const want = 105
        let vx = 0, vy = 0
        if (d > want + 18) { vx = dx / d; vy = dy / d }
        else if (d < want - 18) { vx = -dx / d; vy = -dy / d }
        else { vx = (-dy / d) * e.strafe; vy = (dx / d) * e.strafe }
        e.x += vx * e.speed * dt; e.y += vy * e.speed * dt
        if (e.shootT > 0) {
          e.shootT -= dt
          if (e.burst > 0 && e.shootT <= 0) {
            e.burst--
            e.shootT = 0.16
            const bs = 130
            this.bullets.push({ x: e.x + Math.cos(e.aim) * 8, y: e.y - 3 + Math.sin(e.aim) * 8, vx: Math.cos(e.aim + (rnd() - 0.5) * 0.12) * bs, vy: Math.sin(e.aim + (rnd() - 0.5) * 0.12) * bs, dmg: e.dmg, kind: 'plasma', color: e.pal.accent, r: 2.5, explosive: 0, pierce: false, friendly: false, life: 2.4, hit: new Set() })
            audio.enemyShoot()
          }
        } else if (d < 190 && e.atkCd <= 0) {
          e.burst = e.weapon === 2 ? 1 : 3
          e.shootT = 0.01
          e.atkCd = 1.6
        }
      } else {
        // flyer
        e.swoopT -= dt
        if (e.swoop > 0) {
          e.swoop -= dt
          e.x += e.kbx * dt; e.y += e.kby * dt
          if (d < 12) { this.damagePlayer(e.dmg); e.swoop = 0 }
        } else {
          const orb = 78
          const ta = e.aim + Math.PI / 2 * e.strafe
          const tx = p.x + Math.cos(e.phase + this.time * 1.4 * e.strafe) * orb
          const ty = p.y + Math.sin(e.phase + this.time * 1.4 * e.strafe) * orb
          const tdx = tx - e.x, tdy = ty - e.y, td = Math.hypot(tdx, tdy) || 1
          e.x += (tdx / td) * e.speed * dt + Math.cos(ta) * 6 * dt
          e.y += (tdy / td) * e.speed * dt + Math.sin(ta) * 6 * dt
          if (e.swoopT <= 0 && d < 150) {
            e.swoopT = 2.5 + rnd() * 2
            e.swoop = 0.35
            const sp = 95
            e.kbx = (dx / d) * sp; e.kby = (dy / d) * sp
          }
          // бомбы
          if (e.weapon === 2 && e.atkCd <= 0 && d < 130) {
            e.atkCd = 2.4
            this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.aim) * 60, vy: Math.sin(e.aim) * 60, dmg: e.dmg * 0.8, kind: 'plasma', color: e.pal.accent, r: 2.5, explosive: 0, pierce: false, friendly: false, life: 2.2, hit: new Set() })
            audio.enemyShoot()
          }
        }
      }
      if (e.type !== 'flyer') this.pushOut(e, e.r * 0.6)
      // контактный урон
      if (e.atkCd <= 0 && d < e.r + 6 && (e.type === 'grunt' || e.type === 'brute')) {
        // обрабатывается через windup
      }
    }
  }

  damageEnemy(e: Enemy, dmg: number, crit = false) {
    e.hp -= dmg
    e.flash = 0.12
    this.floaters.push({ x: e.x + (rnd() - 0.5) * 8, y: e.y - e.r - 6, text: String(Math.round(dmg)), color: crit ? '#ffd54a' : '#e8f4ff', life: 0.4, size: crit ? 8 : 6 })
    this.burst(e.x, e.y, 3, e.pal.accent, 1.4)
    audio.hit()
    if (e.hp <= 0) this.killEnemy(e)
  }

  killEnemy(e: Enemy) {
    const i = this.enemies.indexOf(e)
    if (i >= 0) this.enemies.splice(i, 1)
    const p = this.p
    p.kills++
    this.burst(e.x, e.y, 14, e.pal.accent, 2.2)
    this.burst(e.x, e.y, 8, '#ff8a3d', 2.6)
    audio.explode()
    this.shake = Math.max(this.shake, e.type === 'brute' ? 3 : 1.4)
    const r = rnd()
    if (r < 0.5) this.dropCoins(e.x, e.y, irand(1, 2) + (e.type === 'brute' ? 2 : 0), e.type === 'brute' ? 2 : 1)
    else if (r < 0.56) this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'weapon', color: RARITIES[1].color, phase: rnd() * 6, weapon: genWeapon(rnd() < 0.8 ? 1 : 2) })
    else if (r < 0.62) { const a = genArmor(rnd() < 0.8 ? 1 : 2); this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'armor', color: a.color, phase: rnd() * 6, armor: a, slot: ['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'].indexOf(a.slot) }) }
    // сердце: шанс растёт, когда наёмник изранен; громила роняет крупное
    const heartChance = p.hp / p.maxHp < 0.55 ? 0.26 : 0.1
    if (rnd() < heartChance) {
      const heal = Math.round(p.maxHp * (e.type === 'brute' ? 0.28 : 0.14))
      this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'heart', color: '#ff5a7a', phase: rnd() * 6, val: heal })
    }
  }

  dropCoins(x: number, y: number, n: number, tier: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      this.pickups.push({ x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, kind: 'coin', color: '#f5a623', phase: rnd() * 6, val: irand(4, 10) * tier })
    }
  }

  damageCapsule(c: Capsule, dmg: number) {
    c.hp -= dmg
    audio.capsuleHit()
    this.burst(c.x, c.y - 4, 3, '#c9d4de', 1)
    if (c.hp <= 0) this.breakCapsule(c)
  }

  breakCapsule(c: Capsule) {
    const i = this.capsules.indexOf(c)
    if (i >= 0) this.capsules.splice(i, 1)
    const col = CAPSULE_COLORS[c.cIdx]
    this.burst(c.x, c.y, 22, col.band, 2.6)
    this.burst(c.x, c.y, 12, '#c9d4de', 2)
    this.smoke(c.x, c.y, 8)
    audio.capsuleBreak()
    this.shake = Math.max(this.shake, 2.5 + c.size)
    this.floaters.push({ x: c.x, y: c.y - 14, text: 'ГРУЗ!', color: col.band, life: 0.9, size: 8 })
    if (c.special) { this.spawnCompanion(c.x, c.y); return }
    const counts = [2, 4, 6, 8]
    const n = counts[c.size]
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, d = 6 + rnd() * (8 + c.size * 5)
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d
      const roll = rnd()
      const rar = this.rollRarity(c.size)
      if (roll < 0.44) this.dropCoins(x, y, 1, c.size + 1)
      else if (roll < 0.44 + 0.26 + c.size * 0.04) {
        const w = genWeapon(rar)
        this.pickups.push({ x, y, vx: 0, vy: 0, kind: 'weapon', color: RARITIES[rar].color, phase: rnd() * 6, weapon: w })
      } else if (roll < 0.44 + 0.26 + c.size * 0.04 + 0.18) {
        const ar = genArmor(rar)
        this.pickups.push({ x, y, vx: 0, vy: 0, kind: 'armor', color: ar.color, phase: rnd() * 6, armor: ar, slot: ['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'].indexOf(ar.slot) })
      } else {
        const u = pick(COMP_UPGRADES)
        this.pickups.push({ x, y, vx: 0, vy: 0, kind: 'upgrade', color: u.color, phase: rnd() * 6, up: u })
      }
    }
  }

  rollRarity(size: number) {
    const t = rnd()
    if (size === 0) return t < 0.8 ? 0 : 1
    if (size === 1) return t < 0.5 ? 0 : t < 0.85 ? 1 : 2
    if (size === 2) return t < 0.35 ? 1 : t < 0.75 ? 2 : t < 0.95 ? 3 : 4
    return t < 0.4 ? 2 : t < 0.75 ? 3 : 4
  }

  spawnCompanion(x: number, y: number) {
    const def = pick(COMP_DEFS)
    const comp: Companion = {
      x, y, kind: def.kind, def,
      body: irand(0, def.bodies.length - 1),
      gun: irand(0, def.guns.length - 1),
      pal: pick(def.palettes),
      walkT: rnd() * 6, aim: 0, phase: rnd() * 6, fireCd: 0.5, flash: 0, moving: false,
    }
    this.companions.push(comp)
    this.burst(x, y, 24, '#3fe0ff', 2.6)
    this.burst(x, y, 12, '#ffffff', 2)
    this.smoke(x, y, 10)
    audio.companion()
    this.hooks.onToast({ text: `${def.label} ПРИСОЕДИНИЛСЯ К ОТРЯДУ`, color: '#3fe0ff' })
  }

  // ---------- компаньоны (с модулями отряда) ----------
  updateCompanions(dt: number) {
    const p = this.p
    const dmgM = 1 + this.cu('dmg') * 0.2
    const rateM = 1 + this.cu('rate') * 0.16
    const rangeM = 1 + this.cu('range') * 0.18
    const pierceN = this.cu('pierce')
    const critC = this.cu('crit') * 0.1
    const blastL = this.cu('blast')
    const salvoC = this.cu('salvo') * 0.2
    for (let i = 0; i < this.companions.length; i++) {
      const c = this.companions[i]
      c.flash -= dt; c.fireCd -= dt; c.walkT += dt
      const ang = this.time * 0.6 + i * ((Math.PI * 2) / Math.max(4, Math.min(12, this.companions.length))) * 2.4 + i
      const rad = 24 + (i % 3) * 9
      const tx = p.x + Math.cos(ang) * rad, ty = p.y + Math.sin(ang) * rad
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy)
      if (d > 4) {
        const sp = Math.min(c.def.speed, d * 4)
        c.x += (dx / d) * sp * dt
        c.y += (dy / d) * sp * dt
        c.moving = true
        if (!c.def.flying) this.pushOut(c, 4)
      } else c.moving = false
      if (d > 130) { c.x = p.x + (rnd() - 0.5) * 30; c.y = p.y + (rnd() - 0.5) * 30 }
      // цель
      let target: Enemy | null = null
      let bd = c.def.range * rangeM
      for (const e of this.enemies) {
        const ed = Math.hypot(e.x - c.x, e.y - c.y)
        if (ed < bd) { bd = ed; target = e }
      }
      if (target) {
        c.aim = Math.atan2(target.y - c.y, target.x - c.x)
        if (c.fireCd <= 0) {
          c.fireCd = 1 / (c.def.rate * rateM)
          const shots = 1 + (rnd() < salvoC ? (salvoC >= 0.6 ? 2 : 1) : 0)
          for (let s = 0; s < shots; s++) {
            const crit = rnd() < critC
            const dmg = c.def.dmg * dmgM * (crit ? 2 : 1)
            const aim = c.aim + (s > 0 ? (rnd() - 0.5) * 0.24 : 0)
            const bs = 190
            this.bullets.push({
              x: c.x + Math.cos(aim) * 8, y: c.y - 3 + Math.sin(aim) * 8,
              vx: Math.cos(aim) * bs, vy: Math.sin(aim) * bs,
              dmg, kind: c.def.proj, color: crit ? '#ffd54a' : c.pal.accent, r: 2,
              explosive: c.def.proj === 'rocket' ? 12 : blastL > 0 ? 9 + blastL * 4 : 0,
              pierce: false, pierceLeft: pierceN > 0 ? pierceN : undefined,
              friendly: true, life: 1.2, hit: new Set(),
            })
            if (crit) this.floaters.push({ x: c.x, y: c.y - 14, text: 'КРИТ', color: '#ffd54a', life: 0.35, size: 6 })
          }
          this.muzzle(c.x + Math.cos(c.aim) * 10, c.y - 3 + Math.sin(c.aim) * 10, c.pal.accent)
          audio.shoot(c.def.proj === 'bullet' ? 'bullet' : c.def.proj)
        }
      } else c.aim = p.aim
    }
  }

  // ---------- пули ----------
  updateBullets(dt: number) {
    const p = this.p
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.life -= dt
      b.x += b.vx * dt; b.y += b.vy * dt
      let dead = b.life <= 0
      // препятствия
      if (!dead) for (const o of this.nearObstacles(b.x, b.y, b.r)) {
        if (Math.hypot(o.x - b.x, o.y - b.y) < o.r) { dead = true; this.burst(b.x, b.y, 3, b.color, 1); break }
      }
      if (!dead && b.friendly) {
        for (const e of this.enemies) {
          if (b.hit.has(e)) continue
          if (Math.hypot(e.x - b.x, e.y - (b.y + 2)) < e.r + b.r) {
            b.hit.add(e)
            const crit = rnd() * 100 < p.bonus.crit
            this.damageEnemy(e, b.dmg * (crit ? 2 : 1), crit)
            if (b.explosive > 0) { this.explode(b.x, b.y, b.explosive, b.dmg * 0.55, b.color); dead = true }
            else if (b.pierceLeft !== undefined) { b.pierceLeft--; if (b.pierceLeft < 0) dead = true }
            else if (!b.pierce) dead = true
            if (dead) break
          }
        }
        if (!dead) for (const c of this.capsules) {
          const cr = [7, 9, 12, 15][c.size]
          if (Math.hypot(c.x - b.x, c.y - b.y) < cr) {
            this.damageCapsule(c, b.dmg)
            if (b.explosive > 0) this.explode(b.x, b.y, b.explosive, b.dmg * 0.5, b.color)
            dead = true; break
          }
        }
      } else if (!dead && !b.friendly) {
        if (Math.hypot(p.x - b.x, p.y - 2 - b.y) < 6 + b.r) {
          this.damagePlayer(b.dmg)
          dead = true
        }
      }
      if (dead) { if (b.explosive > 0 && b.life <= 0 && b.friendly) this.explode(b.x, b.y, b.explosive, b.dmg * 0.5, b.color); this.bullets.splice(i, 1) }
    }
  }

  explode(x: number, y: number, radius: number, dmg: number, color: string) {
    this.burst(x, y, 16, color, 2.6)
    this.burst(x, y, 10, '#ff8a3d', 2.2)
    this.smoke(x, y, 6)
    this.shake = Math.max(this.shake, 2)
    audio.explode()
    for (const e of [...this.enemies]) {
      if (Math.hypot(e.x - x, e.y - y) < radius + e.r) this.damageEnemy(e, dmg)
    }
    for (const c of [...this.capsules]) {
      if (Math.hypot(c.x - x, c.y - y) < radius + 10) this.damageCapsule(c, dmg)
    }
  }

  burst(x: number, y: number, n: number, color: string, pow: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const sp = (20 + rnd() * 60) * pow
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.3 + rnd() * 0.4, max: 0.7, color, size: rnd() < 0.3 ? 2 : 1, grav: 130 })
    }
  }
  muzzle(x: number, y: number, color: string) {
    for (let i = 0; i < 3; i++) this.particles.push({ x, y, vx: (rnd() - 0.5) * 50, vy: (rnd() - 0.5) * 50, life: 0.12, max: 0.12, color, size: 2, grav: 0 })
  }
  smoke(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.particles.push({ x: x + (rnd() - 0.5) * 10, y: y + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 14, vy: -12 - rnd() * 14, life: 0.7 + rnd() * 0.5, max: 1.2, color: 'rgba(120,130,140,0.5)', size: 3, grav: -8 })
  }

  damagePlayer(dmg: number) {
    const p = this.p
    if (p.iframes > 0 || this.dead || this.spawnAnim < 1) return
    p.hp -= dmg
    p.iframes = 0.7
    p.regenDelay = 5
    this.hurtT = 0.5
    this.shake = Math.max(this.shake, 2.2)
    this.burst(p.x, p.y, 6, '#ff5533', 1.6)
    audio.hurt()
    if (p.hp <= 0) {
      p.hp = 0
      this.dead = true
      this.deadT = 1.4
      this.burst(p.x, p.y, 34, '#ff8a3d', 3)
      this.burst(p.x, p.y, 20, '#3fe0ff', 2.4)
      this.shake = 5
      audio.death()
    }
  }

  // ---------- подбор ----------
  // Правило гильдии: подбирается только то, что ЛУЧШЕ текущего.
  // Оружие сравнивается по суммарной мощности с худшим в арсенале,
  // броня — с надетой в том же слоте. Слабый лут отклоняется.
  updatePickups(dt: number) {
    const p = this.p
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i]
      // отклонённый (слабый) предмет гаснет и исчезает
      if (pk.rej !== undefined) {
        pk.rej -= dt
        if (pk.rej <= 0) {
          this.burst(pk.x, pk.y, 5, '#5e7a90', 1.2)
          this.pickups.splice(i, 1)
        }
        continue
      }
      pk.x += pk.vx * dt; pk.y += pk.vy * dt
      pk.vx *= 1 - Math.min(1, dt * 4); pk.vy *= 1 - Math.min(1, dt * 4)
      const d = Math.hypot(p.x - pk.x, p.y - pk.y)
      if ((pk.kind === 'coin' || (pk.kind === 'heart' && p.hp < p.maxHp)) && d < 52) {
        const a = Math.atan2(p.y - pk.y, p.x - pk.x)
        const sp = 130 * (1 - d / 60) + 40
        pk.x += Math.cos(a) * sp * dt; pk.y += Math.sin(a) * sp * dt
      }
      if (d < (pk.kind === 'coin' || pk.kind === 'heart' ? 9 : 11) && !this.dead) {
        if (pk.kind === 'coin') {
          this.pickups.splice(i, 1)
          p.credits += pk.val || 5
          this.floaters.push({ x: p.x, y: p.y - 18, text: '+' + (pk.val || 5), color: '#ffd54a', life: 0.7, size: 7 })
          audio.coin()
        } else if (pk.kind === 'heart') {
          if (p.hp >= p.maxHp) continue
          this.pickups.splice(i, 1)
          const heal = Math.min(pk.val || 15, p.maxHp - p.hp)
          p.hp += heal
          p.regenDelay = 0
          this.burst(p.x, p.y - 4, 10, '#ff5a7a', 1.6)
          this.floaters.push({ x: p.x, y: p.y - 20, text: '+' + Math.round(heal) + ' HP', color: '#ff9fb2', life: 0.8, size: 7 })
          audio.heal()
        } else if (pk.kind === 'upgrade') {
          this.pickups.splice(i, 1)
          this.applyUpgrade(pk.up as CompUpgrade)
        } else if (pk.kind === 'weapon') {
          const w = pk.weapon as Weapon
          if (this.weaponIsUpgrade(w)) { this.pickups.splice(i, 1); this.collectWeapon(w) }
          else this.rejectPickup(pk, 'СЛАБЕЕ АРСЕНАЛА')
        } else if (pk.kind === 'armor') {
          const a = pk.armor as Armor
          const slotIdx = pk.slot || 0
          const cur = p.armor[slotIdx] as Armor | null
          if (!cur || a.score > cur.score) { this.pickups.splice(i, 1); this.collectArmor(a, slotIdx) }
          else this.rejectPickup(pk, 'СЛАБЕЕ ЭКИПИРОВКИ')
        }
      }
    }
  }

  weaponIsUpgrade(w: Weapon): boolean {
    const ws = this.p.weapons as Weapon[]
    if (!ws.length) return true
    let worst = Infinity
    for (const x of ws) worst = Math.min(worst, weaponScore(x))
    return weaponScore(w) > worst
  }

  rejectPickup(pk: Pickup, why: string) {
    pk.rej = 1.7
    audio.deny()
    this.floaters.push({ x: pk.x, y: pk.y - 15, text: why, color: '#5e7a90', life: 1.1, size: 6 })
    this.burst(pk.x, pk.y, 4, '#5e7a90', 1)
  }

  collectWeapon(w: Weapon) {
    const p = this.p
    if (p.weapons.length < 5) { p.weapons.push(w); p.cur = p.weapons.length - 1 }
    else {
      const ws = p.weapons as Weapon[]
      let wi = 0, worst = Infinity
      ws.forEach((x, i) => { const s = weaponScore(x); if (s < worst) { worst = s; wi = i } })
      p.weapons[wi] = w
      p.cur = wi
    }
    w.magCur = w.mag
    p.mag = w.mag; p.reloadT = 0; p.fireCd = 0.15
    audio.pickup()
    if (w.rarity >= 3) audio.rareSting()
    const rar = RARITIES[w.rarity]
    this.hooks.onToast({ text: `ОРУЖИЕ: ${w.name} [${rar.name}]`, color: rar.color })
    this.floaters.push({ x: p.x, y: p.y - 20, text: w.name, color: rar.color, life: 1, size: 7 })
  }

  collectArmor(a: Armor, slotIdx: number) {
    const p = this.p
    p.armor[slotIdx] = a
    this.recalcBonuses()
    audio.pickup()
    if (a.rarity >= 3) audio.rareSting()
    this.hooks.onToast({ text: `ЭКИПИРОВКА: ${a.name} (${a.bonuses.map((b) => '+' + b.val + ' ' + b.label).join(', ')})`, color: a.color })
  }

  applyUpgrade(u: CompUpgrade) {
    const lvl = this.cu(u.id)
    if (lvl >= u.max) {
      this.p.credits += 60
      audio.coin()
      this.hooks.onToast({ text: `${u.name}: МАКС → +60 КРЕДИТОВ`, color: '#9aa7b8' })
      this.floaters.push({ x: this.p.x, y: this.p.y - 18, text: '+60', color: '#ffd54a', life: 0.7, size: 7 })
      return
    }
    this.compUp[u.id] = lvl + 1
    audio.upgrade()
    this.burst(this.p.x, this.p.y - 4, 14, u.color, 1.8)
    this.hooks.onToast({ text: `МОДУЛЬ ОТРЯДА: ${u.name} → УР.${lvl + 1}`, color: u.color })
    this.floaters.push({ x: this.p.x, y: this.p.y - 20, text: u.name, color: u.color, life: 1, size: 7 })
    for (const c of this.companions) { c.flash = 0.3; this.burst(c.x, c.y - 4, 6, u.color, 1.2) }
  }

  recalcBonuses() {
    const p = this.p
    const b = { hp: 0, dmg: 0, rate: 0, speed: 0, acc: 0, crit: 5 }
    for (const a of p.armor) {
      if (!a) continue
      for (const bn of (a as Armor).bonuses) {
        if (bn.key === 'hp') b.hp += bn.val
        else if (bn.key === 'dmg') b.dmg += bn.val
        else if (bn.key === 'rate') b.rate += bn.val
        else if (bn.key === 'speed') b.speed += bn.val
        else if (bn.key === 'acc') b.acc += bn.val
        else if (bn.key === 'crit') b.crit += bn.val
      }
    }
    const prevMax = p.maxHp
    p.bonus = b
    p.maxHp = 100 + b.hp
    p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - prevMax))
  }

  sendSnap() {
    const p = this.p
    const w = this.curWeapon()
    this.hooks.onSnap({
      hp: Math.ceil(p.hp), maxHp: p.maxHp, credits: p.credits, kills: p.kills,
      nextDrop: this.nextDrop, dropProg: clamp(1 - (this.nextDrop - p.kills) / 20, 0, 1),
      biome: BIOMES[this.biomeAt(p.x, p.y)].name,
      weapons: p.weapons.map((wp) => {
        const ww = wp as Weapon
        return { name: ww.name, rarity: ww.rarity, color: ww.color, dmg: ww.dmg, rate: ww.rate, mag: ww.mag, acc: ww.acc, proj: ww.proj, parts: ww.parts, explosive: ww.explosive, pellets: ww.pellets, pierce: ww.pierce }
      }),
      cur: p.cur, mag: p.mag, magSize: w ? w.mag : 0,
      reload: w && w.mag > 0 ? clamp(1 - p.reloadT / w.reload, 0, 1) : 1,
      reloading: p.reloadT > 0,
      dash: clamp(1 - p.dashCd / 1.05, 0, 1),
      companions: this.companions.length,
      compUpgrades: COMP_UPGRADES.map((u) => this.cu(u.id)),
      time: Math.floor(this.time),
      armor: p.armor.map((a) => a ? { name: (a as Armor).name, color: (a as Armor).color, rarity: (a as Armor).rarity } : null),
      muted: audio.muted,
    })
  }

  // ============================================================
  // ОТРИСОВКА
  // ============================================================
  draw() {
    const ctx = this.ctx
    const W = this.W, H = VIEW_H
    ctx.fillStyle = '#141821'
    ctx.fillRect(0, 0, W, H)
    const shx = (rnd() - 0.5) * this.shake, shy = (rnd() - 0.5) * this.shake
    const ox = Math.round(this.camX - W / 2 + shx), oy = Math.round(this.camY - H / 2 + shy)
    ctx.save()
    ctx.translate(-ox, -oy)
    const cx0 = Math.floor(ox / CHUNK), cx1 = Math.floor((ox + W) / CHUNK)
    const cy0 = Math.floor(oy / CHUNK), cy1 = Math.floor((oy + H) / CHUNK)
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(this.getChunk(cx, cy), cx * CHUNK, cy * CHUNK)
    ctx.fillStyle = BIOMES[this.biomeAt(this.camX, this.camY)].fog
    ctx.fillRect(ox, oy, W, H)

    type D = { y: number; f: () => void }
    const ds: D[] = []
    const t = this.menuT
    for (const c of this.capsules) if (c.x > ox - 40 && c.x < ox + W + 40 && c.y > oy - 40 && c.y < oy + H + 40) ds.push({ y: c.y, f: () => SP.drawCapsule(ctx, { ...c, body: CAPSULE_COLORS[c.cIdx].body, band: CAPSULE_COLORS[c.cIdx].band }, t) })
    for (const pod of this.pods) ds.push({ y: pod.y, f: () => SP.drawGuildPod(ctx, pod, t) })
    for (const pk of this.pickups) ds.push({
      y: pk.y, f: () => {
        if (pk.rej !== undefined) { ctx.globalAlpha = pk.rej < 0.5 ? 0.35 : 0.6; SP.drawPickup(ctx, { ...pk, color: '#4a5a6a' }, t); ctx.globalAlpha = 1 }
        else SP.drawPickup(ctx, pk, t)
      },
    })
    for (const c of this.companions) ds.push({ y: c.y, f: () => { SP.drawCompanion(ctx, c, t); if (c.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(c.x - 5, c.y - 9, 10, 12) } } })
    for (const e of this.enemies) if (e.x > ox - 40 && e.x < ox + W + 40 && e.y > oy - 50 && e.y < oy + H + 40) ds.push({ y: e.y, f: () => { SP.drawEnemy(ctx, e, t); if (e.windup > 0 && (e.type === 'grunt' || e.type === 'brute')) { ctx.fillStyle = `rgba(255,80,60,${0.25 + Math.sin(t * 30) * 0.15})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.type === 'brute' ? 30 : 22, 0, Math.PI * 2); ctx.fill() } if (e.maxHp > 0 && e.hp < e.maxHp) { const w = e.r * 2; SP.px(ctx, e.x - w / 2, e.y - e.r - 12, w, 2, '#1b1f26'); SP.px(ctx, e.x - w / 2, e.y - e.r - 12, Math.max(1, w * (e.hp / e.maxHp)), 2, '#ff5533') } } })
    const p = this.p
    if (!this.dead) ds.push({
      y: p.y, f: () => {
        if (p.iframes > 0 && Math.sin(t * 40) > 0 && this.spawnAnim >= 1) ctx.globalAlpha = 0.45
        const w = this.curWeapon()
        SP.drawPlayer(ctx, { ...p, weaponColor: w ? w.color : '#9aa7b8' }, t)
        ctx.globalAlpha = 1
        if (this.spawnAnim < 1) {
          const k = this.spawnAnim
          ctx.fillStyle = `rgba(125,255,234,${0.5 * (1 - k)})`
          ctx.fillRect(p.x - 8, p.y - 60 * (1 - k) - 12, 16, 60 * (1 - k) + 16)
        }
      },
    })
    ds.sort((a, b) => a.y - b.y)
    for (const d of ds) d.f()

    for (const f of this.fallPods) SP.drawFallingPod(ctx, f.x, f.y, 1 - f.t / f.dur, t)
    for (const b of this.bullets) SP.drawBullet(ctx, b, t)
    for (const pt of this.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1)
      ctx.fillStyle = pt.color
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size)
    }
    ctx.globalAlpha = 1
    for (const w of this.weather) {
      ctx.globalAlpha = clamp(w.life / w.max, 0, 1)
      ctx.fillStyle = w.color
      ctx.fillRect(Math.round(w.x), Math.round(w.y), w.size, w.size)
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.life / 0.4, 0, 1)
      ctx.font = `${f.size}px "Press Start 2P", monospace`
      ctx.fillStyle = '#0f141b'
      ctx.fillText(f.text, f.x + 1, f.y + 1)
      ctx.fillStyle = f.color
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
    ctx.restore()

    if (this.shuttle) {
      const sx = -90 + (this.shuttle.t / 3.6) * (W + 200)
      SP.drawShuttle(ctx, sx, 34 + Math.sin(this.shuttle.t * 2) * 3, t)
    }

    if (!this.dead) {
      const mx = Math.round(this.mouse.x), my = Math.round(this.mouse.y)
      const w = this.curWeapon()
      const cc = w ? w.color : '#3fe0ff'
      ctx.strokeStyle = cc
      ctx.lineWidth = 1
      ctx.strokeRect(mx - 4.5, my - 4.5, 9, 9)
      ctx.fillStyle = cc
      ctx.fillRect(mx - 0.5, my - 7, 1, 3); ctx.fillRect(mx - 0.5, my + 4, 1, 3)
      ctx.fillRect(mx - 7, my - 0.5, 3, 1); ctx.fillRect(mx + 4, my - 0.5, 3, 1)
      if (this.p.reloadT > 0) {
        const w2 = this.curWeapon()!
        ctx.fillStyle = 'rgba(15,20,27,0.7)'
        ctx.fillRect(mx - 10, my + 8, 20, 3)
        ctx.fillStyle = '#ffd54a'
        ctx.fillRect(mx - 10, my + 8, 20 * (1 - this.p.reloadT / w2.reload), 3)
      }
    }

    if (this.hurtT > 0) {
      ctx.fillStyle = `rgba(255,40,20,${this.hurtT * 0.5})`
      ctx.fillRect(0, 0, W, H)
    }
    if (!this.dead && this.p.hp < this.p.maxHp * 0.3) {
      ctx.fillStyle = `rgba(255,40,20,${0.08 + Math.sin(t * 6) * 0.06})`
      ctx.fillRect(0, 0, W, H)
    }

    this.miniT -= 1 / 60
    if (this.miniT <= 0) { this.miniT = 0.1; this.drawMinimap() }
  }

  drawMinimap() {
    const m = this.mini
    if (!m) return
    const g = m.getContext('2d')!
    const S = m.width
    g.fillStyle = 'rgba(10,17,26,0.92)'
    g.fillRect(0, 0, S, S)
    const scale = S / 2 / 300
    const cx = S / 2, cy = S / 2
    const plot = (x: number, y: number, color: string, s: number) => {
      const dx = (x - this.camX) * scale, dy = (y - this.camY) * scale
      if (Math.abs(dx) > S / 2 - 3 || Math.abs(dy) > S / 2 - 3) return
      g.fillStyle = color
      g.fillRect(cx + dx - s / 2, cy + dy - s / 2, s, s)
    }
    for (const c of this.capsules) plot(c.x, c.y, c.special ? '#3fe0ff' : '#ffd54a', c.special ? 4 : 2 + c.size)
    for (const pod of this.pods) if (!pod.opened) plot(pod.x, pod.y, '#7dff5e', 4)
    for (const e of this.enemies) plot(e.x, e.y, '#ff5533', e.type === 'brute' ? 3 : 2)
    for (const c of this.companions) plot(c.x, c.y, '#3fe0ff', 2)
    g.save()
    g.translate(cx, cy)
    g.rotate(this.menuT * 1.6)
    const grad = g.createLinearGradient(0, 0, S / 2, 0)
    grad.addColorStop(0, 'rgba(63,224,255,0.28)')
    grad.addColorStop(1, 'rgba(63,224,255,0)')
    g.fillStyle = grad
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, S / 2, -0.5, 0); g.closePath(); g.fill()
    g.restore()
    g.fillStyle = '#3fe0ff'
    g.fillRect(cx - 1, cy - 2, 2, 4); g.fillRect(cx - 2, cy - 1, 4, 2)
    g.strokeStyle = 'rgba(63,224,255,0.4)'
    g.strokeRect(0.5, 0.5, S - 1, S - 1)
  }

  // ---------- МЕНЮ ----------
  updateMenu(dt: number) {
    for (const s of this.stars) {
      s.x -= s.z * 26 * dt
      if (s.x < -4) { s.x = this.W + 4; s.y = rnd() * VIEW_H }
    }
    if (this.shootStar.life <= 0 && rnd() < 0.004) {
      this.shootStar = { x: this.W * (0.3 + rnd() * 0.7), y: rnd() * 80, vx: -160 - rnd() * 80, vy: 40 + rnd() * 30, life: 0.7 }
    }
    if (this.shootStar.life > 0) {
      this.shootStar.life -= dt
      this.shootStar.x += this.shootStar.vx * dt
      this.shootStar.y += this.shootStar.vy * dt
    }
  }

  drawMenu() {
    const ctx = this.ctx
    const W = this.W, H = VIEW_H
    const t = this.menuT
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#05070f')
    g.addColorStop(0.6, '#0a1020')
    g.addColorStop(1, '#101a2e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(40,60,110,0.14)'
    ctx.fillRect(0, 40 + Math.sin(t * 0.3) * 4, W, 26)
    ctx.fillStyle = 'rgba(90,50,110,0.10)'
    ctx.fillRect(0, 90 + Math.cos(t * 0.24) * 5, W, 18)
    for (const s of this.stars) {
      const tw = 0.4 + Math.abs(Math.sin(t * 2 + s.tw)) * 0.6
      ctx.fillStyle = s.z > 0.7 ? `rgba(220,240,255,${tw})` : `rgba(140,170,210,${tw * 0.7})`
      const sz = s.z > 0.8 ? 2 : 1
      ctx.fillRect(Math.round(s.x), Math.round(s.y), sz, sz)
    }
    if (this.shootStar.life > 0) {
      ctx.strokeStyle = `rgba(220,240,255,${this.shootStar.life})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(this.shootStar.x, this.shootStar.y)
      ctx.lineTo(this.shootStar.x - this.shootStar.vx * 0.08, this.shootStar.y - this.shootStar.vy * 0.08)
      ctx.stroke()
    }
    const pr = W * 0.9
    const pcx = W * 0.5, pcy = H + pr - 46
    const pg = ctx.createRadialGradient(pcx, pcy - pr * 0.1, pr * 0.4, pcx, pcy, pr)
    pg.addColorStop(0, '#2e4a5e')
    pg.addColorStop(0.7, '#1c3040')
    pg.addColorStop(1, '#0e1a26')
    ctx.fillStyle = pg
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.fill()
    ctx.save()
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.clip()
    ctx.fillStyle = 'rgba(245,166,35,0.10)'
    ctx.fillRect(pcx - pr, pcy - pr + 14, pr * 2, 7)
    ctx.fillStyle = 'rgba(63,224,255,0.08)'
    ctx.fillRect(pcx - pr, pcy - pr + 26, pr * 2, 4)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    for (let i = 0; i < 6; i++) ctx.fillRect(pcx - pr + hash2(i, 3, 9) * pr * 2, pcy - pr + 6 + i * 6, 30 + hash2(i, 7, 9) * 60, 3)
    ctx.restore()
    ctx.strokeStyle = 'rgba(63,224,255,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(pcx, pcy, pr + 1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke()
    ctx.strokeStyle = 'rgba(63,224,255,0.18)'
    ctx.beginPath(); ctx.arc(pcx, pcy, pr + 3, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke()

    const beam = this.beamT >= 0 ? clamp(this.beamT, 0, 1) : 0
    SP.drawMenuShip(ctx, W * 0.5, H * 0.42, t, beam)

    if (this.beamT >= 1.05) {
      const k = clamp((this.beamT - 1.05) / 0.3, 0, 1)
      ctx.fillStyle = `rgba(190,255,244,${k})`
      ctx.fillRect(0, 0, W, H)
    }
  }
}
