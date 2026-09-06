// ============================================================
// МИРОВЫЕ СТРУКТУРЫ (POI) + архитектурный генератор данжей.
// Детерминированно от (seed, region, cell). Типизированная
// room-грамматика: bunker / lab / factory / crash.
// ============================================================
import { Rng } from './rng'
import type { RegionDef } from './regions'

export const CELL = 512
export const TILE = 16
export const WALL_M = 10 // внешняя толщина стены корпуса (px)

export type PoiType = 'settlement' | 'camp' | 'factory' | 'crash' | 'bunker' | 'relay' | 'outpost'
export type DungeonType = 'bunker' | 'lab' | 'factory' | 'crash'

export interface PoiDef { label: string; radius: number; dungeonChance: number; guards: number; dtype?: DungeonType }
export const POI_DEFS: Record<PoiType, PoiDef> = {
  settlement: { label: 'ПОСЕЛЕНИЕ «ГАВАНЬ»', radius: 110, dungeonChance: 0, guards: 0 },
  camp: { label: 'ЛАГЕРЬ ПИРАТОВ', radius: 70, dungeonChance: 0, guards: 5 },
  factory: { label: 'ПРОМЫШЛЕННЫЙ ЗАВОД', radius: 100, dungeonChance: 0.6, guards: 6, dtype: 'factory' },
  crash: { label: 'РАЗБИТЫЙ КОРАБЛЬ', radius: 80, dungeonChance: 0.85, guards: 3, dtype: 'crash' },
  bunker: { label: 'ВОЕННЫЙ БУНКЕР', radius: 90, dungeonChance: 0.9, guards: 4, dtype: 'bunker' },
  relay: { label: 'РЕЛЕ-СТАНЦИЯ', radius: 42, dungeonChance: 0, guards: 0 },
  outpost: { label: 'АВАНПОСТ ГИЛЬДИИ', radius: 60, dungeonChance: 0, guards: 0 },
}

// Тайлы: 0 пол · 1 стена · 2 запертая дверь · 3 рубильник · 4 хрупкая стена · 5 ловушка · 6 вход/выход
export type DungeonTile = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Room { x: number; y: number; w: number; h: number; kind: string; name: string }
export interface DecorObj { x: number; y: number; w: number; h: number; type: string; block: boolean }
export interface SetPiece { x: number; y: number; type: string; w: number; h: number }

export interface DungeonLayout {
  type: DungeonType
  ox: number; oy: number
  cols: number; rows: number
  tiles: DungeonTile[]
  rooms: Room[]
  entry: { x: number; y: number }
  switches: { x: number; y: number; on: boolean }[]
  door: { x: number; y: number; open: boolean }
  bossCenter: { x: number; y: number }
  spawns: { x: number; y: number; tier: number }[]
  containers: { x: number; y: number; tier: number }[]
  hazards: { x: number; y: number }[]
  decor: DecorObj[]
  setPieces: SetPiece[]
  lamps: { x: number; y: number; color: string }[]
  secretCache: { x: number; y: number; tier: number }
}

export interface DungeonState {
  spawned: boolean; switches: boolean[]; doorOpen: boolean
  bossSpawned: boolean; cleared: boolean; breakHp: Record<string, number>
}

export interface Poi {
  id: string; type: PoiType; x: number; y: number
  state: 'neutral' | 'hostile' | 'cleared'
  guards: number; guardsLeft: number
  dungeon?: DungeonLayout; ds?: DungeonState
  seed: number
  fp: { x: number; y: number; w: number; h: number }
  doorWorld: { x: number; y: number }
  style: number
}

// ---------- базовые хелперы ----------
export function inDungeonBounds(d: DungeonLayout, x: number, y: number): boolean {
  return x > d.ox && x < d.ox + d.cols * TILE && y > d.oy && y < d.oy + d.rows * TILE
}

export function dungeonTileAt(d: DungeonLayout, wx: number, wy: number): DungeonTile {
  const tx = Math.floor((wx - d.ox) / TILE), ty = Math.floor((wy - d.oy) / TILE)
  // За пределами сетки — СВОБОДНО (чтобы можно было выйти через дверной проём)
  if (tx < 0 || ty < 0 || tx >= d.cols || ty >= d.rows) return 0
  return d.tiles[ty * d.cols + tx]
}

