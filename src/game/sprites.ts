// Процедурный пиксель-арт: визуальные компоненты собираются из частей (anchors),
// чтобы в будущем заменить их sprite sheets без переписывания gameplay-кода.
import { Rng } from './rng'
import { TILE, type DungeonLayout, type Room } from './structures'

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function flashBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, flash: number) {
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, flash * 9)})`
    ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }
}

// ============================================================
// ОРУЖИЕ: собирается из компонентов (body + barrel + magazine +
// sight + muzzle + energy cell). Разные части = разный силуэт.
// Рисуется вдоль +X от рукояти (anchor-точка).
// ============================================================
export interface WeaponVisual {
  proj: string
  kitIdx: number
  rarity: number
  color: string
  pellets?: number
  explosive?: number
  pierce?: boolean
}

export function drawWeaponShape(ctx: CanvasRenderingContext2D, w: WeaponVisual | null | undefined, x: number, y: number, aim: number) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(aim)
  if (!w) {
    px(ctx, 2, -1, 8, 3, '#39424e'); px(ctx, 9, -1, 3, 2, '#9aa7b8'); px(ctx, 2, 2, 2, 2, '#222a33')
    ctx.restore()
    return
  }
  const bodyC = '#39424e', dark = '#222a33', light = '#5e6e7e'
  const bodyLen = 7 + (w.kitIdx % 3) * 2 // 7 / 9 / 11
  const bodyH = w.kitIdx % 2 === 0 ? 3 : 4
  const y0 = -Math.floor(bodyH / 2)
  // корпус (вариант формы от набора)
  const shape = w.kitIdx % 3
  if (shape === 0) { px(ctx, 0, y0, bodyLen, bodyH, bodyC); px(ctx, 0, y0, bodyLen, 1, light) }
  else if (shape === 1) { px(ctx, 0, y0 + 1, bodyLen + 1, bodyH - 1, bodyC); px(ctx, 1, y0, bodyLen - 2, 1, bodyC); px(ctx, 0, y0 + 1, bodyLen + 1, 1, light) }
  else { px(ctx, 0, y0, bodyLen - 1, bodyH, bodyC); px(ctx, bodyLen - 2, y0 + (bodyH > 3 ? 1 : 0), 3, bodyH - (bodyH > 3 ? 1 : 0), bodyC); px(ctx, 0, y0, bodyLen - 1, 1, light) }
  // акцентная полоса производителя/редкости
  px(ctx, 1, y0 + bodyH - 1, bodyLen - 2, 1, w.color + '99')
  // ствол по типу снаряда
  if (w.proj === 'laser') {
    px(ctx, bodyLen, -1, 5, 2, light)
    px(ctx, bodyLen + 4, -2, 2, 1, dark); px(ctx, bodyLen + 4, 1, 2, 1, dark)
    px(ctx, bodyLen + 5, -1, 2, 2, w.color)
  } else if (w.proj === 'plasma') {
    px(ctx, bodyLen, -2, 4, 4, dark)
    px(ctx, bodyLen + 1, -2, 1, 4, w.color); px(ctx, bodyLen + 3, -2, 1, 4, w.color)
    px(ctx, bodyLen + 4, -1, 2, 2, '#ffffff')
  } else if (w.proj === 'rocket') {
    px(ctx, bodyLen, -2, 6, 5, light)
    px(ctx, bodyLen, -2, 6, 1, bodyC)
    px(ctx, bodyLen + 6, -1, 2, 3, w.color)
    if (w.pellets && w.pellets > 1) { px(ctx, bodyLen + 1, -4, 3, 2, dark); px(ctx, bodyLen + 1, 3, 3, 2, dark) }
  } else if (w.proj === 'rail') {
    px(ctx, bodyLen, -1, 9, 2, light)
    px(ctx, bodyLen, -1, 9, 1, w.color)
    px(ctx, 1, -3 - (bodyH > 3 ? 1 : 0), 4, 2, dark)
    px(ctx, 2, -3 - (bodyH > 3 ? 1 : 0), 1, 2, w.color)
  } else {
    px(ctx, bodyLen, -1, 4, 2, light)
    if (w.rarity >= 2) { px(ctx, bodyLen + 3, -2, 2, 4, dark) } // дульный тормоз
    if (w.pellets && w.pellets > 2) { px(ctx, bodyLen, 1, 4, 1, dark); px(ctx, bodyLen, -2, 4, 1, dark) }
  }
  // магазин (вариант от набора)
  const magV = w.kitIdx % 3
  if (magV === 0) px(ctx, 2, y0 + bodyH, 2, 4, dark)
  else if (magV === 1) { px(ctx, 1, y0 + bodyH, 4, 3, dark); px(ctx, 2, y0 + bodyH + 1, 2, 1, light) } // барабан
  else px(ctx, 3, y0 - 2, 4, 2, dark) // верхний короб
  // прицел
  if (w.rarity >= 1) px(ctx, bodyLen - 4, y0 - 2, 2, 2, light)
  if (w.rarity >= 3) { px(ctx, bodyLen - 6, y0 - 3, 5, 2, dark); px(ctx, bodyLen - 5, y0 - 3, 1, 1, w.color) }
  // энерго-ячейка
  px(ctx, 0, y0 + 1, 1, bodyH - 2, w.color)
  // пробивные плавники
  if (w.pierce) { px(ctx, bodyLen - 2, y0 - 1, 1, 1, w.color); px(ctx, bodyLen - 2, y0 + bodyH, 1, 1, w.color) }
  // рукоять
  px(ctx, 2, y0 + bodyH, 2, 2, '#1b2129')
  ctx.restore()
}

// ============================================================
// ИГРОК: многослойная сборка Base + Boots + Chest + Gloves/
// Shoulders + Helmet + Backpack + Weapon. Экипировка реально
// меняет силуэт.
// ============================================================
export interface ArmorVisual { color: string; rarity: number }
export interface PlayerVisual {
  x: number; y: number; aim: number; walkT: number; slashT: number; dashT: number
  chestColor: string; weaponColor: string
  armor?: (ArmorVisual | null)[]
  weapon?: WeaponVisual | null
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerVisual, t: number) {
  const { x, y } = p
  const step = Math.sin(p.walkT * 11) * 1.4
  const helm = p.armor && p.armor[0] ? p.armor[0] : null
  const chest = p.armor && p.armor[1] ? p.armor[1] : null
  const gloves = p.armor && p.armor[2] ? p.armor[2] : null
  const boots = p.armor && p.armor[3] ? p.armor[3] : null
  shadow(ctx, x, y + 5, 6, 2.4)
  if (p.dashT > 0) { ctx.fillStyle = 'rgba(63,224,255,0.25)'; ctx.fillRect(x - 10, y - 6, 20, 12) }
  // --- ноги + ботинки ---
  const legC = '#2c3540'
  const l1 = Math.max(0, step), l2 = Math.max(0, -step)
  px(ctx, x - 3, y + 1 + l1, 2, 4, legC)
  px(ctx, x + 1, y + 1 + l2, 2, 4, legC)
  if (boots) {
    const bw = boots.rarity >= 2 ? 3 : 2
    px(ctx, x - 4, y + 3 + l1, bw + 1, 2, boots.color)
    px(ctx, x, y + 3 + l2, bw + 1, 2, boots.color)
    if (boots.rarity >= 3) {
      px(ctx, x - 4, y + 5 + l1, 1, 1, '#3fe0ff'); px(ctx, x + bw, y + 5 + l2, 1, 1, '#3fe0ff')
    }
  } else {
    px(ctx, x - 3, y + 4 + l1, 2, 1, '#1b2129'); px(ctx, x + 1, y + 4 + l2, 2, 1, '#1b2129')
  }
  // --- рюкзак-реактор ---
  px(ctx, x - 5, y - 5, 2, 6, '#4a5568')
  px(ctx, x - 5, y - 5, 2, 1, '#3fe0ff')
  if (chest && chest.rarity >= 2) {
    px(ctx, x - 6, y - 7, 1, 3, '#8a96a3')
    px(ctx, x - 6, y - 8, 1, 1, Math.sin(t * 7) > 0 ? chest.color : '#22303c')
    px(ctx, x - 5, y + 1, 2, 2, chest.color)
  }
  // --- торс: базовый костюм + броня груди ---
  px(ctx, x - 4, y - 6, 8, 8, '#39424e')
  if (!chest) {
    px(ctx, x - 4, y - 6, 8, 8, p.chestColor)
    px(ctx, x - 4, y - 6, 8, 2, 'rgba(255,255,255,0.18)')
    px(ctx, x - 2, y - 4, 4, 1, 'rgba(0,0,0,0.25)')
  } else if (chest.rarity <= 1) {
    px(ctx, x - 4, y - 6, 8, 7, chest.color)
    px(ctx, x - 3, y - 5, 2, 5, 'rgba(0,0,0,0.28)')
    px(ctx, x + 1, y - 5, 2, 5, 'rgba(0,0,0,0.28)')
    px(ctx, x - 4, y - 6, 8, 1, 'rgba(255,255,255,0.22)')
  } else if (chest.rarity === 2) {
    px(ctx, x - 4, y - 6, 8, 8, chest.color)
    px(ctx, x - 4, y - 6, 8, 2, 'rgba(255,255,255,0.22)')
    px(ctx, x - 1, y - 4, 2, 2, '#e8f4ff')
    px(ctx, x - 4, y + 1, 8, 1, 'rgba(0,0,0,0.3)')
  } else if (chest.rarity === 3) {
    px(ctx, x - 4, y - 6, 8, 8, chest.color)
    px(ctx, x - 4, y - 4, 8, 1, 'rgba(0,0,0,0.35)')
    px(ctx, x - 4, y - 2, 8, 1, 'rgba(0,0,0,0.35)')
    px(ctx, x - 4, y, 8, 1, 'rgba(0,0,0,0.35)')
    px(ctx, x - 1, y - 5, 2, 2, '#ffffff')
    ctx.fillStyle = chest.color + '55'
    ctx.fillRect(x - 5, y - 7, 10, 10)
  } else {
    px(ctx, x - 5, y - 6, 10, 8, chest.color)
    px(ctx, x - 5, y - 6, 10, 2, 'rgba(255,255,255,0.25)')
    px(ctx, x - 4, y - 3, 8, 1, 'rgba(0,0,0,0.35)')
    px(ctx, x - 1, y - 5, 2, 2, '#ffffff')
    px(ctx, x - 5, y + 2, 2, 2, chest.color); px(ctx, x + 3, y + 2, 2, 2, chest.color)
    ctx.fillStyle = chest.color + '66'
    ctx.fillRect(x - 6, y - 8, 12, 12)
  }
  // --- плечи/перчатки ---
  const padC = gloves ? gloves.color : '#f5a623'
  px(ctx, x - 6, y - 6, 2, 3, padC)
  px(ctx, x + 4, y - 6, 2, 3, padC)
  if (gloves && gloves.rarity >= 2) { px(ctx, x - 7, y - 7, 2, 2, gloves.color); px(ctx, x + 5, y - 7, 2, 2, gloves.color) }
  if (gloves && gloves.rarity >= 4) { px(ctx, x - 6, y - 8, 1, 1, '#ffffff'); px(ctx, x + 5, y - 8, 1, 1, '#ffffff') }
  // --- голова + шлем ---
  if (!helm) {
    px(ctx, x - 3, y - 11, 6, 5, '#5e6e7e')
    px(ctx, x - 3, y - 11, 6, 1, '#7e8e9e')
    px(ctx, x - 2, y - 9, 4, 2, '#3fe0ff')
    px(ctx, x - 2, y - 9, 4, 1, '#baf3ff')
    px(ctx, x - 3, y - 7, 6, 1, '#3a4652')
  } else if (helm.rarity <= 1) {
    px(ctx, x - 3, y - 11, 6, 5, helm.color)
    px(ctx, x - 2, y - 9, 4, 2, '#0f141b')
    px(ctx, x - 2, y - 9, 4, 1, '#baf3ff')
  } else if (helm.rarity === 2) {
    px(ctx, x - 3, y - 12, 6, 6, helm.color)
    px(ctx, x - 2, y - 9, 4, 1, '#0f141b')
    px(ctx, x - 4, y - 10, 1, 2, '#222a33'); px(ctx, x + 3, y - 10, 1, 2, '#222a33')
    px(ctx, x - 2, y - 9, 4, 1, '#baf3ff')
  } else if (helm.rarity === 3) {
    px(ctx, x - 3, y - 12, 6, 6, helm.color)
    px(ctx, x - 1, y - 14, 2, 2, helm.color)
    px(ctx, x - 2, y - 10, 2, 1, '#0f141b'); px(ctx, x, y - 10, 2, 1, '#0f141b')
    px(ctx, x - 2, y - 10, 2, 1, '#baf3ff'); px(ctx, x, y - 10, 2, 1, '#baf3ff')
  } else {
    px(ctx, x - 3, y - 12, 6, 6, helm.color)
    px(ctx, x - 1, y - 14, 2, 3, '#ffffff')
    px(ctx, x - 2, y - 10, 4, 1, '#0f141b')
    px(ctx, x - 2, y - 10, 4, 1, '#baf3ff')
    ctx.strokeStyle = helm.color + '88'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(x, y - 10, 5, 2, 0, 0, Math.PI * 2); ctx.stroke()
  }
  // --- оружие в руке (конкретная модель) ---
  const wv: WeaponVisual | null = p.weapon ?? { proj: 'bullet', kitIdx: 0, rarity: 0, color: p.weaponColor }
  drawWeaponShape(ctx, wv, x, y - 3, p.aim)
  // --- слэш-дуга ---
  if (p.slashT > 0) {
    const k = p.slashT / 0.2
    ctx.save()
    ctx.translate(Math.round(x), Math.round(y - 2))
    ctx.rotate(p.aim)
    ctx.fillStyle = `rgba(120,255,240,${0.5 * k})`
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.arc(0, 0, 20, -1.0 - (1 - k) * 0.5, 1.0 + (1 - k) * 0.5); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = `rgba(220,255,250,${0.8 * k})`
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(0, 0, 19, -0.9, 0.9); ctx.stroke()
    ctx.restore()
  }
  if (Math.sin(t * 6) > 0.4) px(ctx, x + 4, y - 4, 1, 1, '#7dff5e')
}

// ============================================================
// ВРАГИ
// ============================================================
export function drawEnemy(ctx: CanvasRenderingContext2D, e: { x: number; y: number; type: string; body: number; head: number; weapon: number; pal: { main: string; dark: string; accent: string }; walkT: number; flash: number; windup: number; aim: number; phase: number }, t: number) {
  const { x, y, pal } = e
  const bob = Math.sin(e.walkT * 10)
  if (e.type === 'grunt') {
    const yy = y + bob * 0.6
    shadow(ctx, x, y + 5, 5, 2)
    px(ctx, x - 2, yy + 2 + Math.max(0, bob), 2, 3, pal.dark)
    px(ctx, x, yy + 2 + Math.max(0, -bob), 2, 3, pal.dark)
    if (e.body === 0) { px(ctx, x - 4, yy - 4, 8, 7, pal.main); px(ctx, x - 4, yy + 2, 2, 2, pal.main); px(ctx, x + 2, yy + 2, 2, 1, pal.main); px(ctx, x - 4, yy - 1, 8, 1, pal.dark) }
    else if (e.body === 1) { px(ctx, x - 4, yy - 4, 8, 6, pal.main); px(ctx, x - 3, yy - 4, 6, 6, pal.dark); px(ctx, x - 1, yy - 4, 2, 6, pal.main) }
    else { px(ctx, x - 4, yy - 4, 8, 6, pal.dark); px(ctx, x - 3, yy - 3, 6, 4, pal.main); px(ctx, x - 5, yy - 3, 1, 4, pal.accent); px(ctx, x + 4, yy - 3, 1, 4, pal.accent) }
    if (e.head === 0) { px(ctx, x - 3, yy - 9, 6, 3, pal.dark); px(ctx, x - 2, yy - 10, 4, 2, pal.dark); px(ctx, x - 1, yy - 8, 2, 1, pal.accent) }
    else if (e.head === 1) { px(ctx, x - 3, yy - 9, 6, 4, '#5e6e7e'); px(ctx, x - 2, yy - 8, 4, 1, pal.accent) }
    else { px(ctx, x - 2, yy - 9, 4, 3, pal.dark); px(ctx, x - 1, yy - 8, 2, 2, pal.accent); ctx.fillStyle = pal.accent + '44'; ctx.fillRect(x - 2, yy - 9, 4, 4) }
    const up = e.windup > 0 ? 2 : 0
    if (e.weapon === 0) { for (let i = 0; i < 3; i++) px(ctx, x + 5, yy - 3 - up + i * 2, 2, 1, pal.accent) }
    else if (e.weapon === 1) { px(ctx, x + 4, yy - 4 - up, 2, 6, '#c9d4de'); px(ctx, x + 4, yy - 6 - up, 2, 2, pal.accent) }
    else { px(ctx, x + 4, yy - 2 - up, 5, 2, '#6e5a3a'); px(ctx, x + 8, yy - 3 - up, 2, 3, pal.dark) }
    flashBox(ctx, x - 5, yy - 10, 10, 15, e.flash)
  } else if (e.type === 'brute') {
    const yy = y + bob * 0.4
    shadow(ctx, x, y + 8, 10, 3.4)
    px(ctx, x - 5, yy + 4 + Math.max(0, bob * 0.5), 4, 4, pal.dark)
    px(ctx, x + 1, yy + 4 + Math.max(0, -bob * 0.5), 4, 4, pal.dark)
    if (e.body === 0) { px(ctx, x - 9, yy - 6, 18, 11, pal.main); px(ctx, x - 9, yy - 6, 18, 2, 'rgba(255,255,255,0.12)'); px(ctx, x - 6, yy - 2, 12, 1, pal.dark); px(ctx, x - 6, yy + 1, 12, 1, pal.dark) }
    else if (e.body === 1) { px(ctx, x - 8, yy - 7, 16, 12, pal.main); px(ctx, x - 9, yy - 4, 18, 6, pal.main); px(ctx, x - 9, yy - 1, 18, 2, pal.accent) }
    else { px(ctx, x - 9, yy - 6, 18, 11, pal.main); for (let i = 0; i < 4; i++) { px(ctx, x - 9 + i * 2, yy - 8, 2, 2, pal.dark); px(ctx, x + 3 + i * 2, yy - 8, 2, 2, pal.dark) } }
    px(ctx, x - 11, yy - 7, 3, 4, pal.dark)
    px(ctx, x + 8, yy - 7, 3, 4, pal.dark)
    if (e.head === 0) { px(ctx, x - 3, yy - 11, 6, 4, '#5e6e7e'); px(ctx, x - 3, yy - 11, 6, 1, '#7e8e9e') }
    else if (e.head === 1) { px(ctx, x - 3, yy - 11, 6, 4, pal.dark); px(ctx, x - 2, yy - 8, 1, 2, '#c9d4de'); px(ctx, x, yy - 8, 1, 2, '#c9d4de'); px(ctx, x + 2, yy - 8, 1, 2, '#c9d4de') }
    else { px(ctx, x - 2, yy - 10, 4, 3, '#222831'); px(ctx, x - 1, yy - 9, 2, 2, pal.accent) }
    if (e.head === 2) { ctx.fillStyle = pal.accent + '44'; ctx.fillRect(x - 2, yy - 11, 4, 4) }
    const up = e.windup > 0 ? 4 : 0
    if (e.weapon === 0) { px(ctx, x + 9, yy - 8 - up, 6, 7, pal.dark); px(ctx, x + 9, yy - 8 - up, 6, 2, pal.accent); px(ctx, x + 8, yy - 2, 2, 6, pal.dark) }
    else if (e.weapon === 1) { px(ctx, x + 9, yy - 9 - up, 2, 10, '#c9d4de'); for (let i = 0; i < 4; i++) px(ctx, x + (i % 2 ? 11 : 8), yy - 8 - up + i * 2, 2, 1, pal.accent) }
    else { px(ctx, x + 8, yy - 2, 7, 3, '#6e7a8a'); px(ctx, x + 15, yy - 1, 3, 1, pal.accent); px(ctx, x + 13, yy - 2, 2, 3, '#4a5560') }
    flashBox(ctx, x - 11, yy - 12, 22, 21, e.flash)
  } else if (e.type === 'gunner') {
    const yy = y + bob * 0.5
    shadow(ctx, x, y + 5, 5, 2)
    px(ctx, x - 2, yy + 1 + Math.max(0, bob), 2, 4, pal.dark)
    px(ctx, x, yy + 1 + Math.max(0, -bob), 2, 4, pal.dark)
    if (e.body === 0) { px(ctx, x - 4, yy - 5, 8, 7, pal.main); px(ctx, x - 4, yy - 3, 8, 1, pal.accent); px(ctx, x - 1, yy - 5, 1, 6, pal.dark) }
    else if (e.body === 1) { px(ctx, x - 4, yy - 5, 8, 7, pal.dark); px(ctx, x - 3, yy - 5, 6, 5, pal.main); px(ctx, x - 3, yy - 2, 6, 1, pal.accent) }
    else { px(ctx, x - 5, yy - 5, 10, 7, pal.dark); px(ctx, x - 3, yy - 4, 6, 5, pal.main); px(ctx, x - 5, yy - 5, 1, 7, pal.accent); px(ctx, x + 4, yy - 5, 1, 7, pal.accent) }
    if (e.head === 0) { px(ctx, x - 3, yy - 10, 6, 4, '#39424e'); px(ctx, x - 2, yy - 9, 4, 1, pal.accent) }
    else if (e.head === 1) { px(ctx, x - 3, yy - 10, 6, 5, pal.dark); px(ctx, x - 1, yy - 9, 2, 2, pal.accent); ctx.fillStyle = pal.accent + '55'; ctx.fillRect(x - 2, yy - 10, 4, 4) }
    else { px(ctx, x - 3, yy - 10, 6, 4, '#39424e'); px(ctx, x - 2, yy - 9, 1, 1, pal.accent); px(ctx, x, yy - 9, 1, 1, pal.accent); px(ctx, x + 2, yy - 9, 1, 1, pal.accent) }
    ctx.save()
    ctx.translate(Math.round(x), Math.round(yy - 3))
    ctx.rotate(e.aim)
    const gl = e.windup > 0 ? pal.accent : '#222a33'
    if (e.weapon === 0) { px(ctx, 2, -1, 10, 2, '#39424e'); px(ctx, 10, -1, 3, 2, gl) }
    else if (e.weapon === 1) { px(ctx, 2, -1, 7, 3, '#39424e'); px(ctx, 8, -2, 3, 3, gl) }
    else { px(ctx, 2, -2, 8, 4, '#39424e'); px(ctx, 9, -1, 3, 2, gl); px(ctx, 3, -3, 3, 1, pal.accent) }
    ctx.restore()
    flashBox(ctx, x - 5, yy - 11, 10, 16, e.flash)
  } else {
    const hover = Math.sin(t * 5 + e.phase) * 2.4
    const yy = y - 6 + hover
    shadow(ctx, x, y + 4, 4 - hover * 0.2, 1.6)
    const flap = Math.sin(t * 18 + e.phase) * 2
    if (e.body === 0) {
      px(ctx, x - 4, yy - 4, 8, 8, pal.main); px(ctx, x - 3, yy - 5, 6, 1, pal.main); px(ctx, x - 3, yy + 4, 6, 1, pal.dark)
      px(ctx, x - 4 - 3, yy - 2 + flap * 0.4, 3, 4, pal.dark); px(ctx, x + 4, yy - 2 - flap * 0.4, 3, 4, pal.dark)
    } else if (e.body === 1) {
      px(ctx, x - 5, yy - 2, 10, 4, pal.main); px(ctx, x + 3, yy - 1, 4, 2, pal.accent)
      px(ctx, x - 4, yy - 5 - Math.abs(flap) * 0.5, 6, 3, pal.dark); px(ctx, x - 4, yy + 2 + Math.abs(flap) * 0.5, 6, 3, pal.dark)
    } else {
      px(ctx, x - 3, yy - 3, 6, 6, pal.main)
      px(ctx, x - 7, yy - 3 - Math.abs(flap) * 0.6, 4, 5, pal.dark); px(ctx, x + 3, yy - 3 - Math.abs(flap) * 0.6, 4, 5, pal.dark)
      px(ctx, x - 2, yy - 4, 4, 1, pal.accent)
    }
    if (e.head === 0) { px(ctx, x - 1, yy - 1, 2, 2, '#ffffff'); ctx.fillStyle = pal.accent + '66'; ctx.fillRect(x - 2, yy - 2, 4, 4) }
    else if (e.head === 1) { px(ctx, x - 2, yy + 1, 4, 2, pal.dark); px(ctx, x - 1, yy + 2, 1, 2, '#c9d4de'); px(ctx, x + 1, yy + 2, 1, 2, '#c9d4de') }
    else { px(ctx, x - 1, yy - 5, 2, 2, pal.accent) }
    if (e.weapon === 0) px(ctx, x, yy + 4, 1, 3, pal.accent)
    else if (e.weapon === 2) { px(ctx, x - 3, yy + 3, 1, 2, pal.dark); px(ctx, x + 2, yy + 3, 1, 2, pal.dark) }
    flashBox(ctx, x - 7, yy - 6, 14, 13, e.flash)
  }
}

// ============================================================
// КОМПАНЬОНЫ (+ отображение переданного оружия)
// ============================================================
export function drawCompanion(ctx: CanvasRenderingContext2D, c: { x: number; y: number; kind: string; pal: { main: string; dark: string; accent: string }; walkT: number; aim: number; phase: number }, t: number, wInfo?: WeaponVisual | null) {
  const { x, y, pal } = c
  const bob = Math.sin(c.walkT * 10)
  if (c.kind === 'mech') {
    const yy = y + bob * 0.4
    shadow(ctx, x, y + 5, 5, 2)
    px(ctx, x - 3, yy + 1 + Math.max(0, bob), 2, 4, pal.dark)
    px(ctx, x + 1, yy + 1 + Math.max(0, -bob), 2, 4, pal.dark)
    px(ctx, x - 4, yy - 5, 8, 7, pal.main)
    px(ctx, x - 4, yy - 5, 8, 2, 'rgba(255,255,255,0.15)')
    px(ctx, x - 1, yy - 3, 2, 2, pal.accent)
    px(ctx, x - 3, yy - 8, 6, 3, pal.dark)
    px(ctx, x - 2, yy - 7, 4, 1, pal.accent)
    drawWeaponShape(ctx, wInfo ?? null, x, yy - 2, c.aim)
  } else if (c.kind === 'tank') {
    shadow(ctx, x, y + 5, 7, 2.4)
    const tr = ((c.walkT * 20) | 0) % 2
    px(ctx, x - 7, y + 1, 14, 4, '#222831')
    for (let i = 0; i < 6; i++) px(ctx, x - 6 + i * 2 + (tr ? 1 : 0), y + 2, 1, 2, '#4a5560')
    px(ctx, x - 6, y - 4, 12, 6, pal.main)
    px(ctx, x - 6, y - 4, 12, 1, 'rgba(255,255,255,0.14)')
    px(ctx, x - 3, y - 7, 7, 4, pal.dark)
    drawWeaponShape(ctx, wInfo ?? null, x, y - 5, c.aim)
    if (Math.sin(t * 5 + c.phase) > 0) px(ctx, x - 5, y - 3, 1, 1, pal.accent)
  } else if (c.kind === 'drone') {
    const yy = y - 6 + Math.sin(t * 6 + c.phase) * 2
    shadow(ctx, x, y + 3, 3.4, 1.3)
    px(ctx, x - 3, yy - 2, 6, 4, pal.main)
    px(ctx, x - 2, yy - 3, 4, 1, pal.dark)
    px(ctx, x - 1, yy - 1, 2, 2, pal.accent)
    const rf = ((t * 30 + c.phase) | 0) % 2
    ctx.fillStyle = 'rgba(200,220,235,0.5)'
    ctx.fillRect(x - 6, yy - 4 + (rf ? 0 : 1), 12, 1)
    px(ctx, x - 1, yy - 5, 2, 2, pal.dark)
    drawWeaponShape(ctx, wInfo ?? null, x, yy + 1, c.aim)
  } else {
    const yy = y + bob * 0.3
    shadow(ctx, x, y + 5, 6, 2.2)
    const lo = Math.max(0, bob)
    px(ctx, x - 5, yy + 1 + lo, 2, 4, pal.dark); px(ctx, x + 3, yy + 1 + lo, 2, 4, pal.dark)
    px(ctx, x - 3, yy + 1 - lo, 2, 4, pal.dark); px(ctx, x + 1, yy + 1 - lo, 2, 4, pal.dark)
    px(ctx, x - 5, yy - 3, 10, 5, pal.main)
    px(ctx, x - 5, yy - 3, 10, 1, 'rgba(255,255,255,0.15)')
    px(ctx, x - 3, yy - 6, 6, 3, pal.dark)
    px(ctx, x - 1, yy - 5, 2, 1, pal.accent)
    drawWeaponShape(ctx, wInfo ?? null, x, yy - 4, c.aim)
  }
}

// ============================================================
// КАПСУЛЫ / ПОДБОР / ГРУЗ
// ============================================================
export function drawCapsule(ctx: CanvasRenderingContext2D, c: { x: number; y: number; size: number; shape: number; body: string; band: string; hp: number; maxHp: number; special: boolean; phase: number }, t: number) {
  const s = [10, 14, 19, 25][c.size]
  const h = s * 0.8
  const blink = Math.sin(t * 4 + c.phase) > 0
  const rarC = ['#9aa7b8', '#4ade60', '#3fa9ff', '#c96bff', '#ffa726'][c.size]
  const glow = c.special ? '#3fe0ff' : rarC
  shadow(ctx, c.x, c.y + h / 2 + 2, s / 2 + 2, 3)
  ctx.fillStyle = glow + '22'
  ctx.beginPath(); ctx.ellipse(c.x, c.y + h / 2 + 2, s / 2 + 5, 4.5, 0, 0, Math.PI * 2); ctx.fill()
  const x = c.x, y = c.y
  if (c.shape === 0) {
    px(ctx, x - s / 2, y - h / 2, s, h, c.body)
    px(ctx, x - s / 2, y - h / 2, s, 2, 'rgba(255,255,255,0.18)')
    px(ctx, x - s / 2, y - h / 6, s, Math.max(2, s / 6), c.band)
    for (let i = 0; i < 3; i++) px(ctx, x - s / 2 + 1 + i * (s / 3), y - h / 2 + 2, 1, h - 4, 'rgba(0,0,0,0.22)')
    px(ctx, x - s / 4, y - h / 2 - 2, s / 2, 3, c.band)
  } else if (c.shape === 1) {
    px(ctx, x - s / 2, y - h / 2, s, h, c.body)
    px(ctx, x - s / 2, y - h / 2, s, 2, 'rgba(255,255,255,0.18)')
    px(ctx, x - s / 2, y - 1, s, 2, c.band)
    px(ctx, x - 1, y - h / 2, 2, h, c.band)
    px(ctx, x - s / 2, y - h / 2, 2, 2, c.band); px(ctx, x + s / 2 - 2, y - h / 2, 2, 2, c.band)
    px(ctx, x - s / 2, y + h / 2 - 2, 2, 2, c.band); px(ctx, x + s / 2 - 2, y + h / 2 - 2, 2, 2, c.band)
  } else if (c.shape === 2) {
    px(ctx, x - s / 2 + 2, y - h / 2, s - 4, h, c.body)
    px(ctx, x - s / 2, y - h / 2 + 3, s, h - 6, c.body)
    px(ctx, x - s / 2, y - h / 2 + 3, s, 2, 'rgba(255,255,255,0.16)')
    px(ctx, x - s / 2 + 2, y - h / 2 - 3, 3, 3, c.band)
    px(ctx, x - s / 2 + 1, y + 1, s - 2, 2, c.band)
  } else {
    const r = s / 2
    for (let i = -r; i <= r; i++) {
      const hh = Math.sqrt(r * r - i * i)
      px(ctx, x + i, y - hh * 0.7, 1, hh * 1.4, c.body)
    }
    px(ctx, x - r + 1, y - 1, s - 2, 2, c.band)
    px(ctx, x - 2, y - r * 0.7 - 2, 4, 2, c.band)
    px(ctx, x - r + 2, y - r * 0.5, s - 4, 1, 'rgba(255,255,255,0.2)')
  }
  const dmgK = 1 - c.hp / c.maxHp
  if (dmgK > 0.2) { px(ctx, x - s / 3, y - h / 3, 2, 1, '#1b1f26'); px(ctx, x + s / 4, y, 1, 2, '#1b1f26') }
  if (dmgK > 0.5) { px(ctx, x, y - h / 4, 2, 2, '#1b1f26'); px(ctx, x - s / 4, y + h / 4, 3, 1, '#1b1f26') }
  if (blink) {
    px(ctx, x - 1, y - h / 2 - (c.shape === 2 ? 4 : 3), 2, 2, glow)
    ctx.fillStyle = glow + '33'
    ctx.fillRect(x - 2, y - h / 2 - 5, 4, 4)
  }
  if (c.special) {
    ctx.fillStyle = 'rgba(63,224,255,0.14)'
    const bw = 3 + Math.sin(t * 3) * 1
    ctx.fillRect(x - bw / 2, y - 40, bw, 40)
    px(ctx, x - 2, y - h / 2 - 6, 4, 3, '#3fe0ff')
  }
  if (c.hp < c.maxHp) {
    px(ctx, x - s / 2, y - h / 2 - 8, s, 2, '#1b1f26')
    px(ctx, x - s / 2, y - h / 2 - 8, Math.max(1, s * (c.hp / c.maxHp)), 2, glow)
  }
}

export function drawPickup(ctx: CanvasRenderingContext2D, p: { x: number; y: number; kind: 'coin' | 'weapon' | 'armor' | 'heart' | 'upgrade'; color: string; phase: number; slot?: number }, t: number, wInfo?: WeaponVisual | null) {
  const bobY = Math.sin(t * 4 + p.phase) * 1.6
  const y = p.y + bobY
  if (p.kind === 'coin') {
    shadow(ctx, p.x, p.y + 3, 3, 1.2)
    px(ctx, p.x - 2, y - 2, 4, 4, '#f5a623')
    px(ctx, p.x - 2, y - 2, 4, 1, '#ffd54a')
    px(ctx, p.x - 1, y - 1, 2, 2, '#c97e12')
    if (Math.sin(t * 8 + p.phase) > 0.6) px(ctx, p.x + 2, y - 3, 1, 1, '#ffffff')
  } else if (p.kind === 'heart') {
    shadow(ctx, p.x, p.y + 3, 3.4, 1.3)
    ctx.fillStyle = 'rgba(255,90,122,0.25)'
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill()
    px(ctx, p.x - 4, y - 3, 3, 2, '#ff5a7a'); px(ctx, p.x + 1, y - 3, 3, 2, '#ff5a7a')
    px(ctx, p.x - 4, y - 1, 8, 2, '#ff5a7a')
    px(ctx, p.x - 3, y + 1, 6, 1, '#ff5a7a')
    px(ctx, p.x - 2, y + 2, 4, 1, '#ff5a7a')
    px(ctx, p.x - 1, y + 3, 2, 1, '#ff5a7a')
    px(ctx, p.x - 4, y - 3, 3, 1, '#ff9fb2'); px(ctx, p.x - 3, y - 1, 2, 1, '#ff9fb2')
    px(ctx, p.x - 1, y + 2, 2, 1, '#c22b4e')
    if (Math.sin(t * 6 + p.phase) > 0.5) { px(ctx, p.x + 4, y - 4, 1, 3, '#ffffff'); px(ctx, p.x + 3, y - 3, 3, 1, '#ffffff') }
  } else if (p.kind === 'upgrade') {
    shadow(ctx, p.x, p.y + 4, 5, 1.6)
    ctx.fillStyle = p.color + '33'
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8, 5, 0, 0, Math.PI * 2); ctx.fill()
    px(ctx, p.x - 4, y - 3, 8, 6, '#222a33')
    px(ctx, p.x - 4, y - 3, 8, 1, '#39424e')
    px(ctx, p.x - 2, y - 1, 4, 2, p.color)
    px(ctx, p.x - 1, y - 1, 2, 2, '#ffffff')
    px(ctx, p.x - 3, y - 5, 1, 2, '#8a96a3'); px(ctx, p.x, y - 5, 1, 2, '#8a96a3'); px(ctx, p.x + 3, y - 5, 1, 2, '#8a96a3')
    px(ctx, p.x - 3, y + 3, 1, 2, '#8a96a3'); px(ctx, p.x, y + 3, 1, 2, '#8a96a3'); px(ctx, p.x + 3, y + 3, 1, 2, '#8a96a3')
    if (Math.sin(t * 6 + p.phase) > 0.4) { ctx.fillStyle = p.color + '66'; ctx.fillRect(p.x - 1, y - 8, 2, 2) }
  } else if (p.kind === 'weapon') {
    shadow(ctx, p.x, p.y + 4, 6, 1.8)
    ctx.fillStyle = p.color + '30'
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 9, 5, 0, 0, Math.PI * 2); ctx.fill()
    drawWeaponShape(ctx, wInfo ?? null, p.x - 4, y, 0)
    if (Math.sin(t * 6 + p.phase) > 0.5) { ctx.fillStyle = p.color + '55'; ctx.fillRect(p.x - 1, y - 9, 2, 2) }
  } else {
    shadow(ctx, p.x, p.y + 4, 5, 1.6)
    ctx.fillStyle = p.color + '30'
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8, 5, 0, 0, Math.PI * 2); ctx.fill()
    if (p.slot === 0) { px(ctx, p.x - 3, y - 4, 6, 5, p.color); px(ctx, p.x - 2, y - 2, 4, 1, '#0f141b') }
    else if (p.slot === 1) { px(ctx, p.x - 3, y - 4, 6, 7, p.color); px(ctx, p.x - 1, y - 3, 2, 4, 'rgba(0,0,0,0.3)') }
    else if (p.slot === 2) { px(ctx, p.x - 3, y - 2, 2, 4, p.color); px(ctx, p.x + 1, y - 2, 2, 4, p.color) }
    else { px(ctx, p.x - 3, y - 1, 2, 4, p.color); px(ctx, p.x + 1, y - 1, 2, 4, p.color); px(ctx, p.x - 3, y + 2, 3, 1, '#222a33'); px(ctx, p.x + 1, y + 2, 3, 1, '#222a33') }
    if (Math.sin(t * 6 + p.phase) > 0.5) { ctx.fillStyle = p.color + '55'; ctx.fillRect(p.x - 1, y - 8, 2, 2) }
  }
}

export function drawGuildPod(ctx: CanvasRenderingContext2D, p: { x: number; y: number; opened: boolean }, t: number) {
  const { x, y } = p
  shadow(ctx, x, y + 7, 10, 3)
  if (!p.opened) { ctx.fillStyle = 'rgba(63,224,255,0.12)'; ctx.fillRect(x - 2, y - 46, 4, 46) }
  px(ctx, x - 8, y - 8, 16, 14, '#c9d4de')
  px(ctx, x - 8, y - 8, 16, 3, '#e8eef4')
  px(ctx, x - 8, y + 3, 16, 3, '#8a96a3')
  px(ctx, x - 10, y - 4, 2, 8, '#3fe0ff')
  px(ctx, x + 8, y - 4, 2, 8, '#3fe0ff')
  px(ctx, x - 3, y - 5, 2, 2, '#f5a623'); px(ctx, x + 1, y - 5, 2, 2, '#f5a623')
  px(ctx, x - 2, y - 3, 2, 2, '#f5a623'); px(ctx, x, y - 3, 2, 2, '#f5a623')
  px(ctx, x - 1, y - 1, 2, 2, '#f5a623')
  if (!p.opened) {
    const blink = Math.sin(t * 5) > 0
    px(ctx, x - 1, y - 11, 2, 2, blink ? '#3fe0ff' : '#1b4a5e')
    ctx.strokeStyle = `rgba(63,224,255,${0.5 + Math.sin(t * 5) * 0.3})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(x, y + 7, 12 + Math.sin(t * 5) * 2, 4, 0, 0, Math.PI * 2); ctx.stroke()
  } else {
    px(ctx, x - 6, y - 12, 12, 4, '#8a96a3')
    px(ctx, x - 6, y - 12, 12, 1, '#e8eef4')
  }
}

