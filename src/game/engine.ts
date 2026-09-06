// ============================================================
// НАЁМНИК ПУСТОТЫ — движок. Режимы: ship (хаб) -> game (экспедиция)
// ============================================================
import {
  RARITIES, ENEMY_DEFS, COMP_DEFS, COMP_UPGRADES, BIOMES, CAPSULE_COLORS,
  genWeapon, genArmor, rnd, pick, irand, clamp, weaponScore,
  type Weapon, type Armor,
} from './data'
import { audio } from './audio'
import * as SP from './sprites'
import { makeStreams, type RngStreams } from './rng'
import { getRegion, REGIONS, type RegionDef } from './regions'
import { CELL, TILE, WALL_M, POI_DEFS, poiForCell, makeStarterDungeon, dungeonTileAt, setDungeonTile, inDungeonBounds, roomAt, type Poi, type DungeonLayout } from './structures'
import { BOSSES, makeBoss, drawBoss, type BossState } from './bosses'
import { Director } from './director'
import { metaApi, artifactBonuses, PERMANENT_POOL } from './meta'
import { SHIP_W, SHIP_H, drawShipInterior, zoneAt, shipBlocked, type ShipZoneId } from './ship'

const VIEW_H = 240
const CHUNK = 64
const MILESTONES = [20, 45, 80, 130, 200, 300]

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

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }
interface Floater { x: number; y: number; text: string; color: string; life: number; size: number }
interface Bullet { x: number; y: number; vx: number; vy: number; dmg: number; kind: string; color: string; r: number; explosive: number; pierce: boolean; friendly: boolean; life: number; hit: Set<unknown>; pierceLeft?: number }
interface Capsule { x: number; y: number; size: number; shape: number; cIdx: number; hp: number; maxHp: number; special: boolean; phase: number }
interface Pickup { x: number; y: number; vx: number; vy: number; kind: 'coin' | 'weapon' | 'armor' | 'heart' | 'upgrade'; color: string; phase: number; val?: number; weapon?: unknown; armor?: unknown; slot?: number; upIdx?: number; rej?: number }
interface Companion {
  x: number; y: number; kind: string; label: string; def: (typeof COMP_DEFS)[0]
  pal: { main: string; dark: string; accent: string }
  walkT: number; aim: number; phase: number; fireCd: number; flash: number
  perm?: boolean; permUid?: string
  weapon?: { name: string; color: string; dmgBoost: number; rateBoost: number }
}
interface Enemy {
  x: number; y: number; type: string; def: (typeof ENEMY_DEFS)['grunt']
  body: number; head: number; weapon: number; pal: { main: string; dark: string; accent: string }
  hp: number; maxHp: number; speed: number; dmg: number; r: number; flash: number
  windup: number; atkCd: number; aim: number; walkT: number; phase: number
  strafe: number; burst: number; shootT: number; swoopT: number; swoop: number; kbx: number; kby: number
  score: number; poiId?: string; tier: number
}
interface Pod { x: number; y: number; opened: boolean }
interface FallPod { x: number; y: number; t: number; dur: number }

const on = (t: EventTarget, e: string, f: EventListenerOrEventListenerObject, o?: AddEventListenerOptions) => t.addEventListener(e, f, o)