export function setDungeonTile(d: DungeonLayout, wx: number, wy: number, t: DungeonTile) {
  const tx = Math.floor((wx - d.ox) / TILE), ty = Math.floor((wy - d.oy) / TILE)
  if (tx >= 0 && ty >= 0 && tx < d.cols && ty < d.rows) d.tiles[ty * d.cols + tx] = t
}

export function roomAt(d: DungeonLayout, wx: number, wy: number): Room | null {
  const tx = Math.floor((wx - d.ox) / TILE), ty = Math.floor((wy - d.oy) / TILE)
  for (const r of d.rooms) if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r
  return null
}

function carve(d: DungeonLayout, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.tiles[y * d.cols + x] = 0
}
function setT(d: DungeonLayout, x: number, y: number, t: DungeonTile) {
  if (x >= 0 && y >= 0 && x < d.cols && y < d.rows) d.tiles[y * d.cols + x] = t
}

// Планировки комнат по типам (в тайлах). Каждая — своя архитектурная логика.
interface Plan { room: [number, number, number, number]; kind: string; name: string }
const PLANS: Record<DungeonType, Plan[]> = {
  bunker: [
    { room: [16, 26, 8, 4], kind: 'entry', name: 'ШЛЮЗ' },
    { room: [12, 19, 16, 7], kind: 'guard', name: 'КАРАУЛЬНЫЙ ЗАЛ' },
    { room: [4, 19, 7, 7], kind: 'armory', name: 'ОРУЖЕЙНАЯ' },
    { room: [29, 19, 9, 7], kind: 'barracks', name: 'КАЗАРМА' },
    { room: [12, 11, 16, 7], kind: 'corridor', name: 'ЦЕНТРАЛЬНЫЙ КОРИДОР' },
    { room: [4, 11, 7, 7], kind: 'storage', name: 'СКЛАД' },
    { room: [29, 11, 9, 7], kind: 'tech', name: 'ТЕХОТСЕК' },
    { room: [12, 2, 16, 8], kind: 'boss', name: 'КОМАНДНЫЙ ЦЕНТР' },
    { room: [29, 2, 9, 7], kind: 'secret', name: 'АРХИВ' },
  ],
  lab: [
    { room: [16, 26, 8, 4], kind: 'entry', name: 'ДЕЗАКТИВАЦИЯ' },
    { room: [12, 19, 16, 7], kind: 'guard', name: 'ВЕСТИБЮЛЬ' },
    { room: [4, 19, 7, 7], kind: 'armory', name: 'СЕРВЕРНАЯ' },
    { room: [29, 19, 9, 7], kind: 'barracks', name: 'КАРАНТИН' },
    { room: [12, 11, 16, 7], kind: 'corridor', name: 'ГАЛЕРЕЯ' },
    { room: [4, 11, 7, 7], kind: 'storage', name: 'ХРАНИЛИЩЕ ОБРАЗЦОВ' },
    { room: [29, 11, 9, 7], kind: 'tech', name: 'РЕАКТОРНАЯ' },
    { room: [12, 2, 16, 8], kind: 'boss', name: 'ЛАБОРАТОРИЯ «ОМЕГА»' },
    { room: [4, 2, 7, 7], kind: 'secret', name: 'СЕКРЕТНАЯ ЛАБОРАТОРИЯ' },
  ],
  factory: [
    { room: [16, 26, 8, 4], kind: 'entry', name: 'ПРОХОДНАЯ' },
    { room: [12, 19, 16, 7], kind: 'guard', name: 'ЦЕХ СБОРКИ' },
    { room: [4, 19, 7, 7], kind: 'armory', name: 'ИНСТРУМЕНТАЛКА' },
    { room: [29, 19, 9, 7], kind: 'barracks', name: 'ПОГРУЗОЧНАЯ' },
    { room: [12, 11, 16, 7], kind: 'corridor', name: 'КОНВЕЙЕРНАЯ ЛИНИЯ' },
    { room: [4, 11, 7, 7], kind: 'storage', name: 'СКЛАД ЗАГОТОВОК' },
    { room: [29, 11, 9, 7], kind: 'tech', name: 'ЭНЕРГОУЗЕЛ' },
    { room: [12, 2, 16, 8], kind: 'boss', name: 'ГЛАВНЫЙ ЦЕХ' },
    { room: [29, 2, 9, 7], kind: 'secret', name: 'БРАКОВАННАЯ ПАРТИЯ' },
  ],
  crash: [
    { room: [16, 26, 8, 4], kind: 'entry', name: 'ПРОБОИНА' },
    { room: [12, 19, 16, 7], kind: 'guard', name: 'ГРУЗОВОЙ ОТСЕК' },
    { room: [4, 19, 7, 7], kind: 'armory', name: 'КАМБУЗ' },
    { room: [29, 19, 9, 7], kind: 'barracks', name: 'КАЮТЫ' },
    { room: [12, 11, 16, 7], kind: 'corridor', name: 'ПАЛУБНЫЙ КОРИДОР' },
    { room: [4, 11, 7, 7], kind: 'storage', name: 'ТРЮМ' },
    { room: [29, 11, 9, 7], kind: 'tech', name: 'ДВИГАТЕЛЬНЫЙ' },
    { room: [12, 2, 16, 8], kind: 'boss', name: 'МОСТИК' },
    { room: [4, 2, 7, 7], kind: 'secret', name: 'КАПITАНСКАЯ КАЮТА' },
  ],
}