export function drawShuttle(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  for (const ey of [-6, 6]) {
    const fl = 6 + Math.sin(t * 40 + ey) * 3
    px(ctx, -34 - fl, ey - 2, fl, 4, 'rgba(255,138,61,0.8)')
    px(ctx, -34 - fl * 0.6, ey - 1, fl * 0.6, 2, '#ffd54a')
    px(ctx, -34, ey - 3, 4, 6, '#39424e')
  }
  px(ctx, -32, -5, 52, 10, '#5e6e7e')
  px(ctx, -32, -5, 52, 2, '#8a96a3')
  px(ctx, -32, 3, 52, 2, '#39424e')
  px(ctx, 20, -3, 14, 6, '#5e6e7e')
  px(ctx, 34, -2, 4, 4, '#8a96a3')
  px(ctx, -20, -12, 22, 7, '#4a5568')
  px(ctx, -20, 5, 22, 7, '#4a5568')
  px(ctx, -20, -12, 22, 1, '#8a96a3')
  px(ctx, -20, 11, 22, 1, '#222a33')
  px(ctx, -28, -1, 44, 2, '#f5a623')
  px(ctx, -6, -4, 8, 8, '#f5a623')
  px(ctx, -4, -2, 1, 1, '#0f141b'); px(ctx, -1, -2, 1, 1, '#0f141b'); px(ctx, -3, 0, 2, 1, '#0f141b'); px(ctx, -2, 2, 1, 1, '#0f141b')
  px(ctx, 22, -2, 8, 4, '#3fe0ff')
  px(ctx, 22, -2, 8, 1, '#baf3ff')
  if (Math.sin(t * 8) > 0) px(ctx, -30, -6, 2, 1, '#ff5533')
  if (Math.sin(t * 8 + 2) > 0) px(ctx, 0, 12, 2, 1, '#7dff5e')
  ctx.restore()
}

