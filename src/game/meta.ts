// Мета-слой: Permanent Inventory (корабль, переживает смерть) vs Expedition Inventory (временный)
export interface PermItem { uid: string; id: string; name: string; kind: 'artifact' | 'blueprint' | 'weapon' | 'module'; rarity: number; desc: string; color: string; acquired: number }
export interface PermCompanion { uid: string; defKind: string; name: string; rarity: number; color: string }
export interface MetaStats { expeditions: number; kills: number; bosses: number; bestKills: number }
export interface MetaState {
  version: number; credits: number; artifacts: PermItem[]; blueprints: string[]
  companions: PermCompanion[]; deployed: string[]; unlocked: string[]
  settings: { muted: boolean }; stats: MetaStats
  /** §46 WORLD STATE: зачищенные структуры и открытые точки высадки */
  clearedPois: string[]
  discoveredSites: string[]
}

/** Абстрактный порт сохранения — позже заменяется на Yandex Games Cloud save */
export interface SavePort { load(): MetaState | null; save(s: MetaState): void }

export class LocalSavePort implements SavePort {
  private key = 'mepixel-slasher-save-v1'
  load(): MetaState | null {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return null
      const p = JSON.parse(raw) as MetaState
      return p && p.version === 1 ? p : null
    } catch { return null }
  }
  save(s: MetaState): void { try { localStorage.setItem(this.key, JSON.stringify(s)) } catch { /* приватный режим */ } }
}

function defaultMeta(): MetaState {
  return { version: 1, credits: 0, artifacts: [], blueprints: [], companions: [], deployed: [], unlocked: [], settings: { muted: false }, stats: { expeditions: 0, kills: 0, bosses: 0, bestKills: 0 }, clearedPois: [], discoveredSites: [] }
}

let uidC = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(uidC++).toString(36)}`

class MetaApi {
  state: MetaState = defaultMeta()
  private port: SavePort = new LocalSavePort()
  boot(): void {
    const l = this.port.load()
    if (l) this.state = { ...defaultMeta(), ...l, clearedPois: l.clearedPois ?? [], discoveredSites: l.discoveredSites ?? [] }
  }
  persist(): void { this.port.save(this.state) }

  // ---------- §46 WORLD STATE ----------
  isClearedPoi(id: string): boolean { return this.state.clearedPois.includes(id) }
  addClearedPoi(id: string): void {
    if (!this.state.clearedPois.includes(id)) { this.state.clearedPois.push(id); this.persist() }
  }
  isDiscoveredSite(key: string): boolean { return this.state.discoveredSites.includes(key) }
  addDiscoveredSite(key: string): void {
    if (!this.state.discoveredSites.includes(key)) { this.state.discoveredSites.push(key); this.persist() }
  }
  addArtifact(def: Omit<PermItem, 'uid' | 'acquired'>): { item: PermItem | null; converted: number } {
    if (this.state.artifacts.some((a) => a.id === def.id)) {
      const cr = 200 + def.rarity * 150
      this.state.credits += cr
      this.persist()
      return { item: null, converted: cr }
    }
    const item: PermItem = { ...def, uid: uid('art'), acquired: Date.now() }
    this.state.artifacts.push(item)
    this.persist()
    return { item, converted: 0 }
  }
  addBlueprint(id: string, compDefKind: string, name: string, rarity: number, color: string): PermCompanion | null {
    if (this.state.blueprints.includes(id)) { this.state.credits += 300; this.persist(); return null }
    this.state.blueprints.push(id)
    const comp: PermCompanion = { uid: uid('cmp'), defKind: compDefKind, name, rarity, color }
    this.state.companions.push(comp)
    this.persist()
    return comp
  }
  toggleDeploy(cUid: string, max: number): boolean {
    const i = this.state.deployed.indexOf(cUid)
    if (i >= 0) this.state.deployed.splice(i, 1)
    else { if (this.state.deployed.length >= max) return false; this.state.deployed.push(cUid) }
    this.persist()
    return true
  }
  earnCredits(n: number): void { this.state.credits += n; this.persist() }
  bumpStats(kills: number, bosses: number): void {
    this.state.stats.expeditions += 1
    this.state.stats.kills += kills
    this.state.stats.bosses += bosses
    this.state.stats.bestKills = Math.max(this.state.stats.bestKills, kills)
    this.persist()
  }
  reset(): void { this.state = defaultMeta(); this.persist() }
}

export const metaApi = new MetaApi()

export const PERMANENT_POOL: { id: string; name: string; kind: 'artifact' | 'blueprint'; rarity: number; desc: string; color: string; compDefKind?: string }[] = [
  { id: 'core_warden', name: 'ЯДРО СТРАЖА', kind: 'artifact', rarity: 4, desc: '+12% к урону во всех экспедициях', color: '#ff8a3d' },
  { id: 'gyro_void', name: 'ГИРО-ПУСТОТЫ', kind: 'artifact', rarity: 3, desc: '+8% точность, +8% темп огня', color: '#3fe0ff' },
  { id: 'cell_isotope', name: 'ИЗОТОПНАЯ ЯЧЕЙКА', kind: 'artifact', rarity: 3, desc: '+25 к макс. целостности', color: '#b6ff2e' },
  { id: 'bp_protomech', name: 'ЧЕРТЁЖ «ПРОТО-МЕХ»', kind: 'blueprint', rarity: 4, desc: 'Постоянный компаньон ПРОТО-МЕХ в отсек корабля', color: '#c96bff', compDefKind: 'mech' },
]

export function artifactBonuses(artifacts: PermItem[]): { hp: number; dmg: number; rate: number; acc: number } {
  const b = { hp: 0, dmg: 0, rate: 0, acc: 0 }
  for (const a of artifacts) {
    if (a.id === 'core_warden') b.dmg += 12
    if (a.id === 'gyro_void') { b.acc += 8; b.rate += 8 }
    if (a.id === 'cell_isotope') b.hp += 25
  }
  return b
}
