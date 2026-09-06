import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Engine } from './game/engine'
import { RARITIES, COMP_UPGRADES, MANUFACTURERS } from './game/data'
import { REGIONS } from './game/regions'
import { POI_DEFS, type PoiType } from './game/structures'
import { metaApi } from './game/meta'
import { audio } from './game/audio'

interface WeaponSnap { name: string; rarity: number; color: string; dmg: number; rate: number; mag: number; acc: number; proj: string; parts: string[]; explosive: number; pellets: number; pierce: boolean; score: number }
interface Snap {
  mode: 'ship' | 'game'; overlay: 'map' | 'storage' | 'bay' | 'info' | 'inventory' | null
  paused: boolean; muted: boolean; prompt: string
  hp: number; maxHp: number; credits: number; kills: number; nextDrop: number; dropProg: number; milestoneIdx: number
  biome: string; regionName: string; regionColor: string; directorPhase: string
  weapons: WeaponSnap[]; cur: number; mag: number; magSize: number; reload: number; reloading: boolean; dash: number
  companions: { label: string; color: string; weapon: string | null; perm: boolean }[]
  companionsCount: number; time: number
  armor: ({ name: string; color: string; rarity: number } | null)[]
  compUpgrades: number[]
  boss: { name: string; title: string; hp: number; maxHp: number; phase: number } | null
  runPermanents: string[]; debugOpen: boolean; god: boolean
  meta: {
    credits: number
    artifacts: { name: string; desc: string; color: string; rarity: number }[]
    companions: { uid: string; name: string; color: string; rarity: number }[]
    deployed: string[]
    stats: { expeditions: number; kills: number; bosses: number; bestKills: number }
  }
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function Bar({ v, max, color, h = 'h-2' }: { v: number; max: number; color: string; h?: string }) {
  return (
    <div className={`w-full ${h} bg-[#0a0f16] border border-[#1e2a38]`}>
      <div className="h-full transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} />
    </div>
  )
}

const PHASE_RU: Record<string, { t: string; c: string }> = {
  calm: { t: 'СПОКОЙНО', c: '#3fe0ff' },
  active: { t: 'АКТИВНОСТЬ', c: '#ffd54a' },
  danger: { t: 'ОПАСНО', c: '#ff5533' },
  recover: { t: 'ЗАТИШЬЕ', c: '#7dff5e' },
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const engRef = useRef<Engine | null>(null)
  const [screen, setScreen] = useState<'ship' | 'game'>('ship')
  const [snap, setSnap] = useState<Snap | null>(null)
  const [paused, setPaused] = useState(false)
  const [death, setDeath] = useState<{ kills: number; credits: number; time: number; companions: number; permanents: string[] } | null>(null)
  const [toasts, setToasts] = useState<{ id: number; text: string; color: string }[]>([])
  const tid = useRef(0)

  useEffect(() => {
    const eng = new Engine(canvasRef.current!, miniRef.current!, {
      onSnap: (s) => setSnap(s as unknown as Snap),
      onStart: () => { setScreen('game'); setDeath(null); setPaused(false) },
      onDeath: (s) => setDeath(s as { kills: number; credits: number; time: number; companions: number; permanents: string[] }),
      onPause: (p) => setPaused(p),
      onToast: ({ text, color }) => {
        const id = ++tid.current
        setToasts((ts) => [...ts.slice(-3), { id, text, color: color || '#ffffff' }])
        window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2800)
      },
    })
    engRef.current = eng
    if (document.fonts?.load) document.fonts.load('8px "Press Start 2P"').catch(() => {})
    return () => eng.destroy()
  }, [])

  // синхронизация React-экрана с режимом движка (возврат на корабль, эвакуация)
  useEffect(() => {
    if (snap && snap.mode !== screen) {
      setScreen(snap.mode)
      if (snap.mode === 'ship') { setDeath(null); setPaused(false) }
    }
  }, [snap, screen])

  const eng = () => engRef.current!
  const launch = (regionId: string, site: number) => { audio.ensure(); audio.click(); eng().launchExpedition(regionId, site) }
  const toShip = () => { audio.click(); eng().returnToShip() }
  const revive = () => { audio.ensure(); audio.click(); eng().launchExpedition(eng().region.id) }

  const w = snap?.weapons?.[snap.cur]

  return (
    <div className="fixed inset-0 bg-[#05070f] overflow-hidden select-none">
      <canvas ref={canvasRef} className={`w-full h-full block ${screen === 'game' ? 'cursor-none' : ''}`} style={{ imageRendering: 'pixelated' }} />

      <div className="pointer-events-none fixed inset-0 z-40 opacity-[0.14]" style={{ background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.9) 2px 3px)' }} />
      <div className="pointer-events-none fixed inset-0 z-40" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(3,6,12,0.55) 100%)' }} />

      <canvas ref={miniRef} width={132} height={132} className="hidden" />

