// Корабль-хаб «Вольный пик»: полноценный интерьер сверху — помещения,
// переборки с дверными проёмами, коридор, мебель, техника, ambient-анимации.
export const SHIP_W = 300
export const SHIP_H = 200
export type ShipZoneId = 'nav' | 'armory' | 'storage' | 'bay' | 'info' | 'med'
export interface ShipZone { id: ShipZoneId; label: string; hint: string; x: number; y: number; w: number; h: number; color: string }

export const SHIP_ZONES: ShipZone[] = [
  { id: 'nav', label: 'НАВИГАЦИЯ', hint: 'Карта системы и начало экспедиции', x: 232, y: 28, w: 22, h: 40, color: '#3fe0ff' },
  { id: 'info', label: 'ГОЛО-СТОЛ', hint: 'Досье наёмника и статистика', x: 160, y: 62, w: 34, h: 20, color: '#c96bff' },
  { id: 'armory', label: 'ОРУЖЕЙНАЯ', hint: 'Верстаки, стойки и постоянные трофеи', x: 82, y: 32, w: 44, h: 30, color: '#ff8a3d' },
  { id: 'storage', label: 'ХРАНИЛИЩЕ', hint: 'Грузовой отсек и контейнеры', x: 20, y: 54, w: 40, h: 26, color: '#f5a623' },
  { id: 'bay', label: 'ОТСЕК ОТРЯДА', hint: 'Зарядные платформы компаньонов (до 2 в отряд)', x: 166, y: 146, w: 20, h: 28, color: '#7dff5e' },
  { id: 'med', label: 'МЕДОТСЕК', hint: 'Восстановление перед высадкой', x: 232, y: 138, w: 20, h: 30, color: '#ff5e8a' },
]

interface Blocker { x: number; y: number; w: number; h: number }
const BLOCKERS: Blocker[] = [
  // переборки: верхний ряд (проёмы 34-50, 98-114, 169-185, 241-257)
  { x: 16, y: 84, w: 18, h: 4 }, { x: 50, y: 84, w: 48, h: 4 }, { x: 114, y: 84, w: 55, h: 4 }, { x: 185, y: 84, w: 56, h: 4 }, { x: 257, y: 84, w: 27, h: 4 },
  // нижний ряд
  { x: 16, y: 112, w: 18, h: 4 }, { x: 50, y: 112, w: 48, h: 4 }, { x: 114, y: 112, w: 55, h: 4 }, { x: 185, y: 112, w: 56, h: 4 }, { x: 257, y: 112, w: 27, h: 4 },
  // вертикальные переборки (коридор свободен)
  { x: 68, y: 16, w: 4, h: 68 }, { x: 68, y: 116, w: 4, h: 68 },
  { x: 140, y: 16, w: 4, h: 68 }, { x: 140, y: 116, w: 4, h: 68 },
  { x: 210, y: 16, w: 4, h: 68 }, { x: 210, y: 116, w: 4, h: 68 },
  // мебель: склад
  { x: 20, y: 22, w: 18, h: 28 }, { x: 46, y: 26, w: 16, h: 22 },
  // оружейная
  { x: 76, y: 18, w: 60, h: 10 }, { x: 116, y: 60, w: 20, h: 12 },
  // центральный зал: голо-стол
  { x: 166, y: 40, w: 22, h: 22 },
  // навигация: консоль у правого борта + кресло штурмана у левой переборки (проход к консоли свободен)
  { x: 252, y: 20, w: 28, h: 44 }, { x: 218, y: 40, w: 12, h: 12 },
  // инженерный: реактор
  { x: 24, y: 126, w: 28, h: 42 },
  // каюта: койка, шкаф, стол
  { x: 76, y: 122, w: 28, h: 14 }, { x: 76, y: 168, w: 42, h: 12 }, { x: 112, y: 144, w: 18, h: 12 },
  // отсек отряда: платформы
  { x: 150, y: 126, w: 20, h: 18 }, { x: 184, y: 126, w: 20, h: 18 },
  // медотсек: капсула
  { x: 252, y: 130, w: 28, h: 38 },
]

