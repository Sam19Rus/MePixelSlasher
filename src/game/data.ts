// ============================================================
// НАЁМНИК ПУСТОТЫ — данные: наборы частей, генераторы, биомы
// ============================================================

export const rnd = Math.random
export const pick = <T,>(a: T[]): T => a[(rnd() * a.length) | 0]
export const irand = (a: number, b: number) => a + ((rnd() * (b - a + 1)) | 0)
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

// ---------- Редкости ----------
export const RARITIES = [
  { name: 'ОБЫЧНОЕ', short: 'ОБЫЧН', color: '#9aa7b8', mult: 1 },
  { name: 'УЛУЧШЕННОЕ', short: 'УЛУЧШ', color: '#4ade60', mult: 1.18 },
  { name: 'РЕДКОЕ', short: 'РЕДКОЕ', color: '#3fa9ff', mult: 1.38 },
  { name: 'ЭПИЧЕСКОЕ', short: 'ЭПИЧ', color: '#c96bff', mult: 1.62 },
  { name: 'ЛЕГЕНДАРНОЕ', short: 'ЛЕГЕНД', color: '#ffa726', mult: 1.95 },
]

// ---------- 12 наборов частей оружия ----------
export type ProjKind = 'laser' | 'bullet' | 'plasma' | 'rocket' | 'rail'
export interface KitPart { name: string; dmg: number; rate: number; mag: number; acc: number }
export interface Kit {
  name: string
  color: string
  proj: ProjKind
  base: { dmg: number; rate: number; mag: number; acc: number; speed: number }
  explosive?: number
  pellets?: number
  pierce?: boolean
  barrel: KitPart
  core: KitPart
  cell: KitPart
}