export function makeDungeon(seed: number, ox: number, oy: number, tier: number, type: DungeonType): DungeonLayout {
  const rng = new Rng(seed)
  const cols = 42, rows = 31
  const tiles: DungeonTile[] = new Array(cols * rows).fill(1)
  const d: DungeonLayout = {
    type, ox, oy, cols, rows, tiles, rooms: [],
    entry: { x: 0, y: 0 }, switches: [], door: { x: 0, y: 0, open: false },
    bossCenter: { x: 0, y: 0 }, spawns: [], containers: [], hazards: [],
    decor: [], setPieces: [], lamps: [],
    secretCache: { x: 0, y: 0, tier: tier + 1 },
  }
  const plan = PLANS[type]
  // вырезаем комнаты
  for (const p of plan) {
    const [x, y, w, h] = p.room
    carve(d, x, y, x + w - 1, y + h - 1)
    d.rooms.push({ x, y, w, h, kind: p.kind, name: p.name })
  }
  const room = (kind: string) => d.rooms.find((r) => r.kind === kind)!
  // вертикальные коридоры-связки
  carve(d, 19, 9, 20, 11)   // corridor -> boss
  carve(d, 19, 17, 20, 19)  // guard -> corridor
  carve(d, 19, 25, 20, 26)  // entry -> guard
  carve(d, 7, 17, 8, 19)    // armory -> storage
  carve(d, 33, 17, 34, 19)  // barracks -> tech
  carve(d, 33, 8, 34, 11)   // secret <-> tech (к секрету)
  // двери: вход (нижняя стена шлюза) и дверь босса
  const ent = room('entry')
  d.entry = { x: (ent.x + 4) * TILE, y: (ent.y + 2) * TILE }
  setT(d, ent.x + 3, ent.y + ent.h, 6); setT(d, ent.x + 4, ent.y + ent.h, 6)
  const boss = room('boss')
  d.door = { x: 19, y: 10, open: false }
  setT(d, 19, 10, 2); setT(d, 20, 10, 2)
  // рубильники в боковых комнатах
  const arm = room('armory'), tec = room('tech')
  d.switches = [
    { x: (arm.x + 3) * TILE + 8, y: (arm.y + 3) * TILE + 8, on: false },
    { x: (tec.x + tec.w - 3) * TILE + 8, y: (tec.y + tec.h - 3) * TILE + 8, on: false },
  ]
  setT(d, arm.x + 3, arm.y + 3, 3)
  setT(d, tec.x + tec.w - 3, tec.y + tec.h - 3, 3)
  // центр босс-арены
  d.bossCenter = { x: (boss.x + 8) * TILE, y: (boss.y + 4) * TILE }
  // враги по зонам
  const addSpawns = (r: Room, n: number, t: number) => {
    for (let i = 0; i < n; i++) {
      d.spawns.push({ x: (r.x + 1 + Math.floor(rng.next() * (r.w - 2))) * TILE + 8, y: (r.y + 1 + Math.floor(rng.next() * (r.h - 2))) * TILE + 8, tier: t })
    }
  }
  addSpawns(room('guard'), 4, 0)
  addSpawns(room('armory'), 2, 1)
  addSpawns(room('barracks'), 2, 1)
  addSpawns(room('corridor'), 3, 1)
  addSpawns(room('storage'), 2, 1)
  addSpawns(room('tech'), 2, 2)
  // контейнеры
  d.containers.push({ x: (room('guard').x + 2) * TILE, y: (room('guard').y + 1) * TILE, tier: 1 })
  d.containers.push({ x: (room('storage').x + 3) * TILE, y: (room('storage').y + 3) * TILE, tier: 1 })
  d.containers.push({ x: (room('tech').x + 2) * TILE, y: (room('tech').y + 2) * TILE, tier: 2 })
  d.containers.push({ x: (room('corridor').x + room('corridor').w - 2) * TILE, y: (room('corridor').y + 3) * TILE, tier: 1 })
  // ловушки в коридоре и тех-зонах
  const addHazard = (tx: number, ty: number) => { setT(d, tx, ty, 5); d.hazards.push({ x: tx * TILE + 8, y: ty * TILE + 8 }) }
  addHazard(15, 14); addHazard(18, 13); addHazard(23, 14); addHazard(26, 13)
  addHazard(31, 13); addHazard(35, 15)
  // секрет за хрупкой стеной
  const sec = room('secret')
  const secSide = type === 'bunker' || type === 'factory' ? 'left' : 'bottom'
  if (secSide === 'left') { setT(d, sec.x - 1, sec.y + 3, 4) }
  else { setT(d, sec.x + 3, sec.y + sec.h, 4) }
  d.secretCache = { x: (sec.x + 2) * TILE + 4, y: (sec.y + 2) * TILE + 4, tier: tier + 1 }
  // декор и set pieces по типу
  populateDecor(d, rng, type)
  // лампы
  for (const r of d.rooms) {
    d.lamps.push({ x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE, color: r.kind === 'boss' ? '#ff8a3d' : '#baf3ff' })
  }
  return d
}

