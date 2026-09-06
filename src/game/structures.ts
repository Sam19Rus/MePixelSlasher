// ============================================================
// МИРОВЫЕ СТРУКТУРЫ (POI) + ПРОЦЕДУРНЫЙ АРХИТЕКТУРНЫЙ ГЕНЕРАТОР
// Детерминированно от (seed, region, cell).
//
// КОНТРАКТ КООРДИНАТ (важно!):
//  - rooms, door{x,y}            -> ТАЙЛЫ
//  - entry, spawns, containers,
//    secretCache, hazards, decor,
//    setPieces, bossCenter       -> пиксели ОТНОСИТЕЛЬНО (ox,oy) данжа
//  - switches{x,y}, lamps{x,y}   -> МИРОВЫЕ пиксели (движок сравнивает
//                                   рубильники с мировой позицией игрока)
//
// Каждый экземпляр собирается из совместимых архитектурных частей
// (слоты-полосы + коридорный хребет) — seed меняет АРХИТЕКТУРУ,
// а не только декор. Валидация BFS: если layout непроходим —
// перегенерация с вариацией seed.
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
  entry: { x: number; y: number }          // local px
  switches: { x: number; y: number; on: boolean }[]  // WORLD px
  door: { x: number; y: number; open: boolean }      // tiles
  bossCenter: { x: number; y: number }     // local px
  spawns: { x: number; y: number; tier: number }[]   // local px
  containers: { x: number; y: number; tier: number }[] // local px
  hazards: { x: number; y: number }[]      // local px
  decor: DecorObj[]                        // local px
  setPieces: SetPiece[]                    // local px
  lamps: { x: number; y: number; color: string }[]   // WORLD px
  secretCache: { x: number; y: number; tier: number } // local px
  silhouette: number                       // вариант внешнего силуэта
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
  factionArch: string
}

// ---------- базовые хелперы ----------
export function inDungeonBounds(d: DungeonLayout, x: number, y: number): boolean {
  return x > d.ox && x < d.ox + d.cols * TILE && y > d.oy && y < d.oy + d.rows * TILE
}

