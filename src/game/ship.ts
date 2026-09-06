// Корабль-хаб: палуба сверху, 6 интерактивных зон, коллизии
export const SHIP_W = 260
export const SHIP_H = 190
export type ShipZoneId = 'nav' | 'armory' | 'storage' | 'bay' | 'info' | 'med'
export interface ShipZone { id: ShipZoneId; label: string; hint: string; x: number; y: number; w: number; h: number; color: string }

export const SHIP_ZONES: ShipZone[] = [
  { id: 'nav', label: 'НАВИГАЦИЯ', hint: 'Выбор региона и начало экспедиции', x: 200, y: 22, w: 44, h: 44, color: '#3fe0ff' },
  { id: 'armory', label: 'ОРУЖЕЙНАЯ', hint: 'Постоянные артефакты и трофеи', x: 16, y: 22, w: 44, h: 44, color: '#ff8a3d' },
  { id: 'storage', label: 'ХРАНИЛИЩЕ', hint: 'Грузовой отсек корабля', x: 16, y: 124, w: 44, h: 44, color: '#f5a623' },
  { id: 'bay', label: 'ОТСЕК ОТРЯДА', hint: 'Постоянные компаньоны (до 2 в отряд)', x: 200, y: 124, w: 44, h: 44, color: '#7dff5e' },
  { id: 'info', label: 'ТЕРМИНАЛ', hint: 'Досье наёмника и статистика', x: 108, y: 22, w: 44, h: 30, color: '#c96bff' },
  { id: 'med', label: 'МЕДОТСЕК', hint: 'Восстановление перед высадкой', x: 108, y: 138, w: 44, h: 30, color: '#ff5e8a' },
]

interface Blocker { x: number; y: number; w: number; h: number }
const BLOCKERS: Blocker[] = [
  { x: 92, y: 78, w: 76, h: 36 }, // центральный стол-консоль
  { x: 70, y: 40, w: 24, h: 14 },
  { x: 166, y: 136, w: 24, h: 14 },
]

export function shipBlocked(x: number, y: number, r: number): boolean {
  if (x < 12 + r || x > SHIP_W - 12 - r || y < 12 + r || y > SHIP_H - 12 - r) return true
  for (const b of BLOCKERS) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true
  }
  return false
}

export function zoneAt(x: number, y: number): ShipZone | null {
  for (const z of SHIP_ZONES) if (x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h) return z
  return null
}

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

