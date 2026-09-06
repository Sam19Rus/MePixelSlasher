// Процедурный пиксель-арт (canvas, без ассетов). Позже заменяется на sprite sheets — сигнатуры стабильны.
export function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}
export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2); ctx.fill()
}
function flashBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, flash: number) {
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, flash * 9)})`; ctx.fillRect(Math.round(x), Math.round(y), w, h) }
}

// ---------- ИГРОК ----------
export function drawPlayer(ctx: CanvasRenderingContext2D, p: { x: number; y: number; aim: number; walkT: number; slashT: number; dashT: number; chestColor: string; weaponColor: string }, t: number) {
  const { x, y } = p
  const step = Math.sin(p.walkT * 11) * 1.4
  shadow(ctx, x, y + 5, 6, 2.4)
  if (p.dashT > 0) { ctx.fillStyle = 'rgba(63,224,255,0.25)'; ctx.fillRect(x - 10, y - 6, 20, 12) }
  px(ctx, x - 3, y + 1 + Math.max(0, step), 2, 4, '#2c3540')
  px(ctx, x + 1, y + 1 + Math.max(0, -step), 2, 4, '#2c3540')
  px(ctx, x - 5, y - 5, 2, 6, '#4a5568')
  px(ctx, x - 5, y - 5, 2, 1, '#3fe0ff')
  px(ctx, x - 4, y - 6, 8, 8, p.chestColor)
  px(ctx, x - 4, y - 6, 8, 2, 'rgba(255,255,255,0.18)')
  px(ctx, x - 4, y + 1, 8, 1, 'rgba(0,0,0,0.3)')
  px(ctx, x - 6, y - 6, 2, 3, '#f5a623'); px(ctx, x + 4, y - 6, 2, 3, '#f5a623')
  px(ctx, x - 3, y - 11, 6, 5, '#5e6e7e')
  px(ctx, x - 2, y - 9, 4, 2, '#3fe0ff')
  px(ctx, x - 2, y - 9, 4, 1, '#baf3ff')
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y - 3))
  ctx.rotate(p.aim)
  px(ctx, 2, -1, 9, 3, '#39424e'); px(ctx, 9, -1, 3, 2, p.weaponColor); px(ctx, 3, -2, 3, 1, p.weaponColor)
  ctx.restore()
  if (p.slashT > 0) {
    const k = p.slashT / 0.2
    ctx.save()
    ctx.translate(Math.round(x), Math.round(y - 2))
    ctx.rotate(p.aim)
    ctx.fillStyle = `rgba(120,255,240,${0.5 * k})`
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.arc(0, 0, 20, -1.0 - (1 - k) * 0.5, 1.0 + (1 - k) * 0.5); ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  if (Math.sin(t * 6) > 0.4) px(ctx, x + 4, y - 4, 1, 1, '#7dff5e')
}

// ---------- ВРАГИ ----------
export function drawEnemy(ctx: CanvasRenderingContext2D, e: { x: number; y: number; type: string; body: number; head: number; weapon: number; pal: { main: string; dark: string; accent: string }; walkT: number; flash: number; windup: number; aim: number; phase: number }, t: number) {
  const { x, y, pal } = e
  const bob = Math.sin(e.walkT * 10)
  if (e.type === 'grunt') {
    const yy = y + bob * 0.6
    shadow(ctx, x, y + 5, 5, 2)
    px(ctx, x - 2, yy + 2 + Math.max(0, bob), 2, 3, pal.dark)
    px(ctx, x, yy + 2 + Math.max(0, -bob), 2, 3, pal.dark)
    if (e.body === 0) { px(ctx, x - 4, yy - 4, 8, 7, pal.main); px(ctx, x - 4, yy - 1, 8, 1, pal.dark) }
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
    if (e.body === 0) { px(ctx, x - 9, yy - 6, 18, 11, pal.main); px(ctx, x - 6, yy - 2, 12, 1, pal.dark); px(ctx, x - 6, yy + 1, 12, 1, pal.dark) }
    else if (e.body === 1) { px(ctx, x - 8, yy - 7, 16, 12, pal.main); px(ctx, x - 9, yy - 4, 18, 6, pal.main); px(ctx, x - 9, yy - 1, 18, 2, pal.accent) }
    else { px(ctx, x - 9, yy - 6, 18, 11, pal.main); for (let i = 0; i < 4; i++) { px(ctx, x - 9 + i * 2, yy - 8, 2, 2, pal.dark); px(ctx, x + 3 + i * 2, yy - 8, 2, 2, pal.dark) } }
    px(ctx, x - 11, yy - 7, 3, 4, pal.dark); px(ctx, x + 8, yy - 7, 3, 4, pal.dark)
    if (e.head === 0) { px(ctx, x - 3, yy - 11, 6, 4, '#5e6e7e'); px(ctx, x - 3, yy - 11, 6, 1, '#7e8e9e') }
    else if (e.head === 1) { px(ctx, x - 3, yy - 11, 6, 4, pal.dark); px(ctx, x - 2, yy - 8, 1, 2, '#c9d4de'); px(ctx, x, yy - 8, 1, 2, '#c9d4de'); px(ctx, x + 2, yy - 8, 1, 2, '#c9d4de') }
    else { px(ctx, x - 2, yy - 10, 4, 3, '#222831'); px(ctx, x - 1, yy - 9, 2, 2, pal.accent) }
    const up = e.windup > 0 ? 4 : 0
    if (e.weapon === 0) { px(ctx, x + 9, yy - 8 - up, 6, 7, pal.dark); px(ctx, x + 9, yy - 8 - up, 6, 2, pal.accent) }
    else if (e.weapon === 1) { px(ctx, x + 9, yy - 9 - up, 2, 10, '#c9d4de'); for (let i = 0; i < 4; i++) px(ctx, x + (i % 2 ? 11 : 8), yy - 8 - up + i * 2, 2, 1, pal.accent) }
    else { px(ctx, x + 8, yy - 2, 7, 3, '#6e7a8a'); px(ctx, x + 15, yy - 1, 3, 1, pal.accent) }
    flashBox(ctx, x - 11, yy - 12, 22, 21, e.flash)
  } else if (e.type === 'gunner') {
    const yy = y + bob * 0.5
    shadow(ctx, x, y + 5, 5, 2)
    px(ctx, x - 2, yy + 1 + Math.max(0, bob), 2, 4, pal.dark)
    px(ctx, x, yy + 1 + Math.max(0, -bob), 2, 4, pal.dark)
    if (e.body === 0) { px(ctx, x - 4, yy - 5, 8, 7, pal.main); px(ctx, x - 4, yy - 3, 8, 1, pal.accent) }
    else if (e.body === 1) { px(ctx, x - 4, yy - 5, 8, 7, pal.dark); px(ctx, x - 3, yy - 5, 6, 5, pal.main); px(ctx, x - 3, yy - 2, 6, 1, pal.accent) }
    else { px(ctx, x - 5, yy - 5, 10, 7, pal.dark); px(ctx, x - 3, yy - 4, 6, 5, pal.main); px(ctx, x - 5, yy - 5, 1, 7, pal.accent); px(ctx, x + 4, yy - 5, 1, 7, pal.accent) }
    if (e.head === 0) { px(ctx, x - 3, yy - 10, 6, 4, '#39424e'); px(ctx, x - 2, yy - 9, 4, 1, pal.accent) }
    else if (e.head === 1) { px(ctx, x - 3, yy - 10, 6, 5, pal.dark); px(ctx, x - 1, yy - 9, 2, 2, pal.accent) }
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
    shadow(ctx, x, y + 4, 4, 1.6)
    const flap = Math.sin(t * 18 + e.phase) * 2
    if (e.body === 0) {
      px(ctx, x - 4, yy - 4, 8, 8, pal.main); px(ctx, x - 3, yy - 5, 6, 1, pal.main)
      px(ctx, x - 7, yy - 2 + flap * 0.4, 3, 4, pal.dark); px(ctx, x + 4, yy - 2 - flap * 0.4, 3, 4, pal.dark)
    } else if (e.body === 1) {
      px(ctx, x - 5, yy - 2, 10, 4, pal.main); px(ctx, x + 3, yy - 1, 4, 2, pal.accent)
      px(ctx, x - 4, yy - 5 - Math.abs(flap) * 0.5, 6, 3, pal.dark); px(ctx, x - 4, yy + 2 + Math.abs(flap) * 0.5, 6, 3, pal.dark)
    } else {
      px(ctx, x - 3, yy - 3, 6, 6, pal.main)
      px(ctx, x - 7, yy - 3 - Math.abs(flap) * 0.6, 4, 5, pal.dark); px(ctx, x + 3, yy - 3 - Math.abs(flap) * 0.6, 4, 5, pal.dark)
    }
    if (e.head === 0) { px(ctx, x - 1, yy - 1, 2, 2, '#ffffff') }
    else if (e.head === 1) { px(ctx, x - 2, yy + 1, 4, 2, pal.dark); px(ctx, x - 1, yy + 2, 1, 2, '#c9d4de'); px(ctx, x + 1, yy + 2, 1, 2, '#c9d4de') }
    else px(ctx, x - 1, yy - 5, 2, 2, pal.accent)
    flashBox(ctx, x - 7, yy - 6, 14, 13, e.flash)
  }
}

// ---------- КОМПАНЬОНЫ ----------
export function drawCompanion(ctx: CanvasRenderingContext2D, c: { x: number; y: number; kind: string; pal: { main: string; dark: string; accent: string }; walkT: number; aim: number; phase: number }, t: number) {
  const { x, y, pal } = c
  const bob = Math.sin(c.walkT * 10)
  if (c.kind === 'mech') {
    const yy = y + bob * 0.4
    shadow(ctx, x, y + 5, 5, 2)
    px(ctx, x - 3, yy + 1 + Math.max(0, bob), 2, 4, pal.dark)
    px(ctx, x + 1, yy + 1 + Math.max(0, -bob), 2, 4, pal.dark)
    px(ctx, x - 4, yy - 5, 8, 7, pal.main)
    px(ctx, x - 1, yy - 3, 2, 2, pal.accent)
    px(ctx, x - 3, yy - 8, 6, 3, pal.dark)
    px(ctx, x - 2, yy - 7, 4, 1, pal.accent)
    ctx.save(); ctx.translate(Math.round(x), Math.round(yy - 2)); ctx.rotate(c.aim)
    px(ctx, 3, -1, 6, 2, pal.dark); px(ctx, 8, -1, 2, 2, pal.accent)
    ctx.restore()
  } else if (c.kind === 'tank') {
    shadow(ctx, x, y + 5, 7, 2.4)
    px(ctx, x - 7, y + 1, 14, 4, '#222831')
    for (let i = 0; i < 6; i++) px(ctx, x - 6 + i * 2 + (((c.walkT * 20) | 0) % 2), y + 2, 1, 2, '#4a5560')
    px(ctx, x - 6, y - 4, 12, 6, pal.main)
    px(ctx, x - 3, y - 7, 7, 4, pal.dark)
    ctx.save(); ctx.translate(Math.round(x), Math.round(y - 5)); ctx.rotate(c.aim)
    px(ctx, 3, -1, 8, 2, pal.dark); px(ctx, 10, -1, 2, 2, pal.accent)
    ctx.restore()
  } else if (c.kind === 'drone') {
    const yy = y - 6 + Math.sin(t * 6 + c.phase) * 2
    shadow(ctx, x, y + 3, 3.4, 1.3)
    px(ctx, x - 3, yy - 2, 6, 4, pal.main)
    px(ctx, x - 1, yy - 1, 2, 2, pal.accent)
    ctx.fillStyle = 'rgba(200,220,235,0.5)'
    ctx.fillRect(x - 6, yy - 4 + (((t * 30 + c.phase) | 0) % 2), 12, 1)
    ctx.save(); ctx.translate(Math.round(x), Math.round(yy + 1)); ctx.rotate(c.aim)
    px(ctx, 2, 0, 4, 1, pal.dark); px(ctx, 5, 0, 2, 1, pal.accent)
    ctx.restore()
  } else {
    const yy = y + bob * 0.3
    shadow(ctx, x, y + 5, 6, 2.2)
    const lo = Math.max(0, bob)
    px(ctx, x - 5, yy + 1 + lo, 2, 4, pal.dark); px(ctx, x + 3, yy + 1 + lo, 2, 4, pal.dark)
    px(ctx, x - 3, yy + 1 - lo, 2, 4, pal.dark); px(ctx, x + 1, yy + 1 - lo, 2, 4, pal.dark)
    px(ctx, x - 5, yy - 3, 10, 5, pal.main)
    px(ctx, x - 3, yy - 6, 6, 3, pal.dark)
    px(ctx, x - 1, yy - 5, 2, 1, pal.accent)
    ctx.save(); ctx.translate(Math.round(x), Math.round(yy - 4)); ctx.rotate(c.aim)
    px(ctx, 3, -1, 9, 2, pal.dark); px(ctx, 11, -1, 2, 2, pal.accent)
    ctx.restore()
  }
}

// ---------- КАПСУЛЫ ----------
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
  } else if (c.shape === 1) {
    px(ctx, x - s / 2, y - h / 2, s, h, c.body)
    px(ctx, x - s / 2, y - 1, s, 2, c.band)
    px(ctx, x - 1, y - h / 2, 2, h, c.band)
  } else if (c.shape === 2) {
    px(ctx, x - s / 2 + 2, y - h / 2, s - 4, h, c.body)
    px(ctx, x - s / 2, y - h / 2 + 3, s, h - 6, c.body)
    px(ctx, x - s / 2 + 2, y - h / 2 - 3, 3, 3, c.band)
    px(ctx, x - s / 2 + 1, y + 1, s - 2, 2, c.band)
  } else {
    const r = s / 2
    for (let i = -r; i <= r; i++) {
      const hh = Math.sqrt(r * r - i * i)
      px(ctx, x + i, y - hh * 0.7, 1, hh * 1.4, c.body)
    }
    px(ctx, x - r + 1, y - 1, s - 2, 2, c.band)
  }
  const dmgK = 1 - c.hp / c.maxHp
  if (dmgK > 0.2) px(ctx, x - s / 3, y - h / 3, 2, 1, '#1b1f26')
  if (dmgK > 0.5) px(ctx, x, y - h / 4, 2, 2, '#1b1f26')
  if (blink) { px(ctx, x - 1, y - h / 2 - (c.shape === 2 ? 4 : 3), 2, 2, glow); ctx.fillStyle = glow + '33'; ctx.fillRect(x - 2, y - h / 2 - 5, 4, 4) }
  if (c.special) {
    ctx.fillStyle = 'rgba(63,224,255,0.14)'
    ctx.fillRect(x - 2, y - 40, 4, 40)
    px(ctx, x - 2, y - h / 2 - 6, 4, 3, '#3fe0ff')
  }
  if (c.hp < c.maxHp) {
    px(ctx, x - s / 2, y - h / 2 - 8, s, 2, '#1b1f26')
    px(ctx, x - s / 2, y - h / 2 - 8, Math.max(1, s * (c.hp / c.maxHp)), 2, glow)
  }
}

// ---------- ПОДБОР ----------
export function drawPickup(ctx: CanvasRenderingContext2D, p: { x: number; y: number; kind: 'coin' | 'weapon' | 'armor' | 'heart' | 'upgrade'; color: string; phase: number; slot?: number }, t: number) {
  const y = p.y + Math.sin(t * 4 + p.phase) * 1.6
  if (p.kind === 'coin') {
    shadow(ctx, p.x, p.y + 3, 3, 1.2)
    px(ctx, p.x - 2, y - 2, 4, 4, '#f5a623')
    px(ctx, p.x - 2, y - 2, 4, 1, '#ffd54a')
    px(ctx, p.x - 1, y - 1, 2, 2, '#c97e12')
  } else if (p.kind === 'heart') {
    shadow(ctx, p.x, p.y + 3, 3.4, 1.3)
    ctx.fillStyle = 'rgba(255,90,122,0.25)'
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill()
    px(ctx, p.x - 4, y - 3, 3, 2, '#ff5a7a'); px(ctx, p.x + 1, y - 3, 3, 2, '#ff5a7a')
    px(ctx, p.x - 4, y - 1, 8, 2, '#ff5a7a')
    px(ctx, p.x - 3, y + 1, 6, 1, '#ff5a7a')
    px(ctx, p.x - 2, y + 2, 4, 1, '#ff5a7a')
    px(ctx, p.x - 1, y + 3, 2, 1, '#ff5a7a')
    px(ctx, p.x - 4, y - 3, 3, 1, '#ff9fb2')
    if (Math.sin(t * 6 + p.phase) > 0.5) { px(ctx, p.x + 4, y - 4, 1, 3, '#ffffff'); px(ctx, p.x + 3, y - 3, 3, 1, '#ffffff') }
  } else if (p.kind === 'upgrade') {
    shadow(ctx, p.x, p.y + 4, 5, 1.6)
    ctx.fillStyle = p.color + '33'
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8, 5, 0, 0, Math.PI * 2); ctx.fill()
    px(ctx, p.x - 4, y - 3, 8, 6, '#222a33')
    px(ctx, p.x - 2, y - 1, 4, 2, p.color)
    px(ctx, p.x - 1, y - 1, 2, 2, '#ffffff')
    px(ctx, p.x - 3, y - 5, 1, 2, '#8a96a3'); px(ctx, p.x, y - 5, 1, 2, '#8a96a3'); px(ctx, p.x + 3, y - 5, 1, 2, '#8a96a3')
    px(ctx, p.x - 3, y + 3, 1, 2, '#8a96a3'); px(ctx, p.x, y + 3, 1, 2, '#8a96a3'); px(ctx, p.x + 3, y + 3, 1, 2, '#8a96a3')
  } else {
    shadow(ctx, p.x, p.y + 4, 5, 1.6)
    ctx.fillStyle = p.color + '30'
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8, 5, 0, 0, Math.PI * 2); ctx.fill()
    if (p.kind === 'weapon') {
      px(ctx, p.x - 6, y - 2, 10, 3, '#39424e')
      px(ctx, p.x + 3, y - 2, 3, 2, p.color)
      px(ctx, p.x - 4, y - 3, 3, 1, p.color)
    } else {
      if (p.slot === 0) { px(ctx, p.x - 3, y - 4, 6, 5, p.color); px(ctx, p.x - 2, y - 2, 4, 1, '#0f141b') }
      else if (p.slot === 1) { px(ctx, p.x - 3, y - 4, 6, 7, p.color); px(ctx, p.x - 1, y - 3, 2, 4, 'rgba(0,0,0,0.3)') }
      else if (p.slot === 2) { px(ctx, p.x - 3, y - 2, 2, 4, p.color); px(ctx, p.x + 1, y - 2, 2, 4, p.color) }
      else { px(ctx, p.x - 3, y - 1, 2, 4, p.color); px(ctx, p.x + 1, y - 1, 2, 4, p.color) }
    }
    if (Math.sin(t * 6 + p.phase) > 0.5) { ctx.fillStyle = p.color + '55'; ctx.fillRect(p.x - 1, y - 8, 2, 2) }
  }
}

// ---------- ГРУЗ ГИЛЬДИИ / ШАТТЛ ----------
export function drawGuildPod(ctx: CanvasRenderingContext2D, p: { x: number; y: number; opened: boolean }, t: number) {
  const { x, y } = p
  shadow(ctx, x, y + 7, 10, 3)
  if (!p.opened) { ctx.fillStyle = 'rgba(63,224,255,0.12)'; ctx.fillRect(x - 2, y - 46, 4, 46) }
  px(ctx, x - 8, y - 8, 16, 14, '#c9d4de')
  px(ctx, x - 8, y - 8, 16, 3, '#e8eef4')
  px(ctx, x - 8, y + 3, 16, 3, '#8a96a3')
  px(ctx, x - 10, y - 4, 2, 8, '#3fe0ff'); px(ctx, x + 8, y - 4, 2, 8, '#3fe0ff')
  px(ctx, x - 3, y - 5, 2, 2, '#f5a623'); px(ctx, x + 1, y - 5, 2, 2, '#f5a623')
  px(ctx, x - 1, y - 1, 2, 2, '#f5a623')
  if (!p.opened) {
    px(ctx, x - 1, y - 11, 2, 2, Math.sin(t * 5) > 0 ? '#3fe0ff' : '#1b4a5e')
    ctx.strokeStyle = `rgba(63,224,255,${0.5 + Math.sin(t * 5) * 0.3})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(x, y + 7, 12 + Math.sin(t * 5) * 2, 4, 0, 0, Math.PI * 2); ctx.stroke()
  } else {
    px(ctx, x - 6, y - 12, 12, 4, '#8a96a3')
  }
}