export function dungeonTileAt(d: DungeonLayout, wx: number, wy: number): DungeonTile {
  const tx = Math.floor((wx - d.ox) / TILE), ty = Math.floor((wy - d.oy) / TILE)
  // За пределами сетки — СВОБОДНО (выход через дверной проём)
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

// ============================================================
// АРХИТЕКТУРНАЯ ГРАММАТИКА ПО ТИПАМ
// ============================================================
type RoomKind = 'entry' | 'guard' | 'corridor' | 'armory' | 'barracks' | 'storage' | 'tech' | 'med' | 'command' | 'boss' | 'secret' | 'hall'

const KIND_NAMES: Record<DungeonType, Partial<Record<RoomKind, string[]>>> = {
  bunker: {
    entry: ['ШЛЮЗ', 'ВХОДНОЙ БЛОК'], guard: ['КАРАУЛЬНЫЙ ЗАЛ', 'КПП'], corridor: ['ЦЕНТРАЛЬНЫЙ КОРИДОР', 'ГАЛЕРЕЯ'],
    armory: ['ОРУЖЕЙНАЯ', 'АРСЕНАЛ'], barracks: ['КАЗАРМА', 'СПАЛЬНЫЙ БЛОК'], storage: ['СКЛАД', 'ХРАНИЛИЩЕ'],
    tech: ['ТЕХОТСЕК', 'ГЕНЕРАТОРНАЯ'], med: ['МЕДПУНКТ'], command: ['КОМАНДНЫЙ ЦЕНТР', 'ШТАБ'],
    boss: ['ЦЕНТРАЛЬНЫЙ ЗАЛ', 'КОМАНДНЫЙ МОДУЛЬ'], secret: ['АРХИВ', 'СЕЙФОВАЯ'], hall: ['СТРОЕВОЙ ДВОР'],
  },
  lab: {
    entry: ['ДЕЗАКТИВАЦИЯ', 'ПРИЁМНЫЙ ШЛЮЗ'], guard: ['ВЕСТИБЮЛЬ', 'ОХРАННЫЙ ПОСТ'], corridor: ['ГАЛЕРЕЯ', 'ТРАНСПОРТНЫЙ ТОННЕЛЬ'],
    armory: ['СЕРВЕРНАЯ', 'Щитовая'], barracks: ['КАРАНТИН', 'ИЗОЛЯТОР'], storage: ['ХРАНИЛИЩЕ ОБРАЗЦОВ', 'КРИОСКЛАД'],
    tech: ['РЕАКТОРНАЯ', 'ПИТАНИЕ'], med: ['МЕДЛАБ'], command: ['ДИСПЕТЧЕРСКАЯ'],
    boss: ['ЛАБОРАТОРИЯ «ОМЕГА»', 'ЭКСПЕРИМЕНТАЛЬНЫЙ ЗАЛ'], secret: ['СЕКРЕТНАЯ ЛАБОРАТОРИЯ'], hall: ['ЦЕНТРАЛЬНЫЙ ХОЛЛ'],
  },
  factory: {
    entry: ['ПРОХОДНАЯ', 'КОНТРОЛЬ'], guard: ['ЦЕХ СБОРКИ', 'ПРИЁМКА'], corridor: ['КОНВЕЙЕРНАЯ ЛИНИЯ', 'ПРОЛЁТ'],
    armory: ['ИНСТРУМЕНТАЛКА', 'МАСТЕРСКАЯ'], barracks: ['БЫТОВКА', 'РАЗДЕВАЛКА'], storage: ['СКЛАД ЗАГОТОВОК', 'БУНКЕР'],
    tech: ['ЭНЕРГОУЗЕЛ', 'КОМПРЕССОРНАЯ'], med: ['МЕДПУНКТ'], command: ['АДМИНИСТРАЦИЯ', 'ДИСПЕТЧЕРСКАЯ'],
    boss: ['ГЛАВНЫЙ ЦЕХ', 'ЛИТЕЙНЫЙ ЗАЛ'], secret: ['БРАКОВАННАЯ ПАРТИЯ', 'ТЕХТОННЕЛЬ'], hall: ['ПОГРУЗОЧНЫЙ ДВОР'],
  },
  crash: {
    entry: ['ПРОБОИНА', 'АВАРИЙНЫЙ ШЛЮЗ'], guard: ['ГРУЗОВОЙ ОТСЕК', 'ТРЮМ'], corridor: ['ПАЛУБНЫЙ КОРИДОР', 'ШАХТА'],
    armory: ['КАМБУЗ', 'КЛАДОВАЯ'], barracks: ['КАЮТЫ', 'ОБЩИЙ ОТСЕК'], storage: ['ГРУЗОВАЯ СЕТЬ', 'КОНТЕЙНЕРНЫЙ'],
    tech: ['ДВИГАТЕЛЬНЫЙ', 'РЕАКТОРНЫЙ'], med: ['ЛАЗАРЕТ'], command: ['НАВИГАЦИОННАЯ'],
    boss: ['МОСТИК', 'ЯДЕРНЫЙ ОТСЕК'], secret: ['КАПИТАНСКАЯ КАЮТА'], hall: ['ШЛЮЗОВАЯ ПАЛУБА'],
  },
}

const pickName = (rng: Rng, type: DungeonType, kind: RoomKind): string => {
  const arr = KIND_NAMES[type][kind]
  return arr ? arr[Math.floor(rng.next() * arr.length)] : kind.toUpperCase()
}

// ---------- сетка слотов ----------
interface Slot { x: number; y: number; w: number; h: number; band: number }

function carve(d: DungeonLayout, x0: number, y0: number, x1: number, y1: number) {
  for (let y = Math.max(0, y0); y <= Math.min(d.rows - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(d.cols - 1, x1); x++)
      d.tiles[y * d.cols + x] = 0
}
function setT(d: DungeonLayout, x: number, y: number, t: DungeonTile) {
  if (x >= 0 && y >= 0 && x < d.cols && y < d.rows) d.tiles[y * d.cols + x] = t
}

// ============================================================
// ГЕНЕРАТОР: слоты-полосы + хребет, вариантность от seed
// ============================================================
export function makeDungeon(seed: number, ox: number, oy: number, tier: number, type: DungeonType): DungeonLayout {
  // несколько попыток с вариацией seed — если layout невалиден
  for (let attempt = 0; attempt < 6; attempt++) {
    const d = buildAttempt(seed + attempt * 101, ox, oy, tier, type)
    if (validate(d)) return d
  }
  // гарантированно валидный запасной вариант (прямой хребет)
  return buildFallback(seed, ox, oy, tier, type)
}

function buildAttempt(seed: number, ox: number, oy: number, tier: number, type: DungeonType): DungeonLayout {
  const rng = new Rng(seed)
  // размер варьИРУЕТСЯ: компактные и вытянутые экземпляры
  const cols = 36 + Math.floor(rng.next() * 12)   // 36..47
  const rows = 26 + Math.floor(rng.next() * 8)    // 26..33
  const tiles: DungeonTile[] = new Array(cols * rows).fill(1)
  const d: DungeonLayout = {
    type, ox, oy, cols, rows, tiles, rooms: [],
    entry: { x: 0, y: 0 }, switches: [], door: { x: 0, y: 0, open: false },
    bossCenter: { x: 0, y: 0 }, spawns: [], containers: [], hazards: [],
    decor: [], setPieces: [], lamps: [],
    secretCache: { x: 0, y: 0, tier: tier + 1 },
    silhouette: Math.floor(rng.next() * 3),
  }

  // ---- полосы слотов: entry снизу -> ... -> boss сверху ----
  const bandH = 6
  const nBands = Math.min(5, Math.floor((rows - 4) / bandH))
  const bands: Slot[][] = []
  for (let b = 0; b < nBands; b++) {
    const by = rows - 4 - (b + 1) * bandH
    const nSlots = b === 0 || b === nBands - 1 ? 1 : 2 + (rng.next() < 0.5 ? 1 : 0)
    const slots: Slot[] = []
    const gap = 2
    const usable = cols - 4 - gap * (nSlots - 1)
    let cx = 2
    for (let s = 0; s < nSlots; s++) {
      const w = s === nSlots - 1 ? cols - 2 - cx : Math.max(5, Math.floor(usable / nSlots) + Math.floor(rng.next() * 3) - 1)
      slots.push({ x: cx, y: by, w: Math.min(w, cols - 2 - cx), h: bandH - 1, band: b })
      cx += slots[slots.length - 1].w + gap
    }
    bands.push(slots)
  }

  // назначение типов комнат: нижняя полоса — вход+охрана, верхняя — босс
  const roomKinds: RoomKind[][] = []
  const sidePool: RoomKind[] = ['armory', 'barracks', 'storage', 'tech', 'med', 'command', 'hall']
  // перемешиваем пул (детерминированно)
  for (let i = sidePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const t2 = sidePool[i]; sidePool[i] = sidePool[j]; sidePool[j] = t2
  }
  let poolIdx = 0
  for (let b = 0; b < nBands; b++) {
    const kinds: RoomKind[] = []
    for (let s = 0; s < bands[b].length; s++) {
      if (b === 0) kinds.push(s === 0 ? 'entry' : 'guard')
      else if (b === nBands - 1) kinds.push(s === 0 ? 'boss' : (sidePool[poolIdx++ % sidePool.length]))
      else kinds.push(sidePool[poolIdx++ % sidePool.length])
    }
    roomKinds.push(kinds)
  }
  // гарантируем tech (рубильник) и хотя бы один storage
  const allKinds = roomKinds.flat()
  if (!allKinds.includes('tech')) {
    for (let b = 1; b < nBands - 1; b++) for (let s = 0; s < roomKinds[b].length; s++)
      if (roomKinds[b][s] === 'hall') { roomKinds[b][s] = 'tech' }
    if (!roomKinds.flat().includes('tech') && nBands > 2) roomKinds[1][roomKinds[1].length - 1] = 'tech'
  }

  // вырезаем комнаты
  for (let b = 0; b < nBands; b++) for (let s = 0; s < bands[b].length; s++) {
    const sl = bands[b][s]
    carve(d, sl.x, sl.y, sl.x + sl.w - 1, sl.y + sl.h - 1)
    d.rooms.push({ x: sl.x, y: sl.y, w: sl.w, h: sl.h, kind: roomKinds[b][s], name: pickName(rng, type, roomKinds[b][s]) })
  }

  // ---- вертикальные коридоры-связки между полосами (хребет) ----
  const spineX = 2 + Math.floor(rng.next() * (cols - 6))
  for (let b = 0; b < nBands - 1; b++) {
    const yTop = bands[b + 1][0].y + bands[b + 1][0].h
    const yBot = bands[b][0].y
    carve(d, spineX, yTop, spineX + 1, yBot - 1)
    // горизонтальные ответвления к слотам полосы
    for (const sl of bands[b + 1]) {
      const midY = sl.y + Math.floor(sl.h / 2)
      if (spineX < sl.x) carve(d, spineX + 1, midY, sl.x - 1, midY + 1)
      else if (spineX + 1 >= sl.x + sl.w) carve(d, sl.x + sl.w, midY, spineX - 1, midY + 1)
      else {
        const my = sl.y + sl.h
        carve(d, spineX, my, spineX + 1, Math.min(rows - 2, my))
      }
    }
    for (const sl of bands[b]) {
      const midY = sl.y + Math.floor(sl.h / 2)
      if (spineX < sl.x) carve(d, spineX + 1, midY, sl.x - 1, midY + 1)
      else if (spineX + 1 >= sl.x + sl.w) carve(d, sl.x + sl.w, midY, spineX - 1, midY + 1)
    }
  }

  const room = (kind: RoomKind) => d.rooms.find((r) => r.kind === kind)!
  const ent = room('entry')
  const boss = room('boss')
  const tec = d.rooms.find((r) => r.kind === 'tech') || room('guard')

  // ---- вход снизу (два тайла двери в нижней стене entry) ----
  const ex = ent.x + Math.floor(ent.w / 2)
  // entry — в ЛОКАЛЬНЫХ координатах данжа (относительно ox/oy), как ожидает движок
  d.entry = { x: ex * TILE + 8, y: (ent.y + ent.h - 1) * TILE + 8 }
  setT(d, ex - 1, ent.y + ent.h, 6)
  setT(d, ex, ent.y + ent.h, 6)

  // ---- дверь босса на хребте перед верхней полосой ----
  const doorY = boss.y + boss.h // сразу под босс-комнатой
  setT(d, spineX, doorY, 2); setT(d, spineX + 1, doorY, 2)
  d.door = { x: spineX, y: doorY, open: false }

  // ---- рубильники: 2, в МИРОВЫХ координатах ----
  const swRoom = tec
  const sw2Room = d.rooms.find((r) => r.kind !== 'tech' && r.kind !== 'entry' && r.kind !== 'boss' && r !== swRoom) || room('guard')
  const swLocal = [
    { lx: swRoom.x + 1, ly: swRoom.y + 1 },
    { lx: sw2Room.x + sw2Room.w - 2, ly: sw2Room.y + sw2Room.h - 2 },
  ]
  d.switches = swLocal.map((s) => ({ x: ox + s.lx * TILE + 8, y: oy + s.ly * TILE + 8, on: false }))
  setT(d, swLocal[0].lx, swLocal[0].ly, 3)
  setT(d, swLocal[1].lx, swLocal[1].ly, 3)

  d.bossCenter = { x: (boss.x + Math.floor(boss.w / 2) - 0) * TILE, y: (boss.y + Math.floor(boss.h / 2)) * TILE }

  // ---- враги: глубже = сильнее ----
  const addSpawns = (r: Room, n: number, t: number) => {
    for (let i = 0; i < n; i++) {
      d.spawns.push({
        x: (r.x + 1 + Math.floor(rng.next() * Math.max(1, r.w - 2))) * TILE + 8,
        y: (r.y + 1 + Math.floor(rng.next() * Math.max(1, r.h - 2))) * TILE + 8, tier: t,
      })
    }
  }
  const guardR = d.rooms.find((r) => r.kind === 'guard')
  if (guardR) addSpawns(guardR, 4, 0)
  for (const r of d.rooms) {
    if (r.kind === 'entry' || r.kind === 'guard' || r.kind === 'boss' || r.kind === 'secret') continue
    const depth = 1 - r.y / rows
    addSpawns(r, 1 + Math.floor(rng.next() * 2), depth > 0.6 ? 2 : 1)
  }

  // ---- контейнеры ----
  const storageR = d.rooms.find((r) => r.kind === 'storage')
  const spots: Room[] = [guardR, storageR, tec].filter(Boolean) as Room[]
  spots.forEach((r, i) => {
    d.containers.push({ x: (r.x + 1 + (i % 2)) * TILE, y: (r.y + 1) * TILE, tier: i === spots.length - 1 ? 2 : 1 })
  })
  if (d.containers.length < 3 && guardR) d.containers.push({ x: (guardR.x + guardR.w - 3) * TILE, y: (guardR.y + 2) * TILE, tier: 1 })

  // ---- ловушки: в коридорах и тех-зонах ----
  const hazardN = 4 + Math.floor(rng.next() * 4)
  for (let i = 0; i < hazardN; i++) {
    const tx = 2 + Math.floor(rng.next() * (cols - 4))
    const ty = 3 + Math.floor(rng.next() * (rows - 7))
    if (d.tiles[ty * cols + tx] === 0) { setT(d, tx, ty, 5); d.hazards.push({ x: tx * TILE + 8, y: ty * TILE + 8 }) }
  }

  // ---- секрет: комната за хрупкой стеной ----
  const secKinds: RoomKind[] = ['secret']
  void secKinds
  // выделяем небольшую секретную комнату у края и прорубаем к ней хрупкую стену
  const secX = rng.next() < 0.5 ? 2 : cols - 6
  const secY = Math.floor(rows * 0.35)
  carve(d, secX, secY, secX + 3, secY + 3)
  d.rooms.push({ x: secX, y: secY, w: 4, h: 4, kind: 'secret', name: pickName(rng, type, 'secret') })
  // хрупкая стена между секретом и ближайшим вырезанным тайлом
  let fragPlaced = false
  for (let k = 1; k < 8 && !fragPlaced; k++) {
    const probe = secX < cols / 2 ? secX + 3 + k : secX - k
    if (probe > 0 && probe < cols - 1 && d.tiles[secY * cols + probe] === 0) {
      const wallX = secX < cols / 2 ? secX + 4 : secX - 1
      setT(d, wallX, secY, 4); setT(d, wallX, secY + 1, 4)
      // коридор между стеной и секретом
      if (secX < cols / 2) carve(d, secX + 4, secY, probe - 1, secY + 1)
      else carve(d, probe + 1, secY, secX - 1, secY + 1)
      fragPlaced = true
    }
  }
  d.secretCache = { x: (secX + 1) * TILE, y: (secY + 1) * TILE, tier: tier + 1 }

  // ---- лампы: МИРОВЫЕ координаты ----
  for (const r of d.rooms) {
    d.lamps.push({
      x: ox + (r.x + r.w / 2) * TILE,
      y: oy + (r.y + r.h / 2) * TILE,
      color: r.kind === 'boss' ? '#ff8a3d' : '#baf3ff',
    })
  }

  populateDecor(d, rng, type)
  return d
}

// гарантированно валидный запасной layout (прямой хребет, без ответвлений)
function buildFallback(seed: number, ox: number, oy: number, tier: number, type: DungeonType): DungeonLayout {
  const rng = new Rng(seed ^ 0x5f5)
  const cols = 20, rows = 30
  const tiles: DungeonTile[] = new Array(cols * rows).fill(1)
  const d: DungeonLayout = {
    type, ox, oy, cols, rows, tiles, rooms: [],
    entry: { x: 0, y: 0 }, switches: [], door: { x: 0, y: 0, open: false },
    bossCenter: { x: 0, y: 0 }, spawns: [], containers: [], hazards: [],
    decor: [], setPieces: [], lamps: [], secretCache: { x: 0, y: 0, tier: tier + 1 }, silhouette: 0,
  }
  // хребет снизу вверх
  carve(d, 8, 2, 11, rows - 2)
  const mk = (y: number, h: number, kind: RoomKind, w = 6): Room => {
    carve(d, 4, y, 4 + w - 1, y + h - 1)
    carve(d, 4 + w, y + 1, 8, y + 2)
    const r = { x: 4, y, w, h, kind, name: pickName(rng, type, kind) }
    d.rooms.push(r)
    return r
  }
  const ent = mk(rows - 6, 4, 'entry')
  mk(rows - 12, 4, 'guard')
  const tec = mk(rows - 18, 4, 'tech')
  mk(rows - 24, 4, 'armory')
  const boss = mk(2, 5, 'boss', 8)
  carve(d, 8, 7, 11, 8)
  d.entry = { x: 9 * TILE + 8, y: (ent.y + ent.h - 1) * TILE + 8 }
  setT(d, 9, rows - 2, 6); setT(d, 10, rows - 2, 6)
  setT(d, 9, 7, 2); setT(d, 10, 7, 2)
  d.door = { x: 9, y: 7, open: false }
  d.switches = [
    { x: ox + (tec.x + 1) * TILE + 8, y: oy + (tec.y + 1) * TILE + 8, on: false },
    { x: ox + (tec.x + tec.w - 2) * TILE + 8, y: oy + (tec.y + tec.h - 2) * TILE + 8, on: false },
  ]
  setT(d, tec.x + 1, tec.y + 1, 3)
  setT(d, tec.x + tec.w - 2, tec.y + tec.h - 2, 3)
  d.bossCenter = { x: (boss.x + 4) * TILE, y: (boss.y + 2) * TILE }
  d.containers.push({ x: 5 * TILE, y: (rows - 11) * TILE, tier: 1 })
  d.secretCache = { x: 2 * TILE, y: 10 * TILE, tier: tier + 1 }
  for (const r of d.rooms) d.lamps.push({ x: ox + (r.x + r.w / 2) * TILE, y: oy + (r.y + r.h / 2) * TILE, color: r.kind === 'boss' ? '#ff8a3d' : '#baf3ff' })
  return d
}

// ============================================================
// ВАЛИДАЦИЯ: BFS от входа; двери и хрупкие стены считаем проходимыми
// ============================================================
function validate(d: DungeonLayout): boolean {
  const { cols, rows, tiles } = d
  const pass = (t: DungeonTile) => t === 0 || t === 2 || t === 3 || t === 4 || t === 5 || t === 6
  // старт — клетка, где игрок реально появляется (внутри входной комнаты)
  const start = { x: Math.floor(d.entry.x / TILE), y: Math.floor(d.entry.y / TILE) }
  const seen = new Uint8Array(cols * rows)
  const q: number[] = [start.y * cols + start.x]
  seen[q[0]] = 1
  while (q.length) {
    const cur = q.pop()!
    const cx = cur % cols, cy = Math.floor(cur / cols)
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      const ni = ny * cols + nx
      if (seen[ni] || !pass(tiles[ni])) continue
      seen[ni] = 1
      q.push(ni)
    }
  }
  // стартовая клетка должна быть полом
  if (!pass(tiles[start.y * cols + start.x])) return false
  // центр каждой комнаты достижим
  for (const r of d.rooms) {
    const cx = r.x + Math.floor(r.w / 2), cy = r.y + Math.floor(r.h / 2)
    if (!seen[cy * cols + cx]) return false
  }
  // рубильники и дверь босса достижимы
  for (const s of d.switches) {
    const tx = Math.floor((s.x - d.ox) / TILE), ty = Math.floor((s.y - d.oy) / TILE)
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows || !seen[ty * cols + tx]) return false
  }
  const dt = d.door
  if (dt.y >= 0 && dt.y < rows && !seen[dt.y * cols + dt.x]) return false
  // точка спавна босса достижима
  const btx = Math.floor(d.bossCenter.x / TILE), bty = Math.floor(d.bossCenter.y / TILE)
  if (!seen[bty * cols + btx]) return false
  return true
}