export class Engine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  mini: HTMLCanvasElement | null
  hooks: Hooks
  W = 427
  mode: 'ship' | 'game' = 'ship'
  overlay: 'map' | 'storage' | 'bay' | 'info' | 'inventory' | null = null
  paused = false
  transitioning = false
  beamT = -1
  keys: Record<string, boolean> = {}
  mouse = { x: 213, y: 120, down: false, rdown: false }

  camX = 0; camY = 0; shake = 0; hurtT = 0

  chunks = new Map<string, HTMLCanvasElement>()
  chunkOrder: string[] = []
  obstacles = new Map<string, { x: number; y: number; r: number }[]>()
  materialized = new Set<string>()
  seed = 1
  streams: RngStreams = makeStreams(1)
  region: RegionDef = REGIONS[0]

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
  shuttleWarned = false

  // сцена: мир / интерьер структуры + переход между ними
  scene: 'world' | 'dungeon' = 'world'
  trans: { t: number; dir: 1 | -1; cb: (() => void) | null } | null = null
  doorPoi: Poi | null = null
  exitReady = false

  pois = new Map<string, Poi | null>()
  activatedPois = new Set<string>()
  touchedRelays = new Set<string>()
  activeDungeonPoi: Poi | null = null
  boss: BossState | null = null
  director = new Director()

  contract = { kills: 0, idx: 0 }
  runPermanents: string[] = []
  runBosses = 0
  banked = false

  p = this.freshPlayer()
  permBonus = { hp: 0, dmg: 0, rate: 0, acc: 0 }
  spawnAnim = 0
  dead = false
  deadT = 0
  time = 0
  spawnT = 0
  snapT = 0
  spawnEnemyT = 0
  landingOffset = { x: 0, y: 0 }
  weatherT = 0
  miniT = 0
  poiT = 0

  shipP = { x: SHIP_W / 2, y: 150 }
  shipZone: ShipZoneId | null = null
  medCd = 0

  debugOpen = false
  god = false

  stars: { x: number; y: number; z: number; tw: number }[] = []
  menuT = 0

  listeners: [EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions?][] = []
  raf = 0
  last = 0
  destroyed = false

  constructor(canvas: HTMLCanvasElement, mini: HTMLCanvasElement | null, hooks: Hooks) {
    this.canvas = canvas
    this.mini = mini
    this.ctx = canvas.getContext('2d')!
    this.hooks = hooks
    metaApi.boot()
    audio.muted = metaApi.state.settings.muted
    this.resize()
    for (let i = 0; i < 130; i++) this.stars.push({ x: rnd() * 600, y: rnd() * VIEW_H, z: 0.25 + rnd() * 0.75, tw: rnd() * 6 })
    this.bind()
    this.last = performance.now()
    const loop = (t: number) => {
      if (this.destroyed) return
      this.raf = requestAnimationFrame(loop)
      const dt = Math.min(0.033, (t - this.last) / 1000)
      this.last = t
      this.tick(dt)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    for (const [t, e, f] of this.listeners) t.removeEventListener(e, f)
    this.listeners = []
    metaApi.persist()
  }

  bind() {
    on(window, 'resize', () => this.resize())
    on(window, 'keydown', ((e: KeyboardEvent) => {
      this.keys[e.code] = true
      if (e.code === 'Space') e.preventDefault()
      if (e.code === 'F9') { e.preventDefault(); this.debugOpen = !this.debugOpen; return }
      if (e.code === 'Escape') {
        if (this.overlay) { this.overlay = null; return }
        if (this.mode === 'game' && !this.dead) { this.paused = !this.paused; this.hooks.onPause(this.paused) }
        return
      }
      if (this.mode === 'ship') { if (e.code === 'KeyE') this.shipInteract(); return }
      if (this.mode !== 'game') return
      if (e.code === 'Tab') { e.preventDefault(); if (!this.paused) this.overlay = this.overlay === 'inventory' ? null : 'inventory'; return }
      if (e.code === 'KeyR') this.startReload()
      if (e.code === 'KeyM') { audio.toggleMute(); metaApi.state.settings.muted = audio.muted; metaApi.persist() }
      if (e.code === 'KeyE') {
        if (this.scene === 'dungeon' && this.exitReady) this.exitDungeon()
        else if (this.scene === 'world' && this.doorPoi) this.enterDungeon(this.doorPoi)
        else this.tryOpenPod()
      }
      if (/^Digit[1-5]$/.test(e.code)) this.switchTo(+e.code.slice(5) - 1)
    }) as EventListener)
    on(window, 'keyup', ((e: KeyboardEvent) => { this.keys[e.code] = false }) as EventListener)
    on(this.canvas, 'mousemove', ((e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect()
      this.mouse.x = (e.clientX - r.left) * (this.W / r.width)
      this.mouse.y = (e.clientY - r.top) * (VIEW_H / r.height)
    }) as EventListener)
    on(this.canvas, 'mousedown', ((e: MouseEvent) => {
      audio.ensure()
      if (e.button === 0) this.mouse.down = true
      if (e.button === 2) { this.mouse.rdown = true; if (this.mode === 'game' && !this.paused) this.trySlash() }
    }) as EventListener)
    on(window, 'mouseup', ((e: MouseEvent) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.rdown = false }) as EventListener)
    on(this.canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener)
    on(window, 'wheel', ((e: WheelEvent) => {
      if (this.mode !== 'game' || this.overlay) return
      e.preventDefault()
      const w = this.p.weapons
      if (w.length > 1) this.switchTo((this.p.cur + (e.deltaY > 0 ? 1 : -1) + w.length) % w.length)
    }) as EventListener, { passive: false })
    on(window, 'beforeunload', () => metaApi.persist())
  }

  resize() {
    const vw = Math.max(320, Math.round((VIEW_H * window.innerWidth) / window.innerHeight))
    this.W = vw
    this.canvas.width = vw
    this.canvas.height = VIEW_H
    this.ctx.imageSmoothingEnabled = false
  }

  // ============================================================
  // КОРАБЛЬ
  // ============================================================
  updateShip(dt: number) {
    const s = this.shipP
    let mx = 0, my = 0
    if (this.keys.KeyW || this.keys.ArrowUp) my -= 1
    if (this.keys.KeyS || this.keys.ArrowDown) my += 1
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1
    if (mx && my) { mx *= 0.707; my *= 0.707 }
    const sp = 62
    const nx = clamp(s.x + mx * sp * dt, 16, SHIP_W - 16)
    const ny = clamp(s.y + my * sp * dt, 16, SHIP_H - 16)
    if (!shipBlocked(nx, s.y, 4)) s.x = nx
    if (!shipBlocked(s.x, ny, 4)) s.y = ny
    const z = zoneAt(s.x, s.y)
    const zid = z ? z.id : null
    if (zid !== this.shipZone) { this.shipZone = zid; if (zid) audio.zoneBlip() }
    this.medCd -= dt
    this.camX = SHIP_W / 2
    this.camY = SHIP_H / 2 + 10
  }

  shipInteract() {
    const z = this.shipZone
    if (!z) return
    audio.ensure(); audio.click()
    if (z === 'nav') this.overlay = 'map'
    else if (z === 'armory' || z === 'storage') this.overlay = 'storage'
    else if (z === 'bay') this.overlay = 'bay'
    else if (z === 'info') this.overlay = 'info'
    else if (z === 'med') {
      if (this.medCd <= 0) { this.medCd = 4; audio.heal(); this.hooks.onToast({ text: 'МЕДОТСЕК: СОСТОЯНИЕ СТАБИЛЬНО', color: '#ff5e8a' }) }
    }
  }

  closeOverlay() { this.overlay = null }
  toggleDeploy(uid: string, max: number) {
    const before = metaApi.state.deployed.includes(uid)
    const ok = metaApi.toggleDeploy(uid, max)
    if (before) this.hooks.onToast({ text: 'КОМПАНЬОН ОСТАЛСЯ НА КОРАБЛЕ', color: '#9aa7b8' })
    else if (ok) this.hooks.onToast({ text: 'КОМПАНЬОН ЗАЧИСЛЕН В ОТРЯД', color: '#7dff5e' })
    else this.hooks.onToast({ text: `ОТРЯД ПОЛОН (МАКС. ${max})`, color: '#ff5533' })
  }

  // ============================================================
  // ЭКСПЕДИЦИЯ
  // ============================================================
  beginLaunch() { this.overlay = 'map' }

  launchExpedition(regionId: string, site = 0) {
    const region = getRegion(regionId)
    this.region = region
    this.seed = (Date.now() % 1000000) + 1
    this.streams = makeStreams(this.seed)
    // детерминированная точка высадки вблизи стартового комплекса
    const lz = this.streams.world
    this.landingOffset = { x: (site - 1) * 90 + lz.range(-30, 30), y: lz.range(-30, 30) }
    this.chunks.clear(); this.chunkOrder = []; this.obstacles.clear(); this.materialized.clear()
    this.enemies = []; this.bullets = []; this.particles = []; this.floaters = []
    this.capsules = []; this.pickups = []; this.companions = []; this.pods = []
    this.fallPods = []; this.weather = []; this.shuttle = null
    this.pois.clear(); this.activatedPois.clear(); this.touchedRelays.clear()
    this.activeDungeonPoi = null; this.boss = null
    this.director.reset()
    this.contract = { kills: 0, idx: 0 }
    this.runPermanents = []; this.runBosses = 0
    this.banked = false
    this.compUp = {}
    this.p = this.freshPlayer()
    this.permBonus = artifactBonuses(metaApi.state.artifacts)
    this.recalcBonuses()
    const w = genWeapon(0, region.lootBias.kits[0] ?? 0)
    this.p.weapons = [w]
    this.p.mag = w.mag
    this.time = 0; this.spawnT = 0; this.dead = false; this.deadT = 0
    this.p.x = this.landingOffset.x; this.p.y = this.landingOffset.y
    this.spawnAnim = 0.001; this.camX = this.p.x; this.camY = this.p.y; this.shake = 0
    this.spawnEnemyT = 3
    const starter = makeStarterDungeon(this.seed, region)
    this.pois.set('starter', starter)
    this.capsules.push(this.makeCapsule(this.p.x + 200, this.p.y + 160, 1, false))
    for (const uid of metaApi.state.deployed) {
      const pc = metaApi.state.companions.find((c) => c.uid === uid)
      if (pc) this.spawnCompanion(this.p.x + 40 * rnd() - 20, this.p.y + 40 * rnd() - 20, pc.defKind, pc.name, true, pc.uid)
    }
    this.mode = 'game'
    this.overlay = null
    this.paused = false
    this.transitioning = false
    this.beamT = -1
    this.hooks.onStart()
    this.hooks.onToast({ text: `ЭКСПЕДИЦИЯ: ${region.name}`, color: region.color })
    window.setTimeout(() => this.hooks.onToast({ text: 'СИГНАЛ: КОМПЛЕКС ОБНАРУЖЕН НА СЕВЕРО-ВОСТОКЕ', color: '#3fe0ff' }), 2600)
    this.burst(this.p.x, this.p.y, 26, '#7dffea', 3)
    audio.teleport()
  }

  // Идемпотентный учёт итогов экспедиции: кредиты и статистика банятся один раз
  // (и при эвакуации, и при смерти — без двойного начисления)
  bankExpedition() {
    if (this.banked) return
    this.banked = true
    metaApi.earnCredits(this.p.credits)
    metaApi.bumpStats(this.contract.kills, this.runBosses)
  }

  returnToShip() {
    this.bankExpedition()
    this.mode = 'ship'
    this.overlay = null
    this.paused = false
    this.hooks.onPause(false)
    this.shipP = { x: SHIP_W / 2, y: 150 }
    this.boss = null
    this.hooks.onToast({ text: 'ВОЗВРАЩЕНИЕ НА КОРАБЛЬ. ТРОФЕИ СОХРАНЕНЫ', color: '#3fe0ff' })
  }

  evacuate() {
    this.hooks.onToast({ text: 'ЭВАКУАЦИЯ: ВРЕМЕННОЕ СНАРЯЖЕНИЕ ОСТАВЛЕНО', color: '#ffd54a' })
    this.returnToShip()
  }

  // ============================================================
  // ИГРОК
  // ============================================================
  freshPlayer() {
    return {
      x: 0, y: 0, hp: 100, maxHp: 100, credits: 0, aim: 0, walkT: 0,
      weapons: [] as unknown[], cur: 0, mag: 0, fireCd: 0, reloadT: 0,
      slashT: 0, slashCd: 0, dashT: 0, dashCd: 0, dashVX: 0, dashVY: 0,
      iframes: 0, regenDelay: 0, chestColor: '#5e6e7e',
      bonus: { hp: 0, dmg: 0, rate: 0, speed: 0, acc: 0, crit: 5 },
      armor: [null, null, null, null] as unknown[],
    }
  }

  cu(id: string): number { return this.compUp[id] || 0 }
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

  startReload() {
    const p = this.p
    const w = this.curWeapon()
    if (!w || p.reloadT > 0 || p.mag >= w.mag) return
    p.reloadT = w.reload
    audio.reload()
  }

  biomeAt(x: number, y: number) {
    if (this.mode !== 'game') return 0
    const n = vnoise(x * 0.0021, y * 0.0021, this.seed + 77)
    if (n < 0.22) return this.region.biomeAlt
    if (n > 0.85) return (this.region.biome + 2) % 6
    return this.region.biome
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
      if (this.chunkOrder.length > 260) { const old = this.chunkOrder.shift()!; this.chunks.delete(old) }
    }
    return c
  }

  renderChunk(c: HTMLCanvasElement, cx: number, cy: number) {
    const g = c.getContext('2d')!
    const wx0 = cx * CHUNK, wy0 = cy * CHUNK
    for (let y = 0; y < CHUNK; y += 2) for (let x = 0; x < CHUNK; x += 2) {
      g.fillStyle = this.groundColor(this.biomeAt(wx0 + x, wy0 + y), wx0 + x, wy0 + y)
      g.fillRect(x, y, 2, 2)
    }
    for (let i = 0; i < 5; i++) {
      const rx = hash2(cx, cy, this.seed + i * 3) * CHUNK
      const ry = hash2(cy, cx, this.seed + i * 5) * CHUNK
      const b = this.biomeAt(wx0 + rx, wy0 + ry)
      g.fillStyle = BIOMES[b].crack
      g.globalAlpha = 0.5
      let px2 = rx, py2 = ry
      for (let s = 0; s < 8; s++) {
        g.fillRect(px2, py2, 2, 1)
        px2 += (hash2(px2, py2, this.seed) - 0.5) * 5
        py2 += (hash2(py2, px2, this.seed) - 0.4) * 4
      }
      g.globalAlpha = 1
    }
    const key = this.chunkKey(cx, cy)
    if (!this.materialized.has(key)) {
      this.materialized.add(key)
      const obs: { x: number; y: number; r: number }[] = []
      const n = 2 + Math.floor(hash2(cx, cy, this.seed + 99) * 4)
      for (let i = 0; i < n; i++) {
        const rx = hash2(cx * 3 + i, cy, this.seed + 7) * CHUNK
        const ry = hash2(cx, cy * 3 + i, this.seed + 13) * CHUNK
        if (hash2(i, cx + cy, this.seed) < 0.3) obs.push({ x: wx0 + rx, y: wy0 + ry, r: 4 + hash2(i, cx, this.seed + 21) * 6 })
      }
      if (obs.length) this.obstacles.set(key, obs)
    }
    const obs = this.obstacles.get(key)
    if (obs) for (const o of obs) {
      const dec = BIOMES[this.biomeAt(o.x, o.y)].decos
      const lx = o.x - wx0, ly = o.y - wy0
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.beginPath(); g.ellipse(lx, ly + o.r * 0.4, o.r, o.r * 0.4, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = dec[0]; g.fillRect(lx - o.r, ly - o.r * 1.4, o.r * 2, o.r * 1.6)
      g.fillStyle = dec[1]; g.fillRect(lx - o.r, ly - o.r * 1.4, o.r * 2, 2)
      g.fillStyle = dec[2]; g.fillRect(lx - o.r * 0.5, ly - o.r * 1.1, 2, 2)
    }
  }

  nearObstacles(x: number, y: number, rad: number) {
    const out: { x: number; y: number; r: number }[] = []
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK)
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
      const obs = this.obstacles.get(this.chunkKey(i, j))
      if (obs) for (const o of obs) if (Math.abs(o.x - x) < rad + o.r && Math.abs(o.y - y) < rad + o.r) out.push(o)
    }
    return out
  }

  pushOut(e: { x: number; y: number }, r: number) {
    // внутри данжа поверхностные препятствия не действуют
    if (this.activeDungeonPoi) return
    for (const o of this.nearObstacles(e.x, e.y, r + 10)) {
      const dx = e.x - o.x, dy = e.y - o.y
      const d = Math.hypot(dx, dy)
      const min = o.r + r
      if (d < min && d > 0.01) { e.x = o.x + (dx / d) * min; e.y = o.y + (dy / d) * min }
    }
  }

  /** Визуальный профиль оружия для спрайт-сборки */
  wv(o: unknown): SP.WeaponVisual | null {
    if (!o) return null
    const w = o as Weapon
    return { proj: w.proj, kitIdx: w.kitIdx, rarity: w.rarity, color: w.color, pellets: w.pellets, explosive: w.explosive, pierce: w.pierce }
  }

  /** Движение сущности: на поверхности — pushOut, в данже — скольжение вдоль стен */
  moveEnt(e: { x: number; y: number }, mx: number, my: number, r: number) {
    if (!this.activeDungeonPoi) {
      // внешний мир: стены структур непроходимы (кроме дверного проёма)
      const nx = e.x + mx
      if (!this.structureBlocked(nx, e.y, r)) e.x = nx
      const ny = e.y + my
      if (!this.structureBlocked(e.x, ny, r)) e.y = ny
      this.pushOut(e, r)
      return
    }
    const poi = this.activeDungeonPoi
    const ok = (x: number, y: number) =>
      !this.tileSolidP(poi, x - r, y) && !this.tileSolidP(poi, x + r, y) &&
      !this.tileSolidP(poi, x, y - r) && !this.tileSolidP(poi, x, y + r)
    if (ok(e.x + mx, e.y + my)) { e.x += mx; e.y += my; return }
    if (mx !== 0 && ok(e.x + mx, e.y)) { e.x += mx; return }
    if (my !== 0 && ok(e.x, e.y + my)) e.y += my
  }

  tileSolidP(poi: Poi, wx: number, wy: number): boolean {
    const d = poi.dungeon!
    const t = dungeonTileAt(d, wx, wy)
    if (t === 1) return true
    if (t === 2) return !d.door.open
    if (t === 4) {
      const tx = Math.floor((wx - d.ox) / TILE), ty = Math.floor((wy - d.oy) / TILE)
      return (poi.ds!.breakHp[`${tx}_${ty}`] ?? 3) > 0
    }
    return false
  }

  collideDungeon(e: { x: number; y: number }, r: number) {
    const poi = this.activeDungeonPoi
    if (!poi || !poi.dungeon) return
    const d = poi.dungeon
    const pts: [number, number][] = [[e.x - r, e.y], [e.x + r, e.y], [e.x, e.y - r], [e.x, e.y + r]]
    for (const [ptx, pty] of pts) {
      if (!this.tileSolidP(poi, ptx, pty)) continue
      const tx = Math.floor((ptx - d.ox) / TILE), ty = Math.floor((pty - d.oy) / TILE)
      const ccx = d.ox + tx * TILE + TILE / 2, ccy = d.oy + ty * TILE + TILE / 2
      const dx = e.x - ccx, dy = e.y - ccy
      if (Math.abs(dx) > Math.abs(dy)) e.x = dx > 0 ? d.ox + (tx + 1) * TILE + r : d.ox + tx * TILE - r
      else e.y = dy > 0 ? d.oy + (ty + 1) * TILE + r : d.oy + ty * TILE - r
    }
  }

  hitDungeonTile(wx: number, wy: number): boolean {
    const poi = this.activeDungeonPoi
    if (!poi || !poi.dungeon) return false
    const t = dungeonTileAt(poi.dungeon, wx, wy)
    if (t === 4) {
      const tx = Math.floor((wx - poi.dungeon.ox) / TILE), ty = Math.floor((wy - poi.dungeon.oy) / TILE)
      const k = `${tx}_${ty}`
      const hp = (poi.ds!.breakHp[k] ?? 3) - 1
      poi.ds!.breakHp[k] = hp
      this.burst(wx, wy, 4, '#8a6a4a', 1.2)
      audio.capsuleHit()
      if (hp <= 0) {
        setDungeonTile(poi.dungeon, wx, wy, 0)
        this.burst(wx, wy, 10, '#c89a6e', 2)
        this.hooks.onToast({ text: 'ПРОЛОМ: НАЙДЕН ТАЙНИК', color: '#ffd54a' })
      }
      return true
    }
    return t === 1 || (t === 2 && !poi.dungeon.door.open)
  }

  // ============================================================
  // ЦИКЛ
  // ============================================================
  tick(dt: number) {
    this.menuT += dt
    if (this.mode === 'ship') {
      this.updateShip(dt)
      for (const s of this.stars) { s.x -= s.z * 12 * dt; if (s.x < -4) { s.x = this.W + 4; s.y = rnd() * VIEW_H } }
      this.drawShipMode()
    } else {
      if (!this.paused) {
        this.time += dt
        if (!this.dead) { this.updatePlayer(dt); this.updateCompanions(dt) }
        else {
          this.deadT += dt
          if (this.deadT > 1.6 && this.deadT < 900) {
            this.deadT = 1000
            this.bankExpedition()
            this.hooks.onDeath({
              kills: this.contract.kills, credits: this.p.credits, time: Math.floor(this.time),
              companions: this.companions.length, permanents: [...this.runPermanents],
            })
          }
        }
        this.updateDirector(dt)
        this.updateEnemies(dt)
        this.updateBoss(dt)
        this.updateBullets(dt)
        this.updatePickups(dt)
        this.updateCapsulesAndPods(dt)
        this.updateParticles(dt)
        this.updateWeather(dt)
        this.updateShuttle(dt)
        this.updatePois(dt)
        if (this.spawnAnim < 1) this.spawnAnim = Math.min(1, this.spawnAnim + dt * 1.4)
      }
      this.updateTrans(dt)
      const p = this.p
      this.camX += (p.x - this.camX) * Math.min(1, dt * 8)
      this.camY += (p.y - this.camY) * Math.min(1, dt * 8)
      this.shake = Math.max(0, this.shake - dt * 14)
      this.hurtT = Math.max(0, this.hurtT - dt * 2.4)
      this.draw()
    }
    this.snapT -= dt
    if (this.snapT <= 0) { this.snapT = 0.12; this.emitSnap() }
  }

  updateDirector(dt: number) {
    if (this.dead) return
    const p = this.p
    const power = ((p.bonus.dmg + 100) / 100) * (1 + this.contract.kills / 200)
    const ctx = { time: this.time, kills: this.contract.kills, playerPower: power, region: this.region, inDungeon: !!this.activeDungeonPoi, enemyCount: this.enemies.length, nearHostilePoi: this.nearHostilePoi() }
    this.director.update(dt, ctx)
    const dec = this.director.decide(ctx)
    this.spawnEnemyT -= dt
    if (dec.allowed && this.spawnEnemyT <= 0) {
      this.spawnEnemyT = dec.interval
      for (let i = 0; i < dec.packSize; i++) {
        const a = rnd() * Math.PI * 2
        const d = 170 + rnd() * 80
        this.spawnEnemy(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, rnd() < dec.eliteChance ? 'brute' : undefined, dec.tier)
      }
    }
  }

  nearHostilePoi(): boolean {
    const p = this.p
    for (const poi of this.pois.values()) {
      if (!poi || poi.state !== 'hostile') continue
      if (poi.dungeon) {
        const fp = poi.fp
        const ddx = Math.max(fp.x - p.x, 0, p.x - (fp.x + fp.w))
        const ddy = Math.max(fp.y - p.y, 0, p.y - (fp.y + fp.h))
        if (Math.hypot(ddx, ddy) < 130) return true
      } else if (Math.hypot(poi.x - p.x, poi.y - p.y) < POI_DEFS[poi.type].radius + 60) return true
    }
    return false
  }

  // ============================================================
  // СЦЕНЫ: ВХОД / ВЫХОД ИЗ СТРУКТУР
  // ============================================================
  startTrans(cb: () => void) {
    this.trans = { t: 0, dir: 1, cb }
    audio.zoneBlip()
  }
  updateTrans(dt: number) {
    const tr = this.trans
    if (!tr) return
    tr.t += tr.dir * dt * 3.2
    if (tr.dir === 1 && tr.t >= 1) { tr.t = 1; if (tr.cb) { tr.cb(); tr.cb = null }; tr.dir = -1 }
    else if (tr.dir === -1 && tr.t <= 0) this.trans = null
  }

  applyEnter(poi: Poi) {
    this.scene = 'dungeon'
    this.activeDungeonPoi = poi
    this.enemies = []
    const d = poi.dungeon!
    this.p.x = d.ox + d.entry.x
    this.p.y = d.oy + d.entry.y
    this.camX = this.p.x; this.camY = this.p.y
    if (!poi.ds!.spawned) {
      poi.ds!.spawned = true
      for (const s of d.spawns) this.spawnEnemy(d.ox + s.x, d.oy + s.y, undefined, this.region.tier * (1 + s.tier * 0.25))
      for (const c of d.containers) this.capsules.push(this.makeCapsule(d.ox + c.x, d.oy + c.y, clamp(c.tier - 1, 0, 3), false))
      this.capsules.push(this.makeCapsule(d.ox + d.secretCache.x, d.oy + d.secretCache.y, clamp(d.secretCache.tier - 1, 0, 3), false))
    }
    for (const c of this.companions) { c.x = this.p.x + (rnd() - 0.5) * 30; c.y = this.p.y + (rnd() - 0.5) * 30 }
    this.hooks.onToast({ text: `ВНУТРИ: ${POI_DEFS[poi.type].label}`, color: '#3fe0ff' })
    audio.doorOpen()
  }
  applyExit() {
    const poi = this.activeDungeonPoi
    if (!poi) return
    this.scene = 'world'
    this.p.x = poi.doorWorld.x
    this.p.y = poi.doorWorld.y + 4
    this.camX = this.p.x; this.camY = this.p.y
    this.activeDungeonPoi = null
    this.enemies = []
    for (const c of this.companions) { c.x = this.p.x + (rnd() - 0.5) * 30; c.y = this.p.y + (rnd() - 0.5) * 30 }
    this.hooks.onToast({ text: 'ВЫХОД НА ПОВЕРХНОСТЬ', color: '#9aa7b8' })
  }

  /** Игрок у внешней двери — войти в интерьер */
  enterDungeon(poi: Poi) {
    if (!poi.dungeon || !poi.ds) return
    this.startTrans(() => this.applyEnter(poi))
  }
  /** Игрок у внутренней двери — выйти наружу */
  exitDungeon() {
    if (!this.activeDungeonPoi) return
    this.startTrans(() => this.applyExit())
  }

  /** Блокируют ли внешние стены структур движение (кроме дверного проёма) */
  structureBlocked(x: number, y: number, r: number): boolean {
    if (this.scene !== 'world') return false
    for (const poi of this.pois.values()) {
      if (!poi || !poi.dungeon) continue
      const fp = poi.fp
      if (x + r < fp.x || x - r > fp.x + fp.w || y + r < fp.y || y - r > fp.y + fp.h) continue
      // внутри footprint — блокируем, кроме дверного проёма снизу
      const doorHalf = 12
      if (y > fp.y + fp.h - WALL_M - r && Math.abs(x - poi.doorWorld.x) < doorHalf) continue
      return true
    }
    return false
  }

  // ============================================================
  // POI / ДАНЖИ
  // ============================================================
  updatePois(dt: number) {
    this.poiT -= dt
    const p = this.p
    if (this.poiT <= 0) {
      this.poiT = 0.4
      const pcx = Math.floor(p.x / CELL), pcy = Math.floor(p.y / CELL)
      for (let cy = pcy - 2; cy <= pcy + 2; cy++) for (let cx = pcx - 2; cx <= pcx + 2; cx++) {
        const key = `${cx}_${cy}`
        if (!this.pois.has(key)) this.pois.set(key, poiForCell(this.seed, this.region, cx, cy))
      }
      if (this.pois.size > 320) {
        for (const [k, v] of this.pois) {
          if (!v || k === 'starter') continue
          if (Math.hypot(v.x - p.x, v.y - p.y) > CELL * 3.2) this.pois.delete(k)
        }
      }
    }
    // --- мир: двери структур (промпт входа) + враждебные POI + реле ---
    this.doorPoi = null
    this.exitReady = false
    if (this.scene === 'world') {
      for (const poi of this.pois.values()) {
        if (!poi) continue
        if (poi.dungeon && Math.hypot(poi.doorWorld.x - p.x, poi.doorWorld.y - p.y) < 26) this.doorPoi = poi
        if (poi.state === 'hostile' && !this.activatedPois.has(poi.id)) {
          let near: boolean
          if (poi.dungeon) {
            const fp = poi.fp
            const ddx = Math.max(fp.x - p.x, 0, p.x - (fp.x + fp.w))
            const ddy = Math.max(fp.y - p.y, 0, p.y - (fp.y + fp.h))
            near = Math.hypot(ddx, ddy) < 70
          } else near = Math.hypot(poi.x - p.x, poi.y - p.y) < POI_DEFS[poi.type].radius
          if (near) {
            this.activatedPois.add(poi.id)
            this.hooks.onToast({ text: `${POI_DEFS[poi.type].label}: ПРОТИВНИК ЗАМЕТИЛ ВАС`, color: '#ff5533' })
            audio.alarm()
            for (let i = 0; i < poi.guards; i++) {
              const a = rnd() * Math.PI * 2
              this.spawnEnemy(poi.x + Math.cos(a) * 40, poi.y + Math.sin(a) * 40, undefined, this.region.tier * 1.1, poi.id)
            }
          }
        }
        if (poi.type === 'relay' && poi.state === 'neutral' && !this.touchedRelays.has(poi.id)) {
          if (Math.hypot(poi.x - p.x, poi.y - p.y) < 26) {
            this.touchedRelays.add(poi.id)
            const cr = irand(25, 60)
            p.credits += cr
            audio.coin()
            this.floaters.push({ x: p.x, y: p.y - 18, text: `+${cr} ДАННЫЕ`, color: '#3fe0ff', life: 1, size: 6 })
            this.hooks.onToast({ text: 'РЕЛЕ: КООРДИНАТЫ ПЕРЕДАНЫ ГИЛЬДИИ', color: '#3fe0ff' })
          }
        }
      }
    } else if (this.activeDungeonPoi?.dungeon) {
      // --- интерьер: промпт выхода у входного шлюза ---
      const d = this.activeDungeonPoi.dungeon
      if (Math.hypot(d.ox + d.entry.x - p.x, d.oy + d.entry.y - p.y) < 28) this.exitReady = true
    }
    const dp = this.activeDungeonPoi
    if (dp && dp.dungeon && dp.ds) {
      const d = dp.dungeon
      let allOn = true
      for (let i = 0; i < d.switches.length; i++) {
        const s = d.switches[i]
        if (!s.on && Math.hypot(s.x - p.x, s.y - p.y) < 10) {
          s.on = true
          dp.ds.switches[i] = true
          audio.switchOn()
          this.burst(s.x, s.y, 8, '#7dff5e', 1.6)
          this.floaters.push({ x: s.x, y: s.y - 12, text: 'РУБИЛЬНИК ВКЛ', color: '#7dff5e', life: 0.9, size: 6 })
        }
        if (!s.on) allOn = false
      }
      if (allOn && !d.door.open) {
        d.door.open = true
        dp.ds.doorOpen = true
        audio.doorOpen()
        this.hooks.onToast({ text: 'ЗАПОР СНЯТ: ЗОНА ЯДРА ДОСТУПНА', color: '#ffd54a' })
        this.shake = Math.max(this.shake, 2)
      }
      const t = this.menuT
      for (let ty = 0; ty < d.rows; ty++) for (let tx = 0; tx < d.cols; tx++) {
        if (d.tiles[ty * d.cols + tx] !== 5) continue
        const hx = d.ox + tx * TILE + 8, hy = d.oy + ty * TILE + 8
        if ((t + hash2(tx, ty, this.seed) * 2.2) % 2.2 > 1.85 && Math.hypot(hx - p.x, hy - p.y) < 15) {
          this.damagePlayer(12)
          this.burst(hx, hy, 6, '#ff5533', 1.4)
        }
      }
      if (d.door.open && !dp.ds.bossSpawned && !dp.ds.cleared && !this.boss) {
        const br = d.rooms.find((r) => r.kind === 'boss')!
        const bx0 = d.ox + br.x * TILE, by0 = d.oy + br.y * TILE
        if (p.x > bx0 && p.x < bx0 + br.w * TILE && p.y > by0 && p.y < by0 + br.h * TILE) {
          dp.ds.bossSpawned = true
          this.boss = makeBoss(BOSSES.warden, d.ox + d.bossCenter.x, d.oy + d.bossCenter.y)
          audio.bossRoar()
          this.shake = Math.max(this.shake, 4)
          this.hooks.onToast({ text: 'СТРАЖ «ЦЕРБЕР»: ОБНАРУЖЕН ВТОРЖЕНЕЦ', color: '#ff5533' })
        }
      }
    }
  }

  // ============================================================
  // ВРАГИ
  // ============================================================
  spawnEnemy(x?: number, y?: number, forceType?: string, tier = 1, poiId?: string) {
    if (this.enemies.length > 60) return
    const p = this.p
    let ex = x ?? p.x + (rnd() < 0.5 ? -1 : 1) * (150 + rnd() * 90)
    let ey = y ?? p.y + (rnd() - 0.5) * 220
    // не спавнить внутри непроходимых структур
    if (this.scene === 'world') {
      for (const poi of this.pois.values()) {
        if (!poi || !poi.dungeon) continue
        const fp = poi.fp
        if (ex > fp.x - 8 && ex < fp.x + fp.w + 8 && ey > fp.y - 8 && ey < fp.y + fp.h + 8) {
          const a = rnd() * Math.PI * 2
          const R = Math.max(fp.w, fp.h) / 2 + 40
          ex = poi.x + Math.cos(a) * R
          ey = poi.y + Math.sin(a) * R * 0.7
        }
      }
    }
    let type = forceType
    if (!type) {
      const w = this.region.enemies
      let total = 0
      for (const k in w) total += w[k]
      let roll = rnd() * total
      type = 'grunt'
      for (const k in w) { roll -= w[k]; if (roll <= 0) { type = k; break } }
    }
    const def = ENEMY_DEFS[type]
    const timeK = 1 + this.time / 480
    const hp = Math.round(def.hp * tier * timeK)
    this.enemies.push({
      x: ex, y: ey, type, def,
      body: irand(0, def.bodies.length - 1), head: irand(0, def.heads.length - 1), weapon: irand(0, def.weapons.length - 1),
      pal: pick(def.palettes), hp, maxHp: hp,
      speed: def.speed * (0.9 + rnd() * 0.25) * (type === 'flyer' ? 1 : Math.min(1.25, 0.85 + tier * 0.15)),
      dmg: Math.round(def.dmg * Math.sqrt(tier) * (0.9 + rnd() * 0.2)),
      r: def.r, flash: 0, windup: 0, atkCd: 1 + rnd(), aim: 0, walkT: rnd() * 6, phase: rnd() * 6,
      strafe: rnd() < 0.5 ? 1 : -1, burst: 0, shootT: 0, swoopT: 2 + rnd() * 3, swoop: 0, kbx: 0, kby: 0,
      score: def.score, poiId, tier,
    })
  }

  damageEnemy(e: Enemy, dmg: number) {
    e.hp -= dmg
    e.flash = 0.12
    this.burst(e.x, e.y, 3, e.pal.accent, 1.4)
    audio.hit()
    if (e.hp <= 0) this.killEnemy(e)
  }

  killEnemy(e: Enemy) {
    const i = this.enemies.indexOf(e)
    if (i >= 0) this.enemies.splice(i, 1)
    const p = this.p
    this.contract.kills++
    metaApi.state.stats.kills++
    this.burst(e.x, e.y, 14, e.pal.accent, 2.2)
    this.burst(e.x, e.y, 8, '#ff8a3d', 2.6)
    audio.explode()
    this.shake = Math.max(this.shake, e.type === 'brute' ? 3 : 1.4)
    const pay = Math.round((4 + e.def.score * 0.4) * this.region.tier)
    p.credits += pay
    this.floaters.push({ x: e.x, y: e.y - 14, text: `+${pay}`, color: '#ffd54a', life: 0.7, size: 6 })
    this.checkMilestone()
    if (e.poiId) {
      const poi = [...this.pois.values()].find((v) => v && v.id === e.poiId)
      if (poi) {
        poi.guardsLeft--
        if (poi.guardsLeft <= 0 && poi.state !== 'cleared') {
          poi.state = 'cleared'
          this.hooks.onToast({ text: `${POI_DEFS[poi.type].label} ЗАЧИЩЕН`, color: '#7dff5e' })
          this.capsules.push(this.makeCapsule(poi.x, poi.y, irand(1, 2), false))
          p.credits += 60
        }
      }
    }
    const r = rnd()
    if (r < 0.44) this.dropCoins(e.x, e.y, irand(1, 2) + (e.type === 'brute' ? 2 : 0), e.type === 'brute' ? 2 : 1)
    else if (r < 0.52) this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'weapon', color: RARITIES[1].color, phase: rnd() * 6, weapon: this.genRegionWeapon(rnd() < 0.8 ? 1 : 2) })
    else if (r < 0.58) { const a = genArmor(rnd() < 0.8 ? 1 : 2); this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'armor', color: a.color, phase: rnd() * 6, armor: a, slot: ['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'].indexOf(a.slot) }) }
    else if (r < 0.62 && this.companions.length > 0) this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'upgrade', color: pick(COMP_UPGRADES).color, phase: rnd() * 6, upIdx: irand(0, COMP_UPGRADES.length - 1) })
    if (rnd() < (p.hp / p.maxHp < 0.55 ? 0.26 : 0.1)) {
      this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'heart', color: '#ff5a7a', phase: rnd() * 6, val: Math.round(p.maxHp * (e.type === 'brute' ? 0.28 : 0.14)) })
    }
  }

  checkMilestone() {
    if (this.contract.kills >= this.milestoneTarget()) {
      this.contract.idx++
      const bonus = 150 * this.contract.idx
      this.p.credits += bonus
      this.hooks.onToast({ text: `КОНТРАКТ: РУБЕЖ ${this.contract.idx} — ПРЕМИЯ +${bonus}`, color: '#f5a623' })
      audio.rareSting()
      this.spawnSupply()
    }
  }

  milestoneTarget(): number {
    const i = this.contract.idx
    if (i < MILESTONES.length) return MILESTONES[i]
    return MILESTONES[MILESTONES.length - 1] + (i - MILESTONES.length + 1) * 150
  }

  genRegionWeapon(rarity: number): Weapon {
    const boost = this.region.lootBias.rarityBoost
    let r = clamp(rarity + Math.floor(this.streams.loot.next() * (boost + 1) * 0.8), 0, 4)
    if (this.streams.loot.next() < 0.12) r = clamp(r + 1, 0, 4)
    const kits = this.region.lootBias.kits
    const kit = this.streams.loot.next() < 0.5 ? kits[irand(0, kits.length - 1)] : -1
    return genWeapon(r, kit)
  }

  rollRarity(size: number) {
    const t = this.streams.loot.next() + this.region.lootBias.rarityBoost * 0.12
    if (size === 0) return t < 0.8 ? 0 : 1
    if (size === 1) return t < 0.5 ? 0 : t < 0.85 ? 1 : 2
    if (size === 2) return t < 0.35 ? 1 : t < 0.75 ? 2 : t < 0.95 ? 3 : 4
    return t < 0.4 ? 2 : t < 0.75 ? 3 : 4
  }

  dropCoins(x: number, y: number, n: number, tier: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      this.pickups.push({ x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, kind: 'coin', color: '#f5a623', phase: rnd() * 6, val: irand(4, 10) * tier })
    }
  }

  makeCapsule(x: number, y: number, size: number, special: boolean): Capsule {
    return { x, y, size, shape: irand(0, 3), cIdx: irand(0, CAPSULE_COLORS.length - 1), hp: 20 + size * 22, maxHp: 20 + size * 22, special, phase: rnd() * 6 }
  }

  // ============================================================
  // БОСС
  // ============================================================
  updateBoss(dt: number) {
    const b = this.boss
    if (!b) return
    const p = this.p
    b.flash -= dt
    b.walkT += dt
    b.atkCd -= dt
    const frac = b.hp / b.maxHp
    const newPhase = frac < 0.3 ? 2 : frac < 0.6 ? 1 : 0
    if (newPhase > b.phase) {
      b.phase = newPhase
      audio.bossRoar()
      this.shake = Math.max(this.shake, 3)
      this.hooks.onToast({ text: b.def.phases[newPhase].name, color: '#ff5533' })
      if (newPhase === 2 && !b.summoned) {
        b.summoned = true
        this.spawnEnemy(b.x - 40, b.y + 20, 'grunt', this.region.tier * 1.3)
        this.spawnEnemy(b.x + 40, b.y + 20, 'gunner', this.region.tier * 1.3)
      }
    }
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy)
    b.aim = Math.atan2(dy, dx)
    if (b.windup > 0) {
      b.windup -= dt
      if (b.windup <= 0) {
        if (b.move === 'slam') {
          this.explode(b.windupX, b.windupY, 26, 0, '#ff8a3d')
          if (Math.hypot(b.windupX - p.x, b.windupY - p.y) < 26) this.damagePlayer(26)
          this.shake = Math.max(this.shake, 4)
        } else if (b.move === 'dash') {
          const dd = Math.hypot(b.windupX - b.x, b.windupY - b.y) || 1
          b.x += ((b.windupX - b.x) / dd) * Math.min(dd, 130)
          b.y += ((b.windupY - b.y) / dd) * Math.min(dd, 130)
          this.burst(b.x, b.y, 10, '#ff5533', 2)
          if (Math.hypot(p.x - b.x, p.y - b.y) < 20) this.damagePlayer(20)
        }
        b.move = 'chase'
      }
    } else {
      const spd = b.def.speed * (1 + b.phase * 0.3)
      if (d > 46) this.moveEnt(b, (dx / d) * spd * dt, (dy / d) * spd * dt, 12)
      if (d < b.def.r + 6 && p.iframes <= 0) this.damagePlayer(b.def.dmg * 0.6)
      if (b.atkCd <= 0 && !this.dead) {
        const opts: string[] = b.phase === 0 ? ['slam', 'burst'] : b.phase === 1 ? ['slam', 'burst', 'ring'] : ['dash', 'ring', 'slam']
        const atk = pick(opts)
        if (atk === 'slam') {
          b.move = 'slam'; b.windup = 0.7
          b.windupX = p.x + (rnd() - 0.5) * 8; b.windupY = p.y + (rnd() - 0.5) * 8
        } else if (atk === 'burst') {
          for (let i = -1; i <= 1; i++) {
            const a = b.aim + i * 0.16
            this.bullets.push({ x: b.x + Math.cos(a) * 14, y: b.y - 4 + Math.sin(a) * 14, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, dmg: b.def.dmg * 0.7, kind: 'plasma', color: b.def.accent, r: 3, explosive: 0, pierce: false, friendly: false, life: 2.2, hit: new Set() })
          }
          audio.enemyShoot()
        } else if (atk === 'ring') {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2
            this.bullets.push({ x: b.x + Math.cos(a) * 12, y: b.y - 4 + Math.sin(a) * 12, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, dmg: b.def.dmg * 0.6, kind: 'plasma', color: b.def.core, r: 2.5, explosive: 0, pierce: false, friendly: false, life: 2.4, hit: new Set() })
          }
          audio.enemyShoot()
        } else {
          b.move = 'dash'; b.windup = 0.5
          b.windupX = p.x; b.windupY = p.y
        }
        b.atkCd = b.phase === 2 ? 1.5 : 2.3
      }
    }
  }

  damageBoss(dmg: number) {
    const b = this.boss
    if (!b) return
    b.hp -= dmg
    b.flash = 0.1
    this.burst(b.x, b.y - 4, 2, b.def.core, 1)
    audio.hit()
    if (b.hp <= 0) this.killBoss()
  }

  killBoss() {
    const b = this.boss!
    this.boss = null
    const poi = this.activeDungeonPoi
    if (poi && poi.ds) { poi.ds.cleared = true; poi.state = 'cleared' }
    this.runBosses++
    this.explode(b.x, b.y, 40, 40, '#ff8a3d')
    this.explode(b.x, b.y, 30, 20, '#ffd54a')
    this.shake = Math.max(this.shake, 8)
    audio.explode()
    audio.rareSting()
    const p = this.p
    const cr = irand(b.def.rewards.credits[0], b.def.rewards.credits[1])
    p.credits += cr
    this.floaters.push({ x: b.x, y: b.y - 20, text: `+${cr}`, color: '#ffd54a', life: 1.2, size: 8 })
    const w = this.guaranteedWeapon(b.def.rewards.weaponRarity)
    this.pickups.push({ x: b.x - 14, y: b.y, vx: 0, vy: 0, kind: 'weapon', color: RARITIES[w.rarity].color, phase: rnd() * 6, weapon: w })
    this.pickups.push({ x: b.x + 14, y: b.y, vx: 0, vy: 0, kind: 'heart', color: '#ff5a7a', phase: rnd() * 6, val: Math.round(p.maxHp * 0.5) })
    if (rnd() < b.def.rewards.permanentChance) this.grantPermanent()
    this.hooks.onToast({ text: 'СТРАЖ УНИЧТОЖЕН. КОМПЛЕКС ЗАЧИЩЕН', color: '#7dff5e' })
  }

  grantPermanent() {
    const owned = new Set(metaApi.state.artifacts.map((a) => a.id))
    const ownedBp = new Set(metaApi.state.blueprints)
    const pool = PERMANENT_POOL.filter((d) => (d.kind === 'artifact' ? !owned.has(d.id) : !ownedBp.has(d.id)))
    if (!pool.length) {
      metaApi.earnCredits(500)
      this.hooks.onToast({ text: 'ПОСТОЯННАЯ НАГРАДА → 500 КРЕДИТОВ', color: '#ffd54a' })
      return
    }
    const def = pick(pool)
    if (def.kind === 'artifact') {
      const res = metaApi.addArtifact({ id: def.id, name: def.name, kind: 'artifact', rarity: def.rarity, desc: def.desc, color: def.color })
      if (res.item) {
        this.runPermanents.push(def.name)
        this.hooks.onToast({ text: `ПОСТОЯННЫЙ ПРЕДМЕТ: ${def.name}`, color: def.color })
        this.floaters.push({ x: this.p.x, y: this.p.y - 26, text: def.name, color: def.color, life: 1.6, size: 7 })
      }
    } else {
      const comp = metaApi.addBlueprint(def.id, def.compDefKind || 'mech', 'ПРОТО-МЕХ', def.rarity, def.color)
      if (comp) {
        this.runPermanents.push(def.name)
        this.hooks.onToast({ text: `ЧЕРТЁЖ: ${def.name} (ОТСЕК ОТРЯДА)`, color: def.color })
      }
    }
    audio.companion()
  }

  /** оружие гарантированно не хуже лучшего в арсенале */
  guaranteedWeapon(minRarity: number): Weapon {
    const ws = this.p.weapons as Weapon[]
    let best = 0
    for (const x of ws) best = Math.max(best, weaponScore(x))
    let w = this.genRegionWeapon(minRarity)
    for (let i = 0; i < 25 && ws.length > 0 && weaponScore(w) <= best; i++) {
      w = this.genRegionWeapon(clamp(minRarity + Math.floor(i / 5), 0, 4))
    }
    return w
  }

  // ============================================================
  // СНАБЖЕНИЕ ГИЛЬДИИ
  // ============================================================
  spawnSupply() {
    if (this.shuttle) return
    this.shuttle = { t: 0, released: false }
    audio.shuttle()
    this.hooks.onToast({ text: 'ШАТТЛ ГИЛЬДИИ: СБРОС СНАБЖЕНИЯ', color: '#f5a623' })
  }

  updateShuttle(dt: number) {
    if (!this.shuttle) return
    this.shuttle.t += dt
    if (!this.shuttle.released && this.shuttle.t >= 1.8) {
      // внутри комплекса сброс невозможен — шаттл барражирует до выхода
      if (this.activeDungeonPoi) {
        this.shuttle.t = 1.2
        if (!this.shuttleWarned) {
          this.shuttleWarned = true
          this.hooks.onToast({ text: 'ШАТТЛ: ОЖИДАЕТ ВАШЕГО ВЫХОДА ИЗ КОМПЛЕКСА', color: '#f5a623' })
        }
        return
      }
      this.shuttleWarned = false
      this.shuttle.released = true
      this.fallPods.push({ x: this.p.x, y: this.p.y + 30, t: 0, dur: 1.1 })
    }
    if (this.shuttle.t >= 3.6) this.shuttle = null
  }

  updateCapsulesAndPods(dt: number) {
    for (let i = this.fallPods.length - 1; i >= 0; i--) {
      const f = this.fallPods[i]
      f.t += dt
      if (rnd() < 0.5) this.particles.push({ x: f.x + (rnd() - 0.5) * 8, y: f.y - (1 - f.t / f.dur) * 100, vx: (rnd() - 0.5) * 10, vy: 20, life: 0.5, max: 0.5, color: 'rgba(200,210,220,0.5)', size: 2, grav: 0 })
      if (f.t >= f.dur) {
        this.fallPods.splice(i, 1)
        this.pods.push({ x: f.x, y: f.y, opened: false })
        this.explode(f.x, f.y, 20, 0, '#c9d4de')
        this.shake = Math.max(this.shake, 3)
        audio.podLand()
      }
    }
  }

  tryOpenPod() {
    const p = this.p
    for (const pod of this.pods) {
      if (pod.opened || Math.hypot(pod.x - p.x, pod.y - p.y) >= 18) continue
      pod.opened = true
      this.burst(pod.x, pod.y, 26, '#3fe0ff', 2.6)
      this.burst(pod.x, pod.y, 12, '#f5a623', 2)
      this.shake = Math.max(this.shake, 3)
      audio.capsuleBreak()
      this.hooks.onToast({ text: 'КОНФИСКОВАННЫЕ ТРОФЕИ ГИЛЬДИИ [E]', color: '#f5a623' })
      const w = this.guaranteedWeapon(2)
      this.pickups.push({ x: pod.x, y: pod.y - 10, vx: 0, vy: 0, kind: 'weapon', color: RARITIES[w.rarity].color, phase: rnd() * 6, weapon: w })
      const slotIdx = this.weakestArmorSlot()
      const ar = this.guaranteedArmor(slotIdx)
      this.pickups.push({ x: pod.x + 12, y: pod.y, vx: 0, vy: 0, kind: 'armor', color: ar.color, phase: rnd() * 6, armor: ar, slot: slotIdx })
      this.pickups.push({ x: pod.x - 12, y: pod.y, vx: 0, vy: 0, kind: 'heart', color: '#ff5a7a', phase: rnd() * 6, val: Math.round(p.maxHp * 0.35) })
      this.dropCoins(pod.x, pod.y + 8, 4, 2)
      return
    }
  }

  weakestArmorSlot(): number {
    let worst = 0, worstScore = Infinity
    for (let i = 0; i < 4; i++) {
      const a = this.p.armor[i] as Armor | null
      const s = a ? a.score : -1
      if (s < worstScore) { worstScore = s; worst = i }
    }
    return worst
  }

  guaranteedArmor(slotIdx: number): Armor {
    const cur = this.p.armor[slotIdx] as Armor | null
    let a = genArmor(2)
    a.slot = (['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'] as const)[slotIdx]
    for (let i = 0; i < 25 && cur && a.score <= cur.score; i++) a = genArmor(clamp(2 + Math.floor(i / 6), 0, 4))
    return a
  }

  // ============================================================
  // ИГРОК: управление
  // ============================================================
  updatePlayer(dt: number) {
    const p = this.p
    p.iframes -= dt; p.slashT -= dt; p.slashCd -= dt; p.dashCd -= dt
    let mx = 0, my = 0
    if (this.keys.KeyW || this.keys.ArrowUp) my -= 1
    if (this.keys.KeyS || this.keys.ArrowDown) my += 1
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1
    if (mx && my) { mx *= 0.707; my *= 0.707 }
    const spd = 88 * (1 + p.bonus.speed / 100)
    if (mx || my) p.walkT += dt
    if ((this.keys.ShiftLeft || this.keys.ShiftRight) && p.dashCd <= 0 && (mx || my)) {
      p.dashT = 0.18; p.dashCd = 1.05
      p.dashVX = mx * 300; p.dashVY = my * 300
      p.iframes = Math.max(p.iframes, 0.22)
      audio.dash()
      this.burst(p.x, p.y, 6, '#3fe0ff', 1.5)
    }
    if (p.dashT > 0) {
      p.dashT -= dt
      this.moveEnt(p, p.dashVX * dt, p.dashVY * dt, 5)
      if (rnd() < 0.6) this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: 'rgba(63,224,255,0.5)', size: 4, grav: 0 })
    } else {
      this.moveEnt(p, mx * spd * dt, my * spd * dt, 5)
    }
    const wx = this.camX - this.W / 2 + this.mouse.x, wy = this.camY - VIEW_H / 2 + this.mouse.y
    p.aim = Math.atan2(wy - (p.y - 3), wx - p.x)
    p.fireCd -= dt
    if (p.reloadT > 0) {
      p.reloadT -= dt
      if (p.reloadT <= 0) { const w = this.curWeapon(); if (w) { p.mag = w.mag; w.magCur = w.mag } }
    }
    if (this.mouse.down && p.fireCd <= 0 && p.reloadT <= 0 && this.spawnAnim >= 1) this.fire()
    if ((this.keys.Space) && p.slashCd <= 0) this.trySlash()
    p.regenDelay -= dt
    if (p.regenDelay <= 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 2.4 * dt)
  }

  fire() {
    const p = this.p
    const w = this.curWeapon()
    if (!w) return
    if (p.mag <= 0) { this.startReload(); return }
    p.mag--
    w.magCur = p.mag
    p.fireCd = 1 / (w.rate * (1 + p.bonus.rate / 100))
    const spread = (1 - w.acc) * 0.5 + (1 - p.bonus.acc / 100) * 0.05
    for (let i = 0; i < w.pellets; i++) {
      const a = p.aim + (rnd() - 0.5) * spread * 2 + (w.pellets > 1 ? (i - (w.pellets - 1) / 2) * 0.09 : 0)
      const sp = w.speed * (0.92 + rnd() * 0.16)
      const crit = rnd() * 100 < p.bonus.crit
      const dmg = w.dmg * (1 + p.bonus.dmg / 100) * (crit ? 2 : 1)
      this.bullets.push({ x: p.x + Math.cos(p.aim) * 10, y: p.y - 3 + Math.sin(p.aim) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, kind: w.proj, color: w.color, r: w.proj === 'rocket' ? 3 : 2, explosive: w.explosive, pierce: w.pierce, friendly: true, life: w.proj === 'rocket' ? 2.2 : 1.1, hit: new Set() })
      if (crit) this.floaters.push({ x: p.x + Math.cos(a) * 20, y: p.y - 14, text: 'КРИТ', color: '#ffd54a', life: 0.5, size: 6 })
    }
    this.muzzle(p.x + Math.cos(p.aim) * 12, p.y - 3 + Math.sin(p.aim) * 12, w.color)
    audio.shoot(w.proj)
    this.shake = Math.max(this.shake, w.proj === 'rocket' ? 1.6 : 0.4)
    if (p.mag <= 0) this.startReload()
  }

  trySlash() {
    const p = this.p
    if (p.slashCd > 0) return
    p.slashCd = 0.55
    p.slashT = 0.2
    audio.slash()
    const dmg = 24 * (1 + p.bonus.dmg / 100)
    for (const e of [...this.enemies]) {
      if (Math.hypot(e.x - p.x, e.y - p.y) < 24 + e.r) {
        const a = Math.atan2(e.y - p.y, e.x - p.x)
        let da = Math.abs(a - p.aim)
        if (da > Math.PI) da = Math.PI * 2 - da
        if (da < 1.4) { this.damageEnemy(e, dmg); e.x += Math.cos(a) * 8; e.y += Math.sin(a) * 8 }
      }
    }
    if (this.boss && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < 26 + this.boss.def.r) this.damageBoss(dmg)
    for (const c of [...this.capsules]) if (Math.hypot(c.x - p.x, c.y - p.y) < 26) this.damageCapsule(c, dmg)
  }

  muzzle(x: number, y: number, color: string) {
    for (let i = 0; i < 3; i++) this.particles.push({ x, y, vx: (rnd() - 0.5) * 50, vy: (rnd() - 0.5) * 50, life: 0.12, max: 0.12, color, size: 2, grav: 0 })
  }

  damagePlayer(raw: number) {
    const p = this.p
    if (p.iframes > 0 || this.dead || this.god) return
    const dmg = Math.max(1, Math.round(raw * (1 - p.bonus.hp / 600)))
    p.hp -= dmg
    p.iframes = 0.5
    p.regenDelay = 4
    this.hurtT = 1
    this.shake = Math.max(this.shake, 3)
    audio.hurt()
    this.burst(p.x, p.y, 6, '#ff5533', 1.6)
    if (p.hp <= 0) {
      p.hp = 0
      this.dead = true
      this.deadT = 0
      this.burst(p.x, p.y, 34, '#ff8a3d', 3)
      this.burst(p.x, p.y, 20, '#3fe0ff', 2.4)
      audio.death()
      this.shake = 6
    }
  }

  // ============================================================
  // КОМПАНЬОНЫ
  // ============================================================
  spawnCompanion(x: number, y: number, kind?: string, label?: string, perm?: boolean, permUid?: string) {
    const def = kind ? COMP_DEFS.find((c) => c.kind === kind) || pick(COMP_DEFS) : pick(COMP_DEFS)
    const comp: Companion = {
      x, y, kind: def.kind, label: label || def.label, def,
      pal: pick(def.palettes),
      walkT: rnd() * 6, aim: 0, phase: rnd() * 6, fireCd: 0.5, flash: 0,
      perm, permUid,
    }
    this.companions.push(comp)
    this.burst(x, y, 18, '#3fe0ff', 2.4)
    audio.companion()
    this.hooks.onToast({ text: `ОТРЯД: ${comp.label}${perm ? ' (ПОСТОЯННЫЙ)' : ''}`, color: '#3fe0ff' })
  }

  updateCompanions(dt: number) {
    const p = this.p
    // модули отряда. Крит определяется ОДИН раз при выстреле — пуля несёт готовый урон.
    const mDmg = 1 + this.cu('dmg') * 0.2
    const mRate = 1 + this.cu('rate') * 0.16
    const mRange = 1 + this.cu('range') * 0.18
    const mCrit = this.cu('crit') * 0.1
    const mPierce = this.cu('pierce')
    const mBlast = this.cu('blast')
    const mSalvo = this.cu('salvo') * 0.2
    for (let i = 0; i < this.companions.length; i++) {
      const c = this.companions[i]
      c.flash -= dt; c.fireCd -= dt; c.walkT += dt
      const ang = this.time * 0.6 + i * ((Math.PI * 2) / Math.max(4, Math.min(12, this.companions.length))) * 2.4 + i
      const rad = 24 + (i % 3) * 9
      const tx = p.x + Math.cos(ang) * rad, ty = p.y + Math.sin(ang) * rad
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy)
      if (d > 4) {
        const sp = Math.min(c.def.speed, d * 4)
        this.moveEnt(c, (dx / d) * sp * dt, (dy / d) * sp * dt, 4)
      }
      if (d > (this.activeDungeonPoi ? 56 : 130)) { c.x = p.x + (rnd() - 0.5) * 24; c.y = p.y + (rnd() - 0.5) * 24 }
      let target: Enemy | BossState | null = null
      let bd = c.def.range * mRange
      for (const e of this.enemies) {
        const ed = Math.hypot(e.x - c.x, e.y - c.y)
        if (ed < bd) { bd = ed; target = e }
      }
      if (this.boss) {
        const ed = Math.hypot(this.boss.x - c.x, this.boss.y - c.y)
        if (ed < bd) { bd = ed; target = this.boss }
      }
      if (target) {
        c.aim = Math.atan2(target.y - c.y, target.x - c.x)
        if (c.fireCd <= 0) {
          const wBoost = c.weapon ? c.weapon.rateBoost : 0
          c.fireCd = 1 / (c.def.rate * mRate * (1 + wBoost))
          const shots = 1 + (rnd() < mSalvo ? (mSalvo >= 0.6 ? 2 : 1) : 0)
          for (let s = 0; s < shots; s++) {
            const isCrit = rnd() < mCrit
            const dmg = (c.def.dmg * mDmg + (c.weapon ? c.weapon.dmgBoost : 0)) * (isCrit ? 2 : 1)
            const bs = 190
            this.bullets.push({
              x: c.x + Math.cos(c.aim) * 8, y: c.y - 3 + Math.sin(c.aim) * 8,
              vx: Math.cos(c.aim + (s ? 0.12 : 0)) * bs, vy: Math.sin(c.aim + (s ? 0.12 : 0)) * bs,
              dmg, kind: c.def.proj, color: isCrit ? '#ffd54a' : c.pal.accent, r: 2,
              explosive: (c.def.proj === 'rocket' ? 12 : 0) + mBlast * 7,
              pierce: false, pierceLeft: mPierce > 0 ? mPierce : undefined,
              friendly: true, life: 1.2, hit: new Set(),
            })
          }
          this.muzzle(c.x + Math.cos(c.aim) * 10, c.y - 3 + Math.sin(c.aim) * 10, c.pal.accent)
          audio.shoot(c.def.proj === 'bullet' ? 'bullet' : c.def.proj)
        }
      } else c.aim = p.aim
    }
  }

  giveWeaponToCompanion(wIdx: number, cIdx: number) {
    const p = this.p
    const w = p.weapons[wIdx] as Weapon | undefined
    const comp = this.companions[cIdx]
    if (!w || !comp) return
    comp.weapon = { name: w.name, color: w.color, dmgBoost: Math.round(w.dmg * 0.6), rateBoost: Math.min(0.8, w.rate * 0.06) }
    p.weapons.splice(wIdx, 1)
    if (p.cur >= p.weapons.length) p.cur = Math.max(0, p.weapons.length - 1)
    const nw = this.curWeapon()
    p.mag = nw ? (nw.magCur ?? nw.mag) : 0
    p.reloadT = 0
    audio.pickup()
    this.hooks.onToast({ text: `${comp.label}: УСТАНОВЛЕНО ${w.name}`, color: w.color })
    this.overlay = null
  }

  // ============================================================
  // ВРАГИ: обновление
  // ============================================================
  updateEnemies(dt: number) {
    const p = this.p
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]
      e.flash -= dt; e.walkT += dt; e.atkCd -= dt
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy)
      if (d > 620) { this.enemies.splice(i, 1); continue }
      e.aim = Math.atan2(dy, dx)
      if (e.windup > 0) {
        e.windup -= dt
        if (e.windup <= 0) {
          if (d < (e.type === 'brute' ? 30 : 22) + e.r) this.damagePlayer(e.dmg)
          this.burst(e.x + Math.cos(e.aim) * 14, e.y + Math.sin(e.aim) * 14, 6, e.pal.accent, 1.6)
          audio.bladeHit()
          e.atkCd = e.type === 'brute' ? 2.2 : 1.4
        }
      } else if (e.type === 'grunt' || e.type === 'brute') {
        const stop = e.type === 'brute' ? 24 : 14
        if (d > stop) this.moveEnt(e, (dx / d) * e.speed * dt, (dy / d) * e.speed * dt, e.r)
        else if (e.atkCd <= 0) e.windup = e.type === 'brute' ? 0.6 : 0.4
      } else if (e.type === 'gunner') {
        const want = 90
        let mx2 = 0, my2 = 0
        if (d > want + 20) { mx2 = dx / d; my2 = dy / d }
        else if (d < want - 20) { mx2 = -dx / d; my2 = -dy / d }
        else { mx2 = (-dy / d) * e.strafe; my2 = (dx / d) * e.strafe }
        this.moveEnt(e, mx2 * e.speed * dt, my2 * e.speed * dt, e.r)
        e.shootT -= dt
        if (e.burst > 0 && e.shootT <= 0) {
          e.burst--
          e.shootT = 0.18
          const bs = 130
          this.bullets.push({ x: e.x + Math.cos(e.aim) * 8, y: e.y - 3 + Math.sin(e.aim) * 8, vx: Math.cos(e.aim + (rnd() - 0.5) * 0.12) * bs, vy: Math.sin(e.aim + (rnd() - 0.5) * 0.12) * bs, dmg: e.dmg, kind: 'plasma', color: e.pal.accent, r: 2.5, explosive: 0, pierce: false, friendly: false, life: 2.4, hit: new Set() })
          audio.enemyShoot()
        } else if (e.burst <= 0 && d < 150 && e.atkCd <= 0 && !this.dead) {
          e.burst = e.weapon === 2 ? 1 : 3
          e.shootT = 0.1
          e.atkCd = 1.8
        }
      } else {
        e.swoopT -= dt
        if (e.swoop > 0) {
          e.swoop -= dt
          this.moveEnt(e, e.kbx * dt, e.kby * dt, e.r)
          if (d < 12 && p.iframes <= 0) this.damagePlayer(e.dmg)
        } else {
          if (d > 60) this.moveEnt(e, (dx / d) * e.speed * dt, (dy / d) * e.speed * dt, e.r)
          else this.moveEnt(e, (-dy / d) * e.speed * 0.6 * dt * e.strafe, (dx / d) * e.speed * 0.6 * dt * e.strafe, e.r)
          if (e.swoopT <= 0 && d < 120 && !this.dead) {
            e.swoopT = 2.4 + rnd() * 2
            if (e.weapon === 0 || e.weapon === 1) {
              const bs = 140
              this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.aim) * bs, vy: Math.sin(e.aim) * bs, dmg: e.dmg * 0.8, kind: 'plasma', color: e.pal.accent, r: 2.5, explosive: 0, pierce: false, friendly: false, life: 2.2, hit: new Set() })
              audio.enemyShoot()
            } else {
              e.swoop = 0.35
              e.kbx = (dx / d) * 95; e.kby = (dy / d) * 95
            }
          }
        }
      }
      if ((e.type === 'grunt' || e.type === 'brute') && d < e.r + 5 && e.windup <= 0) {
        if (p.iframes <= 0) this.damagePlayer(e.dmg * 0.4)
      }
    }
  }

  // ============================================================
  // ПУЛИ
  // ============================================================
  updateBullets(dt: number) {
    const p = this.p
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.life -= dt
      b.x += b.vx * dt; b.y += b.vy * dt
      let dead = b.life <= 0
      if (!dead && this.activeDungeonPoi) {
        if (b.friendly) {
          if (this.hitDungeonTile(b.x, b.y)) { dead = true; this.burst(b.x, b.y, 2, b.color, 1) }
        } else if (this.tileSolidP(this.activeDungeonPoi, b.x, b.y)) {
          dead = true; this.burst(b.x, b.y, 2, b.color, 1)
        }
      }
      if (!dead) for (const o of this.nearObstacles(b.x, b.y, b.r)) {
        if (Math.hypot(o.x - b.x, o.y - b.y) < o.r) { dead = true; this.burst(b.x, b.y, 3, b.color, 1); break }
      }
      if (!dead && b.friendly) {
        for (const e of this.enemies) {
          if (b.hit.has(e)) continue
          if (Math.hypot(e.x - b.x, e.y - (b.y + 2)) < e.r + b.r) {
            b.hit.add(e)
            this.damageEnemy(e, b.dmg)
            if (b.explosive > 0) { this.explode(b.x, b.y, b.explosive, b.dmg * 0.55, b.color); dead = true }
            else if (b.pierce) { /* летит дальше */ }
            else if (b.pierceLeft !== undefined) { b.pierceLeft--; if (b.pierceLeft < 0) dead = true }
            else dead = true
            if (dead) break
          }
        }
        if (!dead && this.boss && !b.hit.has(this.boss)) {
          if (Math.hypot(this.boss.x - b.x, this.boss.y - b.y) < this.boss.def.r + b.r) {
            b.hit.add(this.boss)
            this.damageBoss(b.dmg)
            if (b.explosive > 0) { this.explode(b.x, b.y, b.explosive, b.dmg * 0.5, b.color); dead = true }
            else if (b.pierce) { /* летит дальше */ }
            else if (b.pierceLeft !== undefined) { b.pierceLeft--; if (b.pierceLeft < 0) dead = true }
            else dead = true
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
        if (Math.hypot(p.x - b.x, p.y - 2 - b.y) < 6 + b.r) { this.damagePlayer(b.dmg); dead = true }
      }
      if (dead) { if (b.explosive > 0 && b.life <= 0 && b.friendly) this.explode(b.x, b.y, b.explosive, b.dmg * 0.5, b.color); this.bullets.splice(i, 1) }
    }
  }

  explode(x: number, y: number, radius: number, dmg: number, color: string) {
    this.burst(x, y, 16, color, 2.6)
    this.burst(x, y, 10, '#ff8a3d', 2.2)
    this.smoke(x, y, 6)
    audio.explode()
    this.shake = Math.max(this.shake, 2)
    if (dmg > 0) {
      for (const e of [...this.enemies]) if (Math.hypot(e.x - x, e.y - y) < radius + e.r) this.damageEnemy(e, dmg)
      if (this.boss && Math.hypot(this.boss.x - x, this.boss.y - y) < radius + this.boss.def.r) this.damageBoss(dmg)
      if (Math.hypot(this.p.x - x, this.p.y - y) < radius * 0.6) this.damagePlayer(dmg * 0.5)
    }
  }

  burst(x: number, y: number, n: number, color: string, pow: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const sp = (20 + rnd() * 60) * pow
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.3 + rnd() * 0.4, max: 0.7, color, size: rnd() < 0.3 ? 2 : 1, grav: 130 })
    }
  }

  smoke(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.particles.push({ x: x + (rnd() - 0.5) * 10, y: y + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 14, vy: -12 - rnd() * 14, life: 0.7 + rnd() * 0.5, max: 1.2, color: 'rgba(120,130,140,0.5)', size: 3, grav: -8 })
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
    const n = [2, 4, 6, 8][c.size]
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, d = 6 + rnd() * (8 + c.size * 5)
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d
      const roll = rnd()
      const rar = this.rollRarity(c.size)
      if (roll < 0.44) this.dropCoins(x, y, 1, c.size + 1)
      else if (roll < 0.44 + 0.26 + c.size * 0.04) {
        const w = this.genRegionWeapon(rar)
        this.pickups.push({ x, y, vx: 0, vy: 0, kind: 'weapon', color: RARITIES[rar].color, phase: rnd() * 6, weapon: w })
      } else if (roll < 0.86 && this.companions.length > 0) {
        this.pickups.push({ x, y, vx: 0, vy: 0, kind: 'upgrade', color: pick(COMP_UPGRADES).color, phase: rnd() * 6, upIdx: irand(0, COMP_UPGRADES.length - 1) })
      } else {
        const ar = genArmor(rar)
        this.pickups.push({ x, y, vx: 0, vy: 0, kind: 'armor', color: ar.color, phase: rnd() * 6, armor: ar, slot: ['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'].indexOf(ar.slot) })
      }
    }
  }

  // ============================================================
  // ПОДБОР (только лучший лут)
  // ============================================================
  updatePickups(dt: number) {
    const p = this.p
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i]
      if (pk.rej !== undefined) {
        pk.rej -= dt
        if (pk.rej <= 0) { this.burst(pk.x, pk.y, 5, '#5e7a90', 1.2); this.pickups.splice(i, 1) }
        continue
      }
      pk.x += pk.vx * dt; pk.y += pk.vy * dt
      pk.vx *= 1 - Math.min(1, dt * 4); pk.vy *= 1 - Math.min(1, dt * 4)
      const d = Math.hypot(p.x - pk.x, p.y - pk.y)
      if ((pk.kind === 'coin' || pk.kind === 'heart') && d < 52) {
        const a = Math.atan2(p.y - pk.y, p.x - pk.x)
        const sp = 130 * (1 - d / 60) + 40
        pk.x += Math.cos(a) * sp * dt; pk.y += Math.sin(a) * sp * dt
      }
      if (d >= (pk.kind === 'coin' || pk.kind === 'heart' ? 9 : 11) || this.dead) continue
      if (pk.kind === 'coin') {
        this.pickups.splice(i, 1)
        p.credits += pk.val || 5
        this.floaters.push({ x: p.x, y: p.y - 18, text: '+' + (pk.val || 5), color: '#ffd54a', life: 0.7, size: 7 })
        audio.coin()
      } else if (pk.kind === 'heart') {
        if (p.hp >= p.maxHp) continue
        this.pickups.splice(i, 1)
        const heal = pk.val || 20
        p.hp = Math.min(p.maxHp, p.hp + heal)
        p.regenDelay = 0
        this.floaters.push({ x: p.x, y: p.y - 18, text: '+' + heal, color: '#ff5a7a', life: 0.8, size: 7 })
        this.burst(p.x, p.y, 8, '#ff5a7a', 1.4)
        audio.heal()
      } else if (pk.kind === 'weapon') {
        const w = pk.weapon as Weapon
        if (this.weaponIsUpgrade(w)) { this.pickups.splice(i, 1); this.collectWeapon(w) }
        else this.rejectPickup(pk, 'СЛАБЕЕ АРСЕНАЛА — TAB: ОТРЯДУ')
      } else if (pk.kind === 'armor') {
        const a = pk.armor as Armor
        const slotIdx = pk.slot || 0
        const cur = p.armor[slotIdx] as Armor | null
        if (!cur || a.score > cur.score) { this.pickups.splice(i, 1); this.collectArmor(a, slotIdx) }
        else this.rejectPickup(pk, 'СЛАБЕЕ ЭКИПИРОВКИ')
      } else if (pk.kind === 'upgrade') {
        this.pickups.splice(i, 1)
        this.applyUpgrade(pk.upIdx || 0)
      }
    }
  }

  applyUpgrade(idx: number) {
    const u = COMP_UPGRADES[idx]
    const cur = this.cu(u.id)
    if (cur >= u.max) {
      this.p.credits += 60
      audio.coin()
      this.hooks.onToast({ text: `${u.name}: МАКС → 60 КРЕДИТОВ`, color: '#9aa7b8' })
      return
    }
    this.compUp[u.id] = cur + 1
    audio.upgrade()
    this.burst(this.p.x, this.p.y, 12, u.color, 2)
    this.hooks.onToast({ text: `МОДУЛЬ ОТРЯДА: ${u.name} УР.${cur + 1}`, color: u.color })
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
    this.floaters.push({ x: pk.x, y: pk.y - 15, text: why, color: '#5e7a90', life: 1.1, size: 5 })
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
  }

  collectArmor(a: Armor, slotIdx: number) {
    const p = this.p
    p.armor[slotIdx] = a
    this.recalcBonuses()
    audio.pickup()
    if (a.rarity >= 3) audio.rareSting()
    this.hooks.onToast({ text: `ЭКИПИРОВКА: ${a.name}`, color: a.color })
  }

  recalcBonuses() {
    const p = this.p
    const b = { hp: 0, dmg: 0, rate: 0, speed: 0, acc: 0, crit: 5 }
    for (const a of p.armor) {
      if (!a) continue
      for (const bn of (a as Armor).bonuses) {
        if (bn.key in b) (b as unknown as Record<string, number>)[bn.key] += bn.val
      }
    }
    b.hp += this.permBonus.hp
    b.dmg += this.permBonus.dmg
    b.rate += this.permBonus.rate
    b.acc += this.permBonus.acc
    const oldMax = p.maxHp
    p.maxHp = 100 + b.hp
    p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax))
    p.bonus = b
  }

  updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i]
      pt.life -= dt
      pt.vy += pt.grav * dt
      pt.x += pt.vx * dt; pt.y += pt.vy * dt
      if (pt.life <= 0) this.particles.splice(i, 1)
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]
      f.life -= dt
      f.y -= 14 * dt
      if (f.life <= 0) this.floaters.splice(i, 1)
    }
  }

  updateWeather(dt: number) {
    this.weatherT -= dt
    const biome = BIOMES[this.biomeAt(this.camX, this.camY)]
    if (this.weatherT <= 0 && biome.weather !== 'none') {
      this.weatherT = 0.08
      const colors: Record<string, string> = { ember: '#ff8a3d', snow: '#e8f4ff', spore: '#b6ff2e', sand: '#c89a6e', spark: '#7d5eff', ash: '#8a96a3' }
      this.weather.push({
        x: this.camX + (rnd() - 0.5) * this.W, y: this.camY - VIEW_H / 2 - 10,
        vx: biome.weather === 'sand' ? -20 : (rnd() - 0.5) * 12,
        vy: biome.weather === 'ember' ? -16 - rnd() * 14 : 14 + rnd() * 12,
        life: 3, max: 3, color: colors[biome.weather] || '#ffffff', size: rnd() < 0.3 ? 2 : 1, grav: 0,
      })
    }
    for (let i = this.weather.length - 1; i >= 0; i--) {
      const w = this.weather[i]
      w.life -= dt
      w.x += w.vx * dt; w.y += w.vy * dt
      if (w.life <= 0 || this.weather.length > 90) this.weather.splice(i, 1)
    }
  }

  // ============================================================
  // DEBUG (F9)
  // ============================================================
  dbg(action: string) {
    const p = this.p
    const dropHere = (pk: Omit<Pickup, 'phase'>) => this.pickups.push({ ...pk, phase: 0 } as Pickup)
    switch (action) {
      case 'enemy': this.spawnEnemy(p.x + 80, p.y, undefined, this.region.tier); break
      case 'elite': this.spawnEnemy(p.x + 80, p.y, 'brute', this.region.tier * 1.5); break
      case 'weapon': { const w = this.genRegionWeapon(irand(0, 4)); dropHere({ x: p.x + 30, y: p.y, vx: 0, vy: 0, kind: 'weapon', color: RARITIES[w.rarity].color, weapon: w }); break }
      case 'armor': { const a = genArmor(irand(0, 4)); dropHere({ x: p.x + 30, y: p.y, vx: 0, vy: 0, kind: 'armor', color: a.color, armor: a, slot: ['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'].indexOf(a.slot) }); break }
      case 'companion': this.spawnCompanion(p.x + 30, p.y); break
      case 'heart': dropHere({ x: p.x + 30, y: p.y, vx: 0, vy: 0, kind: 'heart', color: '#ff5a7a', val: 40 }); break
      case 'milestone': this.contract.kills = this.milestoneTarget(); this.checkMilestone(); break
      case 'poi': {
        let best: Poi | null = null, bd = Infinity
        for (const v of this.pois.values()) if (v) { const dd = Math.hypot(v.x - p.x, v.y - p.y); if (dd < bd) { bd = dd; best = v } }
        if (best) { p.x = best.x; p.y = best.y + (best.dungeon ? 20 : 0) }
        break
      }
      case 'dungeon': {
        const s = this.pois.get('starter')
        if (s && s.dungeon && s.ds) this.applyEnter(s)
        break
      }
      case 'boss': this.boss = makeBoss(BOSSES.warden, p.x + 90, p.y); audio.bossRoar(); break
      case 'supply': this.spawnSupply(); break
      case 'kill': this.god = false; this.damagePlayer(99999); break
      case 'artifact': this.grantPermanent(); break
      case 'region': {
        const i = REGIONS.findIndex((r) => r.id === this.region.id)
        this.region = REGIONS[(i + 1) % REGIONS.length]
        this.hooks.onToast({ text: `РЕГИОН: ${this.region.name}`, color: this.region.color })
        break
      }
      case 'god': this.god = !this.god; this.hooks.onToast({ text: this.god ? 'БЕССМЕРТИЕ ВКЛ' : 'БЕССМЕРТИЕ ВЫКЛ', color: '#9aa7b8' }); break
      case 'credits': p.credits += 1000; break
      case 'wipe': metaApi.reset(); this.hooks.onToast({ text: 'META-ПРОГРЕСС СБРОШЕН', color: '#ff5533' }); break
    }
  }

  // ============================================================
  // СНАПШОТ ДЛЯ REACT
  // ============================================================
  emitSnap() {
    const p = this.p
    const w = this.curWeapon()
    const zoneInfo: Record<ShipZoneId, string> = {
      nav: 'НАВИГАЦИЯ — выбор региона', armory: 'ОРУЖЕЙНАЯ — артефакты',
      storage: 'ХРАНИЛИЩЕ — грузовой отсек', bay: 'ОТСЕК ОТРЯДА — компаньоны',
      info: 'ТЕРМИНАЛ — досье', med: 'МЕДОТСЕК',
    }
    this.hooks.onSnap({
      mode: this.mode, overlay: this.overlay, paused: this.paused, muted: audio.muted,
      prompt: this.mode === 'ship' && this.shipZone ? `[E] ${zoneInfo[this.shipZone]}` : '',
      hp: Math.ceil(p.hp), maxHp: p.maxHp, credits: p.credits,
      kills: this.contract.kills, nextDrop: this.milestoneTarget(),
      dropProg: clamp(this.contract.kills / this.milestoneTarget(), 0, 1),
      milestoneIdx: this.contract.idx,
      biome: this.mode === 'game' ? BIOMES[this.biomeAt(this.camX, this.camY)].name : 'ОРБИТА',
      regionName: this.region.name, regionColor: this.region.color,
      directorPhase: this.director.phase,
      weapons: p.weapons.map((wp) => {
        const ww = wp as Weapon
        return { name: ww.name, rarity: ww.rarity, color: ww.color, dmg: ww.dmg, rate: ww.rate, mag: ww.mag, acc: ww.acc, proj: ww.proj, parts: ww.parts, explosive: ww.explosive, pellets: ww.pellets, pierce: ww.pierce, score: Math.round(weaponScore(ww)) }
      }),
      cur: p.cur, mag: p.mag, magSize: w ? w.mag : 0,
      reload: w && w.mag > 0 ? clamp(1 - p.reloadT / w.reload, 0, 1) : 1,
      reloading: p.reloadT > 0,
      dash: clamp(1 - p.dashCd / 1.05, 0, 1),
      companions: this.companions.map((c) => ({ label: c.label, color: c.pal.accent, weapon: c.weapon ? c.weapon.name : null, perm: !!c.perm })),
      companionsCount: this.companions.length,
      time: Math.floor(this.time),
      armor: p.armor.map((a) => (a ? { name: (a as Armor).name, color: (a as Armor).color, rarity: (a as Armor).rarity } : null)),
      compUpgrades: COMP_UPGRADES.map((u) => this.cu(u.id)),
      boss: this.boss ? { name: this.boss.def.name, title: this.boss.def.title, hp: Math.max(0, Math.ceil(this.boss.hp)), maxHp: this.boss.maxHp, phase: this.boss.phase } : null,
      runPermanents: [...this.runPermanents],
      debugOpen: this.debugOpen, god: this.god,
      meta: {
        credits: metaApi.state.credits,
        artifacts: metaApi.state.artifacts.map((a) => ({ name: a.name, desc: a.desc, color: a.color, rarity: a.rarity })),
        companions: metaApi.state.companions.map((c) => ({ uid: c.uid, name: c.name, color: c.color, rarity: c.rarity })),
        deployed: [...metaApi.state.deployed],
        stats: { ...metaApi.state.stats },
      },
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
    const t = this.menuT
    type D = { y: number; f: () => void }
    const ds: D[] = []
    const inDungeon = this.scene === 'dungeon' && !!this.activeDungeonPoi
    if (!inDungeon) {
      // ---------- ВНЕШНИЙ МИР ----------
      const cx0 = Math.floor(ox / CHUNK), cx1 = Math.floor((ox + W) / CHUNK)
      const cy0 = Math.floor(oy / CHUNK), cy1 = Math.floor((oy + H) / CHUNK)
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(this.getChunk(cx, cy), cx * CHUNK, cy * CHUNK)
      ctx.fillStyle = BIOMES[this.biomeAt(this.camX, this.camY)].fog
      ctx.fillRect(ox, oy, W, H)
      // структуры — в y-сортировке (корректная окклюзия: крыша скрывает тех, кто за зданием)
      for (const poi of this.pois.values()) {
        if (!poi) continue
        if (poi.x < ox - 400 || poi.x > ox + W + 400 || poi.y < oy - 400 || poi.y > oy + H + 400) continue
        const baseY = poi.dungeon ? poi.fp.y + poi.fp.h : poi.y + 18
        ds.push({
          y: baseY, f: () => {
            SP.drawStructure(ctx, poi, t)
            const pd = Math.hypot(poi.x - this.p.x, poi.y - this.p.y)
            if (pd < 260) {
              const ly = poi.y - (poi.dungeon ? poi.fp.h / 2 + 16 : 34)
              ctx.font = '6px "Press Start 2P", monospace'
              ctx.textAlign = 'center'
              ctx.fillStyle = 'rgba(0,0,0,0.7)'
              ctx.fillText(POI_DEFS[poi.type].label, poi.x + 1, ly + 1)
              ctx.fillStyle = poi.state === 'hostile' ? '#ff8a7a' : poi.state === 'cleared' ? '#7dff5e' : '#baf3ff'
              ctx.fillText(POI_DEFS[poi.type].label, poi.x, ly)
            }
          },
        })
      }
    } else {
      // ---------- ИНТЕРЬЕР: отдельная сцена ----------
      const dp = this.activeDungeonPoi!
      SP.drawDungeonBackdrop(ctx, dp, ox, oy, W, H)
      this.drawDungeonTiles(ctx, dp, ox, oy, W, H, t)
      SP.drawDungeonDecor(ctx, dp, t)
    }
    for (const c of this.capsules) if (c.x > ox - 40 && c.x < ox + W + 40 && c.y > oy - 40 && c.y < oy + H + 40) ds.push({ y: c.y, f: () => SP.drawCapsule(ctx, { ...c, body: CAPSULE_COLORS[c.cIdx].body, band: CAPSULE_COLORS[c.cIdx].band }, t) })
    for (const pod of this.pods) ds.push({ y: pod.y, f: () => SP.drawGuildPod(ctx, pod, t) })
    for (const pk of this.pickups) ds.push({
      y: pk.y, f: () => {
        if (pk.rej !== undefined) { ctx.globalAlpha = pk.rej < 0.5 ? 0.35 : 0.6; SP.drawPickup(ctx, { ...pk, color: '#4a5a6a' }, t); ctx.globalAlpha = 1 }
        else SP.drawPickup(ctx, pk, t, this.wv(pk.weapon))
      },
    })
    for (const c of this.companions) ds.push({
      y: c.y, f: () => {
        const wi: SP.WeaponVisual | null = c.weapon
          ? { proj: c.def.proj, kitIdx: Math.max(0, COMP_DEFS.findIndex((d) => d.kind === c.kind)) * 4 + 1, rarity: 2, color: c.weapon.color }
          : null
        SP.drawCompanion(ctx, c, t, wi)
      },
    })
    for (const e of this.enemies) if (e.x > ox - 40 && e.x < ox + W + 40 && e.y > oy - 50 && e.y < oy + H + 40) ds.push({ y: e.y, f: () => { SP.drawEnemy(ctx, e, t); if (e.windup > 0 && (e.type === 'grunt' || e.type === 'brute')) { ctx.fillStyle = `rgba(255,80,60,${0.25 + Math.sin(t * 30) * 0.15})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.type === 'brute' ? 30 : 22, 0, Math.PI * 2); ctx.fill() } if (e.hp < e.maxHp) { const w = e.r * 2; SP.px(ctx, e.x - w / 2, e.y - e.r - 12, w, 2, '#1b1f26'); SP.px(ctx, e.x - w / 2, e.y - e.r - 12, Math.max(1, w * (e.hp / e.maxHp)), 2, '#ff5533') } } })
    const p = this.p
    if (!this.dead) ds.push({
      y: p.y, f: () => {
        if (p.iframes > 0 && Math.sin(t * 40) > 0 && this.spawnAnim >= 1) ctx.globalAlpha = 0.45
        const w = this.curWeapon()
        SP.drawPlayer(ctx, {
          x: p.x, y: p.y, aim: p.aim, walkT: p.walkT, slashT: p.slashT, dashT: p.dashT,
          chestColor: '#5e6e7e', weaponColor: w ? w.color : '#9aa7b8',
          armor: p.armor.map((a) => (a ? { color: (a as Armor).color, rarity: (a as Armor).rarity } : null)),
          weapon: w ? this.wv(w) : null,
        }, t)
        ctx.globalAlpha = 1
        if (this.spawnAnim < 1) {
          const k = this.spawnAnim
          ctx.fillStyle = `rgba(125,255,234,${0.5 * (1 - k)})`
          ctx.fillRect(p.x - 8, p.y - 60 * (1 - k) - 12, 16, 60 * (1 - k) + 16)
        }
      },
    })
    if (this.boss) ds.push({ y: this.boss.y, f: () => drawBoss(ctx, this.boss!, t) })
    ds.sort((a, b) => a.y - b.y)
    for (const d of ds) d.f()

    // подсказки входа/выхода — поверх всего
    if (!inDungeon) {
      if (this.doorPoi) SP.drawDoorMarker(ctx, this.doorPoi, t)
    } else if (this.exitReady) {
      const d = this.activeDungeonPoi!.dungeon!
      const ex = d.ox + d.entry.x, ey = d.oy + d.entry.y
      const k = 0.5 + Math.sin(t * 5) * 0.5
      ctx.strokeStyle = `rgba(255,213,74,${0.4 + k * 0.5})`
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.ellipse(ex, ey + 4, 14 + k * 3, 6, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.font = '6px "Press Start 2P", monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText('[E] ВЫЙТИ', ex + 1, ey - 20)
      ctx.fillStyle = '#ffd54a'
      ctx.fillText('[E] ВЫЙТИ', ex, ey - 21)
    }

    for (const f of this.fallPods) SP.drawFallingPod(ctx, f.x, f.y, 1 - f.t / f.dur, t)
    for (const b of this.bullets) SP.drawBullet(ctx, b, t)
    for (const pt of this.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1)
      ctx.fillStyle = pt.color
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size)
    }
    ctx.globalAlpha = 1
    for (const wpt of this.weather) {
      ctx.globalAlpha = clamp(wpt.life / wpt.max, 0, 1)
      ctx.fillStyle = wpt.color
      ctx.fillRect(Math.round(wpt.x), Math.round(wpt.y), wpt.size, wpt.size)
    }
    ctx.globalAlpha = 1
    if (this.activeDungeonPoi) this.drawDungeonLighting(ctx, t)
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
      if (p.reloadT > 0) {
        const w2 = this.curWeapon()!
        ctx.fillStyle = 'rgba(15,20,27,0.7)'
        ctx.fillRect(mx - 10, my + 8, 20, 3)
        ctx.fillStyle = '#ffd54a'
        ctx.fillRect(mx - 10, my + 8, 20 * (1 - p.reloadT / w2.reload), 3)
      }
    }

    if (this.hurtT > 0) { ctx.fillStyle = `rgba(255,40,20,${this.hurtT * 0.5})`; ctx.fillRect(0, 0, W, H) }
    if (!this.dead && p.hp < p.maxHp * 0.3) { ctx.fillStyle = `rgba(255,40,20,${0.08 + Math.sin(t * 6) * 0.06})`; ctx.fillRect(0, 0, W, H) }

    // переход между миром и интерьером (кольцевая диафрагма)
    if (this.trans) {
      const a = Math.min(1, this.trans.t)
      ctx.fillStyle = `rgba(3,6,12,${a})`
      ctx.fillRect(0, 0, W, H)
      if (a > 0.3) {
        ctx.strokeStyle = `rgba(63,224,255,${(1 - a) * 0.6})`
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(W / 2, H / 2, (1 - a) * 160 + 8, 0, Math.PI * 2); ctx.stroke()
      }
    }

    this.miniT -= 1 / 60
    if (this.miniT <= 0) { this.miniT = 0.1; this.drawMinimap() }
  }

  drawDungeonTiles(ctx: CanvasRenderingContext2D, poi: Poi, ox: number, oy: number, W: number, H: number, t: number) {
    const d = poi.dungeon!
    const style: 'tech' | 'wreck' | 'vault' = poi.type === 'crash' ? 'wreck' : poi.type === 'bunker' ? 'vault' : 'tech'
    const tx0 = Math.max(0, Math.floor((ox - d.ox) / TILE))
    const ty0 = Math.max(0, Math.floor((oy - d.oy) / TILE))
    const tx1 = Math.min(d.cols - 1, Math.floor((ox + W - d.ox) / TILE))
    const ty1 = Math.min(d.rows - 1, Math.floor((oy + H - d.oy) / TILE))
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const tile = d.tiles[ty * d.cols + tx]
      const wx = d.ox + tx * TILE, wy = d.oy + ty * TILE
      const room = roomAt(d, wx, wy)
      const extra: { on?: boolean; room?: string | null; v?: number } = { room: room ? room.kind : null, v: hash2(tx * 7, ty * 13, this.seed) }
      if (tile === 2) extra.on = d.door.open
      else if (tile === 3) {
        const sw = d.switches.find((s) => Math.floor((s.x - d.ox) / TILE) === tx && Math.floor((s.y - d.oy) / TILE) === ty)
        extra.on = !!sw?.on
      } else if (tile === 5) {
        extra.on = (t + hash2(tx, ty, this.seed) * 2.2) % 2.2 > 1.6
      }
      SP.drawDungeonTile(ctx, wx, wy, tile, style, t, extra)
    }
  }

  /** Затемнение данжа с «прорезанными» источниками света */
  lightCv: HTMLCanvasElement | null = null
  drawDungeonLighting(ctx: CanvasRenderingContext2D, t: number) {
    const poi = this.activeDungeonPoi
    if (!poi || !poi.dungeon) return
    const d = poi.dungeon
    const w = d.cols * TILE, h = d.rows * TILE
    if (!this.lightCv) this.lightCv = document.createElement('canvas')
    if (this.lightCv.width !== w || this.lightCv.height !== h) { this.lightCv.width = w; this.lightCv.height = h }
    const g = this.lightCv.getContext('2d')!
    g.clearRect(0, 0, w, h)
    g.fillStyle = 'rgba(3,6,12,0.66)'
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = 'destination-out'
    const hole = (x: number, y: number, r: number, a: number) => {
      const lg = g.createRadialGradient(x, y, 2, x, y, r)
      lg.addColorStop(0, `rgba(255,255,255,${a})`)
      lg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = lg
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // свет игрока
    hole(this.p.x - d.ox, this.p.y - d.oy, 74, 0.95)
    // лампы по зонам
    for (let i = 0; i < d.lamps.length; i++) {
      const l = d.lamps[i]
      const flick = 0.55 + Math.sin(t * (3 + (i % 4)) + i * 2) * 0.18
      hole(l.x - d.ox, l.y - d.oy, l.color === '#ff8a3d' ? 90 : 60, flick)
    }
    // рубильники и дверь
    for (const s of d.switches) if (s.on) hole(s.x - d.ox, s.y - d.oy, 20, 0.7)
    if (d.door.open) hole(d.door.x * TILE + 8, d.door.y * TILE + 8, 26, 0.6)
    // входной проём (нижний шлюз)
    hole(d.entry.x, d.rows * TILE - 6, 34, 0.85)
    // ядро босса
    if (this.boss) hole(this.boss.x - d.ox, this.boss.y - d.oy, 55, 0.85)
    g.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.lightCv, d.ox, d.oy)
    // цветные ореолы ламп (аддитивно)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < d.lamps.length; i += 2) {
      const l = d.lamps[i]
      ctx.fillStyle = l.color + '14'
      ctx.beginPath(); ctx.arc(l.x, l.y, 34, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

  drawMinimap() {
    const m = this.mini
    if (!m) return
    const g = m.getContext('2d')!
    const S = m.width
    g.fillStyle = 'rgba(10,17,26,0.92)'
    g.fillRect(0, 0, S, S)
    const scale = S / 2 / 340
    const cx = S / 2, cy = S / 2
    const plot = (x: number, y: number, color: string, s: number) => {
      const dx = (x - this.camX) * scale, dy = (y - this.camY) * scale
      if (Math.abs(dx) > S / 2 - 3 || Math.abs(dy) > S / 2 - 3) return
      g.fillStyle = color
      g.fillRect(cx + dx - s / 2, cy + dy - s / 2, s, s)
    }
    for (const poi of this.pois.values()) {
      if (!poi) continue
      plot(poi.x, poi.y, poi.dungeon ? '#c96bff' : poi.state === 'hostile' ? '#ff8a3d' : '#3fe0ff', poi.dungeon ? 4 : 3)
    }
    for (const c of this.capsules) plot(c.x, c.y, c.special ? '#3fe0ff' : '#ffd54a', 2)
    for (const pod of this.pods) if (!pod.opened) plot(pod.x, pod.y, '#7dff5e', 4)
    for (const e of this.enemies) plot(e.x, e.y, '#ff5533', e.type === 'brute' ? 3 : 2)
    if (this.boss) plot(this.boss.x, this.boss.y, '#ff5533', 5)
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

  drawShipMode() {
    const ctx = this.ctx
    const W = this.W, H = VIEW_H
    const t = this.menuT
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#05070f')
    g.addColorStop(0.7, '#0a1020')
    g.addColorStop(1, '#0e1626')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    for (const s of this.stars) {
      const tw = 0.4 + Math.abs(Math.sin(t * 2 + s.tw)) * 0.6
      ctx.fillStyle = s.z > 0.7 ? `rgba(220,240,255,${tw})` : `rgba(140,170,210,${tw * 0.7})`
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.z > 0.8 ? 2 : 1, s.z > 0.8 ? 2 : 1)
    }
    ctx.save()
    ctx.translate(Math.round(-(this.camX - W / 2)), Math.round(-(this.camY - H / 2)))
    const bots = metaApi.state.deployed
      .map((uid) => metaApi.state.companions.find((c) => c.uid === uid))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({ kind: c.defKind, color: c.color }))
    drawShipInterior(ctx, t, this.shipZone, this.shipP.x, this.shipP.y, bots)
    SP.drawPlayer(ctx, {
      x: this.shipP.x, y: this.shipP.y, aim: Math.PI / 2,
      walkT: this.keys.KeyW || this.keys.KeyS || this.keys.KeyA || this.keys.KeyD ? this.menuT : 0,
      slashT: 0, dashT: 0, chestColor: '#5e6e7e', weaponColor: '#9aa7b8',
    }, t)
    ctx.restore()
    ctx.font = '6px "Press Start 2P", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(63,224,255,0.6)'
    ctx.fillText('БАРЖА «ВОЛЬНЫЙ ПИК»', 10, H - 10)
  }
}
