// Мировые структуры (POI) и генератор данжей. Детерминировано от (seed, region, cell).
import { Rng } from './rng'
import type { RegionDef } from './regions'

export const CELL = 512
export const TILE = 16

export type PoiType = 'settlement' | 'camp' | 'factory' | 'crash' | 'bunker' | 'relay' | 'outpost'

export interface PoiDef { label: string; radius: number; dungeonChance: number; guards: number }
export const POI_DEFS: Record<PoiType, PoiDef> = {
  settlement: { label: 'ПОСЕЛЕНИЕ «ГАВАНЬ»', radius: 90, dungeonChance: 0, guards: 0 },
  camp: { label: 'ЛАГЕРЬ ПИРАТОВ', radius: 60, dungeonChance: 0, guards: 5 },
  factory: { label: 'СТРАТЕГИЧЕСКИЙ ЗАВОД', radius: 80, dungeonChance: 0.5, guards: 6 },
  crash: { label: 'РАЗБИТЫЙ КОРАБЛЬ', radius: 55, dungeonChance: 0.85, guards: 3 },
  bunker: { label: 'ВОЕННЫЙ БУНКЕР', radius: 55, dungeonChance: 0.9, guards: 4 },
  relay: { label: 'РЕЛЕ-СТАНЦИЯ', radius: 36, dungeonChance: 0, guards: 0 },
  outpost: { label: 'АВАНПОСТ ГИЛЬДИИ', radius: 50, dungeonChance: 0, guards: 0 },
}

// 0 пол, 1 стена, 2 дверь босса, 3 рубильник, 4 хрупкая стена, 5 излучатель
export type DungeonTile = 0 | 1 | 2 | 3 | 4 | 5
export type RoomKind = 'entry' | 'hall' | 'tech' | 'storage' | 'lab' | 'corridor' | 'boss' | 'secret'
export interface Room { x: number; y: number; w: number; h: number; kind: RoomKind }
export interface Lamp { x: number; y: number; color: string; r: number }
export interface DungeonLayout {
  ox: number; oy: number; cols: number; rows: number; tiles: DungeonTile[]
  rooms: Room[]; entry: { x: number; y: number }
  switches: { x: number; y: number; on: boolean }[]
  door: { x: number; y: number; open: boolean }
  bossCenter: { x: number; y: number }
  spawns: { x: number; y: number; tier: number }[]
  containers: { x: number; y: number; tier: number }[]
  hazards: { x: number; y: number }[]
  secretCache: { x: number; y: number; tier: number }
  lamps: Lamp[]
  hpx: number; hpy: number
}
export interface DungeonState { spawned: boolean; switches: boolean[]; doorOpen: boolean; bossSpawned: boolean; cleared: boolean; breakHp: Record<string, number> }

export interface Poi {
  id: string; type: PoiType; x: number; y: number
  state: 'neutral' | 'hostile' | 'cleared'
  guards: number; guardsLeft: number
  dungeon?: DungeonLayout; ds?: DungeonState
  seed: number
}

export function inDungeonBounds(d: DungeonLayout, x: number, y: number): boolean {
  return x > d.ox && x < d.ox + d.cols * TILE && y > d.oy && y < d.oy + d.rows * TILE
}

export function dungeonTileAt(d: DungeonLayout, wx: number, wy: number): DungeonTile {
  const tx = Math.floor((wx - d.ox) / TILE), ty = Math.floor((wy - d.oy) / TILE)
  // за границей сетки — открытый мир (пол): это позволяет ВЫЙТИ через входной проём
  if (tx < 0 || ty < 0 || tx >= d.cols || ty >= d.rows) return 0
  return d.tiles[ty * d.cols + tx]
}

export function setDungeonTile(d: DungeonLayout, wx: number, wy: number, t: DungeonTile) {
  const tx = Math.floor((wx - d.ox) / TILE), ty = Math.floor((wy - d.oy) / TILE)
  if (tx >= 0 && ty >= 0 && tx < d.cols && ty < d.rows) d.tiles[ty * d.cols + tx] = t
}