// ============================================================
// ДЕКОР И SET PIECES: назначение каждой зоны + история места
// ============================================================
function populateDecor(d: DungeonLayout, rng: Rng, type: DungeonType) {
  const deco = (r: Room | undefined, t: string, dx: number, dy: number, w: number, h: number, block = true) => {
    if (!r) return
    d.decor.push({ x: (r.x + dx) * TILE, y: (r.y + dy) * TILE, w: w * TILE, h: h * TILE, type: t, block })
  }
  const byKind = (k: string) => d.rooms.find((r) => r.kind === k)
  // общие следы деятельности
  deco(byKind('guard'), 'debris', 1, 1, 2, 1, false)
  deco(byKind('entry'), 'warning', 1, 0, 1, 1, false)
  const boss = byKind('boss')
  if (type === 'bunker') {
    deco(byKind('armory'), 'weaponrack', 1, 0, 4, 1)
    deco(byKind('barracks'), 'bunk', 1, 1, 3, 2)
    deco(byKind('barracks'), 'locker', 5, 0, 2, 1)
    deco(byKind('storage'), 'crate', 1, 1, 2, 2)
    deco(byKind('storage'), 'crate', 3, 2, 2, 2)
    deco(byKind('tech'), 'generator', 1, 1, 3, 3)
    if (boss) d.setPieces.push({ x: (boss.x + Math.floor(boss.w / 2) - 2) * TILE, y: (boss.y + 1) * TILE, type: 'warholo', w: 4 * TILE, h: 3 * TILE })
  } else if (type === 'lab') {
    deco(byKind('armory'), 'server', 1, 0, 2, 4)
    deco(byKind('barracks'), 'pod', 1, 1, 2, 3)
    deco(byKind('barracks'), 'pod', 4, 1, 2, 3)
    deco(byKind('storage'), 'vat', 2, 1, 2, 3)
    deco(byKind('tech'), 'reactor', 1, 1, 4, 4)
    if (boss) d.setPieces.push({ x: (boss.x + 2) * TILE, y: (boss.y + 1) * TILE, type: 'specimen', w: 6 * TILE, h: 4 * TILE })
  } else if (type === 'factory') {
    deco(byKind('corridor'), 'conveyor', 2, 2, 6, 2, false)
    deco(byKind('armory'), 'workbench', 1, 1, 3, 2)
    deco(byKind('barracks'), 'pallet', 1, 1, 3, 2)
    deco(byKind('storage'), 'crate', 1, 1, 2, 2)
    deco(byKind('storage'), 'crate', 3, 2, 3, 2)
    deco(byKind('tech'), 'transformer', 1, 1, 3, 4)
    if (boss) d.setPieces.push({ x: (boss.x + 2) * TILE, y: (boss.y + 1) * TILE, type: 'assembly', w: 6 * TILE, h: 4 * TILE })
  } else {
    deco(byKind('armory'), 'galley', 1, 1, 3, 2)
    deco(byKind('barracks'), 'bunk', 1, 1, 3, 2)
    deco(byKind('barracks'), 'bunk', 5, 1, 3, 2)
    deco(byKind('storage'), 'crate', 1, 1, 2, 2)
    deco(byKind('storage'), 'barrel', 3, 2, 2, 2)
    deco(byKind('tech'), 'engine', 1, 1, 4, 4)
    if (boss) d.setPieces.push({ x: (boss.x + 2) * TILE, y: (boss.y + 1) * TILE, type: 'console', w: 6 * TILE, h: 3 * TILE })
    const corr = byKind('corridor')
    if (corr) d.decor.push({ x: (corr.x + 1) * TILE, y: corr.y * TILE, w: 2 * TILE, h: TILE, type: 'breach', block: false })
  }
  void rng
}