export function drawShuttle(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  for (const ey of [-6, 6]) {
    const fl = 6 + Math.sin(t * 40 + ey) * 3
    px(ctx, -34 - fl, ey - 2, fl, 4, 'rgba(255,138,61,0.8)')
    px(ctx, -34, ey - 3, 4, 6, '#39424e')
  }
  px(ctx, -32, -5, 52, 10, '#5e6e7e')
  px(ctx, -32, -5, 52, 2, '#8a96a3')
  px(ctx, 20, -3, 14, 6, '#5e6e7e')
  px(ctx, -20, -12, 22, 7, '#4a5568'); px(ctx, -20, 5, 22, 7, '#4a5568')
  px(ctx, -28, -1, 44, 2, '#f5a623')
  px(ctx, -6, -4, 8, 8, '#f5a623')
  px(ctx, -4, -2, 1, 1, '#0f141b'); px(ctx, -1, -2, 1, 1, '#0f141b'); px(ctx, -3, 0, 2, 1, '#0f141b')
  px(ctx, 22, -2, 8, 4, '#3fe0ff')
  ctx.restore()
}

export function drawFallingPod(ctx: CanvasRenderingContext2D, x: number, y: number, alt: number, t: number) {
  shadow(ctx, x, y + 4, 3 + (1 - alt) * 7, 1.2 + (1 - alt) * 2)
  const yy = y - alt * 110
  ctx.save()
  ctx.translate(Math.round(x), Math.round(yy))
  const fl = 3 + Math.sin(t * 50) * 2
  px(ctx, -3, 7, 6, fl + 3, 'rgba(255,138,61,0.85)')
  px(ctx, -7, -7, 14, 13, '#c9d4de')
  px(ctx, -7, -7, 14, 3, '#e8eef4')
  px(ctx, -9, -4, 2, 7, '#3fe0ff'); px(ctx, 7, -4, 2, 7, '#3fe0ff')
  px(ctx, -3, -4, 2, 2, '#f5a623'); px(ctx, 1, -4, 2, 2, '#f5a623')
  ctx.restore()
}