export function drawFallingPod(ctx: CanvasRenderingContext2D, x: number, y: number, alt: number, t: number) {
  shadow(ctx, x, y + 4, 3 + (1 - alt) * 7, 1.2 + (1 - alt) * 2)
  const yy = y - alt * 110
  ctx.save()
  ctx.translate(Math.round(x), Math.round(yy))
  const fl = 3 + Math.sin(t * 50) * 2
  px(ctx, -3, 7, 6, fl + 3, 'rgba(255,138,61,0.85)')
  px(ctx, -2, 7, 4, fl, '#ffd54a')
  px(ctx, -7, -7, 14, 13, '#c9d4de')
  px(ctx, -7, -7, 14, 3, '#e8eef4')
  px(ctx, -7, 3, 14, 3, '#8a96a3')
  px(ctx, -9, -4, 2, 7, '#3fe0ff')
  px(ctx, 7, -4, 2, 7, '#3fe0ff')
  px(ctx, -3, -4, 2, 2, '#f5a623'); px(ctx, 1, -4, 2, 2, '#f5a623')
  px(ctx, -1, -2, 2, 2, '#f5a623')
  ctx.restore()
}

export function drawBullet(ctx: CanvasRenderingContext2D, b: { x: number; y: number; vx: number; vy: number; kind: string; color: string }, t: number) {
  const ang = Math.atan2(b.vy, b.vx)
  ctx.save()
  ctx.translate(Math.round(b.x), Math.round(b.y))
  ctx.rotate(ang)
  if (b.kind === 'laser') {
    ctx.fillStyle = b.color + '55'; ctx.fillRect(-6, -2, 9, 4)
    px(ctx, -4, -1, 7, 2, b.color); px(ctx, -2, 0, 4, 1, '#ffffff')
  } else if (b.kind === 'plasma') {
    ctx.fillStyle = b.color + '44'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -1, 2, 2)
  } else if (b.kind === 'rocket') {
    const fl = 3 + Math.sin(t * 60) * 2
    px(ctx, -6 - fl, -1, fl + 2, 2, 'rgba(255,160,60,0.85)')
    px(ctx, -4, -2, 7, 4, '#5e6e7e'); px(ctx, 3, -1, 3, 2, b.color); px(ctx, -4, -3, 2, 1, b.color); px(ctx, -4, 2, 2, 1, b.color)
  } else if (b.kind === 'rail') {
    ctx.fillStyle = b.color + '66'; ctx.fillRect(-14, -1.5, 18, 3)
    px(ctx, -12, -1, 15, 2, b.color); px(ctx, -8, 0, 10, 1, '#ffffff')
  } else {
    ctx.fillStyle = b.color + '55'; ctx.fillRect(-5, -1, 6, 2)
    px(ctx, -2, -1, 4, 2, b.color)
  }
  ctx.restore()
}