// ============================================================
// ВНЕШНИЕ POI
// ============================================================
function buildPoi(id: string, type: PoiType, x: number, y: number, seed: number, rng: Rng, tier: number, factionArch: string): Poi {
  const def = POI_DEFS[type]
  const guards = def.guards + Math.floor(rng.next() * 2)
  const hasDungeon = !!def.dtype && rng.next() < def.dungeonChance
  let dungeon: DungeonLayout | undefined
  let fp = { x: x - 30, y: y - 24, w: 60, h: 48 }
  let doorWorld = { x, y: y + 28 }
  if (hasDungeon) {
    const probe = makeDungeon((seed ^ (x * 2654435761) ^ (y * 40503)) >>> 0, 0, 0, tier, def.dtype!)
    const ex = (probe as { _ex?: number })._ex ?? Math.floor(probe.cols / 2)
    const ox = x - ex * TILE - TILE // дверной проём (ex,ex+1) строго под мировой точкой x
    const oy = y - (probe.rows * TILE) / 2 - 20
    dungeon = makeDungeon((seed ^ (x * 2654435761) ^ (y * 40503)) >>> 0, ox, oy, tier, def.dtype!)
    fp = { x: ox - WALL_M, y: oy - WALL_M, w: dungeon.cols * TILE + WALL_M * 2, h: dungeon.rows * TILE + WALL_M * 2 }
    doorWorld = { x, y: fp.y + fp.h + 6 }
  }
  return {
    id, type, x, y,
    state: guards > 0 ? 'hostile' : 'neutral',
    guards, guardsLeft: guards,
    dungeon,
    ds: dungeon ? { spawned: false, switches: dungeon.switches.map(() => false), doorOpen: false, bossSpawned: false, cleared: false, breakHp: {} } : undefined,
    seed, fp, doorWorld,
    style: Math.floor(rng.next() * 3),
    factionArch,
  }
}