export const KITS: Kit[] = [
  { name: 'ВСПЫШКА', color: '#ffd54a', proj: 'laser', base: { dmg: 7, rate: 7, mag: 24, acc: 0.7, speed: 260 },
    barrel: { name: 'СТ-ИЗЛУЧАТЕЛЬ', dmg: 0.05, rate: 0.15, mag: 0, acc: 0.05 }, core: { name: 'РАМА «ИСКРА»', dmg: 0.1, rate: 0.05, mag: 0.1, acc: 0 }, cell: { name: 'ФОТОН-ЯЧЕЙКА', dmg: 0, rate: 0.1, mag: 0.25, acc: 0.05 } },
  { name: 'ГРОЗА', color: '#3fe0ff', proj: 'plasma', base: { dmg: 11, rate: 4.2, mag: 16, acc: 0.62, speed: 200 },
    barrel: { name: 'ПЛАЗМО-СТВОЛ', dmg: 0.18, rate: -0.05, mag: 0, acc: 0.04 }, core: { name: 'КАТУШКА «ГРОЗА»', dmg: 0.08, rate: 0.12, mag: 0.08, acc: 0 }, cell: { name: 'ИОННЫЙ БЛОК', dmg: 0.05, rate: 0, mag: 0.2, acc: 0.08 } },
  { name: 'КУВАЛДА', color: '#ff8a3d', proj: 'rocket', base: { dmg: 22, rate: 1.6, mag: 6, acc: 0.5, speed: 150 }, explosive: 26,
    barrel: { name: 'ТРУБА «МОЛОТ»', dmg: 0.25, rate: -0.1, mag: 0, acc: -0.04 }, core: { name: 'ПУСКОВАЯ РАМА', dmg: 0.1, rate: 0.08, mag: 0.15, acc: 0.02 }, cell: { name: 'БАРАБАН БОЕПРИПАСОВ', dmg: 0.08, rate: 0, mag: 0.35, acc: -0.02 } },
  { name: 'ОСА', color: '#c8f542', proj: 'bullet', base: { dmg: 6, rate: 9, mag: 32, acc: 0.6, speed: 300 },
    barrel: { name: 'ИГЛО-СТВОЛ', dmg: 0.06, rate: 0.2, mag: 0, acc: 0.08 }, core: { name: 'ЛЕГКИЙ КОРПУС', dmg: 0, rate: 0.12, mag: 0.1, acc: 0.05 }, cell: { name: 'МАГАЗИН-ПЛЕНКА', dmg: -0.04, rate: 0.05, mag: 0.4, acc: 0 } },
  { name: 'ФОТОН', color: '#ffffff', proj: 'laser', base: { dmg: 13, rate: 3.2, mag: 12, acc: 0.92, speed: 320 },
    barrel: { name: 'ФОКУС-ЛИНЗА', dmg: 0.12, rate: 0, mag: 0, acc: 0.14 }, core: { name: 'ГИРО-СТАБИЛИЗАТОР', dmg: 0.05, rate: 0.06, mag: 0, acc: 0.1 }, cell: { name: 'ЛАЗЕР-КАПСУЛА', dmg: 0.15, rate: -0.06, mag: 0.15, acc: 0 } },
  { name: 'МАГМА', color: '#ff5533', proj: 'rocket', base: { dmg: 18, rate: 2.2, mag: 8, acc: 0.55, speed: 170 }, explosive: 20,
    barrel: { name: 'ТЕРМО-СОПЛО', dmg: 0.22, rate: -0.06, mag: 0, acc: 0 }, core: { name: 'ЖАРОПРОЧНЫЙ КОРПУС', dmg: 0.1, rate: 0.1, mag: 0.1, acc: 0.03 }, cell: { name: 'ТЕРМО-ЗАРЯД', dmg: 0.18, rate: 0, mag: 0.2, acc: -0.03 } },
  { name: 'ИНЕЙ', color: '#9fd8ff', proj: 'bullet', base: { dmg: 9, rate: 5, mag: 20, acc: 0.78, speed: 260 },
    barrel: { name: 'КРИО-СТВОЛ', dmg: 0.12, rate: 0.04, mag: 0, acc: 0.1 }, core: { name: 'ОХЛАЖДАЕМЫЙ КОРПУС', dmg: 0.06, rate: 0.1, mag: 0.06, acc: 0.04 }, cell: { name: 'АЗОТНЫЙ БЛОК', dmg: 0.04, rate: 0.05, mag: 0.22, acc: 0.06 } },
  { name: 'РОЙ', color: '#7dff5e', proj: 'bullet', base: { dmg: 4, rate: 12, mag: 40, acc: 0.42, speed: 240 }, pellets: 2,
    barrel: { name: 'РАЗДВОИТЕЛЬ', dmg: -0.08, rate: 0.25, mag: 0, acc: -0.06 }, core: { name: 'МУЛЬТИ-ЗАТВОР', dmg: 0, rate: 0.2, mag: 0.12, acc: 0 }, cell: { name: 'ЛЕНТА «РОЙ»', dmg: 0, rate: 0.1, mag: 0.45, acc: -0.04 } },
  { name: 'КОПЬЁ', color: '#3dffc8', proj: 'rail', base: { dmg: 20, rate: 2, mag: 8, acc: 0.95, speed: 420 }, pierce: true,
    barrel: { name: 'РЕЛЬСА «КОПЬЁ»', dmg: 0.24, rate: -0.08, mag: 0, acc: 0.1 }, core: { name: 'ИМПУЛЬСНЫЙ КОРПУС', dmg: 0.12, rate: 0.05, mag: 0.1, acc: 0.05 }, cell: { name: 'СВЕРХ-КОНДЕНСАТОР', dmg: 0.16, rate: -0.04, mag: 0.12, acc: 0 } },
  { name: 'ЦЕРБЕР', color: '#ffb347', proj: 'bullet', base: { dmg: 5, rate: 2.4, mag: 10, acc: 0.3, speed: 230 }, pellets: 5,
    barrel: { name: 'РАСТРУБ «ЦЕРБЕР»', dmg: 0.1, rate: 0, mag: 0, acc: -0.02 }, core: { name: 'УСИЛЕННЫЙ КОРПУС', dmg: 0.14, rate: 0.06, mag: 0.08, acc: 0.02 }, cell: { name: 'ДРОБОВОЙ БЛОК', dmg: 0.12, rate: 0.08, mag: 0.18, acc: 0 } },
  { name: 'ГАММА', color: '#b6ff2e', proj: 'plasma', base: { dmg: 12, rate: 3.6, mag: 14, acc: 0.6, speed: 190 }, explosive: 12,
    barrel: { name: 'РАДИО-СТВОЛ', dmg: 0.2, rate: -0.04, mag: 0, acc: 0 }, core: { name: 'СВИНЦОВЫЙ КОРПУС', dmg: 0.1, rate: 0.08, mag: 0.1, acc: 0.04 }, cell: { name: 'ИЗОТОПНАЯ ЯЧЕЙКА', dmg: 0.14, rate: 0, mag: 0.16, acc: -0.02 } },
  { name: 'НУЛЬ', color: '#d05fff', proj: 'laser', base: { dmg: 16, rate: 2.8, mag: 10, acc: 0.85, speed: 340 }, pierce: true,
    barrel: { name: 'ПУСТОТНЫЙ РЕЗОНАТОР', dmg: 0.26, rate: -0.1, mag: 0, acc: 0.08 }, core: { name: 'НУЛЕВОЙ КОРПУС', dmg: 0.15, rate: 0.04, mag: 0.06, acc: 0.06 }, cell: { name: 'АНТИ-ЯЧЕЙКА', dmg: 0.2, rate: -0.05, mag: 0.1, acc: 0.04 } },
]

