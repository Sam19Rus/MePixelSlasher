// ============================================================
// БОССЫ: архетип на каждый тип структуры.
// Structure Type + Seed -> Boss Archetype. Разные визуалы,
// паттерны атак и поведение арены.
// ============================================================
import type { ProjKind } from './data'
import type { DungeonType } from './structures'

export type BossKind = 'mech' | 'creature' | 'core' | 'commander'

export interface BossAttackDef { name: string; telegraph: number; dmg: number }
export interface BossDef {
  id: string; name: string; title: string; kind: BossKind
  hp: number; speed: number; dmg: number; r: number
  proj: ProjKind; color: string; core: string; accent: string
  phases: { at: number; name: string; rateMult: number }[]
  attacks: BossAttackDef[]
  /** что происходит с ареной на 50%: сколько тайлов вокруг центра превращается в ловушки */
  arenaBreak: { radius: number; toast: string }
  rewards: { credits: [number, number]; weaponRarity: number; permanentChance: number }
}

const PH = (n1: string, n2: string, n3: string) => [
  { at: 1, name: n1, rateMult: 1 },
  { at: 0.5, name: n2, rateMult: 1.4 },
  { at: 0.25, name: n3, rateMult: 1.75 },
]

export const BOSSES: Record<string, BossDef> = {
  // ---- БУНКЕР: тяжёлый боевой мех гарнизона ----
  warden: {
    id: 'warden', name: 'ЦЕРБЕР', title: 'СТРАЖ КОМПЛЕКСА', kind: 'mech',
    hp: 950, speed: 34, dmg: 22, r: 13,
    proj: 'plasma', color: '#5e6e7e', core: '#ff5533', accent: '#ffd54a',
    phases: PH('ФАЗА 1: ОХРАННЫЙ РЕЖИМ', 'ФАЗА 2: ПЕРЕГРЕВ ЯДРА', 'ФАЗА 3: ПРОТОКОЛ ИСТРЕБЛЕНИЯ'),
    attacks: [
      { name: 'ТАРАН', telegraph: 0.5, dmg: 20 },
      { name: 'УДАР ЯДРА', telegraph: 0.7, dmg: 26 },
      { name: 'ОЧЕРЕДЬ', telegraph: 0.4, dmg: 10 },
    ],
    arenaBreak: { radius: 3, toast: 'ПЕРЕГРЕВ: ПЛИТЫ ПОЛА РАЗРУШАЮТСЯ' },
    rewards: { credits: [400, 700], weaponRarity: 3, permanentChance: 1 },
  },
  // ---- БУНКЕР: командир гарнизона в экзоброне ----
  commander: {
    id: 'commander', name: 'ПОЛКОВНИК ГРАНИТ', title: 'КОМАНДИР ГАРНИЗОНА', kind: 'commander',
    hp: 800, speed: 44, dmg: 18, r: 11,
    proj: 'bullet', color: '#4a5a4e', core: '#b6ff2e', accent: '#f5a623',
    phases: PH('ФАЗА 1: ОГНЕВОЙ КОНТАКТ', 'ФАЗА 2: ПРИКАЗ «НИКТО НЕ УЙДЁТ»', 'ФАЗА 3: ПОСЛЕДНИЙ РУБЕЖ'),
    attacks: [
      { name: 'ЗАЛП ДРОБОВИКА', telegraph: 0.4, dmg: 16 },
      { name: 'ГРАНАТА', telegraph: 0.6, dmg: 24 },
      { name: 'РЫВОК С КЛИНКОМ', telegraph: 0.45, dmg: 20 },
    ],
    arenaBreak: { radius: 2, toast: 'ГЕРМОЗАТВОРЫ ЗАКЛИНИЛО: ПАР ИЗ ПРОБОИН' },
    rewards: { credits: [380, 640], weaponRarity: 3, permanentChance: 1 },
  },
  // ---- ФАБРИКА: промышленный мех-сборщик ----
  forge: {
    id: 'forge', name: 'ЛИТЕЙЩИК-9', title: 'ПРОИЗВОДСТВЕННЫЙ КОМПЛЕКС', kind: 'mech',
    hp: 1150, speed: 26, dmg: 26, r: 15,
    proj: 'rocket', color: '#7a5a3a', core: '#ff8a3d', accent: '#3fe0ff',
    phases: PH('ФАЗА 1: ШТАТНЫЙ ЦИКЛ', 'ФАЗА 2: СБОЙ КОНВЕЙЕРА', 'ФАЗА 3: АВАРИЙНАЯ ПЛАВКА'),
    attacks: [
      { name: 'ПРЕСС-УДАР', telegraph: 0.8, dmg: 30 },
      { name: 'РАСПЛАВ', telegraph: 0.5, dmg: 14 },
      { name: 'СБРОС ЗАГОТОВОК', telegraph: 0.5, dmg: 12 },
    ],
    arenaBreak: { radius: 4, toast: 'КОНВЕЙЕР ВЗБЕСИЛСЯ: ЛИНия ОГНЯ' },
    rewards: { credits: [450, 750], weaponRarity: 3, permanentChance: 1 },
  },
  // ---- ФАБРИКА: сошедший с ума ИИ управления ----
  rogueai: {
    id: 'rogueai', name: 'ДИСПЕТЧЕР', title: 'СБОЙНЫЙ ИИ УПРАВЛЕНИЯ', kind: 'core',
    hp: 850, speed: 40, dmg: 20, r: 10,
    proj: 'laser', color: '#39424e', core: '#3fe0ff', accent: '#ff5533',
    phases: PH('ФАЗА 1: ДИАГНОСТИКА УГРОЗЫ', 'ФАЗА 2: ПЕРЕРАСПРЕДЕЛЕНИЕ МОЩНОСТЕЙ', 'ФАЗА 3: ПОЛНАЯ АВТОНОМИЯ'),
    attacks: [
      { name: 'ЛАЗЕРНАЯ СЕТЬ', telegraph: 0.4, dmg: 12 },
      { name: 'ДУГОВОЙ РАЗРЯД', telegraph: 0.6, dmg: 22 },
      { name: 'СЕРВО-ТАРАН', telegraph: 0.5, dmg: 18 },
    ],
    arenaBreak: { radius: 3, toast: 'ИИ ПЕРЕКОММУТИРОВАЛ СЕТЬ: ИСКРЕНИЕ' },
    rewards: { credits: [420, 700], weaponRarity: 3, permanentChance: 1 },
  },
  // ---- ЛАБОРАТОРИЯ: мутировавший эксперимент ----
  specimen: {
    id: 'specimen', name: 'ОБРАЗЕЦ-12', title: 'МУТИРОВАННЫЙ ЭКСПЕРИМЕНТ', kind: 'creature',
    hp: 1000, speed: 38, dmg: 24, r: 14,
    proj: 'plasma', color: '#4a6e3f', core: '#b6ff2e', accent: '#c96bff',
    phases: PH('ФАЗА 1: ЛАТЕНТНАЯ ФАЗА', 'ФАЗА 2: НЕКРОЗ ОБОЛОЧКИ', 'ФАЗА 3: НЕКОНТРОЛИРУЕМЫЙ РОСТ'),
    attacks: [
      { name: 'ПРЫЖОК-ХВАТКА', telegraph: 0.5, dmg: 22 },
      { name: 'СПОРОВЫЙ ЗАЛП', telegraph: 0.6, dmg: 14 },
      { name: 'КИСЛОТНЫЙ ПЛЕВОК', telegraph: 0.45, dmg: 16 },
    ],
    arenaBreak: { radius: 3, toast: 'ОБРАЗЕЦ РАЗОРВАЛ КАПСУЛЫ: ТОКСИЧНЫЕ ЛУЖИ' },
    rewards: { credits: [430, 720], weaponRarity: 3, permanentChance: 1 },
  },
  // ---- ЛАБОРАТОРИЯ: нестабильный биомех ----
  biomech: {
    id: 'biomech', name: 'ХИМЕРА-М', title: 'БИОМЕХАНИЧЕСКИЙ ПРОТОТИП', kind: 'creature',
    hp: 950, speed: 36, dmg: 22, r: 13,
    proj: 'plasma', color: '#6e4a5e', core: '#ff5e8a', accent: '#3fe0ff',
    phases: PH('ФАЗА 1: СТАБИЛЬНЫЕ ПОКАЗАТЕЛИ', 'ФАЗА 2: ОТТОРЖЕНИЕ ИМПЛАНТОВ', 'ФАЗА 3: ЦЕПНАЯ ДЕГРАДАЦИЯ'),
    attacks: [
      { name: 'УДАР МАНИПУЛЯТОРА', telegraph: 0.6, dmg: 24 },
      { name: 'ЗАЛП ИМПЛАНТОВ', telegraph: 0.5, dmg: 12 },
      { name: 'СПАЗМ-РЫВОК', telegraph: 0.45, dmg: 18 },
    ],
    arenaBreak: { radius: 3, toast: 'ИМПЛАНТЫ ВЗРЫВАЮТСЯ: ОБЛОМКИ ПО ВСЕЙ АРЕНЕ' },
    rewards: { credits: [430, 720], weaponRarity: 3, permanentChance: 1 },
  },
  // ---- ОБЛОМОК: выживший корабельный ИИ ----
  hullmind: {
    id: 'hullmind', name: 'КАПИТАН-0', title: 'КОРАБЕЛЬНЫЙ ИИ-ПРИЗРАК', kind: 'core',
    hp: 900, speed: 42, dmg: 20, r: 11,
    proj: 'laser', color: '#5e6e7e', core: '#c96bff', accent: '#ffd54a',
    phases: PH('ФАЗА 1: КАРАНТИН НАРУШЕН', 'ФАЗА 2: АКТИВАЦИЯ ОРУДИЙ', 'ФАЗА 3: САМОУНИЧТОЖЕНИЕ ОТМЕНЕНО'),
    attacks: [
      { name: 'СВАРОЧНАЯ ДУГА', telegraph: 0.4, dmg: 14 },
      { name: 'ОБВАЛ ПЕРЕБОРОК', telegraph: 0.7, dmg: 26 },
      { name: 'ИОННОЕ КОЛЬЦО', telegraph: 0.5, dmg: 10 },
    ],
    arenaBreak: { radius: 3, toast: 'РЕАКТОР НЕСТАБИЛЕН: КАБЕЛИ ИСКРЯТ' },
    rewards: { credits: [400, 680], weaponRarity: 3, permanentChance: 1 },
  },
}

