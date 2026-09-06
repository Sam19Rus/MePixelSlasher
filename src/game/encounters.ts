// ============================================================
// МИРОВАЯ АКТИВНОСТЬ (encounters). Планета живёт независимо от игрока:
// патрули ходят, группы воюют друг с другом, караваны движутся.
// Вдали — абстрактные (дешёвые) сущности; при приближении — реальные враги.
// ============================================================
import { Rng } from './rng'

export type EncounterKind = 'patrol' | 'camp' | 'conflict' | 'ambush' | 'convoy' | 'pursuit'

export interface Encounter {
  id: number
  kind: EncounterKind
  x: number; y: number
  /** радиус, в котором событие «реально» (враги активны) */
  radius: number
  size: number          // число участников
  types: string[]       // типы врагов
  tier: number
  // движение (patrol/convoy)
  wx: number; wy: number; // путевая точка
  speed: number
  // бой двух групп (conflict)
  conflictT?: number
  // обнаружение игрока
  alerted: boolean
  // состояние
  dead: boolean
  spawnT: number        // таймер до материализации
}

let eid = 0
const nextId = () => ++eid

/** Создать случайное событие вокруг точки (детерминированно от rng) */
export function makeEncounter(rng: Rng, x: number, y: number, tier: number, enemies: Record<string, number>): Encounter {
  const roll = rng.next()
  let kind: EncounterKind
  if (roll < 0.3) kind = 'patrol'
  else if (roll < 0.55) kind = 'camp'
  else if (roll < 0.7) kind = 'conflict'
  else if (roll < 0.82) kind = 'ambush'
  else kind = 'convoy'

  const pickType = (): string => {
    let total = 0
    for (const k in enemies) total += enemies[k]
    let r = rng.next() * total
    for (const k in enemies) { r -= enemies[k]; if (r <= 0) return k }
    return 'grunt'
  }

  const size = kind === 'camp' ? 4 + Math.floor(rng.next() * 3)
    : kind === 'conflict' ? 3
    : kind === 'convoy' ? 5
    : 2 + Math.floor(rng.next() * 2)

  const types = Array.from({ length: size }, () => pickType())
  const a = rng.next() * Math.PI * 2
  return {
    id: nextId(), kind, x, y,
    radius: kind === 'camp' ? 150 : kind === 'conflict' ? 170 : 120,
    size, types, tier,
    wx: x + Math.cos(a) * 220, wy: y + Math.sin(a) * 220,
    speed: kind === 'convoy' ? 26 : 18,
    conflictT: kind === 'conflict' ? 2 + rng.next() * 3 : 0,
    alerted: false, dead: false, spawnT: 0,
  }
}

/** Обновление логики событий (до материализации) */
export function updateEncounterLogic(e: Encounter, dt: number, playerX: number, playerY: number) {
  if (e.dead) return
  const pd = Math.hypot(playerX - e.x, playerY - e.y)
  // патруль/конвой движутся между путевыми точками
  if (e.kind === 'patrol' || e.kind === 'convoy') {
    const dx = e.wx - e.x, dy = e.wy - e.y
    const d = Math.hypot(dx, dy)
    if (d < 20) {
      const a = Math.random() * Math.PI * 2
      e.wx = e.x + Math.cos(a) * 240
      e.wy = e.y + Math.sin(a) * 240
    } else {
      e.x += (dx / d) * e.speed * dt
      e.y += (dy / d) * e.speed * dt
    }
  }
  // конфликт: две группы сближаются и «воюют»
  if (e.kind === 'conflict' && e.conflictT !== undefined) {
    e.conflictT -= dt
  }
  // обнаружение игрока
  if (!e.alerted && pd < e.radius * 0.9 && e.kind !== 'conflict') {
    e.alerted = true
  }
  if (e.alerted && (e.kind === 'patrol' || e.kind === 'ambush')) {
    e.kind = 'pursuit'
  }
}
