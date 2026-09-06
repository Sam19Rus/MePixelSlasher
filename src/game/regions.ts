// Регионы планеты: биом + фракция + POI-таблица + loot-bias + сложность
import type { PoiType } from './structures'

export interface RegionDef {
  id: string; name: string; desc: string; color: string; danger: number; tier: number
  biome: number; biomeAlt: number
  enemies: Record<string, number>
  poiTable: { type: PoiType; w: number }[]
  lootBias: { kits: number[]; rarityBoost: number }
  mapX: number; mapY: number; mapR: number
}

export const REGIONS: RegionDef[] = [
  {
    id: 'scrapline', name: 'РЖАВЫЙ ПОЯС', desc: 'Старые шахты и лагеря мародёров. Идеально для первого контракта.',
    color: '#f5a623', danger: 1, tier: 1, biome: 0, biomeAlt: 1,
    enemies: { grunt: 5, gunner: 2, flyer: 1.5, brute: 1 },
    poiTable: [{ type: 'camp', w: 3 }, { type: 'factory', w: 2 }, { type: 'relay', w: 2 }, { type: 'outpost', w: 1.5 }, { type: 'bunker', w: 1 }, { type: 'crash', w: 0.8 }],
    lootBias: { kits: [0, 3, 6, 9], rarityBoost: 0 },
    mapX: 0.28, mapY: 0.3, mapR: 0.13,
  },
  {
    id: 'ashfield', name: 'ПЕПЕЛЬНАЯ ПУСТОШЬ', desc: 'Серая равнина разбитых машин. Роботы здесь сходят с ума.',
    color: '#9aa7b8', danger: 2, tier: 1.35, biome: 1, biomeAlt: 0,
    enemies: { grunt: 3, gunner: 3, flyer: 2, brute: 2 },
    poiTable: [{ type: 'factory', w: 3 }, { type: 'camp', w: 2 }, { type: 'relay', w: 1.5 }, { type: 'bunker', w: 1.2 }, { type: 'outpost', w: 1.2 }, { type: 'crash', w: 1 }],
    lootBias: { kits: [1, 4, 7, 10], rarityBoost: 0.5 },
    mapX: 0.6, mapY: 0.24, mapR: 0.11,
  },
  {
    id: 'frostgap', name: 'ЛЕДЯНОЙ РАЗЛОМ', desc: 'Замёрзшие каньоны, где гнездятся пикеры и бродят громилы.',
    color: '#9fd8ff', danger: 2, tier: 1.55, biome: 2, biomeAlt: 4,
    enemies: { grunt: 2, gunner: 2, flyer: 4, brute: 2.5 },
    poiTable: [{ type: 'relay', w: 2.5 }, { type: 'crash', w: 2.5 }, { type: 'camp', w: 2 }, { type: 'outpost', w: 1.5 }, { type: 'bunker', w: 1 }, { type: 'factory', w: 0.7 }],
    lootBias: { kits: [2, 5, 8, 11], rarityBoost: 1 },
    mapX: 0.8, mapY: 0.55, mapR: 0.1,
  },
  {
    id: 'sporesea', name: 'КИСЛОТНЫЕ ТОПИ', desc: 'Споры, твари из болот и брошенные лаборатории на сваях.',
    color: '#7dff5e', danger: 3, tier: 1.8, biome: 4, biomeAlt: 3,
    enemies: { grunt: 3, gunner: 2.5, flyer: 3, brute: 2.5 },
    poiTable: [{ type: 'camp', w: 2.5 }, { type: 'bunker', w: 2 }, { type: 'crash', w: 1.5 }, { type: 'relay', w: 1.5 }, { type: 'outpost', w: 1.5 }, { type: 'factory', w: 1 }],
    lootBias: { kits: [1, 3, 6, 10], rarityBoost: 1.2 },
    mapX: 0.45, mapY: 0.66, mapR: 0.12,
  },
  {
    id: 'emberfall', name: 'ВУЛКАНИЧЕСКИЙ ПОЯС', desc: 'Раскалённые трещины. Только для ветеранов гильдии.',
    color: '#ff5533', danger: 4, tier: 2.2, biome: 5, biomeAlt: 0,
    enemies: { grunt: 2.5, gunner: 3, flyer: 2.5, brute: 4 },
    poiTable: [{ type: 'factory', w: 2.5 }, { type: 'bunker', w: 2 }, { type: 'camp', w: 2 }, { type: 'crash', w: 1.5 }, { type: 'relay', w: 1 }, { type: 'outpost', w: 1.5 }],
    lootBias: { kits: [2, 5, 9, 11], rarityBoost: 2 },
    mapX: 0.18, mapY: 0.72, mapR: 0.09,
  },
]

export function getRegion(id: string): RegionDef {
  return REGIONS.find((r) => r.id === id) || REGIONS[0]
}