// ---------- ПУЛИ ----------
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
  } else if (b.kind === 'rocket') {
    const fl = 3 + Math.sin(t * 60) * 2
    px(ctx, -6 - fl, -1, fl + 2, 2, 'rgba(255,160,60,0.85)')
    px(ctx, -4, -2, 7, 4, '#5e6e7e'); px(ctx, 3, -1, 3, 2, b.color)
  } else if (b.kind === 'rail') {
    ctx.fillStyle = b.color + '66'; ctx.fillRect(-14, -1.5, 18, 3)
    px(ctx, -12, -1, 15, 2, b.color)
  } else {
    ctx.fillStyle = b.color + '55'; ctx.fillRect(-5, -1, 6, 2)
    px(ctx, -2, -1, 4, 2, b.color)
  }
  ctx.restore()
}

// ---------- СТРУКТУРЫ (POI) ----------
export function drawPoi(ctx: CanvasRenderingContext2D, poi: { type: string; x: number; y: number; state: string; dungeon?: unknown }, t: number, _hasDungeon: boolean) {
  const { x, y } = poi
  const cleared = poi.state === 'cleared'
  const hostile = poi.state === 'hostile'
  const blink = Math.sin(t * 3) > 0
  if (poi.type === 'settlement' || poi.type === 'outpost') {
    const c1 = poi.type === 'settlement' ? '#5e6e7e' : '#4a6e5e'
    const band = poi.type === 'settlement' ? '#f5a623' : '#7dff5e'
    shadow(ctx, x, y + 18, 34, 8)
    // купола
    for (const [dx, r] of [[-18, 10], [4, 13], [22, 8]] as [number, number][]) {
      for (let i = -r; i <= r; i++) {
        const hh = Math.sqrt(r * r - i * i)
        px(ctx, x + dx + i, y + 8 - hh * 0.8, 1, hh * 0.8 + 8, c1)
      }
      px(ctx, x + dx - r + 2, y + 2, r * 2 - 4, 2, 'rgba(255,255,255,0.12)')
    }
    px(ctx, x + 1, y - 6, 3, 3, blink && !cleared ? band : '#39424e')
    px(ctx, x - 30, y + 15, 60, 2, '#2c3540')
    // окна
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
    // костёр
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
    // трубы
    px(ctx, x + 16, y - 26, 6, 18, '#5e6e7e')
    px(ctx, x + 16, y - 26, 6, 2, '#8a96a3')
    if (!cleared && blink) { ctx.fillStyle = 'rgba(140,150,163,0.4)'; ctx.beginPath(); ctx.arc(x + 19, y - 30 - (t * 6 % 8), 3, 0, Math.PI * 2); ctx.fill() }
    // ворота
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
    // обломки
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
    // гермодверь
    px(ctx, x - 8, y - 2, 16, 14, '#222831')
    px(ctx, x - 6, y, 12, 10, poi.dungeon ? '#0f141b' : '#39424e')
    if (poi.dungeon && blink) px(ctx, x - 1, y + 3, 2, 4, '#c96bff')
    px(ctx, x - 20, y - 4, 5, 3, hostile && blink ? '#ff5533' : '#ffd54a')
    px(ctx, x + 15, y - 4, 5, 3, '#1b2b3a')
    // вентиляционные шахты
    px(ctx, x - 16, y - 16, 6, 6, '#39424e'); px(ctx, x + 10, y - 16, 6, 6, '#39424e')
  } else {
    // relay
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

// ---------- ТАЙЛЫ ДАНЖА ----------
export function drawDungeonTile(ctx: CanvasRenderingContext2D, wx: number, wy: number, tile: number, style: 'tech' | 'wreck' | 'vault', t: number, extra: { on?: boolean; broken?: boolean }) {
  const wall = style === 'wreck' ? '#4a4438' : style === 'vault' ? '#3c4450' : '#39424e'
  const wallTop = style === 'wreck' ? '#6e6450' : style === 'vault' ? '#5e6e7e' : '#5e6e7e'
  const floor = style === 'wreck' ? '#2a251e' : style === 'vault' ? '#1c222b' : '#202832'
  if (tile === 1) {
    px(ctx, wx, wy, 16, 16, wall)
    px(ctx, wx, wy, 16, 3, wallTop)
    px(ctx, wx, wy + 14, 16, 2, '#151a21')
    if ((Math.floor(wx / 16) + Math.floor(wy / 16)) % 2 === 0) px(ctx, wx + 7, wy + 7, 2, 2, '#151a21')
  } else if (tile === 0) {
    px(ctx, wx, wy, 16, 16, floor)
    ctx.strokeStyle = 'rgba(94,110,126,0.12)'
    ctx.strokeRect(wx + 0.5, wy + 0.5, 15, 15)
  } else if (tile === 2) {
    if (extra.on) {
      px(ctx, wx, wy, 16, 16, floor)
      px(ctx, wx, wy, 3, 16, wall); px(ctx, wx + 13, wy, 3, 16, wall)
    } else {
      px(ctx, wx, wy, 16, 16, '#5a2a1e')
      px(ctx, wx, wy, 16, 2, '#8a4a33')
      px(ctx, wx + 7, wy + 5, 2, 6, '#ffd54a')
      if (Math.sin(t * 4) > 0) px(ctx, wx + 6, wy + 2, 4, 2, '#ff5533')
    }
  } else if (tile === 3) {
    px(ctx, wx, wy, 16, 16, floor)
    px(ctx, wx + 4, wy + 3, 8, 10, '#222831')
    px(ctx, wx + 6, wy + 5, 4, 4, extra.on ? '#7dff5e' : '#3a2b12')
    px(ctx, wx + 7, wy + 11, 2, 2, extra.on ? '#7dff5e' : '#5e444a')
    if (extra.on && Math.sin(t * 6) > 0) { ctx.fillStyle = 'rgba(125,255,94,0.3)'; ctx.fillRect(wx + 2, wy + 1, 12, 14) }
  } else if (tile === 4) {
    px(ctx, wx, wy, 16, 16, '#5e5344')
    px(ctx, wx, wy, 16, 2, '#7a6a52')
    px(ctx, wx + 2, wy + 4, 5, 1, '#3a3226'); px(ctx, wx + 8, wy + 8, 6, 1, '#3a3226'); px(ctx, wx + 3, wy + 12, 6, 1, '#3a3226')
    if (Math.sin(t * 5) > 0.4) px(ctx, wx + 12, wy + 3, 2, 2, '#ffd54a')
  } else if (tile === 5) {
    px(ctx, wx, wy, 16, 16, floor)
    ctx.strokeStyle = 'rgba(255,85,51,0.35)'
    ctx.strokeRect(wx + 2.5, wy + 2.5, 11, 11)
    px(ctx, wx + 6, wy + 6, 4, 4, '#39424e')
    if (extra.on) {
      const k = Math.sin(t * 24) > 0 ? 1 : 0.6
      ctx.fillStyle = `rgba(255,85,51,${0.5 * k})`
      ctx.beginPath(); ctx.moveTo(wx + 8, wy + 8); ctx.lineTo(wx + 2, wy + 14); ctx.lineTo(wx + 14, wy + 14); ctx.closePath(); ctx.fill()
      ctx.fillStyle = `rgba(255,200,120,${0.7 * k})`
      ctx.fillRect(wx + 7, wy + 7, 2, 2)
    }
  }
}

// ---------- КОРАБЛЬ МЕНЮ (вид сбоку, для заставки) ----------
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
