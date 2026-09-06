// ============================================================
// БИОМЫ (природная география) и РЕГИОНЫ (политические территории).
// БИОМ ≠ РЕГИОН: регион пересекает несколько биомов.
// ============================================================
import type { PoiType } from './structures'

/** Природные зоны: грунт, растительность, климат, погода */
export interface BiomeDef {
  id: string; name: string
  ground: string[]; crack: string
  decos: string[]; fog: string
  weather: 'sand' | 'snow' | 'spore' | 'ember' | 'ash' | 'spark' | 'none'
}
export const BIOME_DEFS: BiomeDef[] = [
  { id: 'dune', name: 'РЖАВЫЕ ДЮНЫ', ground: ['#8a5a33', '#7d4f2b', '#96653c', '#6f4526'], crack: '#5a371e', decos: ['#6e4426', '#a4744a', '#c89a6e'], fog: 'rgba(255,180,110,0.05)', weather: 'sand' },
  { id: 'ash', name: 'ПЕПЕЛЬНАЯ ПУСТОШЬ', ground: ['#4a4e57', '#41454d', '#545963', '#383c43'], crack: '#2c2f35', decos: ['#5e636e', '#33373e', '#787e8a'], fog: 'rgba(140,150,170,0.06)', weather: 'ash' },
  { id: 'frost', name: 'ЛЕДЯНОЙ РАЗЛОМ', ground: ['#7fb6c9', '#72a9bd', '#8cc4d6', '#649cae'], crack: '#4d7e90', decos: ['#a8d8e8', '#5e93a6', '#d8f0f8'], fog: 'rgba(160,220,255,0.07)', weather: 'snow' },
  { id: 'crystal', name: 'КРИСТАЛЬНЫЕ ПОЛЯ', ground: ['#3f4a6e', '#37405f', '#47547d', '#2f3752'], crack: '#252b40', decos: ['#7d5eff', '#3fe0ff', '#c96bff'], fog: 'rgba(120,110,255,0.06)', weather: 'spark' },
  { id: 'spore', name: 'КИСЛОТНЫЕ ТОПИ', ground: ['#4a6e3f', '#41613a', '#547d4a', '#38572f'], crack: '#2c4025', decos: ['#7dff5e', '#3f6e33', '#b6ff2e'], fog: 'rgba(140,255,120,0.06)', weather: 'spore' },
  { id: 'ember', name: 'ВУЛКАНИЧЕСКИЙ ПОЯС', ground: ['#4a3338', '#412b30', '#543c41', '#38262b'], crack: '#ff6b35', decos: ['#5e444a', '#2c1f23', '#ff8a3d'], fog: 'rgba(255,110,60,0.07)', weather: 'ember' },
]

export type FactionId = 'guild' | 'pirates' | 'corp' | 'machines' | 'feral'

export interface FactionDef {
  id: FactionId; name: string; color: string
  desc: string
  /** архитектурный/визуальный язык фракции */
  arch: 'industrial' | 'improvised' | 'corporate' | 'machine' | 'organic'
}
export const FACTIONS: Record<FactionId, FactionDef> = {
  guild: { id: 'guild', name: 'ГИЛЬДИЯ НАЁМНИКОВ', color: '#f5a623', desc: 'Нейтральные аванпосты и ретрансляторы', arch: 'industrial' },
  pirates: { id: 'pirates', name: 'БАГРОВАЯ СТАЯ', color: '#ff5533', desc: 'Мародёры и контрабандисты. Самодельные укрепления.', arch: 'improvised' },
  corp: { id: 'corp', name: 'КОРПОРАЦИЯ «ГЕЛИОС»', color: '#3fe0ff', desc: 'Промышленные комплексы. Чистая стандартизированная техника.', arch: 'corporate' },
  machines: { id: 'machines', name: 'РОЙ', color: '#c96bff', desc: 'Безумные роботы. Неестественная симметрия, провода.', arch: 'machine' },
  feral: { id: 'feral', name: 'ДИКИЕ ТВАРИ', color: '#7dff5e', desc: 'Мутировавшие существа пустошей', arch: 'organic' },
}

