// Режиссёр сложности: calm -> active -> danger -> recover
import type { RegionDef } from './regions'

export type DirectorPhase = 'calm' | 'active' | 'danger' | 'recover'
const PHASE_DUR: Record<DirectorPhase, number> = { calm: 22, active: 32, danger: 18, recover: 12 }

export interface DirectorCtx {
  time: number; kills: number; playerPower: number; region: RegionDef
  inDungeon: boolean; enemyCount: number; nearHostilePoi: boolean
}
export interface SpawnDecision { allowed: boolean; interval: number; packSize: number; tier: number; eliteChance: number }

export class Director {
  phase: DirectorPhase = 'calm'
  phaseT = PHASE_DUR.calm
  danger = 0

  reset() { this.phase = 'calm'; this.phaseT = PHASE_DUR.calm; this.danger = 0 }

  update(dt: number, ctx: DirectorCtx) {
    this.phaseT -= dt
    const target = Math.min(1, (ctx.time / 600) * 0.5 + ctx.kills / 400 + (ctx.region.danger - 1) * 0.08)
    this.danger += (target - this.danger) * Math.min(1, dt * 0.05)
    if (this.phaseT <= 0) {
      const roll = Math.random()
      if (this.phase === 'calm') this.phase = roll < 0.7 ? 'active' : 'danger'
      else if (this.phase === 'active') this.phase = roll < 0.45 + this.danger * 0.3 ? 'danger' : 'calm'
      else if (this.phase === 'danger') this.phase = roll < 0.6 ? 'recover' : 'active'
      else this.phase = roll < 0.75 ? 'calm' : 'active'
      this.phaseT = PHASE_DUR[this.phase] * (0.85 + Math.random() * 0.3)
    }
  }

  decide(ctx: DirectorCtx): SpawnDecision {
    if (ctx.inDungeon) return { allowed: false, interval: 99, packSize: 0, tier: 1, eliteChance: 0 }
    const maxEnemies = ctx.nearHostilePoi ? 10 : 16
    if (ctx.enemyCount >= maxEnemies) return { allowed: false, interval: 2, packSize: 0, tier: 1, eliteChance: 0 }
    const tier = ctx.region.tier * (1 + this.danger * 0.6)
    let interval: number
    let packSize = 1
    let eliteChance = 0
    if (this.phase === 'calm') { interval = 7.5 - this.danger * 2; if (Math.random() < 0.4) interval = 99 }
    else if (this.phase === 'active') { interval = 4.2 - this.danger * 1.4; packSize = Math.random() < 0.35 ? 2 : 1; eliteChance = 0.08 + this.danger * 0.1 }
    else if (this.phase === 'danger') { interval = 2.4 - this.danger * 0.8; packSize = Math.random() < 0.5 ? 2 : Math.random() < 0.25 ? 3 : 1; eliteChance = 0.18 + this.danger * 0.15 }
    else { interval = 9; if (Math.random() < 0.6) interval = 99 }
    return { allowed: true, interval: Math.max(1.1, interval), packSize, tier, eliteChance }
  }
}