export function roomAt(d: DungeonLayout, tx: number, ty: number): Room | null {
  for (const r of d.rooms) if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r
  return null
}

function carve(d: DungeonLayout, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.tiles[y * d.cols + x] = 0
}

const LAMP_COLOR: Record<RoomKind, string> = {
  entry: '#9fd8ff', hall: '#ffd9a0', tech: '#3fe0ff', storage: '#f5a623',
  lab: '#7dff5e', corridor: '#ffd54a', boss: '#ff5533', secret: '#c96bff',
}

/** Данж «заброшенный военный комплекс»: полноценная многозонная локация */
export function makeDungeon(seed: number, ox: number, oy: number, tier: number): DungeonLayout {
  const rng = new Rng(seed)
  const cols = 34, rows = 26
  const tiles: DungeonTile[] = new Array(cols * rows).fill(1)
  const d: DungeonLayout = {
    ox, oy, cols, rows, tiles, rooms: [],
    entry: { x: 3 * TILE + 8, y: 13 * TILE - 8 },
    switches: [], door: { x: 0, y: 0, open: false },
    bossCenter: { x: 0, y: 0 }, spawns: [], containers: [], hazards: [],
    secretCache: { x: 0, y: 0, tier: tier + 1 }, lamps: [], hpx: 0, hpy: 0,
  }
  const room = (x: number, y: number, w: number, h: number, kind: RoomKind): Room => {
    carve(d, x, y, x + w - 1, y + h - 1)
    const r = { x, y, w, h, kind }
    d.rooms.push(r)
    return r
  }
  // ЗОНЫ: вход-шлюз -> главный зал с баррикадами -> техотсек/склад по бокам
  // -> коридор с излучателями -> лаборатория -> арена босса; тайник сверху
  const entry = room(1, 11, 5, 4, 'entry')
  const hallA = room(6, 9, 9, 8, 'hall')
  const sideL = room(8, 3, 6, 5, 'tech')
  const sideR = room(8, 18, 6, 5, 'storage')
  const corridor = room(15, 11, 5, 4, 'corridor')
  const hallB = room(20, 8, 7, 10, 'lab')
  const bossR = room(27, 6, 6, 14, 'boss')
  const secret = room(17, 2, 5, 4, 'secret')
  // коридоры между зонами
  carve(d, 10, 7, 11, 9); carve(d, 10, 17, 11, 18)
  carve(d, 21, 4, 22, 8)
  // входной проём в западной стене
  d.tiles[12 * cols + 0] = 0
  d.tiles[13 * cols + 0] = 0
  // дверь в зону ядра
  d.door = { x: 26, y: 12, open: false }
  d.tiles[12 * cols + 26] = 2
  d.tiles[13 * cols + 26] = 2
  // рубильники питания
  d.switches = [
    { x: (sideL.x + 1) * TILE + 8, y: (sideL.y + 1) * TILE + 8, on: false },
    { x: (sideR.x + sideR.w - 2) * TILE + 8, y: (sideR.y + sideR.h - 2) * TILE + 8, on: false },
  ]
  d.tiles[(sideL.y + 1) * cols + sideL.x + 1] = 3
  d.tiles[(sideR.y + sideR.h - 2) * cols + sideR.x + sideR.w - 2] = 3
  d.bossCenter = { x: (bossR.x + 3) * TILE, y: (bossR.y + 7) * TILE }
  // противники по зонам (глубже — опаснее)
  const addSpawns = (r: Room, n: number, t: number) => {
    for (let i = 0; i < n; i++) d.spawns.push({ x: (r.x + 1 + Math.floor(rng.next() * (r.w - 2))) * TILE + 8, y: (r.y + 1 + Math.floor(rng.next() * (r.h - 2))) * TILE + 8, tier: t })
  }
  addSpawns(hallA, 3, 0)
  addSpawns(sideL, 2, 1)
  addSpawns(sideR, 2, 1)
  addSpawns(corridor, 2, 1)
  addSpawns(hallB, 3, 2)
  // контейнеры снабжения
  d.containers.push({ x: (hallA.x + 2) * TILE, y: (hallA.y + 1) * TILE, tier: 1 })
  d.containers.push({ x: (hallB.x + hallB.w - 2) * TILE, y: (hallB.y + 2) * TILE, tier: 2 })
  d.containers.push({ x: (corridor.x + 2) * TILE, y: (corridor.y + corridor.h - 2) * TILE, tier: 1 })
  // излучатели
  const addHazard = (tx: number, ty: number) => { d.tiles[ty * cols + tx] = 5; d.hazards.push({ x: tx * TILE + 8, y: ty * TILE + 8 }) }
  addHazard(16, 12); addHazard(18, 13)
  addHazard(22, 10); addHazard(24, 15); addHazard(23, 12)
  // тайник за хрупкой стеной (коридор x=21..22 запечатан на y=6)
  d.tiles[6 * cols + 21] = 4
  d.tiles[6 * cols + 22] = 4
  d.secretCache = { x: (secret.x + 2) * TILE + 4, y: (secret.y + 2) * TILE + 4, tier: tier + 1 }
  // аварийное освещение по зонам
  for (const r of d.rooms) {
    const c = LAMP_COLOR[r.kind]
    const rad = r.kind === 'boss' ? 44 : r.kind === 'corridor' ? 26 : 34
    d.lamps.push({ x: d.ox + (r.x + 1) * TILE, y: d.oy + (r.y + 1) * TILE, color: c, r: rad })
    d.lamps.push({ x: d.ox + (r.x + r.w - 1) * TILE, y: d.oy + (r.y + r.h - 1) * TILE, color: c, r: rad })
  }
  d.hpx = entry.x
  d.hpy = entry.y
  return d
}