export interface Weapon {
  name: string
  kitIdx: number
  color: string
  proj: ProjKind
  dmg: number
  rate: number
  mag: number
  acc: number
  speed: number
  explosive: number
  pellets: number
  pierce: boolean
  rarity: number
  parts: string[]
  reload: number
  magCur?: number
}

export function genWeapon(rarity: number, kitIdx = -1): Weapon {
  const ki = kitIdx >= 0 ? kitIdx : irand(0, KITS.length - 1)
  const kit = KITS[ki]
  const coherent = rnd() < 0.65
  const slots: ('barrel' | 'core' | 'cell')[] = ['barrel', 'core', 'cell']
  let dmg = 0, rate = 0, mag = 0, acc = 0
  const parts: string[] = []
  for (const s of slots) {
    const k = coherent ? kit : KITS[irand(0, KITS.length - 1)]
    const p = k[s]
    parts.push(p.name)
    dmg += p.dmg; rate += p.rate; mag += p.mag; acc += p.acc
  }
  const m = RARITIES[rarity].mult
  const mk = irand(1, 9)
  let pellets = kit.pellets || 1
  let explosive = kit.explosive || 0
  if (rarity >= 3 && rnd() < 0.7) pellets += 1
  if (rarity >= 4) { explosive = Math.max(explosive, 14); dmg += 0.2 }
  const w: Weapon = {
    name: `${kit.name}-МК${mk}`,
    kitIdx: ki,
    color: kit.color,
    proj: kit.proj,
    dmg: Math.max(2, Math.round(kit.base.dmg * (1 + dmg) * m)),
    rate: Math.max(0.5, +(kit.base.rate * (1 + rate) * (1 + (m - 1) * 0.4)).toFixed(2)),
    mag: Math.max(3, Math.round(kit.base.mag * (1 + mag) * (1 + (m - 1) * 0.5))),
    acc: clamp(kit.base.acc + acc * 0.6 + (m - 1) * 0.15, 0.08, 0.98),
    speed: kit.base.speed,
    explosive,
    pellets,
    pierce: !!kit.pierce || rarity >= 4,
    rarity,
    parts,
    reload: clamp(1.5 - kit.base.rate * 0.06, 0.7, 1.6),
  }
  return w
}

// оценка мощности оружия — для правила «подбирай только лучшее»
export function weaponScore(w: Weapon): number {
  return (
    w.dmg * w.rate * w.pellets * (1 + (w.explosive > 0 ? 0.3 : 0)) +
    w.mag * 1.2 + w.acc * 30 + w.speed * 0.05 + (w.pierce ? 22 : 0) + w.rarity * 18
  )
}

