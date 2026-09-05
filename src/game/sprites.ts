// ============================================================
// НАЁМНИК ПУСТОТЫ — процедурный пиксель-арт (canvas, без ассетов)
// ============================================================

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

// ---------- ИГРОК (3/4 сверху) ----------
export function drawPlayer(ctx: CanvasRenderingContext2D, p: { x: number; y: number; aim: number; walkT: number; slashT: number; dashT: number; chestColor: string; weaponColor: string }, t: number) {
  const { x, y } = p
  const step = Math.sin(p.walkT * 11) * 1.4
  shadow(ctx, x, y + 5, 6, 2.4)
  if (p.dashT > 0) {
    ctx.fillStyle = 'rgba(63,224,255,0.25)'
    ctx.fillRect(x - 10, y - 6, 20, 12)
  }
  px(ctx, x - 3, y + 1 + Math.max(0, step), 2, 4, '#2c3540')
  px(ctx, x + 1, y + 1 + Math.max(0, -step), 2, 4, '#2c3540')
  px(ctx, x - 3, y + 4 + Math.max(0, step), 2, 1, '#1b2129')
  px(ctx, x + 1, y + 4 + Math.max(0, -step), 2, 1, '#1b2129')
  px(ctx, x - 5, y - 5, 2, 6, '#4a5568')
  px(ctx, x - 5, y - 5, 2, 1, '#3fe0ff')
  px(ctx, x - 4, y - 6, 8, 8, p.chestColor)
  px(ctx, x - 4, y - 6, 8, 2, 'rgba(255,255,255,0.18)')
  px(ctx, x - 4, y + 1, 8, 1, 'rgba(0,0,0,0.3)')
  px(ctx, x - 1, y - 5, 2, 5, 'rgba(0,0,0,0.22)')
  px(ctx, x - 6, y - 6, 2, 3, '#f5a623')
  px(ctx, x + 4, y - 6, 2, 3, '#f5a623')
  px(ctx, x - 3, y - 11, 6, 5, '#5e6e7e')
  px(ctx, x - 3, y - 11, 6, 1, '#7e8e9e')
  px(ctx, x - 2, y - 9, 4, 2, '#3fe0ff')
  px(ctx, x - 2, y - 9, 4, 1, '#baf3ff')
  px(ctx, x - 3, y - 7, 6, 1, '#3a4652')
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y - 3))
  ctx.rotate(p.aim)
  px(ctx, 2, -1, 9, 3, '#39424e')
  px(ctx, 9, -1, 3, 2, p.weaponColor)
  px(ctx, 3, -2, 3, 1, p.weaponColor)
  px(ctx, 2, 2, 2, 2, '#222a33')
  ctx.restore()
  if (p.slashT > 0) {
    const k = p.slashT / 0.2
    ctx.save()
    ctx.translate(Math.round(x), Math.round(y - 2))
    ctx.rotate(p.aim)
    ctx.fillStyle = `rgba(120,255,240,${0.5 * k})`
    ctx.beginPath()
    ctx.moveTo(4, 0)
    ctx.arc(0, 0, 20, -1.0 - (1 - k) * 0.5, 1.0 + (1 - k) * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = `rgba(220,255,250,${0.8 * k})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, 0, 19, -0.9, 0.9)
    ctx.stroke()
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

// ---------- КОМПАНЬОНЫ ----------
export function drawCompanion(ctx: CanvasRenderingContext2D, c: { x: number; y: number; kind: string; body: number; pal: { main: string; dark: string; accent: string }; walkT: number; aim: number; phase: number }, t: number) {
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
    ctx.save(); ctx.translate(Math.round(x), Math.round(yy - 2)); ctx.rotate(c.aim)
    px(ctx, 3, -1, 6, 2, pal.dark); px(ctx, 8, -1, 2, 2, pal.accent)
    ctx.restore()
  } else if (c.kind === 'tank') {
    shadow(ctx, x, y + 5, 7, 2.4)
    const tr = ((c.walkT * 20) | 0) % 2
    px(ctx, x - 7, y + 1, 14, 4, '#222831')
    for (let i = 0; i < 6; i++) px(ctx, x - 6 + i * 2 + (tr ? 1 : 0), y + 2, 1, 2, '#4a5560')
    px(ctx, x - 6, y - 4, 12, 6, pal.main)
    px(ctx, x - 6, y - 4, 12, 1, 'rgba(255,255,255,0.14)')
    px(ctx, x - 3, y - 7, 7, 4, pal.dark)
    ctx.save(); ctx.translate(Math.round(x), Math.round(y - 5)); ctx.rotate(c.aim)
    px(ctx, 3, -1, 8, 2, pal.dark); px(ctx, 10, -1, 2, 2, pal.accent)
    ctx.restore()
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
    px(ctx, x - 5, yy - 3, 10, 1, 'rgba(255,255,255,0.15)')
    px(ctx, x - 3, yy - 6, 6, 3, pal.dark)
    px(ctx, x - 1, yy - 5, 2, 1, pal.accent)
    ctx.save(); ctx.translate(Math.round(x), Math.round(yy - 4)); ctx.rotate(c.aim)
    px(ctx, 3, -1, 9, 2, pal.dark); px(ctx, 6, -2, 2, 1, pal.accent); px(ctx, 11, -1, 2, 2, pal.accent)
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

// ---------- ПОДБОР ----------
export function drawPickup(ctx: CanvasRenderingContext2D, p: { x: number; y: number; kind: 'coin' | 'weapon' | 'armor' | 'heart' | 'upgrade'; color: string; phase: number; slot?: number }, t: number) {
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
    const pulse = Math.sin(t * 6 + p.phase)
    if (pulse > 0.5) { px(ctx, p.x + 4, y - 4, 1, 3, '#ffffff'); px(ctx, p.x + 3, y - 3, 3, 1, '#ffffff') }
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
    if (Math.sin(t * 6 + p.phase) > 0.4) {
      ctx.fillStyle = p.color + '66'
      ctx.fillRect(p.x - 1, y - 8, 2, 2)
    }
  } else {
    shadow(ctx, p.x, p.y + 4, 5, 1.6)
    ctx.fillStyle = p.color + '30'
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8, 5, 0, 0, Math.PI * 2); ctx.fill()
    if (p.kind === 'weapon') {
      px(ctx, p.x - 6, y - 2, 10, 3, '#39424e')
      px(ctx, p.x + 3, y - 2, 3, 2, p.color)
      px(ctx, p.x - 4, y - 3, 3, 1, p.color)
      px(ctx, p.x - 3, y + 1, 2, 2, '#222a33')
    } else {
      if (p.slot === 0) { px(ctx, p.x - 3, y - 4, 6, 5, p.color); px(ctx, p.x - 2, y - 2, 4, 1, '#0f141b') }
      else if (p.slot === 1) { px(ctx, p.x - 3, y - 4, 6, 7, p.color); px(ctx, p.x - 1, y - 3, 2, 4, 'rgba(0,0,0,0.3)') }
      else if (p.slot === 2) { px(ctx, p.x - 3, y - 2, 2, 4, p.color); px(ctx, p.x + 1, y - 2, 2, 4, p.color) }
      else { px(ctx, p.x - 3, y - 1, 2, 4, p.color); px(ctx, p.x + 1, y - 1, 2, 4, p.color); px(ctx, p.x - 3, y + 2, 3, 1, '#222a33'); px(ctx, p.x + 1, y + 2, 3, 1, '#222a33') }
    }
    if (Math.sin(t * 6 + p.phase) > 0.5) {
      ctx.fillStyle = p.color + '55'
      ctx.fillRect(p.x - 1, y - 8, 2, 2)
    }
  }
}

// ---------- ГРУЗ ГИЛЬДИИ ----------
export function drawGuildPod(ctx: CanvasRenderingContext2D, p: { x: number; y: number; opened: boolean }, t: number) {
  const { x, y } = p
  shadow(ctx, x, y + 7, 10, 3)
  if (!p.opened) {
    ctx.fillStyle = 'rgba(63,224,255,0.12)'
    ctx.fillRect(x - 2, y - 46, 4, 46)
  }
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

// ---------- ШАТТЛ ГИЛЬДИИ (экранные координаты) ----------
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

// ---------- ПАДАЮЩАЯ КАПСУЛА ----------
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

// ---------- ПУЛИ ----------
export function drawBullet(ctx: CanvasRenderingContext2D, b: { x: number; y: number; vx: number; vy: number; kind: string; color: string; friendly: boolean }, t: number) {
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

// ---------- КОРАБЛЬ МЕНЮ (вид сбоку) ----------
export function drawMenuShip(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, beam: number) {
  ctx.save()
  ctx.translate(Math.round(cx), Math.round(cy + Math.sin(t * 1.4) * 3))
  const sc = 2.2
  ctx.scale(sc, sc)
  for (const ey of [-10, 10]) {
    const fl = 10 + Math.sin(t * 30 + ey) * 4 + Math.sin(t * 47) * 2
    ctx.fillStyle = 'rgba(63,224,255,0.5)'
    ctx.beginPath()
    ctx.moveTo(-52, ey - 4); ctx.lineTo(-52 - fl, ey); ctx.lineTo(-52, ey + 4)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#baf3ff'
    ctx.beginPath()
    ctx.moveTo(-52, ey - 2); ctx.lineTo(-52 - fl * 0.55, ey); ctx.lineTo(-52, ey + 2)
    ctx.closePath(); ctx.fill()
    px(ctx, -52, ey - 5, 6, 10, '#39424e')
    px(ctx, -52, ey - 5, 6, 2, '#5e6e7e')
  }
  px(ctx, -48, -16, 86, 32, '#5e6e7e')
  px(ctx, -48, -16, 86, 4, '#8a96a3')
  px(ctx, -48, 12, 86, 4, '#39424e')
  px(ctx, 38, -10, 16, 20, '#5e6e7e')
  px(ctx, 54, -6, 10, 12, '#8a96a3')
  px(ctx, 64, -3, 6, 6, '#c9d4de')
  ctx.fillStyle = '#4a5568'
  ctx.beginPath(); ctx.moveTo(70, -3); ctx.lineTo(84, 0); ctx.lineTo(70, 3); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#4a5568'
  ctx.beginPath(); ctx.moveTo(-30, -16); ctx.lineTo(-8, -30); ctx.lineTo(6, -30); ctx.lineTo(10, -16); ctx.closePath(); ctx.fill()
  px(ctx, -8, -32, 14, 3, '#f5a623')
  ctx.fillStyle = '#39424e'
  ctx.beginPath(); ctx.moveTo(-26, 16); ctx.lineTo(-12, 26); ctx.lineTo(2, 26); ctx.lineTo(4, 16); ctx.closePath(); ctx.fill()
  for (let i = 0; i < 5; i++) px(ctx, -44 + i * 18, -14, 1, 28, 'rgba(0,0,0,0.16)')
  px(ctx, -46, -6, 80, 2, 'rgba(0,0,0,0.14)')
  px(ctx, -46, 4, 80, 1, 'rgba(255,255,255,0.08)')
  px(ctx, -40, 7, 70, 3, '#f5a623')
  px(ctx, -40, -13, 30, 2, '#f5a623')
  for (const ix of [-34, -24, -14]) {
    px(ctx, ix, -11, 4, 4, '#1b2b3a')
    px(ctx, ix, -11, 4, 1, Math.sin(t * 3 + ix) > 0.3 ? '#ffd54a' : '#3a2b12')
  }
  // === КАБИНА С НАЁМНИКОМ ===
  px(ctx, 18, -12, 22, 16, '#274b5e')
  px(ctx, 18, -12, 22, 2, '#baf3ff')
  px(ctx, 40, -10, 3, 12, '#baf3ff')
  px(ctx, 26, -2, 8, 8, '#3a4652')
  px(ctx, 27, -3, 6, 2, '#f5a623')
  px(ctx, 27, -8, 6, 6, '#5e6e7e')
  px(ctx, 28, -7, 4, 3, '#f5a623')
  px(ctx, 28, -7, 4, 1, '#ffd9a0')
  px(ctx, 33, 1, 4, 2, '#3a4652')
  px(ctx, 36, 0, 2, 4, '#222a33')
  ctx.fillStyle = 'rgba(186,243,255,0.25)'
  ctx.beginPath(); ctx.moveTo(20, -11); ctx.lineTo(26, -11); ctx.lineTo(21, 2); ctx.lineTo(19, 2); ctx.closePath(); ctx.fill()
  px(ctx, 18, -12, 1, 16, '#8a96a3'); px(ctx, 18, 3, 22, 1, '#8a96a3')
  px(ctx, -2, -38, 1, 8, '#8a96a3')
  if (Math.sin(t * 4) > 0) px(ctx, -3, -40, 3, 2, '#ff5533')
  px(ctx, -20, 16, 3, 8, '#39424e'); px(ctx, -24, 23, 10, 2, '#39424e')
  px(ctx, 24, 16, 3, 8, '#39424e'); px(ctx, 20, 23, 10, 2, '#39424e')
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
    ctx.fillStyle = `rgba(255,255,255,${0.5 * beam})`
    ctx.fillRect(cx - bw / 5, cy + 40, (bw * 2) / 5, 230)
  }
}