export function makeStarterDungeon(seed: number, region: RegionDef): Poi {
  const rng = new Rng(seed * 31 + 7)
  const x = 220 + rng.range(0, 60), y = -190 - rng.range(0, 50)
  // входной проём совпадает с точкой POI, где рисуется структура
  const dungeon = makeDungeon(seed * 77 + 5, x, y - 12 * TILE, region.tier)
  return {
    id: 'starter', type: 'bunker', x, y, state: 'hostile',
    guards: 0, guardsLeft: 0, dungeon,
    ds: { spawned: false, switches: [false, false], doorOpen: false, bossSpawned: false, cleared: false, breakHp: {} },
    seed,
  }
}

/** Детерминированный POI для ячейки мира */
export function poiForCell(seed: number, region: RegionDef, cx: number, cy: number): Poi | null {
  const rng = new Rng(((seed ^ (cx * 73856093)) ^ (cy * 19349663)) >>> 0)
  if (rng.next() > 0.16) return null
  let total = 0
  for (const e of region.poiTable) total += e.w
  let roll = rng.next() * total
  let type: PoiType = 'camp'
  for (const e of region.poiTable) { roll -= e.w; if (roll <= 0) { type = e.type; break } }
  const def = POI_DEFS[type]
  const x = cx * CELL + CELL / 2 + rng.range(-120, 120)
  const y = cy * CELL + CELL / 2 + rng.range(-120, 120)
  const id = `${region.id}_${cx}_${cy}`
  const guards = def.guards + Math.floor(rng.next() * 2)
  const hasDungeon = rng.next() < def.dungeonChance && (type === 'factory' || type === 'crash' || type === 'bunker')
  // входной проём совпадает с точкой POI
  const dungeon = hasDungeon ? makeDungeon((seed ^ (cx * 2654435761) ^ (cy * 40503)) >>> 0, x, y - 12 * TILE, region.tier) : undefined
  return {
    id, type, x, y,
    state: guards > 0 ? 'hostile' : 'neutral',
    guards, guardsLeft: guards,
    dungeon,
    ds: dungeon ? { spawned: false, switches: [false, false], doorOpen: false, bossSpawned: false, cleared: false, breakHp: {} } : undefined,
    seed,
  }
}