export function drawShipInterior(ctx: CanvasRenderingContext2D, t: number, activeZone: ShipZoneId | null, px0: number, py0: number) {
  const cx = SHIP_W / 2, cy = SHIP_H / 2
  // корпус
  ctx.fillStyle = '#2e3644'
  ctx.beginPath()
  ctx.moveTo(16, 34); ctx.lineTo(80, 10); ctx.lineTo(180, 10); ctx.lineTo(244, 34)
  ctx.lineTo(250, 95); ctx.lineTo(244, 156); ctx.lineTo(180, 180); ctx.lineTo(80, 180)
  ctx.lineTo(16, 156); ctx.lineTo(10, 95); ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#5e6e7e'
  ctx.lineWidth = 3
  ctx.stroke()
  // палуба
  ctx.fillStyle = '#1c232e'
  ctx.beginPath()
  ctx.moveTo(22, 38); ctx.lineTo(82, 16); ctx.lineTo(178, 16); ctx.lineTo(238, 38)
  ctx.lineTo(244, 95); ctx.lineTo(238, 152); ctx.lineTo(178, 174); ctx.lineTo(82, 174)
  ctx.lineTo(22, 152); ctx.lineTo(16, 95); ctx.closePath()
  ctx.fill()
  // палубные плиты
  ctx.strokeStyle = 'rgba(94,110,126,0.18)'
  ctx.lineWidth = 1
  for (let i = 1; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(16 + i * 28.5, 14); ctx.lineTo(16 + i * 28.5, 176); ctx.stroke()
  }
  for (let i = 1; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(12, 14 + i * 27); ctx.lineTo(248, 14 + i * 27); ctx.stroke()
  }
  // направляющая дорожка к люку
  ctx.fillStyle = 'rgba(245,166,35,0.25)'
  for (let i = 0; i < 6; i++) px(ctx, 124, 100 + i * 12, 12, 6, 'rgba(245,166,35,0.22)')
  // центральный стол
  px(ctx, 92, 78, 76, 36, '#39424e')
  px(ctx, 92, 78, 76, 4, '#5e6e7e')
  px(ctx, 92, 110, 76, 4, '#222a33')
  const hg = Math.sin(t * 2.4)
  ctx.fillStyle = `rgba(63,224,255,${0.25 + hg * 0.12})`
  ctx.beginPath(); ctx.ellipse(130, 96, 26, 10, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(63,224,255,0.7)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.ellipse(130, 96, 26 + hg * 2, 10 + hg, 0, 0, Math.PI * 2); ctx.stroke()
  px(ctx, 128, 90, 4, 4, '#ffd54a')
  // блокировки-декорации
  for (const b of BLOCKERS.slice(1)) {
    px(ctx, b.x, b.y, b.w, b.h, '#39424e')
    px(ctx, b.x, b.y, b.w, 2, '#5e6e7e')
  }
  // зоны
  for (const z of SHIP_ZONES) {
    const active = z.id === activeZone
    const dist = active ? 0 : Math.hypot(px0 - (z.x + z.w / 2), py0 - (z.y + z.h / 2))
    const near = dist < 46
    ctx.fillStyle = 'rgba(10,16,24,0.85)'
    ctx.fillRect(z.x, z.y, z.w, z.h)
    ctx.strokeStyle = active ? z.color : near ? z.color + 'aa' : '#1e2a38'
    ctx.lineWidth = active ? 2 : 1
    ctx.strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1)
    // пульс активной зоны
    if (active) {
      ctx.strokeStyle = z.color + '44'
      ctx.strokeRect(z.x - 2.5, z.y - 2.5, z.w + 5, z.h + 5)
    }
    drawZoneIcon(ctx, z, t, active)
    // подпись
    ctx.font = '5px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = active || near ? z.color : '#5e7a90'
    ctx.fillText(z.label, z.x + z.w / 2, z.y + z.h + 8)
  }
  // выход-люк
  px(ctx, 118, 176, 24, 8, '#222a33')
  px(ctx, 118, 176, 24, 2, '#f5a623')
  if (Math.sin(t * 3) > 0) px(ctx, 128, 179, 4, 2, '#ffd54a')
}

function drawZoneIcon(ctx: CanvasRenderingContext2D, z: ShipZone, t: number, active: boolean) {
  const x = z.x + z.w / 2, y = z.y + z.h / 2
  const c = active ? z.color : '#7e93a8'
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  if (z.id === 'nav') {
    // планета с орбитой
    ctx.fillStyle = c
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = active ? '#ffffff' : '#3a4f63'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 4, -0.4, 0, Math.PI * 2); ctx.stroke()
    const a = t * 1.6
    ctx.fillStyle = '#ffd54a'
    ctx.fillRect(Math.cos(a) * 11 - 1, Math.sin(a) * 4 - 1, 2, 2)
  } else if (z.id === 'armory') {
    px(ctx, -8, -3, 14, 5, c)
    px(ctx, 5, -4, 4, 3, active ? '#ffffff' : c)
    px(ctx, -5, 2, 3, 4, c)
    px(ctx, -2, -6, 3, 3, c)
  } else if (z.id === 'storage') {
    px(ctx, -8, -5, 16, 10, c)
    px(ctx, -8, -1, 16, 2, active ? '#0f141b' : '#1e2a38')
    px(ctx, -2, -1, 4, 2, active ? '#ffffff' : '#5e7a90')
  } else if (z.id === 'bay') {
    px(ctx, -7, -2, 6, 7, c)
    px(ctx, -7, 5, 2, 3, c); px(ctx, -3, 5, 2, 3, c)
    px(ctx, 2, -5, 5, 4, c)
    px(ctx, 1, -1, 7, 5, c)
    px(ctx, 4, 4, 2, 3, c)
    if (active && Math.sin(t * 6) > 0) px(ctx, 3, -4, 2, 1, '#ffffff')
  } else if (z.id === 'info') {
    px(ctx, -7, -6, 14, 10, '#0f141b')
    for (let i = 0; i < 3; i++) px(ctx, -5, -4 + i * 3, 10 - i * 2, 1, c)
    px(ctx, -7, 5, 14, 2, c)
  } else {
    px(ctx, -2, -6, 4, 12, c)
    px(ctx, -6, -2, 12, 4, c)
  }
  ctx.restore()
}