      {/* ==================== КОРАБЛЬ: верхняя панель ==================== */}
      {screen === 'ship' && snap && (
        <div className="fixed inset-x-0 top-0 z-50 pointer-events-none font-body p-3 flex items-start justify-between gap-3">
          <div className="panel px-4 py-3 pointer-events-auto">
            <div className="font-display text-[10px] text-[#e8f4ff]">БАРЖА «ВОЛЬНЫЙ ПИК»</div>
            <div className="font-display text-[6px] text-[#5e7a90] mt-1.5">СИСТЕМА КРАЙ-7 • ФИЛИАЛ ГИЛЬДИИ НАЁМНИКОВ</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="panel px-4 py-2 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 0L10 3v5L5.5 11 1 8V3z" fill="#f5a623" /><path d="M5.5 2L8 3.7v3.6L5.5 9 3 7.3V3.7z" fill="#ffd54a" /></svg>
                <span className="font-display text-[10px] text-[#ffd54a]">{snap.meta.credits}</span>
              </div>
              <span className="font-display text-[6px] text-[#5e7a90]">ЭКСПЕДИЦИЙ: {snap.meta.stats.expeditions}</span>
              <button onClick={() => { audio.toggleMute(); metaApi.state.settings.muted = audio.muted; metaApi.persist() }} className="pointer-events-auto font-display text-[7px] text-[#5e7a90] hover:text-[#3fe0ff] border border-[#1e2a38] px-1.5 py-1">
                {snap.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ'}
              </button>
            </div>
            {snap.prompt && (
              <div className="panel px-4 py-2 animate-blink" style={{ borderColor: '#3fe0ff55' }}>
                <span className="font-display text-[8px] text-[#3fe0ff]">{snap.prompt}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {screen === 'ship' && (
        <div className="fixed bottom-3 left-3 z-50 panel px-3 py-2 font-body pointer-events-none">
          <span className="font-display text-[6px] text-[#3a4f63]">WASD — ДВИЖЕНИЕ ПО ПАЛУБЕ • E — ВЗАИМОДЕЙСТВИЕ</span>
        </div>
      )}

      {/* ==================== HUD ЭКСПЕДИЦИИ ==================== */}
      {screen === 'game' && snap && !death && (
        <div className="fixed inset-0 z-50 pointer-events-none font-body">
          <div className="absolute top-2 left-2 right-2 flex items-start gap-2">
            <div className="panel px-3 py-2.5 w-[216px] shrink-0 max-w-[44vw]">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="font-display text-[7px] text-[#5e7a90]">ЦЕЛОСТНОСТЬ</span>
                <span className={`font-display text-[10px] ${snap.hp / snap.maxHp < 0.3 ? 'text-[#ff5533] animate-blink' : 'text-[#7dff5e]'}`}>{snap.hp}<span className="text-[#5e7a90] text-[7px]">/{snap.maxHp}</span></span>
              </div>
              <Bar v={snap.hp} max={snap.maxHp} color={snap.hp / snap.maxHp < 0.3 ? '#ff5533' : 'linear-gradient(90deg,#3fae5a,#7dff5e)'} />
              <div className="flex items-center gap-2 mt-2">
                <span className="font-display text-[6px] text-[#5e7a90] w-10">РЫВОК</span>
                <div className="flex-1"><Bar v={snap.dash} max={1} color="#3fe0ff" h="h-1.5" /></div>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="w-1.5 h-1.5 shrink-0" style={{ background: snap.regionColor }} />
                <span className="font-display text-[6px] tracking-wider" style={{ color: snap.regionColor }}>{snap.regionName}</span>
                <span className="font-display text-[7px] text-[#f5a623]">{snap.biome}</span>
                <span className="ml-auto font-display text-[7px] text-[#5e7a90]">{fmt(snap.time)}</span>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 max-w-[340px] mx-auto">
              <div className="panel px-4 py-2 w-full flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0"><path d="M2 2h10v6a5 5 0 0 1-10 0V2z" fill="none" stroke="#ff5533" strokeWidth="1.6" /><rect x="4" y="4" width="2" height="2" fill="#ff5533" /><rect x="8" y="4" width="2" height="2" fill="#ff5533" /></svg>
                <span className="font-display text-[11px] text-[#e8f4ff]">{snap.kills}</span>
                <div className="flex-1">
                  <div className="font-display text-[6px] text-[#5e7a90] mb-1 text-right">КОНТРАКТ · РУБЕЖ {snap.milestoneIdx + 1} · ЕЩЁ {Math.max(0, snap.nextDrop - snap.kills)}</div>
                  <Bar v={snap.dropProg} max={1} color="#f5a623" h="h-1.5" />
                </div>
              </div>
              {snap.boss && (
                <div className="boss-in panel px-4 py-2 w-full" style={{ borderColor: '#ff553388' }}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-display text-[8px] text-[#ff5533]">{snap.boss.name}</span>
                    <span className="font-display text-[6px] text-[#8a5a4a]">{snap.boss.title} · ФАЗА {snap.boss.phase + 1}/3</span>
                  </div>
                  <Bar v={snap.boss.hp} max={snap.boss.maxHp} color="linear-gradient(90deg,#a3200e,#ff5533)" />
                </div>
              )}
              <div className="flex flex-col items-center gap-1">
                {toasts.map((t) => (
                  <div key={t.id} className="toast-in font-display text-[7px] px-3 py-1.5 bg-[#0a111acc] border" style={{ color: t.color, borderColor: t.color + '55', textShadow: '2px 2px 0 rgba(0,0,0,0.8)' }}>
                    {t.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="panel px-3 py-2 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 0L10 3v5L5.5 11 1 8V3z" fill="#f5a623" /><path d="M5.5 2L8 3.7v3.6L5.5 9 3 7.3V3.7z" fill="#ffd54a" /></svg>
                  <span className="font-display text-[10px] text-[#ffd54a]">{snap.credits}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 11 11"><rect x="2" y="3" width="7" height="6" fill="#3fe0ff" /><rect x="3" y="1" width="2" height="2" fill="#3fe0ff" /><rect x="6" y="1" width="2" height="2" fill="#3fe0ff" /><rect x="1" y="9" width="9" height="1" fill="#3fe0ff" /></svg>
                  <span className="font-display text-[10px] text-[#3fe0ff]">{snap.companionsCount}</span>
                </div>
                <span className="font-display text-[6px]" style={{ color: PHASE_RU[snap.directorPhase]?.c }}>{PHASE_RU[snap.directorPhase]?.t}</span>
              </div>
              <div className="panel p-1.5"><MiniView miniRef={miniRef} /></div>
            </div>
          </div>

          <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2">
            <div className="hidden md:flex flex-col gap-2 w-[216px] shrink-0 max-w-[30vw]">
              <div className="panel px-3 py-2">
                <div className="font-display text-[6px] text-[#5e7a90] mb-1.5">ЭКИПИРОВКА <span className="text-[#3a4f63]">· TAB: ОТРЯД</span></div>
                <div className="grid grid-cols-4 gap-1.5">
                  {snap.armor.map((a, i) => (
                    <div key={i} className="h-8 border flex items-center justify-center" style={{ borderColor: a ? a.color + '88' : '#1e2a38', background: a ? a.color + '14' : '#0a0f16' }} title={a ? a.name : ['ШЛЕМ', 'НАГРУДНИК', 'ПЕРЧАТКИ', 'БОТИНКИ'][i] + ': пусто'}>
                      <span className="font-display text-[7px]" style={{ color: a ? a.color : '#2b3a4a' }}>{['ШЛ', 'НА', 'ПЕ', 'БО'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel px-3 py-2">
                <div className="font-display text-[6px] text-[#5e7a90] mb-1.5">МОДУЛИ ОТРЯДА</div>
                <div className="grid grid-cols-7 gap-1">
                  {COMP_UPGRADES.map((u, i) => {
                    const lv = snap.compUpgrades?.[i] || 0
                    return (
                      <div key={u.id} title={`${u.name} — ${u.desc} (ур. ${lv}/${u.max})`} className="h-8 border flex flex-col items-center justify-center gap-0.5" style={{ borderColor: lv > 0 ? u.color + '99' : '#1e2a38', background: lv > 0 ? u.color + '12' : '#0a0f16' }}>
                        <span className="font-display text-[6px] leading-none" style={{ color: lv > 0 ? u.color : '#2b3a4a' }}>{lv > 0 ? lv : '·'}</span>
                        <span className="flex gap-px">
                          {Array.from({ length: u.max }).map((_, j) => (
                            <span key={j} className="w-[3px] h-[3px]" style={{ background: j < lv ? u.color : '#1e2a38' }} />
                          ))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="panel px-3 py-1.5 w-fit">
                <span className="font-display text-[6px] text-[#3a4f63]">ЛКМ ОГОНЬ • ПКМ КЛИНОК • SHIFT РЫВОК • E ГРУЗ</span>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
              <div className="flex gap-1.5">
                {snap.weapons.map((wp, i) => {
                  const rar = RARITIES[wp.rarity]
                  const active = i === snap.cur
                  return (
                    <div key={i} className="group relative panel px-2.5 py-1.5 w-[94px] lg:w-[118px] shrink-0 transition-all duration-100" style={{ borderColor: active ? wp.color : '#1e2a38', background: active ? wp.color + '18' : '#0a111acc', transform: active ? 'translateY(-4px)' : 'none' }}>
                      <div className="flex items-center justify-between">
                        <span className="font-display text-[6px] text-[#5e7a90]">{i + 1}</span>
                        <span className="font-display text-[6px]" style={{ color: rar.color }}>{rar.short}</span>
                      </div>
                      <div className="font-display text-[8px] text-[#e8f4ff] mt-1 truncate">{wp.name}</div>
                      <div className="h-1 mt-1.5" style={{ background: active ? wp.color : '#2b3a4a' }} />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 panel p-2 w-[190px] z-10">
                        <div className="font-display text-[6px] text-[#5e7a90] mb-1">ДЕТАЛИ СБОРКИ · {wp.score} ОЧК.</div>
                        {wp.parts.map((p, j) => <div key={j} className="text-[10px] text-[#8fa5ba] leading-4">▸ {p}</div>)}
                        {wp.explosive > 0 && <div className="text-[10px] text-[#ff8a3d] leading-4">▸ ФУГАСНЫЙ ЗАРЯД</div>}
                        {wp.pierce && <div className="text-[10px] text-[#3dffc8] leading-4">▸ ПРОШИВАЕТ ЦЕЛИ</div>}
                      </div>
                    </div>
                  )
                })}
                {snap.weapons.length < 5 && (
                  <div className="panel px-2.5 py-1.5 w-[94px] lg:w-[118px] shrink-0 border-dashed hidden sm:flex items-center justify-center">
                    <span className="font-display text-[6px] text-[#2b3a4a]">СЛОТ {snap.weapons.length + 1} — ПУСТО</span>
                  </div>
                )}
              </div>
              <span className="font-display text-[6px] text-[#3a4f63]">КОЛЕСО МЫШИ — СМЕНА ОРУЖИЯ</span>
            </div>

            {w && (
              <div className="hidden md:block panel px-3 py-2.5 w-[200px] xl:w-[218px] shrink-0">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[8px]" style={{ color: RARITIES[w.rarity].color }}>{w.name}</span>
                  <span className="font-display text-[7px] text-[#5e7a90] uppercase">{w.proj === 'laser' ? 'ЛАЗЕР' : w.proj === 'rocket' ? 'РАКЕТЫ' : w.proj === 'plasma' ? 'ПЛАЗМА' : w.proj === 'rail' ? 'РЕЛЬСА' : 'ПУЛИ'}</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {[['УРОН', w.dmg, 70, '#ff5533'], ['ТЕМП', w.rate, 14, '#ffd54a'], ['ТОЧНОСТЬ', Math.round(w.acc * 100), 100, '#3fe0ff'], ['ОБОЙМА', w.mag, 45, '#7dff5e']].map(([l, v, m, c]) => (
                    <div key={l as string} className="flex items-center gap-2">
                      <span className="font-display text-[6px] text-[#5e7a90] w-[62px]">{l as string}</span>
                      <div className="flex-1"><Bar v={v as number} max={m as number} color={c as string} h="h-1.5" /></div>
                      <span className="font-display text-[7px] text-[#c9d8e6] w-7 text-right">{v as number}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t border-[#1e2a38] pt-1.5">
                  <span className="font-display text-[6px] text-[#5e7a90]">БОЕЗАПАС</span>
                  {snap.reloading ? (
                    <span className="font-display text-[9px] text-[#ffd54a] animate-blink">ПЕРЕЗАРЯДКА</span>
                  ) : (
                    <span className={`font-display text-[13px] ${snap.mag === 0 ? 'text-[#ff5533]' : 'text-[#e8f4ff]'}`}>{snap.mag}<span className="text-[7px] text-[#5e7a90]">/{snap.magSize}</span></span>
                  )}
                </div>
                <Bar v={snap.reloading ? snap.reload : snap.mag / Math.max(1, snap.magSize)} max={1} color={snap.reloading ? '#ffd54a' : w.color} h="h-1.5" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== ОВЕРЛЕИ ==================== */}
      {snap?.overlay === 'map' && <MapOverlay snap={snap} onLaunch={launch} onClose={() => eng().closeOverlay()} />}
      {snap?.overlay === 'storage' && (
        <Overlay title="ХРАНИЛИЩЕ И ТРОФЕИ" sub="ПОСТОЯННЫЕ ПРЕДМЕТЫ ПЕРЕЖИВАЮТ ЛЮБУЮ ЭКСПЕДИЦИЮ" onClose={() => eng().closeOverlay()}>
          <div className="font-display text-[7px] text-[#f5a623] mb-2">БАЛАНС ГИЛЬДИИ: {snap!.meta.credits} КРЕДИТОВ</div>
          {snap!.meta.artifacts.length === 0 && <div className="text-[12px] text-[#5e7a90]">Пока пусто. Артефакты добываются в комплексах — за боссами.</div>}
          <div className="space-y-2">
            {snap!.meta.artifacts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 border border-[#1e2a38] px-3 py-2" style={{ background: a.color + '0d' }}>
                <span className="w-3 h-3 shrink-0" style={{ background: a.color, boxShadow: `0 0 8px ${a.color}` }} />
                <div>
                  <div className="font-display text-[8px]" style={{ color: a.color }}>{a.name} <span className="text-[#5e7a90]">[{RARITIES[a.rarity].short}]</span></div>
                  <div className="text-[11px] text-[#8fa5ba]">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Overlay>
      )}
      {snap?.overlay === 'bay' && (
        <Overlay title="ОТСЕК ОТРЯДА" sub={`ПОСТОЯННЫЕ КОМПАНЬОНЫ · В ОТРЯДЕ ${snap!.meta.deployed.length}/2`} onClose={() => eng().closeOverlay()}>
          {snap!.meta.companions.length === 0 && (
            <div className="text-[12px] text-[#5e7a90]">Отсек пуст. Чертежи компаньонов падают со стражей комплексов.</div>
          )}
          <div className="space-y-2">
            {snap!.meta.companions.map((c) => {
              const dep = snap!.meta.deployed.includes(c.uid)
              return (
                <div key={c.uid} className="flex items-center gap-3 border border-[#1e2a38] px-3 py-2" style={{ background: dep ? c.color + '14' : 'transparent' }}>
                  <span className="w-3 h-3 shrink-0" style={{ background: c.color }} />
                  <div className="flex-1">
                    <div className="font-display text-[8px]" style={{ color: c.color }}>{c.name}</div>
                    <div className="text-[11px] text-[#5e7a90]">боевая единица отряда</div>
                  </div>
                  <button onClick={() => { audio.click(); eng().toggleDeploy(c.uid, 2) }} className="pointer-events-auto font-display text-[8px] px-3 py-2 border" style={{ color: dep ? '#0a0f16' : c.color, background: dep ? c.color : 'transparent', borderColor: c.color }}>
                    {dep ? 'ВЕРНУТЬ' : 'В ОТРЯД'}
                  </button>
                </div>
              )
            })}
          </div>
        </Overlay>
      )}
      {snap?.overlay === 'info' && (
        <Overlay title="ТЕРМИНАЛ ГИЛЬДИИ" sub="ДОСЬЕ НАЁМНИКА" onClose={() => eng().closeOverlay()}>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['ЭКСПЕДИЦИЙ', snap!.meta.stats.expeditions],
              ['ЦЕЛЕЙ УСТРАНЕНО', snap!.meta.stats.kills],
              ['СТРАЖЕЙ ПОВЕРЖЕНО', snap!.meta.stats.bosses],
              ['ЛУЧШАЯ СЕРИЯ', snap!.meta.stats.bestKills],
            ].map(([l, v]) => (
              <div key={l as string} className="border border-[#1e2a38] px-3 py-2">
                <div className="font-display text-[6px] text-[#5e7a90]">{l as string}</div>
                <div className="font-display text-[14px] text-[#e8f4ff] mt-1">{v as number}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[12px] text-[#8fa5ba] leading-relaxed">
            Свободный наёмник. Контракт гильдии: зачистка враждебной популяции системы Край-7.
            Оплата — за каждую подтверждённую цель, премии за рубежи. Всё снаряжение с поверхности — временное.
            Артефакты и чертежи остаются на корабле навсегда.
          </div>
          <div className="mt-3 font-display text-[6px] text-[#3a4f63]">ПРОИЗВОДИТЕЛИ СЕКТОРА: {MANUFACTURERS.map((m) => m.name).join(' · ')}</div>
        </Overlay>
      )}
      {snap?.overlay === 'inventory' && screen === 'game' && (
        <Overlay title="ОТРЯД: ПЕРЕДАЧА СНАРЯЖЕНИЯ" sub="ВРЕМЕННОЕ ОРУЖИЕ МОЖНО УСТАНОВИТЬ КОМПАНЬОНУ" onClose={() => eng().closeOverlay()}>
          {snap!.companions.length === 0 && <div className="text-[12px] text-[#5e7a90]">В отряде нет компаньонов. Особые капсулы на поверхности высвобождают боевых роботов.</div>}
          <div className="space-y-3">
            {snap!.companions.map((c, ci) => (
              <div key={ci} className="border border-[#1e2a38] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5" style={{ background: c.color }} />
                  <span className="font-display text-[8px] text-[#e8f4ff]">{c.label}</span>
                  {c.perm && <span className="font-display text-[6px] text-[#7dff5e] border border-[#7dff5e44] px-1 py-0.5">ПОСТОЯННЫЙ</span>}
                  <span className="ml-auto font-display text-[6px] text-[#5e7a90]">{c.weapon ? `СТВОЛ: ${c.weapon}` : 'БЕЗ СТВОЛА'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {snap!.weapons.map((wp, wi) => (
                    <button key={wi} onClick={() => { audio.click(); eng().giveWeaponToCompanion(wi, ci) }} className="pointer-events-auto font-display text-[7px] px-2 py-1.5 border hover:brightness-150" style={{ borderColor: wp.color + '66', color: wp.color }}>
                      ➜ {wp.name}
                    </button>
                  ))}
                  {snap!.weapons.length === 0 && <span className="text-[11px] text-[#5e7a90]">Нет оружия для передачи</span>}
                </div>
              </div>
            ))}
          </div>
        </Overlay>
      )}

      {/* ==================== DEBUG (F9) ==================== */}
      {snap?.debugOpen && screen === 'game' && (
        <div className="fixed top-14 right-2 z-[70] panel p-2 pointer-events-auto font-body w-[172px]">
          <div className="font-display text-[7px] text-[#ffd54a] mb-2">DEBUG <span className={snap.god ? 'text-[#7dff5e]' : 'text-[#5e7a90]'}>{snap.god ? 'GOD' : ''}</span></div>
          <div className="grid grid-cols-2 gap-1">
            {([
              ['enemy', 'ВРАГ'], ['elite', 'ЭЛИТА'], ['weapon', 'СТВОЛ'], ['armor', 'БРОНЯ'],
              ['companion', 'РОБОТ'], ['heart', 'СЕРДЦЕ'], ['milestone', 'РУБЕЖ'], ['poi', 'К POI'],
              ['dungeon', 'В ДАНЖ'], ['boss', 'БОСС'], ['artifact', 'ПРЕДМЕТ'], ['region', 'РЕГИОН'],
              ['supply', 'СНАБЖ'], ['credits', '+1000'], ['god', 'GOD'], ['kill', 'СМЕРТЬ'], ['wipe', 'СБРОС'],
            ] as [string, string][]).map(([a, l]) => (
              <button key={a} onClick={() => eng().dbg(a)} className="font-display text-[6px] text-[#8fa5ba] border border-[#1e2a38] px-1 py-1.5 hover:text-[#3fe0ff] hover:border-[#3fe0ff55]">
                {l}
              </button>
            ))}
          </div>
          <div className="mt-1.5 font-display text-[5px] text-[#3a4f63]">SEED: {snap.kills >= 0 ? 'см. консоль' : ''} F9 — ЗАКРЫТЬ</div>
        </div>
      )}

      {/* ==================== ПАУЗА ==================== */}
      {screen === 'game' && paused && !death && (
        <div className="fixed inset-0 z-[60] bg-[#05070fcc] flex items-center justify-center font-body">
          <div className="panel px-10 py-8 w-[420px]">
            <div className="font-display text-[18px] text-[#3fe0ff] mb-1" style={{ textShadow: '3px 3px 0 rgba(63,224,255,0.2)' }}>ПАУЗА</div>
            <div className="font-display text-[7px] text-[#5e7a90] mb-5">СИСТЕМЫ В РЕЖИМЕ ОЖИДАНИЯ</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {([['WASD', 'движение'], ['ЛКМ', 'огонь'], ['ПКМ/SPACE', 'клинок'], ['SHIFT', 'рывок'], ['КОЛЕСО', 'оружие'], ['R', 'перезарядка'], ['TAB', 'отряд'], ['E', 'груз/E'], ['F9', 'debug'], ['M', 'звук']] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[11px] text-[#7e93a8]">
                  <span className="font-display text-[7px] text-[#3fe0ff] border border-[#1e3a4a] bg-[#0a1822] px-1.5 py-1 min-w-[56px] text-center">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { audio.click(); eng().paused = false; eng().hooks.onPause(false) }} className="pointer-events-auto font-display text-[9px] bg-[#3fe0ff] text-[#0a0f16] px-5 py-3 hover:bg-[#baf3ff]" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>ПРОДОЛЖИТЬ</button>
              <button onClick={() => { audio.click(); eng().evacuate() }} className="pointer-events-auto font-display text-[9px] border border-[#f5a62388] text-[#f5a623] px-5 py-3 hover:bg-[#f5a62318]">ЭВАКУАЦИЯ</button>
              <button onClick={toShip} className="pointer-events-auto font-display text-[9px] border border-[#5e7a90] text-[#8fa5ba] px-5 py-3 hover:border-[#ff5533] hover:text-[#ff5533]">В АНГАР</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== СМЕРТЬ ==================== */}
      {screen === 'game' && death && (
        <div className="fixed inset-0 z-[60] bg-[#160806d9] flex items-center justify-center font-body">
          <div className="panel px-10 py-8 w-[460px]" style={{ borderColor: '#5a231a' }}>
            <div className="font-display text-[20px] text-[#ff5533] mb-1" style={{ textShadow: '3px 3px 0 rgba(255,85,51,0.25)' }}>КОНТРАКТ ПРЕРВАН</div>
            <div className="font-display text-[7px] text-[#8a5a4a] mb-5">КАПСУЛА ВОССТАНОВЛЕНИЯ АКТИВИРОВАНА · ВРЕМЕННОЕ СНАРЯЖЕНИЕ УТРАЧЕНО</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-5">
              {[['ЦЕЛЕЙ', death.kills], ['КРЕДИТЫ → БАНК', death.credits], ['ВРЕМЯ', fmt(death.time)], ['КОМПАНЬОНЫ', death.companions]].map(([l, v]) => (
                <div key={l as string} className="flex items-baseline justify-between border-b border-[#2b1a16] pb-1">
                  <span className="font-display text-[7px] text-[#8a5a4a]">{l as string}</span>
                  <span className="font-display text-[13px] text-[#ffd9a0]">{v as number}</span>
                </div>
              ))}
            </div>
            {death.permanents.length > 0 && (
              <div className="mb-5 border border-[#f5a62344] bg-[#f5a6230d] p-3">
                <div className="font-display text-[7px] text-[#f5a623] mb-2">СПАСЕНО НА КОРАБЛЬ (ПОСТОЯННОЕ):</div>
                {death.permanents.map((p, i) => (
                  <div key={i} className="font-display text-[9px] text-[#ffd9a0] leading-5">▮ {p}</div>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={revive} className="pointer-events-auto font-display text-[10px] bg-[#f5a623] text-[#0a0f16] px-6 py-3.5 hover:bg-[#ffd54a]" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>НОВЫЙ ЗАБРОС</button>
              <button onClick={toShip} className="pointer-events-auto font-display text-[10px] border border-[#5e7a90] text-[#8fa5ba] px-6 py-3.5 hover:border-[#3fe0ff] hover:text-[#3fe0ff]">НА КОРАБЛЬ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- ОВЕРЛЕЙ-ШАБЛОН ----------
function Overlay({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[55] bg-[#05070fd9] flex items-center justify-center font-body">
      <div className="panel px-8 py-6 w-[560px] max-w-[94vw] max-h-[86vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <div className="font-display text-[14px] text-[#e8f4ff]">{title}</div>
          <button onClick={onClose} className="pointer-events-auto font-display text-[10px] text-[#5e7a90] hover:text-[#ff5533] px-2">✕</button>
        </div>
        <div className="font-display text-[6px] text-[#5e7a90] mb-5">{sub}</div>
        {children}
        <div className="mt-5 font-display text-[6px] text-[#3a4f63]">ESC — ЗАКРЫТЬ</div>
      </div>
    </div>
  )
}

// ---------- КАРТА РЕГИОНОВ ----------
// Детерминированный рельеф: органичные территории, горы, реки, леса, кратеры, ледники
function srand(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function blob(cx: number, cy: number, r: number, seed: number, n = 10): string {
  const rnd = srand(seed)
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (0.72 + rnd() * 0.42)
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr * 0.82).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}
// рельефные глифы региона (горы/деревья/кратеры/лёд) — детерминированно
function terrain(seed: number, cx: number, cy: number, kind: string) {
  const rnd = srand(seed)
  const out: { x: number; y: number; s: number; k: string }[] = []
  const n = 6
  for (let i = 0; i < n; i++) {
    out.push({ x: cx + (rnd() - 0.5) * 26, y: cy + (rnd() - 0.5) * 18, s: 2 + rnd() * 3, k: kind })
  }
  return out
}

function MapOverlay({ snap, onLaunch, onClose }: { snap: Snap; onLaunch: (id: string, site: number) => void; onClose: () => void }) {
  const [sel, setSel] = useState(REGIONS[0].id)
  const [site, setSite] = useState(0)
  const r = REGIONS.find((x) => x.id === sel)!
  const ri = REGIONS.findIndex((x) => x.id === sel)
  // 3 детерминированные зоны высадки в регионе
  const sites = (() => {
    const rnd = srand(ri * 777 + 13)
    const names = ['СЕДЛО', 'УЩЕЛЬЕ', 'ПЛАТО']
    return [0, 1, 2].map((i) => ({
      x: r.mapX * 100 + (rnd() - 0.5) * r.mapR * 120,
      y: r.mapY * 100 + (rnd() - 0.5) * r.mapR * 90,
      name: names[i],
    }))
  })()
  const pickRegion = (id: string) => { setSel(id); setSite(0) }
  return (
    <div className="fixed inset-0 z-[55] bg-[#04060dee] flex items-center justify-center font-body">
      <div className="panel px-8 py-6 w-[860px] max-w-[96vw]">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-[14px] text-[#e8f4ff]">НАВИГАЦИОННАЯ КАРТА</div>
            <div className="font-display text-[6px] text-[#5e7a90] mt-1">СИСТЕМА КРАЙ-7 · ВЫБОР РЕГИОНА ВЫСАДКИ</div>
          </div>
          <button onClick={onClose} className="pointer-events-auto font-display text-[10px] text-[#5e7a90] hover:text-[#ff5533] px-2">✕</button>
        </div>

        <div className="mt-5 flex gap-6 flex-col md:flex-row">
          {/* топографическая карта поверхности */}
          <div className="relative w-[380px] h-[320px] shrink-0 mx-auto">
            <svg viewBox="0 0 100 84" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 24px rgba(63,224,255,0.1))' }}>
              <defs>
                <radialGradient id="ocean" cx="42%" cy="34%" r="90%">
                  <stop offset="0%" stopColor="#122438" />
                  <stop offset="100%" stopColor="#070e18" />
                </radialGradient>
              </defs>
              <rect x="0" y="0" width="100" height="84" fill="url(#ocean)" />
              {/* сетка координат */}
              {[...Array(9)].map((_, i) => <line key={`v${i}`} x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2="84" stroke="#1a2c40" strokeWidth="0.15" />)}
              {[...Array(7)].map((_, i) => <line key={`h${i}`} x1="0" y1={(i + 1) * 12} x2="100" y2={(i + 1) * 12} stroke="#1a2c40" strokeWidth="0.15" />)}
              {/* материк */}
              <path d={blob(50, 42, 44, 99, 14)} fill="#1b2b3a" stroke="#2e4a5e" strokeWidth="0.6" />
              <path d={blob(50, 42, 40, 55, 12)} fill="#223648" />
              {/* регионы: территории + рельеф + подписи */}
              {REGIONS.map((reg, idx) => {
                const active = reg.id === sel
                const cx = reg.mapX * 100, cy = reg.mapY * 84
                const rr = reg.mapR * 95
                const kinds: Record<string, string> = { scrapline: 'm', ashfield: 'r', frostgap: 'i', sporesea: 'f', emberfall: 'v' }
                return (
                  <g key={reg.id} onClick={() => { audio.click(); pickRegion(reg.id) }} onMouseEnter={() => { audio.ensure(); audio.hover(); pickRegion(reg.id) }} style={{ cursor: 'pointer' }}>
                    <path d={blob(cx, cy, rr, idx * 31 + 7, 11)} fill={`${reg.color}${active ? '55' : '2b'}`} stroke={reg.color} strokeWidth={active ? 0.8 : 0.3} strokeOpacity={active ? 1 : 0.5} style={{ transition: 'all .15s' }} />
                    {terrain(idx * 977 + 3, cx, cy, kinds[reg.id]).map((g2, j) =>
                      g2.k === 'm' ? <path key={j} d={`M${g2.x - g2.s},${g2.y + g2.s} L${g2.x},${g2.y - g2.s} L${g2.x + g2.s},${g2.y + g2.s} Z`} fill="#4a5f73" opacity="0.8" />
                        : g2.k === 'f' ? <circle key={j} cx={g2.x} cy={g2.y} r={g2.s * 0.45} fill="#2e5e3a" opacity="0.85" />
                        : g2.k === 'v' ? <g key={j}><circle cx={g2.x} cy={g2.y} r={g2.s * 0.5} fill="#5e2a1e" /><circle cx={g2.x} cy={g2.y} r={g2.s * 0.22} fill={active ? '#ff8a3d' : '#c2451e'} /></g>
                        : g2.k === 'i' ? <rect key={j} x={g2.x - g2.s * 0.5} y={g2.y - g2.s * 0.3} width={g2.s} height={g2.s * 0.6} fill="#bfe8f5" opacity="0.7" />
                        : <path key={j} d={`M${g2.x - g2.s},${g2.y} q${g2.s},-${g2.s} ${g2.s * 2},0`} fill="none" stroke="#8a6a4a" strokeWidth="0.5" opacity="0.7" />
                    )}
                    <text x={cx} y={cy + rr + 4.5} textAnchor="middle" fontSize="2.6" fontFamily="'Press Start 2P',monospace" fill={active ? reg.color : '#7e93a8'}>{reg.name}</text>
                    {/* индикатор опасности */}
                    {[...Array(reg.danger)].map((_, d2) => <rect key={d2} x={cx - reg.danger * 1.1 + d2 * 2.2} y={cy + rr + 6.2} width="1.7" height="1.1" fill={active ? reg.color : '#5e7a90'} />)}
                  </g>
                )
              })}
              {/* зоны высадки выбранного региона */}
              {sites.map((s, i) => {
                const on = i === site
                return (
                  <g key={i} onClick={(e) => { e.stopPropagation(); audio.click(); setSite(i) }} style={{ cursor: 'pointer' }}>
                    <circle cx={s.x} cy={s.y} r={on ? 3.4 : 2.4} fill="none" stroke={on ? '#ffd54a' : '#8fa5ba'} strokeWidth="0.5" opacity={on ? 1 : 0.6}>
                      {on && <animate attributeName="r" values="3;4.2;3" dur="1.2s" repeatCount="indefinite" />}
                    </circle>
                    <circle cx={s.x} cy={s.y} r="0.9" fill={on ? '#ffd54a' : '#8fa5ba'} />
                    {on && <path d={`M${s.x},${s.y - 6.4} l1.6,2.6 h-3.2 Z`} fill="#ffd54a" />}
                    <text x={s.x} y={s.y + 6.2} textAnchor="middle" fontSize="1.9" fontFamily="'Press Start 2P',monospace" fill={on ? '#ffd54a' : '#7e93a8'}>{s.name}</text>
                  </g>
                )
              })}
            </svg>
            {/* сканирующая линия */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded">
              <div className="absolute left-0 right-0 h-[2px] opacity-30" style={{ background: 'linear-gradient(90deg,transparent,#3fe0ff,transparent)', animation: 'scanY 4s linear infinite' }} />
            </div>
            <style>{`@keyframes scanY{0%{top:0}100%{top:100%}}`}</style>
          </div>

          {/* детали региона */}
          <div className="flex-1 min-w-0">
            <div className="font-display text-[12px]" style={{ color: r.color }}>{r.name}</div>
            <div className="text-[12px] text-[#8fa5ba] mt-1.5 leading-relaxed">{r.desc}</div>
            <div className="mt-3 space-y-1.5">
              <InfoRow label="ОПАСНОСТЬ">
                <span className="flex gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className="w-3 h-2" style={{ background: i <= r.danger ? r.color : '#1e2a38' }} />)}</span>
              </InfoRow>
              <InfoRow label="УГРОЗЫ">
                <span className="text-[11px] text-[#c9d8e6]">{Object.entries(r.enemies).sort((a, b) => b[1] - a[1]).map(([k]) => ENEMY_SHORT[k]).join(' · ')}</span>
              </InfoRow>
              <InfoRow label="ОБЪЕКТЫ">
                <span className="text-[11px] text-[#c9d8e6]">{[...new Set(r.poiTable.map((p) => POI_DEFS[p.type as PoiType].label.split(' ')[0]))].slice(0, 4).join(' · ')}</span>
              </InfoRow>
              <InfoRow label="ЛУТ-ПРОФИЛЬ">
                <span className="text-[11px] text-[#c9d8e6]">редкость +{r.lootBias.rarityBoost} · свои наборы оружия</span>
              </InfoRow>
              <InfoRow label="ЗОНА ВЫСАДКИ">
                <span className="flex gap-1.5">
                  {sites.map((s, i) => (
                    <button key={i} onClick={() => { audio.click(); setSite(i) }} onMouseEnter={() => { audio.ensure(); audio.hover() }}
                      className="font-display text-[7px] px-2 py-1 border transition-colors"
                      style={{ borderColor: i === site ? '#ffd54a' : '#1e2a38', color: i === site ? '#ffd54a' : '#5e7a90', background: i === site ? '#ffd54a15' : 'transparent' }}>
                      {s.name}
                    </button>
                  ))}
                </span>
              </InfoRow>
            </div>
            <button
              onClick={() => onLaunch(r.id, site)}
              onMouseEnter={() => { audio.ensure(); audio.hover() }}
              className="mt-5 pointer-events-auto font-display text-[11px] text-[#0a0f16] bg-[#f5a623] px-8 py-3.5 tracking-widest hover:bg-[#ffd54a] active:translate-y-0.5"
              style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))', boxShadow: '5px 5px 0 rgba(63,224,255,0.3)' }}
            >
              ▶ ВЫСАДКА
            </button>
            <div className="mt-3 font-display text-[6px] text-[#3a4f63]">КОНТРАКТ: УСТРАНЕНИЕ ВРАЖДЕБНОЙ ПОПУЛЯЦИИ · ПРЕМИИ ЗА РУБЕЖИ 20/45/80…</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="font-display text-[6px] text-[#3a4f63]">ESC — ОТМЕНА</div>
          <div className="font-display text-[6px] text-[#5e7a90]">БАЛАНС: {snap.meta.credits} КР.</div>
        </div>
      </div>
    </div>
  )
}

const ENEMY_SHORT: Record<string, string> = { grunt: 'МАРОДЁРЫ', brute: 'ГРОМИЛЫ', gunner: 'СТРЕЛКИ', flyer: 'ПИКЕРЫ' }

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#1e2a38] pb-1.5">
      <span className="font-display text-[6px] text-[#5e7a90] w-[76px] shrink-0">{label}</span>
      {children}
    </div>
  )
}

// Радар: движок рисует в скрытый canvas, переносим его в HUD
function MiniView({ miniRef }: { miniRef: RefObject<HTMLCanvasElement | null> }) {
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const c = miniRef.current
    const host = hostRef.current
    if (c && host && c.parentElement !== host) {
      c.classList.remove('hidden')
      c.style.width = '132px'
      c.style.height = '132px'
      c.style.imageRendering = 'pixelated'
      c.style.display = 'block'
      host.appendChild(c)
    }
  }, [miniRef])
  return <div ref={hostRef} className="w-[132px] h-[132px]" />
}