// ============================================================
// СТРУКТУРЫ НА ПОВЕРХНОСТИ
// ============================================================
export function drawPoi(ctx: CanvasRenderingContext2D, poi: { type: string; x: number; y: number; state: string; dungeon?: unknown }, t: number) {
  const { x, y } = poi
  const cleared = poi.state === 'cleared'
  const hostile = poi.state === 'hostile'
  const blink = Math.sin(t * 3) > 0
  if (poi.type === 'settlement' || poi.type === 'outpost') {
    const c1 = poi.type === 'settlement' ? '#5e6e7e' : '#4a6e5e'
    const band = poi.type === 'settlement' ? '#f5a623' : '#7dff5e'
    shadow(ctx, x, y + 18, 34, 8)
    for (const [dx, r] of [[-18, 10], [4, 13], [22, 8]] as [number, number][]) {
      for (let i = -r; i <= r; i++) {
        const hh = Math.sqrt(r * r - i * i)
        px(ctx, x + dx + i, y + 8 - hh * 0.8, 1, hh * 0.8 + 8, c1)
      }
      px(ctx, x + dx - r + 2, y + 2, r * 2 - 4, 2, 'rgba(255,255,255,0.12)')
    }
    px(ctx, x + 1, y - 6, 3, 3, blink && !cleared ? band : '#39424e')
    px(ctx, x - 30, y + 15, 60, 2, '#2c3540')
    for (let i = 0; i < 3; i++) px(ctx, x - 2 + i * 4 - 6, y + 8, 2, 3, blink && i === 1 ? '#ffd54a' : '#1b2b3a')
    if (poi.type === 'outpost') {
      px(ctx, x - 26, y - 12, 2, 26, '#8a96a3')
      px(ctx, x - 26, y - 12, 10, 6, band)
    }
  } else if (poi.type === 'camp') {
    shadow(ctx, x, y + 12, 26, 6)
    for (const [dx, dy, w2] of [[-16, -4, 14], [2, 2, 16], [-6, -12, 10]] as [number, number, number][]) {
      ctx.fillStyle = '#6e5a3c'
      ctx.beginPath()
      ctx.moveTo(x + dx, y + dy + 10)
      ctx.lineTo(x + dx + w2 / 2, y + dy - 4)
      ctx.lineTo(x + dx + w2, y + dy + 10)
      ctx.closePath(); ctx.fill()
      px(ctx, x + dx + w2 / 2 - 1, y + dy - 4, 2, 2, '#39424e')
    }
    px(ctx, x + 10, y + 4, 6, 2, '#39424e')
    if (!cleared) {
      const fh = 3 + Math.sin(t * 14) * 1.5
      px(ctx, x + 12, y + 1 - fh, 2, fh, '#ff8a3d')
      px(ctx, x + 11, y - fh, 1, 2, '#ffd54a')
    }
    if (hostile && blink) { px(ctx, x - 22, y - 18, 3, 3, '#ff5533'); px(ctx, x - 21, y - 15, 1, 6, '#5e444a') }
    if (cleared) { px(ctx, x - 4, y - 14, 8, 6, '#3f6e33'); px(ctx, x - 2, y - 12, 4, 2, '#7dff5e') }
  } else if (poi.type === 'factory') {
    shadow(ctx, x, y + 16, 30, 7)
    px(ctx, x - 26, y - 8, 52, 24, '#4a5560')
    px(ctx, x - 26, y - 8, 52, 3, '#6e7a8a')
    for (let i = 0; i < 3; i++) px(ctx, x - 20 + i * 16, y - 14, 10, 6, '#39424e')
    px(ctx, x + 16, y - 26, 6, 18, '#5e6e7e')
    px(ctx, x + 16, y - 26, 6, 2, '#8a96a3')
    if (!cleared && blink) { ctx.fillStyle = 'rgba(140,150,163,0.4)'; ctx.beginPath(); ctx.arc(x + 19, y - 30 - ((t * 6) % 8), 3, 0, Math.PI * 2); ctx.fill() }
    px(ctx, x - 8, y + 2, 16, 14, '#2c3540')
    for (let i = 0; i < 3; i++) px(ctx, x - 8, y + 4 + i * 4, 16, 1, '#39424e')
    px(ctx, x - 22, y + 4, 4, 4, hostile && blink ? '#ff5533' : '#ffd54a')
    px(ctx, x - 26, y - 16, 2, 8, '#8a96a3')
  } else if (poi.type === 'crash') {
    shadow(ctx, x, y + 10, 24, 6)
    ctx.save()
    ctx.translate(Math.round(x), Math.round(y))
    ctx.rotate(0.5)
    px(ctx, -22, -6, 40, 12, '#5e6e7e')
    px(ctx, 18, -4, 10, 8, '#4a5568')
    px(ctx, -22, -6, 40, 2, '#8a96a3')
    px(ctx, -6, -12, 12, 6, '#39424e')
    ctx.restore()
    px(ctx, x + 18, y + 8, 8, 3, '#4a5568')
    px(ctx, x - 26, y - 10, 6, 3, '#4a5568')
    if (poi.dungeon) {
      px(ctx, x - 8, y - 4, 8, 8, '#0f141b')
      if (blink) { px(ctx, x - 7, y - 6, 2, 2, '#c96bff'); px(ctx, x - 3, y - 6, 2, 2, '#c96bff') }
    }
    if (!cleared && blink) { ctx.fillStyle = 'rgba(255,138,61,0.35)'; ctx.beginPath(); ctx.arc(x + 8, y - 8, 4, 0, Math.PI * 2); ctx.fill() }
  } else if (poi.type === 'bunker') {
    shadow(ctx, x, y + 12, 26, 7)
    px(ctx, x - 24, y - 10, 48, 22, '#4a4e57')
    px(ctx, x - 24, y - 10, 48, 3, '#6e7a8a')
    px(ctx, x - 28, y - 6, 4, 16, '#39424e'); px(ctx, x + 24, y - 6, 4, 16, '#39424e')
    px(ctx, x - 8, y - 2, 16, 14, '#222831')
    px(ctx, x - 6, y, 12, 10, poi.dungeon ? '#0f141b' : '#39424e')
    if (poi.dungeon && blink) px(ctx, x - 1, y + 3, 2, 4, '#c96bff')
    px(ctx, x - 20, y - 4, 5, 3, hostile && blink ? '#ff5533' : '#ffd54a')
    px(ctx, x + 15, y - 4, 5, 3, '#1b2b3a')
    px(ctx, x - 16, y - 16, 6, 6, '#39424e'); px(ctx, x + 10, y - 16, 6, 6, '#39424e')
  } else {
    shadow(ctx, x, y + 8, 10, 3)
    px(ctx, x - 8, y + 2, 16, 6, '#39424e')
    px(ctx, x - 1, y - 26, 2, 28, '#8a96a3')
    for (let i = 0; i < 3; i++) px(ctx, x - 4 + i * 2, y - 24 + i * 2, 8 - i * 4, 1, '#5e6e7e')
    const on = Math.sin(t * 4) > 0
    px(ctx, x - 2, y - 30, 4, 4, on ? '#3fe0ff' : '#1b4a5e')
    if (on) { ctx.fillStyle = 'rgba(63,224,255,0.25)'; ctx.beginPath(); ctx.arc(x, y - 28, 7, 0, Math.PI * 2); ctx.fill() }
    px(ctx, x - 6, y + 4, 3, 2, '#ffd54a')
  }
}