// ---------- Броня ----------
export const ARMOR_SLOTS = ['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'] as const
export type ArmorSlot = (typeof ARMOR_SLOTS)[number]
const ARMOR_BONUS_POOL: { key: string; label: string; min: number; max: number }[] = [
  { key: 'hp', label: 'ЖИВУЧЕСТЬ', min: 8, max: 40 },
  { key: 'dmg', label: 'УРОН', min: 4, max: 22 },
  { key: 'speed', label: 'СКОРОСТЬ', min: 3, max: 14 },
  { key: 'rate', label: 'ТЕМП ОГНЯ', min: 4, max: 18 },
  { key: 'acc', label: 'ТОЧНОСТЬ', min: 4, max: 16 },
  { key: 'crit', label: 'КРИТ-ШАНС', min: 3, max: 14 },
]
export interface Armor {
  name: string
  slot: ArmorSlot
  rarity: number
  bonuses: { key: string; label: string; val: number }[]
  score: number
  color: string
}
const ARMOR_BASES: Record<ArmorSlot, string[]> = {
  ШЛЕМ: ['КУПОЛ', 'ВИЗОР', 'ШАТУР', 'ГРЕБЕНЬ'],
  НАГРУДНИК: ['ПАНЦИРЬ', 'ЖИЛЕТ', 'КИРАСА', 'ЭКЗО-КОРПУС'],
  ПЕРЧАТКИ: ['ХВАТАЧИ', 'ЛАТЫ', 'МУФТЫ', 'КОГТИ'],
  БОТИНКИ: ['СКАЧКИ', 'ТРАКИ', 'ПЛИТЫ', 'СПРИНТЕРЫ'],
}
export function genArmor(rarity: number): Armor {
  const slot = pick(ARMOR_SLOTS as unknown as ArmorSlot[])
  const nB = 1 + Math.min(2, rarity) + (rnd() < 0.4 ? 1 : 0)
  const keys = [...ARMOR_BONUS_POOL].sort(() => rnd() - 0.5).slice(0, Math.min(nB, 3))
  const bonuses = keys.map((k) => {
    const v = Math.round((k.min + rnd() * (k.max - k.min)) * RARITIES[rarity].mult)
    return { key: k.key, label: k.label, val: v }
  })
  const score = bonuses.reduce((s, b) => s + b.val * (b.key === 'hp' ? 1 : 2.2), 0) + rarity * 12
  return {
    name: `${pick(ARMOR_BASES[slot])} «${pick(KITS).name}»`,
    slot,
    rarity,
    bonuses,
    score: Math.round(score),
    color: RARITIES[rarity].color,
  }
}

// ---------- Враги: наборы частей ----------
export interface EnemyDef {
  type: string
  label: string
  bodies: string[]
  heads: string[]
  weapons: string[]
  palettes: { main: string; dark: string; accent: string }[]
  hp: number
  speed: number
  dmg: number
  r: number
  score: number
}
export const ENEMY_DEFS: Record<string, EnemyDef> = {
  grunt: {
    type: 'grunt', label: 'МАРОДЁР',
    bodies: ['РУБАШКА-БРОНЯ', 'РВАНЫЙ ЖИЛЕТ', 'ЭКЗО-РАМА'],
    heads: ['КАПЮШОН', 'ШЛЕМ-ЩИТОК', 'СЕНСОР-ГЛАЗ'],
    weapons: ['КОГТИ', 'ТЕСАК', 'ТРУБА'],
    palettes: [
      { main: '#a4503c', dark: '#5c241a', accent: '#ffd166' },
      { main: '#7c4d9e', dark: '#3c2354', accent: '#ff5e8a' },
      { main: '#8a8f6a', dark: '#464b33', accent: '#f5a623' },
    ],
    hp: 26, speed: 46, dmg: 8, r: 6, score: 10,
  },
  brute: {
    type: 'brute', label: 'ГРОМИЛА',
    bodies: ['ПЛИТНЫЙ КОРПУС', 'ТЯЖЁЛАЯ РАМА', 'ШИПОВАННАЯ БРОНЯ'],
    heads: ['ЗАБРАЛО', 'КЛЫКАСТАЯ МАСКА', 'ПРОЖЕКТОР'],
    weapons: ['КУВАЛДА', 'ЦЕПЬ', 'ПНЕВМОКУЛАК'],
    palettes: [
      { main: '#6e5a4a', dark: '#3a2e24', accent: '#ff8a3d' },
      { main: '#54667a', dark: '#2a3440', accent: '#3fe0ff' },
      { main: '#7a5a6e', dark: '#402a3a', accent: '#ff5e8a' },
    ],
    hp: 90, speed: 30, dmg: 22, r: 10, score: 30,
  },
  gunner: {
    type: 'gunner', label: 'СТРЕЛОК',
    bodies: ['РАЗГРУЗКА', 'БРОНЕКОСТЮМ', 'ТЕХ-ЖИЛЕТ'],
    heads: ['ВИЗОР-ЩИТОК', 'СЕНСОР-МАСКА', 'ТРИ-ОКУЛЯР'],
    weapons: ['ИМПУЛЬСНИК', 'ПЛАЗМЕР', 'ДРОБОВИК'],
    palettes: [
      { main: '#3a6e5e', dark: '#1e3a30', accent: '#7dff5e' },
      { main: '#5e4a7c', dark: '#2e2440', accent: '#c96bff' },
      { main: '#6e6438', dark: '#38321c', accent: '#ffd54a' },
    ],
    hp: 30, speed: 40, dmg: 7, r: 6, score: 15,
  },
  flyer: {
    type: 'flyer', label: 'ПИКЕР',
    bodies: ['ГЛИССЕР', 'ОСА-КОРПУС', 'ЛОПАСТИ'],
    heads: ['СЕНСОР-КУПОЛ', 'ЖАЛЬНЫЙ БЛОК', 'МАЯЧОК'],
    weapons: ['ЛУЧ', 'ДРОТИКИ', 'БОМБЫ'],
    palettes: [
      { main: '#4a6e8a', dark: '#243a4c', accent: '#3fe0ff' },
      { main: '#8a4a5e', dark: '#4c242e', accent: '#ff5e8a' },
      { main: '#5e8a4a', dark: '#2e4c24', accent: '#b6ff2e' },
    ],
    hp: 16, speed: 62, dmg: 6, r: 5, score: 12,
  },
}