/** Структура + seed -> архетип босса */
export function pickBoss(type: DungeonType, seed: number): BossDef {
  const pools: Record<DungeonType, string[]> = {
    bunker: ['warden', 'commander'],
    factory: ['forge', 'rogueai'],
    lab: ['specimen', 'biomech'],
    crash: ['hullmind'],
  }
  const pool = pools[type] || pools.bunker
  return BOSSES[pool[(seed ^ type.length * 7919) % pool.length]!]
}

export interface BossState {
  def: BossDef; x: number; y: number; hp: number; maxHp: number
  phase: number; atkCd: number; windup: number; windupX: number; windupY: number
  move: 'chase' | 'slam' | 'dash'; flash: number; aim: number; walkT: number
  summoned: boolean
  /** арена уже дестабилизирована (50%) */
  arenaBroken: boolean
  /** визуальная фаза смерти */
  deathT: number
}

export function makeBoss(def: BossDef, x: number, y: number): BossState {
  return { def, x, y, hp: def.hp, maxHp: def.hp, phase: 0, atkCd: 1.5, windup: 0, windupX: 0, windupY: 0, move: 'chase', flash: 0, aim: 0, walkT: 0, summoned: false, arenaBroken: false, deathT: 0 }
}

// ============================================================
// ОТРИСОВКА: отдельный силуэт на каждый архетип
// ============================================================
const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