// ============================================================
// ВНЕШНИЕ СТРУКТУРЫ — 2.5D (крыша + южный фасад с высотой)
// ============================================================
const WALL_H = 30

interface StructPoi {
  type: string; x: number; y: number; state: string; seed: number
  dungeon?: unknown
  fp?: { x: number; y: number; w: number; h: number }
  doorWorld?: { x: number; y: number }
}
const shash = (n: number, s: number) => {
  let h = (n | 0) * 2654435761 + (s | 0) * 97
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Экструдированный блок: крыша сверху + южный фасад с высотой */
function block3d(ctx: CanvasRenderingContext2D, fx: number, fy: number, fw: number, fh: number, H: number, roof: string, roofLight: string, wall: string, wallDark: string) {
  // тень
  ctx.fillStyle = 'rgba(0,0,0,0.32)'
  ctx.fillRect(fx + 5, fy + fh, fw, 7)
  // южный фасад
  px(ctx, fx, fy + fh - H, fw, H, wall)
  px(ctx, fx + fw - 4, fy + fh - H, 4, H, wallDark)
  px(ctx, fx, fy + fh - 2, fw, 2, wallDark)
  // крыша
  px(ctx, fx, fy - H, fw, fh, roof)
  px(ctx, fx, fy - H, fw, 3, roofLight)
  px(ctx, fx, fy - H, 3, fh, roofLight)
}

export function drawStructure(ctx: CanvasRenderingContext2D, poi: StructPoi, t: number) {
  const { x, y } = poi
  const hostile = poi.state === 'hostile'
  const cleared = poi.state === 'cleared'
  const blink = Math.sin(t * 3) > 0
  const S = poi.seed

  if (poi.dungeon && poi.fp) {
    const fp = poi.fp
    const fx = fp.x, fy = fp.y, fw = fp.w, fh = fp.h
    const isFactory = poi.type === 'factory'
    const isCrash = poi.type === 'crash'
    const roof = isFactory ? '#3d4550' : isCrash ? '#4a4438' : '#414b58'
    const roofL = isFactory ? '#5a6470' : isCrash ? '#6e6450' : '#5e6e7e'
    const wall = isFactory ? '#333a44' : isCrash ? '#3e382c' : '#39424e'
    const wallD = '#242b34'
    block3d(ctx, fx, fy, fw, fh, WALL_H, roof, roofL, wall, wallD)

    // --- детали крыши (детерминированные) ---
    const n = 6
    for (let i = 0; i < n; i++) {
      const rx = fx + 24 + shash(i, S) * (fw - 60)
      const ry = fy - WALL_H + 20 + shash(i + 99, S) * (fh - 70)
      const kind = Math.floor(shash(i + 7, S) * 3)
      if (kind === 0) { // вентблок
        px(ctx, rx, ry, 22, 16, '#333c47')
        px(ctx, rx, ry, 22, 3, '#4a5560')
        for (let k = 0; k < 3; k++) px(ctx, rx + 3, ry + 5 + k * 4, 16, 1, '#242b34')
      } else if (kind === 1) { // световой люк
        px(ctx, rx, ry, 18, 12, '#1b2b3a')
        px(ctx, rx + 2, ry + 2, 14, 8, blink && !cleared ? 'rgba(255,213,74,0.5)' : '#16222e')
        px(ctx, rx + 8, ry, 2, 12, '#39424e')
      } else { // трубы
        px(ctx, rx, ry, 8, 26, '#4a5560')
        px(ctx, rx - 2, ry - 3, 12, 4, '#5e6e7e')
        if (!cleared && blink && isFactory) { ctx.fillStyle = 'rgba(140,150,163,0.35)'; ctx.beginPath(); ctx.arc(rx + 4, ry - 8 - ((t * 8 + i * 5) % 14), 3.4, 0, Math.PI * 2); ctx.fill() }
      }
    }
    // антенна/вышка
    const ax = fx + fw * 0.82, ay = fy - WALL_H + 14
    px(ctx, ax, ay - 26, 3, 26, '#5e6e7e')
    px(ctx, ax - 5, ay - 26, 13, 2, '#5e6e7e')
    px(ctx, ax - 1, ay - 30, 5, 4, hostile && blink ? '#ff5533' : cleared ? '#7dff5e' : '#3fe0ff')
    if (hostile && blink) { ctx.fillStyle = 'rgba(255,85,51,0.25)'; ctx.beginPath(); ctx.arc(ax + 1.5, ay - 28, 8, 0, Math.PI * 2); ctx.fill() }
    // посадочная площадка / энерголинии
    if (isFactory) {
      px(ctx, fx + 30, fy - WALL_H + fh - 70, 60, 40, '#333c47')
      ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 2
      ctx.strokeRect(fx + 36, fy - WALL_H + fh - 64, 48, 28)
      px(ctx, fx + 56, fy - WALL_H + fh - 54, 8, 8, '#f5a623')
    }
    if (isCrash) {
      // пробоина и дым
      ctx.fillStyle = '#1c1812'
      ctx.beginPath(); ctx.ellipse(fx + fw * 0.3, fy - WALL_H + fh * 0.4, 34, 20, 0.3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(110,100,80,0.3)'
      ctx.beginPath(); ctx.arc(fx + fw * 0.3, fy - WALL_H + fh * 0.4 - ((t * 10) % 20), 8, 0, Math.PI * 2); ctx.fill()
    }

    // --- южный фасад: дверь + окна ---
    const doorX = poi.doorWorld ? poi.doorWorld.x : fx + fw / 2
    // гермодверь (вход)
    px(ctx, doorX - 14, fy + fh - WALL_H + 4, 28, WALL_H - 4, '#222831')
    px(ctx, doorX - 14, fy + fh - WALL_H + 4, 28, 3, '#4a5560')
    px(ctx, doorX - 10, fy + fh - WALL_H + 8, 20, WALL_H - 10, '#0f141b')
    px(ctx, doorX - 1, fy + fh - WALL_H + 10, 2, WALL_H - 14, '#3fe0ff')
    px(ctx, doorX - 14, fy + fh - WALL_H + 1, 28, 2, hostile ? '#ff5533' : '#f5a623')
    // окна фасада
    const wn = Math.floor(fw / 70)
    for (let i = 0; i < wn; i++) {
      const wxp = fx + 20 + i * 70
      if (Math.abs(wxp - doorX) < 40) continue
      px(ctx, wxp, fy + fh - WALL_H + 8, 26, 10, '#1b2b3a')
      px(ctx, wxp + 2, fy + fh - WALL_H + 10, 22, 6, blink && !cleared && shash(i + 31, S) > 0.5 ? 'rgba(255,213,74,0.5)' : '#16222e')
      px(ctx, wxp + 12, fy + fh - WALL_H + 8, 2, 10, '#39424e')
    }
    // отметка состояния
    if (cleared) { px(ctx, doorX - 5, fy + fh - WALL_H - 8, 10, 6, '#3f6e33'); px(ctx, doorX - 3, fy + fh - WALL_H - 6, 6, 2, '#7dff5e') }
    return
  }

  // --- малые структуры (без интерьера) ---
  if (poi.type === 'settlement' || poi.type === 'outpost') {
    const c1 = poi.type === 'settlement' ? '#5e6e7e' : '#4a6e5e'
    const band = poi.type === 'settlement' ? '#f5a623' : '#7dff5e'
    shadow(ctx, x, y + 18, 36, 8)
    for (const [dx, r] of [[-20, 11], [4, 14], [24, 9]] as [number, number][]) {
      for (let i = -r; i <= r; i++) {
        const hh = Math.sqrt(r * r - i * i)
        px(ctx, x + dx + i, y + 8 - hh * 0.8, 1, hh * 0.8 + 8, c1)
      }
      px(ctx, x + dx - r + 2, y + 2, r * 2 - 4, 2, 'rgba(255,255,255,0.12)')
    }
    px(ctx, x + 1, y - 8, 3, 3, blink && !cleared ? band : '#39424e')
    px(ctx, x - 32, y + 15, 64, 2, '#2c3540')
    for (let i = 0; i < 3; i++) px(ctx, x - 8 + i * 5, y + 8, 2, 3, blink && i === 1 ? '#ffd54a' : '#1b2b3a')
    if (poi.type === 'outpost') { px(ctx, x - 28, y - 14, 2, 28, '#8a96a3'); px(ctx, x - 28, y - 14, 11, 6, band) }
  } else if (poi.type === 'camp') {
    shadow(ctx, x, y + 12, 28, 6)
    for (const [dx, dy, w2] of [[-18, -4, 15], [2, 2, 17], [-6, -13, 11]] as [number, number, number][]) {
      ctx.fillStyle = '#6e5a3c'
      ctx.beginPath()
      ctx.moveTo(x + dx, y + dy + 10); ctx.lineTo(x + dx + w2 / 2, y + dy - 5); ctx.lineTo(x + dx + w2, y + dy + 10)
      ctx.closePath(); ctx.fill()
      px(ctx, x + dx + w2 / 2 - 1, y + dy - 5, 2, 2, '#39424e')
    }
    px(ctx, x + 11, y + 4, 6, 2, '#39424e')
    if (!cleared) {
      const fh2 = 3 + Math.sin(t * 14) * 1.5
      px(ctx, x + 13, y + 1 - fh2, 2, fh2, '#ff8a3d'); px(ctx, x + 12, y - fh2, 1, 2, '#ffd54a')
    }
    if (hostile && blink) { px(ctx, x - 24, y - 19, 3, 3, '#ff5533'); px(ctx, x - 23, y - 16, 1, 6, '#5e444a') }
    if (cleared) { px(ctx, x - 4, y - 15, 8, 6, '#3f6e33'); px(ctx, x - 2, y - 13, 4, 2, '#7dff5e') }
  } else {
    // реле-станция
    shadow(ctx, x, y + 8, 11, 3)
    px(ctx, x - 9, y + 2, 18, 6, '#39424e')
    px(ctx, x - 1, y - 28, 2, 30, '#8a96a3')
    for (let i = 0; i < 3; i++) px(ctx, x - 4 + i * 2, y - 26 + i * 2, 8 - i * 4, 1, '#5e6e7e')
    const on = Math.sin(t * 4) > 0
    px(ctx, x - 2, y - 32, 4, 4, on ? '#3fe0ff' : '#1b4a5e')
    if (on) { ctx.fillStyle = 'rgba(63,224,255,0.25)'; ctx.beginPath(); ctx.arc(x, y - 30, 8, 0, Math.PI * 2); ctx.fill() }
    px(ctx, x - 7, y + 4, 3, 2, '#ffd54a')
  }
}

/** Пульсирующий маркер входа у двери */
export function drawDoorMarker(ctx: CanvasRenderingContext2D, poi: StructPoi, t: number) {
  if (!poi.doorWorld) return
  const dx = poi.doorWorld.x, dy = poi.doorWorld.y
  const k = 0.5 + Math.sin(t * 5) * 0.5
  ctx.strokeStyle = `rgba(125,255,234,${0.35 + k * 0.5})`
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.ellipse(dx, dy + 2, 12 + k * 3, 5 + k, 0, 0, Math.PI * 2); ctx.stroke()
  px(ctx, dx - 1, dy - 26 - k * 3, 2, 6, '#7dffea')
  ctx.beginPath()
  ctx.moveTo(dx - 4, dy - 20 - k * 3); ctx.lineTo(dx + 4, dy - 20 - k * 3); ctx.lineTo(dx, dy - 14 - k * 3)
  ctx.closePath()
  ctx.fillStyle = `rgba(125,255,234,${0.5 + k * 0.5})`
  ctx.fill()
  ctx.font = '6px "Press Start 2P", monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillText('[E] ВОЙТИ', dx + 1, dy - 33)
  ctx.fillStyle = '#7dffea'
  ctx.fillText('[E] ВОЙТИ', dx, dy - 34)
}

/** Тёмный фон интерьера (внешний мир не просвечивает) */
export function drawDungeonBackdrop(ctx: CanvasRenderingContext2D, poi: { dungeon?: { ox: number; oy: number; cols: number; rows: number } }, ox: number, oy: number, W: number, H: number) {
  ctx.fillStyle = '#05070c'
  ctx.fillRect(ox, oy, W, H)
  const d = poi.dungeon
  if (!d) return
  // мягкое внешнее свечение вокруг комплекса
  const g = ctx.createRadialGradient(d.ox + (d.cols * 16) / 2, d.oy + (d.rows * 16) / 2, 60, d.ox + (d.cols * 16) / 2, d.oy + (d.rows * 16) / 2, (d.cols * 16) / 1.4)
  g.addColorStop(0, 'rgba(20,28,40,0.9)')
  g.addColorStop(1, 'rgba(5,7,12,1)')
  ctx.fillStyle = g
  ctx.fillRect(ox, oy, W, H)
}

// ============================================================
// ТАЙЛЫ ДАНЖА (зависят от зоны) + ДЕКОРАЦИИ С ИСТОРИЕЙ МЕСТА
// ============================================================
const FLOOR_BY: Record<string, string> = {
  entry: '#232a35', hall: '#202832', tech: '#1e2833', storage: '#262a2b',
  lab: '#1f2b28', corridor: '#23262e', boss: '#26202a', secret: '#28232e',
}

export function drawDungeonTile(ctx: CanvasRenderingContext2D, wx: number, wy: number, tile: number, style: 'tech' | 'wreck' | 'vault', t: number, extra: { on?: boolean; room?: string | null; v?: number }) {
  const v = extra.v ?? 0.5
  const room = extra.room
  const wall = style === 'wreck' ? '#4a4438' : style === 'vault' ? '#3c4450' : '#39424e'
  const wallTop = style === 'wreck' ? '#6e6450' : '#5e6e7e'
  if (tile === 1) {
    px(ctx, wx, wy, 16, 16, wall)
    px(ctx, wx, wy, 16, 3, wallTop)
    px(ctx, wx, wy + 14, 16, 2, '#151a21')
    const h = Math.floor(wx / 16) + Math.floor(wy / 16)
    if (h % 2 === 0) px(ctx, wx + 7, wy + 7, 2, 2, '#151a21')
    if (h % 3 === 0) px(ctx, wx + 2, wy + 5, 4, 1, '#151a21')
    if (style === 'wreck' && h % 4 === 1) px(ctx, wx + 3, wy + 9, 3, 2, '#5a4a33')
    if (v > 0.85) px(ctx, wx + 11, wy + 4, 3, 3, '#222a33')
  } else if (tile === 0) {
    const base = (room && FLOOR_BY[room]) || (style === 'wreck' ? '#2a251e' : style === 'vault' ? '#1c222b' : '#202832')
    px(ctx, wx, wy, 16, 16, base)
    // плиты
    ctx.strokeStyle = 'rgba(94,110,126,0.14)'
    ctx.strokeRect(wx + 0.5, wy + 0.5, 15, 15)
    if (v < 0.18) { // решётка
      px(ctx, wx + 3, wy + 3, 10, 1, 'rgba(0,0,0,0.3)')
      px(ctx, wx + 3, wy + 7, 10, 1, 'rgba(0,0,0,0.3)')
      px(ctx, wx + 3, wy + 11, 10, 1, 'rgba(0,0,0,0.3)')
    } else if (v > 0.88) { // тёмное пятно
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath(); ctx.ellipse(wx + 8, wy + 8, 5, 4, 0, 0, Math.PI * 2); ctx.fill()
    } else if (v > 0.5 && v < 0.56) { // заклёпки
      px(ctx, wx + 2, wy + 2, 1, 1, 'rgba(255,255,255,0.14)')
      px(ctx, wx + 13, wy + 13, 1, 1, 'rgba(255,255,255,0.14)')
    }
    if (room === 'corridor') { // сигнальные шевроны
      if (v < 0.5) { px(ctx, wx + 2, wy + 7, 4, 2, 'rgba(255,213,74,0.4)'); px(ctx, wx + 8, wy + 7, 4, 2, 'rgba(255,213,74,0.25)') }
    }
    if (room === 'boss') {
      ctx.strokeStyle = 'rgba(255,85,51,0.14)'
      ctx.strokeRect(wx + 1.5, wy + 1.5, 13, 13)
    }
    if (room === 'tech' && v > 0.4 && v < 0.46) px(ctx, wx, wy + 7, 16, 1, 'rgba(63,224,255,0.16)')
  } else if (tile === 2) {
    if (extra.on) {
      px(ctx, wx, wy, 16, 16, '#1c222b')
      px(ctx, wx, wy, 3, 16, wall); px(ctx, wx + 13, wy, 3, 16, wall)
      px(ctx, wx, wy, 3, 2, wallTop); px(ctx, wx + 13, wy, 3, 2, wallTop)
      if (Math.sin(t * 5) > 0) px(ctx, wx + 1, wy + 7, 1, 2, '#7dff5e'); else px(ctx, wx + 14, wy + 7, 1, 2, '#7dff5e')
    } else {
      px(ctx, wx, wy, 16, 16, '#5a2a1e')
      px(ctx, wx, wy, 16, 2, '#8a4a33')
      px(ctx, wx, wy + 14, 16, 2, '#3a1a12')
      px(ctx, wx + 7, wy + 4, 2, 8, '#ffd54a')
      px(ctx, wx + 2, wy + 3, 1, 10, '#8a4a33'); px(ctx, wx + 13, wy + 3, 1, 10, '#8a4a33')
      if (Math.sin(t * 4) > 0) px(ctx, wx + 6, wy + 2, 4, 2, '#ff5533')
    }
  } else if (tile === 3) {
    px(ctx, wx, wy, 16, 16, '#1e2833')
    px(ctx, wx + 3, wy + 2, 10, 12, '#222831')
    px(ctx, wx + 3, wy + 2, 10, 2, '#39424e')
    px(ctx, wx + 5, wy + 5, 6, 4, extra.on ? '#7dff5e' : '#3a2b12')
    if (extra.on) { px(ctx, wx + 6, wy + 6, 2, 1, '#d8ffe0'); px(ctx, wx + 9, wy + 7, 1, 1, '#0f141b') }
    px(ctx, wx + 7, wy + 11, 2, 2, extra.on ? '#7dff5e' : '#5e444a')
    if (extra.on && Math.sin(t * 6) > 0) { ctx.fillStyle = 'rgba(125,255,94,0.25)'; ctx.fillRect(wx + 1, wy, 14, 16) }
    else if (!extra.on && Math.sin(t * 2) > 0.4) px(ctx, wx + 12, wy + 3, 2, 1, '#ff5533')
  } else if (tile === 4) {
    px(ctx, wx, wy, 16, 16, '#5e5344')
    px(ctx, wx, wy, 16, 2, '#7a6a52')
    px(ctx, wx + 2, wy + 4, 5, 1, '#3a3226'); px(ctx, wx + 8, wy + 8, 6, 1, '#3a3226'); px(ctx, wx + 3, wy + 12, 6, 1, '#3a3226')
    px(ctx, wx + 10, wy + 3, 3, 4, 'rgba(0,0,0,0.25)')
    if (Math.sin(t * 5) > 0.4) px(ctx, wx + 12, wy + 11, 2, 2, '#ffd54a')
  } else if (tile === 5) {
    px(ctx, wx, wy, 16, 16, '#23262e')
    ctx.strokeStyle = 'rgba(255,85,51,0.35)'
    ctx.strokeRect(wx + 2.5, wy + 2.5, 11, 11)
    px(ctx, wx + 6, wy + 6, 4, 4, '#39424e')
    px(ctx, wx + 7, wy + 7, 2, 2, '#222a33')
    if (extra.on) {
      const k = Math.sin(t * 24) > 0 ? 1 : 0.6
      ctx.fillStyle = `rgba(255,85,51,${0.5 * k})`
      ctx.beginPath(); ctx.moveTo(wx + 8, wy + 8); ctx.lineTo(wx + 2, wy + 14); ctx.lineTo(wx + 14, wy + 14); ctx.closePath(); ctx.fill()
      ctx.fillStyle = `rgba(255,200,120,${0.7 * k})`
      ctx.fillRect(wx + 7, wy + 7, 2, 2)
      ctx.fillStyle = `rgba(255,85,51,0.12)`
      ctx.beginPath(); ctx.arc(wx + 8, wy + 8, 10, 0, Math.PI * 2); ctx.fill()
    }
  } else if (tile === 6) {
    // входной/выходной шлюз
    px(ctx, wx, wy, 16, 16, '#2a3340')
    px(ctx, wx, wy, 16, 3, '#4a5a6e')
    px(ctx, wx, wy, 2, 16, '#4a5a6e'); px(ctx, wx + 14, wy, 2, 16, '#4a5a6e')
    const open = Math.sin(t * 3) > -0.4
    px(ctx, wx + 3, wy + 3, 10, 13, open ? '#101820' : '#39424e')
    if (open) {
      px(ctx, wx + 7, wy + 5, 2, 9, 'rgba(63,224,255,0.5)')
      px(ctx, wx + 4, wy + 14, 8, 1, '#3fe0ff')
    }
    px(ctx, wx + 6, wy + 1, 4, 1, Math.sin(t * 4) > 0 ? '#7dff5e' : '#2b4a2b')
  }
}

/** Декорации зон данжа: environmental storytelling без текста */
export function drawDungeonDecor(ctx: CanvasRenderingContext2D, poi: { seed: number; dungeon?: DungeonLayout }, t: number) {
  const d = poi.dungeon
  if (!d) return
  const ox = d.ox, oy = d.oy
  d.rooms.forEach((r, idx) => {
    const rng = new Rng(((poi.seed ^ (idx * 2654435761)) >>> 0) + 9)
    const rx = ox + r.x * TILE, ry = oy + r.y * TILE
    const rw = r.w * TILE, rh = r.h * TILE
    const fx = (f: number) => rx + 8 + f * (rw - 16)
    const fy = (f: number) => ry + 8 + f * (rh - 16)
    if (r.kind === 'entry') {
      // следы проникновения: сорванный щит, отпечатки, знак опасности
      px(ctx, fx(0.12), fy(0.7), 7, 3, '#39424e'); px(ctx, fx(0.12), fy(0.7), 7, 1, '#5e6e7e')
      px(ctx, fx(0.2), fy(0.66), 2, 2, '#8a4a33')
      for (let i = 0; i < 4; i++) px(ctx, fx(0.3 + i * 0.13), fy(0.3 + (i % 2) * 0.06), 1, 2, 'rgba(0,0,0,0.35)')
      px(ctx, fx(0.75), fy(0.2), 6, 6, '#ffd54a'); px(ctx, fx(0.75) + 2, fy(0.2) + 1, 2, 3, '#0f141b')
      // разбитый ящик
      px(ctx, fx(0.6), fy(0.75), 8, 6, '#4a4038'); px(ctx, fx(0.6), fy(0.75), 8, 1, '#6a5a48')
      px(ctx, fx(0.6) + 3, fy(0.75) + 2, 3, 3, '#1b1f26')
    } else if (r.kind === 'hall') {
      // следы боя: опрокинутая баррикада, масляные пятна, гильзы
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath(); ctx.ellipse(fx(0.3), fy(0.6), 8, 5, 0.3, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(fx(0.7), fy(0.3), 6, 4, -0.4, 0, Math.PI * 2); ctx.fill()
      // баррикада
      for (let i = 0; i < 3; i++) { px(ctx, fx(0.62 + i * 0.07), fy(0.62 - i * 0.04), 8, 4, '#4a5560'); px(ctx, fx(0.62 + i * 0.07), fy(0.62 - i * 0.04), 8, 1, '#6e7a8a') }
      px(ctx, fx(0.66), fy(0.52), 2, 2, '#8a4a33')
      for (let i = 0; i < 6; i++) px(ctx, fx(rng.next()), fy(rng.next()), 1, 1, '#ffd54a')
      // павший бот
      px(ctx, fx(0.2), fy(0.25), 8, 5, '#39424e'); px(ctx, fx(0.2) + 2, fy(0.25) + 1, 2, 2, '#1b2129')
      px(ctx, fx(0.2) + 6, fy(0.25) - 2, 2, 3, '#39424e')
      ctx.fillStyle = 'rgba(120,90,40,0.4)'
      ctx.beginPath(); ctx.ellipse(fx(0.24), fy(0.34), 5, 3, 0, 0, Math.PI * 2); ctx.fill()
    } else if (r.kind === 'tech') {
      // генераторы, трубы, кабели, вентиляция
      px(ctx, fx(0.7), fy(0.15), 12, 14, '#2c3540'); px(ctx, fx(0.7), fy(0.15), 12, 2, '#4a5560')
      px(ctx, fx(0.7) + 3, fy(0.15) + 4, 6, 6, Math.sin(t * 7 + idx) > 0 ? '#3fe0ff' : '#123844')
      px(ctx, rx + 4, ry + 2, rw - 8, 2, '#4a5560')
      px(ctx, rx + 4, ry + 5, rw - 14, 1, '#222a33')
      for (let i = 0; i < 3; i++) px(ctx, fx(0.15 + i * 0.25), fy(0.8), 6, 3, '#222a33')
      px(ctx, fx(0.4), fy(0.5), 2, 10, '#39424e')
      if (Math.sin(t * 11 + idx * 2) > 0.85) px(ctx, fx(0.4), fy(0.52), 2, 2, '#baf3ff')
    } else if (r.kind === 'storage') {
      // стеллажи, штабели ящиков, погрузчик
      for (let i = 0; i < 3; i++) {
        px(ctx, fx(0.08 + i * 0.3), fy(0.12), 10, 12, '#3a4148')
        px(ctx, fx(0.08 + i * 0.3), fy(0.12) + 4, 10, 1, '#222a33')
        px(ctx, fx(0.08 + i * 0.3) + 2, fy(0.12) + 1, 3, 2, '#5e6e7e')
      }
      px(ctx, fx(0.2), fy(0.72), 9, 7, '#4a4038'); px(ctx, fx(0.2), fy(0.72), 9, 2, '#6a5a48')
      px(ctx, fx(0.34), fy(0.76), 7, 6, '#44504a'); px(ctx, fx(0.34), fy(0.76), 7, 2, '#5e6e5e')
      px(ctx, fx(0.75), fy(0.6), 2, 12, '#5e6e7e'); px(ctx, fx(0.75) - 4, fy(0.6), 6, 2, '#5e6e7e')
      for (let i = 0; i < 3; i++) px(ctx, fx(0.6 + rng.next() * 0.3), fy(0.75 + rng.next() * 0.15), 3, 2, '#3a3226')
    } else if (r.kind === 'lab') {
      // терминалы, бак с трещиной, разбитое стекло
      px(ctx, fx(0.08), fy(0.15), 12, 8, '#222831')
      px(ctx, fx(0.08) + 1, fy(0.15) + 1, 10, 5, Math.sin(t * 5 + idx) > -0.3 ? '#1f4a3a' : '#0f141b')
      px(ctx, fx(0.08) + 2, fy(0.15) + 2, 4, 1, '#7dff5e')
      px(ctx, fx(0.08) + 2, fy(0.15) + 4, 6, 1, '#3a6e4a')
      // бак
      px(ctx, fx(0.7), fy(0.18), 8, 14, '#274b5e'); px(ctx, fx(0.7), fy(0.18), 8, 2, '#5e6e7e')
      px(ctx, fx(0.7) + 2, fy(0.18) + 3, 4, 8, 'rgba(125,255,94,0.35)')
      px(ctx, fx(0.7) + 5, fy(0.18) + 5, 1, 6, '#0f141b')
      ctx.fillStyle = 'rgba(125,255,94,0.25)'
      ctx.beginPath(); ctx.ellipse(fx(0.7) + 6, fy(0.85), 5, 2.5, 0, 0, Math.PI * 2); ctx.fill()
      // осколки
      for (let i = 0; i < 5; i++) px(ctx, fx(0.3 + rng.next() * 0.3), fy(0.6 + rng.next() * 0.25), 1, 1, '#baf3ff')
      px(ctx, fx(0.4), fy(0.75), 7, 4, '#222831'); px(ctx, fx(0.4) + 2, fy(0.75) - 2, 3, 2, '#222831')
    } else if (r.kind === 'corridor') {
      // свисающие кабели + аварийные огни
      const sway = Math.sin(t * 2.2 + idx) * 2
      ctx.strokeStyle = 'rgba(34,42,51,0.9)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(rx + rw * 0.3, ry + 2); ctx.quadraticCurveTo(rx + rw * 0.3 + sway, ry + rh * 0.4, rx + rw * 0.34, ry + rh * 0.55); ctx.stroke()
      px(ctx, rx + rw * 0.34, ry + rh * 0.55, 2, 2, Math.sin(t * 9) > 0 ? '#ffd54a' : '#3a2b12')
      px(ctx, rx + 2, ry + rh / 2 - 1, 4, 2, 'rgba(255,213,74,0.5)')
      px(ctx, rx + rw - 6, ry + rh / 2 - 1, 4, 2, 'rgba(255,213,74,0.5)')
    } else if (r.kind === 'boss') {
      // арена: пилоны, копоть, пульсирующее кольцо ядра
      for (const [cx2, cy2] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]] as [number, number][]) {
        px(ctx, fx(cx2) - 3, fy(cy2) - 3, 6, 6, '#3c3444')
        px(ctx, fx(cx2) - 3, fy(cy2) - 3, 6, 2, '#5e5470')
      }
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath(); ctx.ellipse(fx(0.3), fy(0.4), 9, 6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(fx(0.7), fy(0.7), 7, 5, 0, 0, Math.PI * 2); ctx.fill()
      const pulse = 0.5 + Math.sin(t * 3) * 0.3
      ctx.strokeStyle = `rgba(255,85,51,${0.25 * pulse + 0.1})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(rx + rw / 2, ry + rh / 2, 30, 22, 0, 0, Math.PI * 2); ctx.stroke()
    } else if (r.kind === 'secret') {
      // тайник: скелет оператора, редкий ящик, лампа
      px(ctx, fx(0.2), fy(0.3), 6, 4, '#c9d4de'); px(ctx, fx(0.2) + 1, fy(0.3) - 2, 3, 2, '#c9d4de')
      px(ctx, fx(0.2) + 2, fy(0.3) - 1, 1, 1, '#0f141b')
      px(ctx, fx(0.6), fy(0.55), 10, 8, '#4a3a5e'); px(ctx, fx(0.6), fy(0.55), 10, 2, '#7d5eff')
      if (Math.sin(t * 4) > 0) px(ctx, fx(0.6) + 4, fy(0.55) + 4, 2, 2, '#c96bff')
      const flick = Math.sin(t * 13) > -0.6 ? 0.5 : 0.15
      ctx.fillStyle = `rgba(201,111,255,${flick * 0.2})`
      ctx.beginPath(); ctx.arc(fx(0.8), fy(0.2), 12, 0, Math.PI * 2); ctx.fill()
      px(ctx, fx(0.8), fy(0.2) - 2, 2, 2, '#c96bff')
    }
  })
  // входная рамка проёма и стрелка «ВЫХОД»
  for (let ty = 0; ty < d.rows; ty++) {
    if (d.tiles[ty * d.cols] === 0) {
      const wy = oy + ty * TILE
      px(ctx, ox - 3, wy, 3, TILE, '#222a33')
      px(ctx, ox - 3, wy, 1, TILE, '#3fe0ff')
    }
  }
  const blink = Math.sin(t * 5) > 0
  if (blink) {
    px(ctx, ox + 10, d.oy + 12 * TILE + 7, 3, 2, '#3fe0ff')
    px(ctx, ox + 6, d.oy + 12 * TILE + 7, 2, 2, '#3fe0ff')
  }
}

// ============================================================
// КОРАБЛЬ МЕНЮ (вид сбоку, заставка)
// ============================================================
export function drawMenuShip(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, beam: number) {
  ctx.save()
  ctx.translate(Math.round(cx), Math.round(cy + Math.sin(t * 1.4) * 3))
  ctx.scale(2.2, 2.2)
  for (const ey of [-10, 10]) {
    const fl = 10 + Math.sin(t * 30 + ey) * 4
    ctx.fillStyle = 'rgba(63,224,255,0.5)'
    ctx.beginPath(); ctx.moveTo(-52, ey - 4); ctx.lineTo(-52 - fl, ey); ctx.lineTo(-52, ey + 4); ctx.closePath(); ctx.fill()
    px(ctx, -52, ey - 5, 6, 10, '#39424e')
  }
  px(ctx, -48, -16, 86, 32, '#5e6e7e')
  px(ctx, -48, -16, 86, 4, '#8a96a3')
  px(ctx, -48, 12, 86, 4, '#39424e')
  px(ctx, 38, -10, 16, 20, '#5e6e7e')
  px(ctx, 54, -6, 10, 12, '#8a96a3')
  ctx.fillStyle = '#4a5568'
  ctx.beginPath(); ctx.moveTo(70, -3); ctx.lineTo(84, 0); ctx.lineTo(70, 3); ctx.closePath(); ctx.fill()
  px(ctx, -40, 7, 70, 3, '#f5a623')
  for (const ix of [-34, -24, -14]) { px(ctx, ix, -11, 4, 4, '#1b2b3a'); px(ctx, ix, -11, 4, 1, Math.sin(t * 3 + ix) > 0.3 ? '#ffd54a' : '#3a2b12') }
  px(ctx, 18, -12, 22, 16, '#274b5e')
  px(ctx, 26, -2, 8, 8, '#3a4652'); px(ctx, 27, -3, 6, 2, '#f5a623')
  px(ctx, 27, -8, 6, 6, '#5e6e7e'); px(ctx, 28, -7, 4, 3, '#f5a623')
  px(ctx, 18, -12, 22, 2, '#baf3ff')
  px(ctx, -6, 16, 12, 4, '#222a33')
  px(ctx, -4, 17, 8, 2, beam > 0 ? '#7dffea' : '#39424e')
  ctx.restore()
  if (beam > 0) {
    const bw = 14 * beam
    const g = ctx.createLinearGradient(0, cy + 40, 0, cy + 260)
    g.addColorStop(0, `rgba(125,255,234,${0.85 * beam})`)
    g.addColorStop(1, 'rgba(125,255,234,0)')
    ctx.fillStyle = g
    ctx.fillRect(cx - bw / 2, cy + 40, bw, 230)
  }
}