// ---------- Компаньоны ----------
export interface CompDef {
  kind: string
  label: string
  bodies: string[]
  guns: string[]
  palettes: { main: string; dark: string; accent: string }[]
  hp: number
  dmg: number
  rate: number
  range: number
  speed: number
  proj: string
  flying?: boolean
}
export const COMP_DEFS: CompDef[] = [
  {
    kind: 'mech', label: 'МЕХ «КЛЫК»',
    bodies: ['ШАГАЮЩИЙ КОРПУС', 'ПРЫЖКОВАЯ РАМА', 'ШТУРМОВАЯ БРОНЯ'],
    guns: ['АВТО-ПУШКА', 'ПЛАЗМА-ЛАПА', 'РАКЕТНАЯ РУКА'],
    palettes: [
      { main: '#7a8494', dark: '#3a4150', accent: '#3fe0ff' },
      { main: '#94764a', dark: '#4c3a22', accent: '#ffa726' },
    ],
    hp: 100, dmg: 5, rate: 4, range: 110, speed: 52, proj: 'bullet',
  },
  {
    kind: 'tank', label: 'РОБО-ТАНК «ПАНЦИРЬ»',
    bodies: ['ГУСЕНИЧНАЯ ПЛАТФОРМА', 'КОЛЁСНОЕ ШАССИ', 'ТЯЖЁЛАЯ БАШНЯ'],
    guns: ['ФУГАСНАЯ ПУШКА', 'КАРТЕЧНИЦА', 'ЛУЧЕВАЯ БАШНЯ'],
    palettes: [
      { main: '#5e7a5e', dark: '#2b3a2b', accent: '#7dff5e' },
      { main: '#7a5e5e', dark: '#3a2b2b', accent: '#ff5533' },
    ],
    hp: 160, dmg: 9, rate: 1.8, range: 130, speed: 36, proj: 'rocket',
  },
  {
    kind: 'drone', label: 'ДРОН «ГЛАЗ»',
    bodies: ['ВИНТОКРЫЛ', 'СФЕРА-РОТОР', 'КРЫЛО-ПЛЕНКА'],
    guns: ['ЛАЗЕР-ЛУЧ', 'ИГЛОМЁТ', 'ИМПУЛЬСНИК'],
    palettes: [
      { main: '#5e6e8a', dark: '#2b3444', accent: '#3fe0ff' },
      { main: '#8a7a5e', dark: '#443b2b', accent: '#ffd54a' },
    ],
    hp: 50, dmg: 3, rate: 7, range: 120, speed: 66, proj: 'laser', flying: true,
  },
  {
    kind: 'turret', label: 'ШАГОХОД-ТУРЕЛЬ «ШТЫРЬ»',
    bodies: ['ЧЕТЫРЕХНОГ', 'ТРИПОД', 'ПАУЧЬЕ ШАССИ'],
    guns: ['СКОРОСТРЕЛ', 'РЕЛЬСОТРОН', 'РАЗРЫВНИК'],
    palettes: [
      { main: '#9a6a9a', dark: '#4a334a', accent: '#c96bff' },
      { main: '#5e7a6e', dark: '#2b3a33', accent: '#ffa726' },
    ],
    hp: 140, dmg: 7, rate: 6, range: 140, speed: 46, proj: 'bullet',
  },
]