export function makeStarterDungeon(seed: number, region: RegionDef): Poi {
  const rng = new Rng(seed * 31 + 7)
  const x = 260 + rng.range(0, 60), y = -260 - rng.range(0, 50)
  const poi = buildPoi('starter', 'bunker', x, y, seed * 77 + 5, rng, region.tier, 'military')
  if (!poi.dungeon) {
    const d = makeDungeon(seed * 77 + 5, x - 20 * TILE, y - 20 * TILE, region.tier, 'bunker')
    poi.dungeon = d
    poi.fp = { x: d.ox - WALL_M, y: d.oy - WALL_M, w: d.cols * TILE + WALL_M * 2, h: d.rows * TILE + WALL_M * 2 }
    poi.doorWorld = { x: d.ox + d.entry.x, y: poi.fp.y + poi.fp.h + 6 }
    poi.ds = { spawned: false, switches: d.switches.map(() => false), doorOpen: false, bossSpawned: false, cleared: false, breakHp: {} }
  }
  return poi
}

export function poiForCell(seed: number, region: RegionDef, cx: number, cy: number): Poi | null {
  const rng = new Rng(((seed ^ (cx * 73856093)) ^ (cy * 19349663)) >>> 0)
  if (rng.next() > 0.2) return null
  let total = 0
  for (const e of region.poiTable) total += e.w
  let roll = rng.next() * total
  let type: PoiType = 'camp'
  for (const e of region.poiTable) { roll -= e.w; if (roll <= 0) { type = e.type; break } }
  const x = cx * CELL + CELL / 2 + rng.range(-110, 110)
  const y = cy * CELL + CELL / 2 + rng.range(-110, 110)
  return buildPoi(`${region.id}_${cx}_${cy}`, type, x, y, seed, rng, region.tier, region.faction)
}