function telegraphs(ctx: CanvasRenderingContext2D, b: BossState, t: number) {
  if (b.move === 'slam' && b.windup > 0) {
    const k = 0.4 + Math.sin(t * 30) * 0.3
    ctx.strokeStyle = `rgba(255,85,51,${k})`
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(b.windupX, b.windupY, 26, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(255,85,51,0.12)'
    ctx.beginPath(); ctx.arc(b.windupX, b.windupY, 26, 0, Math.PI * 2); ctx.fill()
  }
  if (b.move === 'dash' && b.windup > 0) {
    ctx.strokeStyle = 'rgba(255,138,61,0.55)'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.windupX, b.windupY); ctx.stroke()
  }
}

function drawMech(ctx: CanvasRenderingContext2D, b: BossState, t: number) {
  const { x, def } = b
  const yy = b.y + Math.sin(b.walkT * 6) * 0.8
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath(); ctx.ellipse(x, b.y + 13, 18, 6, 0, 0, Math.PI * 2); ctx.fill()
  const st = Math.sin(b.walkT * 8)
  // массивные опоры с поршнями
  px(ctx, x - 13, yy + 4 + Math.max(0, st * 2), 6, 9, '#2c3540')
  px(ctx, x + 7, yy + 4 + Math.max(0, -st * 2), 6, 9, '#2c3540')
  px(ctx, x - 12, yy + 2 + Math.max(0, st * 2), 4, 4, '#4a5568')
  px(ctx, x + 8, yy + 2 + Math.max(0, -st * 2), 4, 4, '#4a5568')
  // корпус-рама
  px(ctx, x - 15, yy - 11, 30, 17, def.color)
  px(ctx, x - 15, yy - 11, 30, 3, '#8a96a3')
  px(ctx, x - 15, yy + 3, 30, 3, '#222831')
  // рёбра жёсткости
  for (let i = 0; i < 3; i++) px(ctx, x - 9 + i * 8, yy - 8, 2, 10, 'rgba(0,0,0,0.25)')
  // бронеплиты по фазам
  const pl = b.phase >= 1 ? '#ff8a3d' : '#4a5568'
  px(ctx, x - 18, yy - 9, 3, 12, pl)
  px(ctx, x + 15, yy - 9, 3, 12, pl)
  if (b.phase >= 2) { px(ctx, x - 11, yy - 15, 3, 4, '#ff5533'); px(ctx, x + 8, yy - 15, 3, 4, '#ff5533') }
  // раскалённое ядро
  const pulse = 0.6 + Math.sin(t * (4 + b.phase * 4)) * 0.4
  ctx.fillStyle = def.core
  ctx.beginPath(); ctx.arc(x, yy - 2, 4 + pulse, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffd9a0'; ctx.fillRect(x - 1, yy - 3, 2, 2)
  ctx.fillStyle = `rgba(255,138,61,${0.15 * pulse})`
  ctx.beginPath(); ctx.arc(x, yy - 2, 13, 0, Math.PI * 2); ctx.fill()
  // сенсорная голова
  px(ctx, x - 5, yy - 18, 10, 7, '#39424e')
  px(ctx, x - 3, yy - 16, 6, 2, b.phase === 2 && Math.sin(t * 20) > 0 ? '#ffffff' : def.core)
  // спаренные орудия
  ctx.save()
  ctx.translate(Math.round(x), Math.round(yy - 4))
  ctx.rotate(b.aim)
  px(ctx, 10, -7, 11, 3, '#39424e'); px(ctx, 19, -7, 3, 3, def.accent)
  px(ctx, 10, 4, 11, 3, '#39424e'); px(ctx, 19, 4, 3, 3, def.accent)
  ctx.restore()
}

function drawCommander(ctx: CanvasRenderingContext2D, b: BossState, t: number) {
  const { x, def } = b
  const yy = b.y + Math.sin(b.walkT * 9) * 0.6
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath(); ctx.ellipse(x, b.y + 12, 12, 4, 0, 0, Math.PI * 2); ctx.fill()
  const st = Math.sin(b.walkT * 11)
  // ноги экзоброни
  px(ctx, x - 7, yy + 2 + Math.max(0, st * 2), 5, 10, '#2c3540')
  px(ctx, x + 2, yy + 2 + Math.max(0, -st * 2), 5, 10, '#2c3540')
  px(ctx, x - 8, yy + 10 + Math.max(0, st * 2), 6, 2, '#1b2129')
  px(ctx, x + 2, yy + 10 + Math.max(0, -st * 2), 6, 2, '#1b2129')
  // торс
  px(ctx, x - 9, yy - 8, 18, 12, def.color)
  px(ctx, x - 9, yy - 8, 18, 2, '#8a96a3')
  px(ctx, x - 9, yy + 2, 18, 2, '#222831')
  // наплечники-плиты
  px(ctx, x - 13, yy - 10, 5, 7, b.phase >= 1 ? '#ff8a3d' : '#4a5568')
  px(ctx, x + 8, yy - 10, 5, 7, b.phase >= 1 ? '#ff8a3d' : '#4a5568')
  px(ctx, x - 13, yy - 10, 5, 2, def.accent)
  px(ctx, x + 8, yy - 10, 5, 2, def.accent)
  // нагрудное ядро
  const pulse = 0.5 + Math.sin(t * (5 + b.phase * 4)) * 0.4
  ctx.fillStyle = def.core
  ctx.beginPath(); ctx.arc(x, yy - 2, 3 + pulse, 0, Math.PI * 2); ctx.fill()
  // шлем с визором и гребнем
  px(ctx, x - 4, yy - 15, 8, 7, '#39424e')
  px(ctx, x - 3, yy - 13, 6, 2, def.core)
  px(ctx, x - 1, yy - 18, 2, 4, def.accent)
  // знамя на спине
  px(ctx, x + 9, yy - 20, 2, 12, '#4a5568')
  px(ctx, x + 11, yy - 20, 8, 6, def.accent)
  px(ctx, x + 12, yy - 19, 6, 1, 'rgba(0,0,0,0.3)')
  // оружие в руке
  ctx.save()
  ctx.translate(Math.round(x), Math.round(yy - 3))
  ctx.rotate(b.aim)
  px(ctx, 8, -2, 13, 4, '#39424e')
  px(ctx, 19, -3, 4, 6, def.accent)
  px(ctx, 8, -5, 3, 3, '#222831')
  ctx.restore()
}

function drawCreature(ctx: CanvasRenderingContext2D, b: BossState, t: number) {
  const { x, def } = b
  const yy = b.y + Math.sin(b.walkT * 5) * 1.4
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath(); ctx.ellipse(x, b.y + 12, 16, 5, 0, 0, Math.PI * 2); ctx.fill()
  // пульсирующая биомасса
  const br = 13 + Math.sin(t * 3 + b.phase) * 2
  ctx.fillStyle = def.color
  ctx.beginPath(); ctx.ellipse(x, yy - 4, br, br * 0.85, 0, 0, Math.PI * 2); ctx.fill()
  // наросты
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t * 0.5
    const gx = x + Math.cos(a) * (br - 2), gy = yy - 4 + Math.sin(a) * (br - 4)
    ctx.fillStyle = i % 2 ? def.core : def.accent
    ctx.beginPath(); ctx.arc(gx, gy, 2.4, 0, Math.PI * 2); ctx.fill()
  }
  // брюшная мембрана
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath(); ctx.ellipse(x, yy + 2, br * 0.7, br * 0.4, 0, 0, Math.PI * 2); ctx.fill()
  // разрывы оболочки по фазам
  if (b.phase >= 1) {
    px(ctx, x - 8, yy - 8, 4, 2, def.core)
    px(ctx, x + 5, yy - 2, 3, 2, def.core)
  }
  if (b.phase >= 2) px(ctx, x - 3, yy - 12, 3, 3, '#ffffff')
  // глаз-ядро
  const pulse = 0.5 + Math.sin(t * (6 + b.phase * 5)) * 0.4
  ctx.fillStyle = def.core
  ctx.beginPath(); ctx.arc(x, yy - 6, 3.5 + pulse, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#0f141b'
  ctx.beginPath(); ctx.arc(x, yy - 6, 1.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = `rgba(182,255,46,${0.14 * pulse})`
  ctx.beginPath(); ctx.arc(x, yy - 6, 12, 0, Math.PI * 2); ctx.fill()
  // щупальца
  for (let i = -1; i <= 1; i += 2) {
    ctx.strokeStyle = def.color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x + i * (br - 4), yy + 2)
    ctx.quadraticCurveTo(x + i * (br + 8), yy + 6 + Math.sin(t * 7 + i) * 3, x + i * (br + 4), yy + 12)
    ctx.stroke()
  }
}

function drawCore(ctx: CanvasRenderingContext2D, b: BossState, t: number) {
  const { x, def } = b
  const hover = Math.sin(t * 4) * 3
  const yy = b.y - 6 + hover
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath(); ctx.ellipse(x, b.y + 10, 10 - hover * 0.5, 3.5, 0, 0, Math.PI * 2); ctx.fill()
  // кабельные жгуты снизу
  ctx.strokeStyle = '#39424e'
  ctx.lineWidth = 2
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(x + i * 5, yy + 6)
    ctx.quadraticCurveTo(x + i * 7, b.y + 4, x + i * 9, b.y + 10)
    ctx.stroke()
  }
  // оболочка реактора
  ctx.fillStyle = def.color
  ctx.beginPath(); ctx.arc(x, yy - 4, 11, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#8a96a3'
  ctx.beginPath(); ctx.arc(x, yy - 4, 11, Math.PI * 1.1, Math.PI * 1.9); ctx.lineTo(x, yy - 4); ctx.fill()
  // сегменты-ставни
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * (0.4 + b.phase * 0.4)
    ctx.fillStyle = b.phase >= 2 ? '#ff5533' : '#222831'
    ctx.fillRect(x + Math.cos(a) * 8 - 1.5, yy - 4 + Math.sin(a) * 8 - 1.5, 3, 3)
  }
  // ядро
  const pulse = 0.5 + Math.sin(t * (6 + b.phase * 5)) * 0.5
  ctx.fillStyle = def.core
  ctx.beginPath(); ctx.arc(x, yy - 4, 4.5 + pulse, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - 1, yy - 5, 2, 2)
  ctx.fillStyle = `${def.core}26`
  ctx.beginPath(); ctx.arc(x, yy - 4, 15 + pulse * 3, 0, Math.PI * 2); ctx.fill()
  // кольца-манипуляторы
  ctx.save()
  ctx.translate(Math.round(x), Math.round(yy - 4))
  ctx.rotate(b.aim + Math.sin(t * 2) * 0.2)
  px(ctx, 10, -2, 8, 3, '#39424e'); px(ctx, 17, -3, 3, 5, def.accent)
  ctx.restore()
}

export function drawBoss(ctx: CanvasRenderingContext2D, b: BossState, t: number) {
  telegraphs(ctx, b, t)
  if (b.def.kind === 'commander') drawCommander(ctx, b, t)
  else if (b.def.kind === 'creature') drawCreature(ctx, b, t)
  else if (b.def.kind === 'core') drawCore(ctx, b, t)
  else drawMech(ctx, b, t)
  if (b.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, b.flash * 8)})`
    ctx.fillRect(b.x - 18, b.y - 20, 36, 36)
  }
  // агония при смерти
  if (b.deathT > 0) {
    ctx.fillStyle = `rgba(255,138,61,${0.4 * Math.sin(t * 40)})`
    ctx.beginPath(); ctx.arc(b.x, b.y - 4, 16, 0, Math.PI * 2); ctx.fill()
  }
}