function populateDecor(d: DungeonLayout, rng: Rng, type: DungeonType) {
  const room = (k: string) => d.rooms.find((r) => r.kind === k)!
  const deco = (r: Room, t: string, dx: number, dy: number, w: number, h: number, block = true) =>
    d.decor.push({ x: (r.x + dx) * TILE, y: (r.y + dy) * TILE, w: w * TILE, h: h * TILE, type: t, block })
  // общие: груды обломков у входа
  deco(room('guard'), 'debris', 1, 1, 2, 1, false)
  deco(room('entry'), 'warning', 1, 0, 1, 1, false)
  if (type === 'bunker') {
    deco(room('armory'), 'weaponrack', 1, 0, 4, 1)
    deco(room('barracks'), 'bunk', 1, 1, 3, 2)
    deco(room('barracks'), 'locker', 6, 0, 2, 1)
    deco(room('storage'), 'crate', 1, 1, 2, 2)
    deco(room('storage'), 'crate', 4, 3, 2, 2)
    deco(room('tech'), 'generator', 2, 1, 3, 3)
    d.setPieces.push({ x: (room('boss').x + 6) * TILE, y: (room('boss').y + 1) * TILE, type: 'warholo', w: 4 * TILE, h: 3 * TILE })
  } else if (type === 'lab') {
    deco(room('armory'), 'server', 1, 0, 2, 4)
    deco(room('barracks'), 'pod', 1, 1, 2, 3)
    deco(room('barracks'), 'pod', 4, 1, 2, 3)
    deco(room('storage'), 'vat', 2, 1, 2, 3)
    deco(room('tech'), 'reactor', 2, 1, 4, 4)
    d.setPieces.push({ x: (room('boss').x + 5) * TILE, y: (room('boss').y + 1) * TILE, type: 'specimen', w: 6 * TILE, h: 4 * TILE })
  } else if (type === 'factory') {
    deco(room('corridor'), 'conveyor', 2, 2, 8, 2, false)
    deco(room('armory'), 'workbench', 1, 1, 3, 2)
    deco(room('barracks'), 'pallet', 1, 1, 3, 2)
    deco(room('storage'), 'crate', 1, 1, 2, 2)
    deco(room('storage'), 'crate', 3, 3, 3, 2)
    deco(room('tech'), 'transformer', 2, 1, 3, 4)
    d.setPieces.push({ x: (room('boss').x + 5) * TILE, y: (room('boss').y + 1) * TILE, type: 'assembly', w: 6 * TILE, h: 4 * TILE })
  } else {
    deco(room('armory'), 'galley', 1, 1, 3, 2)
    deco(room('barracks'), 'bunk', 1, 1, 3, 2)
    deco(room('barracks'), 'bunk', 5, 1, 3, 2)
    deco(room('storage'), 'crate', 1, 1, 2, 2)
    deco(room('storage'), 'barrel', 4, 2, 2, 2)
    deco(room('tech'), 'engine', 2, 1, 4, 4)
    d.setPieces.push({ x: (room('boss').x + 5) * TILE, y: (room('boss').y + 1) * TILE, type: 'console', w: 6 * TILE, h: 3 * TILE })
    // пробоины
    d.decor.push({ x: (room('corridor').x + 1) * TILE, y: (room('corridor').y) * TILE, w: 2 * TILE, h: TILE, type: 'breach', block: false })
  }
  void rng
}