export function shipBlocked(x: number, y: number, r: number): boolean {
  if (x < 16 + r || x > SHIP_W - 16 - r || y < 16 + r || y > SHIP_H - 16 - r) return true
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

export interface ShipBot { kind: string; color: string }

export function drawShipInterior(ctx: CanvasRenderingContext2D, t: number, activeZone: ShipZoneId | null, px0: number, py0: number, bots: ShipBot[] = []) {
  // ---------- корпус ----------
  ctx.fillStyle = '#232b38'
  ctx.beginPath()
  ctx.moveTo(16, 40); ctx.lineTo(70, 12); ctx.lineTo(216, 12); ctx.lineTo(266, 30)
  ctx.quadraticCurveTo(292, 44, 292, 100); ctx.quadraticCurveTo(292, 156, 266, 170)
  ctx.lineTo(216, 188); ctx.lineTo(70, 188); ctx.lineTo(16, 160)
  ctx.quadraticCurveTo(8, 100, 16, 40); ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#5e6e7e'
  ctx.lineWidth = 3
  ctx.stroke()
  // двигательные сопла слева
  for (const ey of [60, 140]) {
    px(ctx, 4, ey - 8, 10, 16, '#39424e')
    px(ctx, 4, ey - 8, 10, 3, '#5e6e7e')
    const fl = 6 + Math.sin(t * 26 + ey) * 3
    ctx.fillStyle = 'rgba(63,224,255,0.5)'
    ctx.beginPath(); ctx.moveTo(4, ey - 5); ctx.lineTo(4 - fl, ey); ctx.lineTo(4, ey + 5); ctx.closePath(); ctx.fill()
  }
  // ---------- палуба ----------
  ctx.fillStyle = '#1a212c'
  ctx.beginPath()
  ctx.moveTo(20, 44); ctx.lineTo(72, 17); ctx.lineTo(214, 17); ctx.lineTo(262, 34)
  ctx.quadraticCurveTo(287, 47, 287, 100); ctx.quadraticCurveTo(287, 153, 262, 166)
  ctx.lineTo(214, 183); ctx.lineTo(72, 183); ctx.lineTo(20, 156)
  ctx.quadraticCurveTo(13, 100, 20, 44); ctx.closePath()
  ctx.fill()
  // палубные плиты
  ctx.strokeStyle = 'rgba(94,110,126,0.14)'
  ctx.lineWidth = 1
  for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(16 + i * 27.5, 14); ctx.lineTo(16 + i * 27.5, 186); ctx.stroke() }
  for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo(12, 14 + i * 24.6); ctx.lineTo(288, 14 + i * 24.6); ctx.stroke() }

  // ---------- коридор: направляющая дорожка ----------
  const chev = Math.floor(t * 3) % 4
  for (let i = 0; i < 9; i++) {
    const on = (i + chev) % 4 === 0
    px(ctx, 26 + i * 29, 98, 12, 4, on ? 'rgba(245,166,35,0.5)' : 'rgba(245,166,35,0.14)')
  }

  // ---------- переборки с дверными проёмами ----------
  for (const b of BLOCKERS.slice(0, 16)) {
    px(ctx, b.x, b.y, b.w, b.h, '#2e3644')
    if (b.h === 4) px(ctx, b.x, b.y, b.w, 1, '#4a5568')
    else px(ctx, b.x, b.y, 1, b.h, '#4a5568')
  }
  // дверные рамы проёмов
  for (const gx of [34, 98, 169, 241]) {
    px(ctx, gx, 84, 2, 4, '#f5a623'); px(ctx, gx + 14, 84, 2, 4, '#f5a623')
    px(ctx, gx, 112, 2, 4, '#f5a623'); px(ctx, gx + 14, 112, 2, 4, '#f5a623')
  }

  // ---------- ХРАНИЛИЩЕ (верх-лево) ----------
  // кран-балка
  px(ctx, 18, 18, 48, 2, '#4a5568')
  px(ctx, 30 + Math.sin(t * 0.7) * 8, 18, 2, 5, '#8a96a3')
  // штабели контейнеров
  const crates: [number, number, number, number, string][] = [
    [20, 22, 18, 13, '#4a4038'], [20, 36, 18, 13, '#44504a'], [46, 26, 16, 11, '#3e4a5e'], [46, 38, 16, 10, '#4a4038'],
  ]
  for (const [cx2, cy2, cw, ch, cc] of crates) {
    px(ctx, cx2, cy2, cw, ch, cc)
    px(ctx, cx2, cy2, cw, 2, 'rgba(255,255,255,0.14)')
    px(ctx, cx2 + cw / 2 - 1, cy2 + 2, 2, ch - 4, 'rgba(0,0,0,0.25)')
  }
  px(ctx, 24, 60, 10, 8, '#5e5344'); px(ctx, 24, 60, 10, 2, '#7a6a52')
  px(ctx, 40, 64, 8, 7, '#3e4a5e')

  // ---------- ОРУЖЕЙНАЯ (верх-центр) ----------
  px(ctx, 76, 18, 60, 10, '#2c3540') // стойка
  px(ctx, 76, 18, 60, 2, '#4a5568')
  for (let i = 0; i < 3; i++) {
    const wx = 84 + i * 18
    px(ctx, wx, 21, 10, 2, '#39424e')
    px(ctx, wx + 8, 21, 3, 2, ['#3fe0ff', '#ff8a3d', '#c96bff'][i])
    px(ctx, wx + 2, 23, 2, 3, '#222a33')
  }
  // верстак с тисками
  px(ctx, 116, 60, 20, 12, '#39424e')
  px(ctx, 116, 60, 20, 2, '#5e6e7e')
  px(ctx, 121, 56, 4, 4, '#4a5568'); px(ctx, 128, 57, 5, 3, '#222a33')
  if (Math.sin(t * 9) > 0.6) px(ctx, 130, 55, 2, 2, '#ffd54a') // искра
  px(ctx, 76, 34, 4, 4, Math.sin(t * 4) > 0 ? '#ff5533' : '#3a1a12')

  // ---------- ЦЕНТРАЛЬНЫЙ ЗАЛ: голо-стол ----------
  px(ctx, 166, 40, 22, 22, '#2c3540')
  px(ctx, 166, 40, 22, 3, '#4a5568')
  const hg = Math.sin(t * 2.2)
  ctx.fillStyle = `rgba(201,111,255,${0.16 + hg * 0.05})`
  ctx.beginPath(); ctx.ellipse(177, 51, 9, 6, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(201,111,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.ellipse(177, 51 - hg, 6, 4, 0, 0, Math.PI * 2); ctx.stroke()
  // планета-голограмма
  ctx.fillStyle = '#3fa9ff'
  ctx.beginPath(); ctx.arc(177, 46 - hg * 1.5, 3.4, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#baf3ff'
  ctx.beginPath(); ctx.ellipse(177, 46 - hg * 1.5, 5.5, 1.6, -0.3 + t * 0.8, 0, Math.PI * 2); ctx.stroke()
  // боковой терминал
  px(ctx, 148, 24, 12, 16, '#222831')
  for (let i = 0; i < 3; i++) px(ctx, 150, 27 + i * 4, 8 - i * 2, 1, Math.sin(t * 5 + i) > 0 ? '#3fe0ff' : '#1b4a5e')

  // ---------- НАВИГАЦИЯ (нос) ----------
  // консоль полукругом
  px(ctx, 252, 20, 28, 44, '#2c3540')
  px(ctx, 252, 20, 28, 3, '#4a5568')
  for (let i = 0; i < 3; i++) {
    px(ctx, 256, 26 + i * 13, 20, 8, '#0f141b')
    const lines = 2 + ((i + Math.floor(t * 2)) % 2)
    for (let l = 0; l < lines; l++) px(ctx, 258, 28 + i * 13 + l * 3, 12 - l * 3, 1, i === 1 ? '#f5a623' : '#3fe0ff')
  }
  // кресло штурмана (у левой переборки, развёрнуто к консоли)
  px(ctx, 218, 40, 12, 12, '#39424e')
  px(ctx, 220, 42, 8, 8, '#274b5e')
  px(ctx, 228, 43, 2, 6, '#4a5568')
  // радар
  ctx.save()
  ctx.translate(276, 74)
  ctx.strokeStyle = 'rgba(63,224,255,0.5)'
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke()
  ctx.rotate(t * 2.4)
  const rg = ctx.createLinearGradient(0, 0, 7, 0)
  rg.addColorStop(0, 'rgba(63,224,255,0.7)'); rg.addColorStop(1, 'rgba(63,224,255,0)')
  ctx.fillStyle = rg
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 7, -0.4, 0); ctx.closePath(); ctx.fill()
  ctx.restore()
  // смотровая полоса носа
  ctx.strokeStyle = 'rgba(186,243,255,0.35)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(268, 36); ctx.quadraticCurveTo(284, 60, 284, 100); ctx.quadraticCurveTo(284, 140, 268, 164)
  ctx.stroke()

  // ---------- ИНЖЕНЕРНЫЙ (низ-лево) ----------
  // реактор
  px(ctx, 24, 126, 28, 42, '#2c3540')
  px(ctx, 24, 126, 28, 3, '#4a5568')
  const rp = 0.5 + Math.sin(t * 3.1) * 0.35
  px(ctx, 31, 134, 14, 26, '#0f141b')
  ctx.fillStyle = `rgba(245,166,35,${0.3 + rp * 0.4})`
  ctx.fillRect(33, 137, 10, 20)
  px(ctx, 33, 137 + Math.floor(rp * 12), 10, 2, '#ffd54a')
  // трубы
  px(ctx, 52, 130, 14, 3, '#4a5568'); px(ctx, 63, 130, 3, 20, '#4a5568')
  px(ctx, 20, 172, 46, 3, '#4a5568')
  // манометры
  for (let i = 0; i < 3; i++) {
    px(ctx, 56 + i * 0, 152 + i * 7, 6, 5, '#222831')
    px(ctx, 57, 153 + i * 7, Math.floor(2 + Math.sin(t * (2 + i) + i) * 1.5 + 1.5), 3, ['#7dff5e', '#ffd54a', '#ff5533'][i])
  }
  // кабели под потолком отсека
  ctx.strokeStyle = 'rgba(245,166,35,0.3)'
  ctx.beginPath(); ctx.moveTo(18, 120); ctx.quadraticCurveTo(38, 124 + Math.sin(t * 1.4), 66, 120); ctx.stroke()
  // пар
  if (Math.sin(t * 2.2) > 0.4) {
    ctx.fillStyle = 'rgba(200,215,225,0.18)'
    ctx.beginPath(); ctx.arc(50, 126 - ((t * 8) % 12), 3, 0, Math.PI * 2); ctx.fill()
  }

  // ---------- КАЮТА (низ-центр) ----------
  px(ctx, 76, 122, 28, 14, '#39424e') // койка
  px(ctx, 78, 124, 10, 10, '#5e4a3c')
  px(ctx, 90, 124, 12, 10, '#4a5568')
  px(ctx, 76, 168, 42, 12, '#2c3540') // шкафчики
  for (let i = 0; i < 3; i++) px(ctx, 79 + i * 13, 170, 10, 8, '#39424e')
  px(ctx, 87, 173, 1, 3, '#8a96a3'); px(ctx, 100, 173, 1, 3, '#8a96a3')
  px(ctx, 112, 144, 18, 12, '#39424e') // столик
  px(ctx, 116, 141, 4, 3, '#8a5a3c') // кружка
  px(ctx, 124, 141, 5, 3, '#c9d4de')
  // фото и растение
  px(ctx, 132, 124, 6, 7, '#222831'); px(ctx, 133, 125, 4, 4, '#f5a623')
  px(ctx, 74, 148, 4, 8, '#4a3a2c'); px(ctx, 72, 142, 8, 6, '#3f6e33'); px(ctx, 74, 140, 4, 3, '#4a8a3f')

  // ---------- ОТСЕК ОТРЯДА (низ-центр-право) ----------
  const pads: [number, number][] = [[150, 126], [184, 126]]
  pads.forEach(([bx, by], i) => {
    px(ctx, bx, by, 20, 18, '#2c3540')
    ctx.strokeStyle = '#7dff5e55'
    ctx.strokeRect(bx + 1.5, by + 1.5, 17, 15)
    const charging = Math.sin(t * 4 + i * 2) > 0
    px(ctx, bx + 8, by + 15, 4, 2, charging ? '#7dff5e' : '#2b4a2b')
    // бот на платформе (второй бот — работает у верстака)
    const bot = bots[i]
    if (bot) {
      const working = i === 1 && bots.length > 1
      const wx = working ? 106 : bx + 6
      const wy = working ? 66 : by + 9
      const bby = wy + Math.sin(t * 3 + i) * 1
      if (bot.kind === 'drone') {
        px(ctx, wx, bby - 6, 8, 4, '#5e6e8a')
        ctx.fillStyle = 'rgba(200,220,235,0.5)'
        ctx.fillRect(wx - 2, bby - 8 + (((t * 20) | 0) % 2), 12, 1)
        px(ctx, wx + 3, bby - 5, 2, 2, bot.color)
      } else {
        px(ctx, wx, bby - 4, 8, 7, '#5e6e7e')
        px(ctx, wx, bby - 7, 8, 3, '#39424e')
        px(ctx, wx + 2, bby - 6, 4, 1, bot.color)
        px(ctx, wx - 1, bby + 3, 3, 3, '#39424e'); px(ctx, wx + 6, bby + 3, 3, 3, '#39424e')
      }
      // сварка у верстака: периодические искры
      if (working && Math.sin(t * 2.2) > -0.4) {
        const sp = ((t * 30) | 0) % 3
        ctx.fillStyle = '#ffd54a'
        px(ctx, 122 + sp * 2, 66 - sp, 2, 2, '#ffd54a')
        px(ctx, 120 - sp, 68 + sp, 1, 1, '#ff8a3d')
        ctx.fillStyle = 'rgba(255,213,74,0.3)'
        ctx.beginPath(); ctx.arc(122, 66, 5 + sp, 0, Math.PI * 2); ctx.fill()
      }
    }
  })
  // стойка питания
  px(ctx, 172, 152, 10, 20, '#2c3540')
  for (let i = 0; i < 3; i++) px(ctx, 174, 155 + i * 6, 6, 2, Math.sin(t * 5 + i) > 0.2 ? '#7dff5e' : '#1e3a1e')

  // ---------- МЕДОТСЕК (низ-право) ----------
  px(ctx, 252, 130, 28, 38, '#2c3540')
  px(ctx, 256, 134, 20, 26, '#274b5e')
  px(ctx, 256, 134, 20, 2, '#baf3ff')
  ctx.fillStyle = 'rgba(186,243,255,0.16)'
  ctx.fillRect(258, 138, 16, 18)
  px(ctx, 264, 143, 4, 10, '#ff5e8a'); px(ctx, 261, 146, 10, 4, '#ff5e8a')
  if (Math.sin(t * 6) > 0.5) px(ctx, 258, 158, 3, 2, '#7dff5e')
  px(ctx, 244, 134, 4, 14, '#4a5568') // капельница
  px(ctx, 244, 148, 1, 8, '#8a96a3')

  // ---------- AMBIENT: светодиодные ленты ----------
  for (let i = 0; i < 8; i++) {
    const on = Math.floor(t * 2 + i) % 3 === 0
    px(ctx, 24 + i * 33, 15, 3, 1, on ? '#3fe0ff' : '#123844')
    px(ctx, 24 + i * 33, 184, 3, 1, on ? '#f5a623' : '#3a2b12')
  }

  // ---------- интерактивные зоны ----------
  for (const z of SHIP_ZONES) {
    const active = z.id === activeZone
    const dist = active ? 0 : Math.hypot(px0 - (z.x + z.w / 2), py0 - (z.y + z.h / 2))
    const near = dist < 44
    if (active || near) {
      ctx.strokeStyle = active ? z.color : z.color + '66'
      ctx.lineWidth = active ? 2 : 1
      ctx.setLineDash([3, 3])
      ctx.strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1)
      ctx.setLineDash([])
      if (active) {
        ctx.strokeStyle = z.color + '33'
        ctx.strokeRect(z.x - 2.5, z.y - 2.5, z.w + 5, z.h + 5)
      }
    }
    ctx.font = '5px "Press Start 2P", monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = active ? z.color : near ? z.color + 'bb' : '#3a4f63'
    ctx.fillText(z.label, z.x + z.w / 2, z.y + z.h + 8)
  }

  // ---------- выходной люк (корма-низ) ----------
  px(ctx, 128, 182, 44, 5, '#222a33')
  px(ctx, 128, 182, 44, 1, '#f5a623')
  if (Math.sin(t * 3) > 0) { px(ctx, 146, 184, 8, 2, '#ffd54a') }
}
