// Боссы: архетип + фазы + телеграфы + награды
import type { ProjKind } from './data'

export interface BossAttackDef { name: string; telegraph: number; dmg: number }
export interface BossDef {
  id: string; name: string; title: string
  hp: number; speed: number; dmg: number; r: number
  proj: ProjKind; color: string; core: string; accent: string
  phases: { at: number; name: string; rateMult: number }[]
  attacks: BossAttackDef[]
  rewards: { credits: [number, number]; weaponRarity: number; permanentChance: number }
}

export const BOSSES: Record<string, BossDef> = {
  warden: {
    id: 'warden', name: 'ЦЕРБЕР', title: 'СТРАЖ КОМПЛЕКСА',
    hp: 900, speed: 34, dmg: 22, r: 13,
    proj: 'plasma', color: '#5e6e7e', core: '#ff5533', accent: '#ffd54a',
    phases: [
      { at: 1, name: 'ФАЗА 1: ОХРАННЫЙ РЕЖИМ', rateMult: 1 },
      { at: 0.6, name: 'ФАЗА 2: ПЕРЕГРЕВ ЯДРА', rateMult: 1.35 },
      { at: 0.3, name: 'ФАЗА 3: ПРОТОКОЛ ИСТРЕБЛЕНИЯ', rateMult: 1.7 },
    ],
    attacks: [
      { name: 'ТАРАН', telegraph: 0.5, dmg: 20 },
      { name: 'УДАР ЯДРА', telegraph: 0.7, dmg: 26 },
      { name: 'ОЧЕРЕДЬ', telegraph: 0.4, dmg: 10 },
      { name: 'КОЛЬЦО', telegraph: 0.5, dmg: 8 },
    ],
    rewards: { credits: [400, 700], weaponRarity: 3, permanentChance: 1 },
  },
}

export interface BossState {
  def: BossDef; x: number; y: number; hp: number; maxHp: number
  phase: number; atkCd: number; windup: number; windupX: number; windupY: number
  move: 'chase' | 'slam' | 'dash'; flash: number; aim: number; walkT: number
  summoned: boolean
}

export function makeBoss(def: BossDef, x: number, y: number): BossState {
  return { def, x, y, hp: def.hp, maxHp: def.hp, phase: 0, atkCd: 1.5, windup: 0, windupX: 0, windupY: 0, move: 'chase', flash: 0, aim: 0, walkT: 0, summoned: false }
}

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

export function drawBoss(ctx: CanvasRenderingContext2D, b: BossState, t: number) {
  const { x, y, def } = b
  const bob = Math.sin(b.walkT * 6) * 0.8
  const yy = y + bob
  // тень
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath(); ctx.ellipse(x, y + 12, 16, 5, 0, 0, Math.PI * 2); ctx.fill()
  // телеграфы
  if (b.move === 'slam' && b.windup > 0) {
    ctx.strokeStyle = `rgba(255,85,51,${0.4 + Math.sin(t * 30) * 0.3})`
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(b.windupX, b.windupY, 26, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(255,85,51,0.12)'
    ctx.beginPath(); ctx.arc(b.windupX, b.windupY, 26, 0, Math.PI * 2); ctx.fill()
  }
  if (b.move === 'dash' && b.windup > 0) {
    ctx.strokeStyle = 'rgba(255,138,61,0.5)'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(b.windupX, b.windupY); ctx.stroke()
  }
  // ноги-опоры
  const st = Math.sin(b.walkT * 8)
  px(ctx, x - 12, yy + 4 + Math.max(0, st * 2), 5, 8, '#2c3540')
  px(ctx, x + 7, yy + 4 + Math.max(0, -st * 2), 5, 8, '#2c3540')
  // корпус
  px(ctx, x - 14, yy - 10, 28, 16, def.color)
  px(ctx, x - 14, yy - 10, 28, 3, '#8a96a3')
  px(ctx, x - 14, yy + 3, 28, 3, '#2c3540')
  // бронеплиты по фазам
  const pl = b.phase >= 1 ? '#ff8a3d' : '#4a5568'
  px(ctx, x - 16, yy - 8, 3, 10, pl)
  px(ctx, x + 13, yy - 8, 3, 10, pl)
  if (b.phase >= 2) {
    px(ctx, x - 10, yy - 14, 3, 4, '#ff5533')
    px(ctx, x + 7, yy - 14, 3, 4, '#ff5533')
  }
  // ядро
  const pulse = 0.6 + Math.sin(t * (4 + b.phase * 4)) * 0.4
  ctx.fillStyle = def.core
  ctx.beginPath(); ctx.arc(x, yy - 2, 4 + pulse, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffd9a0'
  ctx.fillRect(x - 1, yy - 3, 2, 2)
  ctx.fillStyle = `rgba(255,85,51,${0.15 * pulse})`
  ctx.beginPath(); ctx.arc(x, yy - 2, 12, 0, Math.PI * 2); ctx.fill()
  // голова-сенсор
  px(ctx, x - 5, yy - 17, 10, 7, '#39424e')
  const eyeC = b.phase === 2 && Math.sin(t * 20) > 0 ? '#ffffff' : def.core
  px(ctx, x - 3, yy - 15, 6, 2, eyeC)
  // пушки
  ctx.save()
  ctx.translate(Math.round(x), Math.round(yy - 4))
  ctx.rotate(b.aim)
  px(ctx, 10, -6, 10, 3, '#39424e'); px(ctx, 18, -6, 3, 3, def.accent)
  px(ctx, 10, 3, 10, 3, '#39424e'); px(ctx, 18, 3, 3, 3, def.accent)
  ctx.restore()
  // вспышка урона
  if (b.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, b.flash * 8)})`
    ctx.fillRect(x - 16, yy - 18, 32, 32)
  }
}