/** Точка высадки: имя + относительное положение в регионе (0..1) */
export interface LandingSite { name: string; lx: number; ly: number }

export interface RegionDef {
  id: string; name: string; desc: string; color: string
  danger: number; tier: number
  /** регион ПЕРЕСЕКАЕТ несколько биомов (индексы в BIOME_DEFS) */
  biomes: number[]
  /** доминирующий биом для базовой отрисовки */
  biome: number
  faction: FactionId
  enemies: Record<string, number>
  poiTable: { type: PoiType; w: number }[]
  lootBias: { kits: number[]; rarityBoost: number }
  landing: LandingSite[]
  mapX: number; mapY: number; mapR: number
}

export const REGIONS: RegionDef[] = [
  {
    id: 'scrapline', name: 'РЖАВЫЙ ПОЯС', desc: 'Старые шахты Багровой Стаи. Идеально для первого контракта.',
    color: '#f5a623', danger: 1, tier: 1,
    biomes: [0, 1], biome: 0, faction: 'pirates',
    enemies: { grunt: 5, gunner: 2, flyer: 1.5, brute: 1 },
    poiTable: [{ type: 'camp', w: 3 }, { type: 'factory', w: 2 }, { type: 'relay', w: 2 }, { type: 'outpost', w: 1.5 }, { type: 'bunker', w: 1 }, { type: 'crash', w: 0.8 }],
    lootBias: { kits: [0, 3, 6, 9], rarityBoost: 0 },
    landing: [{ name: 'СЕДЛО', lx: 0.3, ly: 0.35 }, { name: 'СУХАЯ БАЛКА', lx: 0.62, ly: 0.5 }, { name: 'ОСТОВ КОНВОЯ', lx: 0.45, ly: 0.72 }],
    mapX: 0.28, mapY: 0.3, mapR: 0.13,
  },
  {
    id: 'ashfield', name: 'ПЕПЕЛЬНАЯ ПУСТОШЬ', desc: 'Серая равнина, где РОЙ сводит машины с ума.',
    color: '#9aa7b8', danger: 2, tier: 1.35,
    biomes: [1, 0], biome: 1, faction: 'machines',
    enemies: { grunt: 3, gunner: 3, flyer: 2, brute: 2 },
    poiTable: [{ type: 'factory', w: 3 }, { type: 'camp', w: 2 }, { type: 'relay', w: 1.5 }, { type: 'bunker', w: 1.2 }, { type: 'outpost', w: 1.2 }, { type: 'crash', w: 1 }],
    lootBias: { kits: [1, 4, 7, 10], rarityBoost: 0.5 },
    landing: [{ name: 'ЗЕРКАЛЬНАЯ РОВЬ', lx: 0.4, ly: 0.3 }, { name: 'РАЗЛОМ', lx: 0.7, ly: 0.55 }, { name: 'СТАРОЕ КЛАДБИЩЕ', lx: 0.3, ly: 0.68 }],
    mapX: 0.6, mapY: 0.24, mapR: 0.11,
  },
  {
    id: 'frostgap', name: 'ЛЕДЯНОЙ РАЗЛОМ', desc: 'Замёрзшие каньоны. Здесь гнездятся пикеры и бродят громилы.',
    color: '#9fd8ff', danger: 2, tier: 1.55,
    biomes: [2, 4], biome: 2, faction: 'feral',
    enemies: { grunt: 2, gunner: 2, flyer: 4, brute: 2.5 },
    poiTable: [{ type: 'relay', w: 2.5 }, { type: 'crash', w: 2.5 }, { type: 'camp', w: 2 }, { type: 'outpost', w: 1.5 }, { type: 'bunker', w: 1 }, { type: 'factory', w: 0.7 }],
    lootBias: { kits: [2, 5, 8, 11], rarityBoost: 1 },
    landing: [{ name: 'МЁРТВАЯ РЕКА', lx: 0.35, ly: 0.32 }, { name: 'ГРЯДА', lx: 0.68, ly: 0.48 }, { name: 'ОЗЁРНАЯ КОТЛОВИНА', lx: 0.42, ly: 0.7 }],
    mapX: 0.8, mapY: 0.55, mapR: 0.1,
  },
  {
    id: 'sporesea', name: 'КИСЛОТНЫЕ ТОПИ', desc: 'Споры, твари и брошенные лаборатории «Гелиоса» на сваях.',
    color: '#7dff5e', danger: 3, tier: 1.8,
    biomes: [4, 3], biome: 4, faction: 'corp',
    enemies: { grunt: 3, gunner: 2.5, flyer: 3, brute: 2.5 },
    poiTable: [{ type: 'camp', w: 2.5 }, { type: 'bunker', w: 2 }, { type: 'crash', w: 1.5 }, { type: 'relay', w: 1.5 }, { type: 'outpost', w: 1.5 }, { type: 'factory', w: 1 }],
    lootBias: { kits: [1, 3, 6, 10], rarityBoost: 1.2 },
    landing: [{ name: 'ГНИЛАЯ ПРОСЕКА', lx: 0.32, ly: 0.34 }, { name: 'ТОПКИЙ БЕРЕГ', lx: 0.6, ly: 0.42 }, { name: 'СТАРАЯ ДАМБА', lx: 0.48, ly: 0.74 }],
    mapX: 0.45, mapY: 0.66, mapR: 0.12,
  },
  {
    id: 'emberfall', name: 'ВУЛКАНИЧЕСКИЙ ПОЯС', desc: 'Раскалённые трещины. Только для ветеранов гильдии.',
    color: '#ff5533', danger: 4, tier: 2.2,
    biomes: [5, 0], biome: 5, faction: 'machines',
    enemies: { grunt: 2.5, gunner: 3, flyer: 2.5, brute: 4 },
    poiTable: [{ type: 'factory', w: 2.5 }, { type: 'bunker', w: 2 }, { type: 'camp', w: 2 }, { type: 'crash', w: 1.5 }, { type: 'relay', w: 1 }, { type: 'outpost', w: 1.5 }],
    lootBias: { kits: [2, 5, 9, 11], rarityBoost: 2 },
    landing: [{ name: 'ПЕПЕЛЬНЫЙ ПЛЯЖ', lx: 0.3, ly: 0.3 }, { name: 'ОБВАЛ', lx: 0.66, ly: 0.52 }, { name: 'ЛАВОВАЯ ЖИЛА', lx: 0.5, ly: 0.75 }],
    mapX: 0.18, mapY: 0.72, mapR: 0.09,
  },
]

export function getRegion(id: string): RegionDef {
  return REGIONS.find((r) => r.id === id) || REGIONS[0]
}

/**
 * Точка высадки (lx,ly 0..1 внутри региона) -> координаты ИГРОВОГО МИРА.
 * Это единственная связь карта -> мир: игрок появляется ровно там,
 * куда указал на глобусе.
 */
export function landingWorldPos(region: RegionDef, siteIdx: number): { x: number; y: number } {
  const site = region.landing[Math.max(0, Math.min(siteIdx, region.landing.length - 1))]
  // центр региона в мировых координатах детерминирован от id
  let h = 0
  for (let i = 0; i < region.id.length; i++) h = (h * 31 + region.id.charCodeAt(i)) >>> 0
  const cx = ((h % 4000) - 2000)
  const cy = ((Math.floor(h / 4000) % 4000) - 2000)
  const SPAN = 900 // регион занимает ~900px мира
  return { x: cx + (site.lx - 0.5) * SPAN, y: cy + (site.ly - 0.5) * SPAN }
}