// ---------- Модули улучшений отряда (7) ----------
export interface CompUpgrade { id: string; name: string; desc: string; color: string; max: number }
export const COMP_UPGRADES: CompUpgrade[] = [
  { id: 'dmg', name: 'КАЛИБР+', desc: '+20% урон всех компаньонов', color: '#ff5533', max: 5 },
  { id: 'rate', name: 'СКОРОСТРЕЛ', desc: '+16% темп огня отряда', color: '#ffd54a', max: 5 },
  { id: 'range', name: 'ДАЛЬНОСТЬ', desc: '+18% радиус атаки', color: '#3fe0ff', max: 5 },
  { id: 'pierce', name: 'ПРОБОЙ', desc: 'Снаряд пробивает +1 цель', color: '#c96bff', max: 3 },
  { id: 'crit', name: 'КРИТ-ЧИП', desc: '+10% шанс крита (×2 урон)', color: '#ffa726', max: 5 },
  { id: 'blast', name: 'ФУГАС', desc: 'Снаряды взрываются по области', color: '#ff5e8a', max: 3 },
  { id: 'salvo', name: 'ЗАЛП', desc: '+20% шанс второго выстрела', color: '#7dff5e', max: 4 },
]

// ---------- Биомы ----------
export interface Biome {
  name: string
  ground: string[]
  crack: string
  weather: 'ember' | 'snow' | 'spore' | 'sand' | 'spark' | 'ash' | 'none'
  decos: string[]
  fog: string
}
export const BIOMES: Biome[] = [
  { name: 'РЖАВЫЕ ДЮНЫ', ground: ['#8a5a33', '#7d4f2b', '#96653c', '#6f4526'], crack: '#5a371e', weather: 'sand', decos: ['#6e4426', '#a4744a', '#c89a6e'], fog: 'rgba(255,180,110,0.05)' },
  { name: 'ПЕПЕЛЬНАЯ ПУСТОШЬ', ground: ['#4a4e57', '#41454d', '#545963', '#383c43'], crack: '#2c2f35', weather: 'ash', decos: ['#5e636e', '#33373e', '#787e8a'], fog: 'rgba(140,150,170,0.06)' },
  { name: 'ЛЕДЯНОЙ РАЗЛОМ', ground: ['#7fb6c9', '#72a9bd', '#8cc4d6', '#649cae'], crack: '#4d7e90', weather: 'snow', decos: ['#a8d8e8', '#5e93a6', '#d8f0f8'], fog: 'rgba(160,220,255,0.07)' },
  { name: 'КРИСТАЛЬНЫЕ ПОЛЯ', ground: ['#3f4a6e', '#37405f', '#47547d', '#2f3752'], crack: '#252b40', weather: 'spark', decos: ['#7d5eff', '#3fe0ff', '#c96bff'], fog: 'rgba(120,110,255,0.06)' },
  { name: 'КИСЛОТНЫЕ ТОПИ', ground: ['#4a6e3f', '#41613a', '#547d4a', '#38572f'], crack: '#2c4025', weather: 'spore', decos: ['#7dff5e', '#3f6e33', '#b6ff2e'], fog: 'rgba(140,255,120,0.06)' },
  { name: 'ВУЛКАНИЧЕСКИЙ ПОЯС', ground: ['#4a3338', '#412b30', '#543c41', '#38262b'], crack: '#ff6b35', weather: 'ember', decos: ['#5e444a', '#2c1f23', '#ff8a3d'], fog: 'rgba(255,110,60,0.07)' },
]

export const CAPSULE_SHAPES = ['ЦИЛИНДР', 'ЯЩИК', 'КАНИСТРА', 'СФЕРА']
export const CAPSULE_COLORS = [
  { body: '#8a5a3c', band: '#ffd166' },
  { body: '#4a6e5e', band: '#7dff5e' },
  { body: '#5e5470', band: '#c96bff' },
  { body: '#706250', band: '#3fe0ff' },
  { body: '#6e3a3a', band: '#ff8a3d' },
  { body: '#3e5a6e', band: '#9fd8ff' },
]