// ---------- внешний POI ----------
function buildPoi(id: string, type: PoiType, x: number, y: number, seed: number, rng: Rng, tier: number): Poi {
  const def = POI_DEFS[type]
  const guards = def.guards + Math.floor(rng.next() * 2)
  const hasDungeon = !!def.dtype && rng.next() < def.dungeonChance
  let dungeon: DungeonLayout | undefined
  let fp = { x: x - 30, y: y - 24, w: 60, h: 48 }
  let doorWorld = { x, y: y + 28 }
  if (hasDungeon) {
    const cols = 42, rows = 31
    const ox = x - (cols * TILE) / 2
    const oy = y - (rows * TILE) / 2
    dungeon = makeDungeon((seed ^ (x * 2654435761) ^ (y * 40503)) >>> 0, ox, oy, tier, def.dtype!)
    fp = { x: ox - WALL_M, y: oy - WALL_M, w: cols * TILE + WALL_M * 2, h: rows * TILE + WALL_M * 2 }
    // дверь снаружи нижней стены, напротив шлюза
    doorWorld = { x: ox + dungeon.entry.x, y: fp.y + fp.h + 6 }
  }
  return {
    id, type, x, y,
    state: guards > 0 ? 'hostile' : 'neutral',
    guards, guardsLeft: guards,
    dungeon,
    ds: dungeon ? { spawned: false, switches: [false, false], doorOpen: false, bossSpawned: false, cleared: false, breakHp: {} } : undefined,
    seed, fp, doorWorld,
    style: Math.floor(rng.next() * 3),
  }
}

export function makeStarterDungeon(seed: number, region: RegionDef): Poi {
  const rng = new Rng(seed * 31 + 7)
  const x = 260 + rng.range(0, 60), y = -260 - rng.range(0, 50)
  const poi = buildPoi('starter', 'bunker', x, y, seed * 77 + 5, rng, region.tier)
  // гарантируем данж у стартового
  if (!poi.dungeon) {
    const cols = 42, rows = 31
    const ox = x - (cols * TILE) / 2, oy = y - (rows * TILE) / 2
    poi.dungeon = makeDungeon(seed * 77 + 5, ox, oy, region.tier, 'bunker')
    poi.fp = { x: ox - WALL_M, y: oy - WALL_M, w: cols * TILE + WALL_M * 2, h: rows * TILE + WALL_M * 2 }
    poi.doorWorld = { x: ox + poi.dungeon.entry.x, y: poi.fp.y + poi.fp.h + 6 }
    poi.ds = { spawned: false, switches: [false, false], doorOpen: false, bossSpawned: false, cleared: false, breakHp: {} }
  }
  return poi
}

export function poiForCell(seed: number, region: RegionDef, cx: number, cy: number): Poi | null {
  const rng = new Rng(((seed ^ (cx * 73856093)) ^ (cy * 19349663)) >>> 0)
  if (rng.next() > 0.18) return null
  let total = 0
  for (const e of region.poiTable) total += e.w
  let roll = rng.next() * total
  let type: PoiType = 'camp'
  for (const e of region.poiTable) { roll -= e.w; if (roll <= 0) { type = e.type; break } }
  const x = cx * CELL + CELL / 2 + rng.range(-110, 110)
  const y = cy * CELL + CELL / 2 + rng.range(-110, 110)
  return buildPoi(`${region.id}_${cx}_${cy}`, type, x, y, seed, rng, region.tier)
}
