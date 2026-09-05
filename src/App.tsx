import { useEffect, useRef, useState, type RefObject } from 'react'
import { Engine } from './game/engine'
import { RARITIES, COMP_UPGRADES } from './game/data'
import { audio } from './game/audio'

interface WeaponSnap { name: string; rarity: number; color: string; dmg: number; rate: number; mag: number; acc: number; proj: string; parts: string[]; explosive: number; pellets: number; pierce: boolean }
interface Snap {
  hp: number; maxHp: number; credits: number; kills: number; nextDrop: number; dropProg: number
  biome: string; weapons: WeaponSnap[]; cur: number; mag: number; magSize: number
  reload: number; reloading: boolean; dash: number; companions: number; time: number; muted?: boolean
  armor: ({ name: string; color: string; rarity: number } | null)[]
  compUpgrades: number[]
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function Bar({ v, max, color, h = 'h-2' }: { v: number; max: number; color: string; h?: string }) {
  return (
    <div className={`w-full ${h} bg-[#0a0f16] border border-[#1e2a38]`} style={{ imageRendering: 'pixelated' }}>
      <div className="h-full transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} />
    </div>
  )
}

function Controls({ compact }: { compact?: boolean }) {
  const rows: [string, string][] = [
    ['WASD', 'движение'], ['ЛКМ', 'огонь'], ['ПКМ / SPACE', 'энергоклинок'],
    ['SHIFT', 'рывок'], ['КОЛЕСО', 'смена оружия'], ['R', 'перезарядка'], ['ESC', 'пауза'], ['M', 'звук'],
  ]
  return (
    <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2'} gap-x-6 gap-y-1.5`}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-[11px] text-[#7e93a8]">
          <span className="font-display text-[8px] text-[#3fe0ff] border border-[#1e3a4a] bg-[#0a1822] px-1.5 py-1 min-w-[52px] text-center">{k}</span>
          <span className="font-body">{v}</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const engRef = useRef<Engine | null>(null)
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [snap, setSnap] = useState<Snap | null>(null)
  const [paused, setPaused] = useState(false)
  const [death, setDeath] = useState<{ kills: number; credits: number; time: number; companions: number } | null>(null)
  const [toasts, setToasts] = useState<{ id: number; text: string; color: string }[]>([])
  const tid = useRef(0)

  useEffect(() => {
    const eng = new Engine(canvasRef.current!, miniRef.current!, {
      onSnap: (s) => setSnap(s as unknown as Snap),
      onStart: () => { setScreen('game'); setDeath(null); setPaused(false) },
      onDeath: (s) => setDeath(s as { kills: number; credits: number; time: number; companions: number }),
      onPause: (p) => setPaused(p),
      onToast: ({ text, color }) => {
        const id = ++tid.current
        setToasts((ts) => [...ts.slice(-3), { id, text, color: color || '#ffffff' }])
        window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2800)
      },
    })
    engRef.current = eng
    if (document.fonts?.load) {
      document.fonts.load('8px "Press Start 2P"').catch(() => {})
    }
    return () => eng.destroy()
  }, [])

  const launch = () => {
    audio.ensure(); audio.click()
    engRef.current?.beginLaunch()
  }
  const revive = () => { audio.ensure(); audio.click(); engRef.current?.startGame() }
  const toMenu = () => {
    audio.click()
    const e = engRef.current!
    e.mode = 'menu'; e.paused = false; e.transitioning = false; e.beamT = -1
    setPaused(false); setDeath(null); setScreen('menu'); setSnap(null)
  }

  const w = snap?.weapons?.[snap.cur]

  return (
    <div className="fixed inset-0 bg-[#05070f] overflow-hidden select-none">
      <canvas ref={canvasRef} className={`w-full h-full block ${screen === 'game' ? 'cursor-none' : ''}`} style={{ imageRendering: 'pixelated' }} />

      {/* сканлайны + виньетка */}
      <div className="pointer-events-none fixed inset-0 z-40 opacity-[0.16]" style={{ background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.9) 2px 3px)' }} />
      <div className="pointer-events-none fixed inset-0 z-40" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(3,6,12,0.55) 100%)' }} />

      {/* скрытый радар — всегда смонтирован */}
      <canvas ref={miniRef} width={132} height={132} className="hidden" />

      {/* ==================== МЕНЮ ==================== */}
      {screen === 'menu' && (
        <div className="fixed inset-0 z-50 font-body text-[#c9d8e6]">
          <div className="absolute top-5 left-6 flex items-center gap-3">
            <span className="font-display text-[8px] text-[#3fe0ff] tracking-wider">СЕКТОР 7G // КАНАЛ ГИЛЬДИИ НАЁМНИКОВ</span>
            <span className="w-2 h-3 bg-[#3fe0ff] animate-blink" />
          </div>
          <div className="absolute top-5 right-6 font-display text-[8px] text-[#5e7a90] text-right leading-4">
            СИГНАЛ: СТАБИЛЬНЫЙ<br />ТОПЛИВО: 98%
          </div>

          <div className="absolute left-6 md:left-12 top-[16%] max-w-[560px]">
            <div className="font-display text-[8px] text-[#f5a623] mb-3 tracking-widest">16-БИТ • ВЕРХНИЙ СЕКТОР • СЛЭШЕР</div>
            <h1 className="font-display text-[34px] md:text-[52px] leading-[1.15] text-[#e8f4ff]" style={{ textShadow: '4px 4px 0 #0a2233, 8px 8px 0 rgba(63,224,255,0.25)' }}>
              НАЁМНИК<br /><span className="text-[#f5a623]" style={{ textShadow: '4px 4px 0 #2b1a05, 8px 8px 0 rgba(245,166,35,0.25)' }}>ПУСТОТЫ</span>
            </h1>
            <p className="mt-4 text-[13px] md:text-sm text-[#8fa5ba] leading-relaxed max-w-[420px]">
              Одиночный контракт в неисследованном секторе: бесконечная планета, пиратские отряды,
              грузовые капсулы с оружием из 12 наборов частей, модули для отряда и шаттлы гильдии за серии убийств.
            </p>
          </div>

          <div className="absolute left-6 md:left-12 bottom-10 flex flex-col gap-5">
            <button
              onClick={launch}
              onMouseEnter={() => { audio.ensure(); audio.hover() }}
              className="group relative font-display text-[16px] text-[#0a0f16] bg-[#f5a623] px-10 py-4 tracking-widest transition-transform duration-100 hover:translate-x-1 hover:bg-[#ffd54a] active:translate-y-0.5"
              style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))', boxShadow: '6px 6px 0 rgba(63,224,255,0.35)' }}
            >
              ▶ ИГРАТЬ
              <span className="absolute -right-1.5 top-1.5 w-2 h-2 bg-[#3fe0ff] animate-blink" />
            </button>
            <div className="panel px-4 py-3 w-fit">
              <div className="font-display text-[7px] text-[#5e7a90] mb-2">УПРАВЛЕНИЕ</div>
              <Controls />
            </div>
          </div>

          <div className="absolute right-6 md:right-10 bottom-10 panel px-4 py-3 hidden md:block w-[240px]">
            <div className="font-display text-[7px] text-[#5e7a90] mb-2">БОРТЖУРНАЛ</div>
            <ul className="text-[11px] text-[#8fa5ba] space-y-1.5 leading-snug">
              <li><span className="text-[#ff5533]">▮</span> 4 класса противников — мутации из частей</li>
              <li><span className="text-[#ffd54a]">▮</span> Капсулы: чем больше, тем реже лут</li>
              <li><span className="text-[#3fe0ff]">▮</span> Каждый 20-й фрагер — сброс гильдии</li>
              <li><span className="text-[#7dff5e]">▮</span> Модули из ящиков усиливают отряд</li>
              <li><span className="text-[#c96bff]">▮</span> Особый контейнер высвобождает меха</li>
            </ul>
          </div>
        </div>
      )}

      {/* ==================== HUD ==================== */}
      {screen === 'game' && snap && !death && (
        <div className="fixed inset-0 z-50 pointer-events-none font-body">
          {/* верхняя строка HUD — flex-раскладка, не выходит за края экрана */}
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
            <div className="mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#f5a623]" />
              <span className="font-display text-[7px] text-[#f5a623] tracking-wider">{snap.biome}</span>
              <span className="ml-auto font-display text-[7px] text-[#5e7a90]">{fmt(snap.time)}</span>
            </div>
          </div>

          {/* центр: фраги + гильдия */}
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 max-w-[320px] mx-auto">
            <div className="panel px-4 py-2 w-full flex items-center gap-3">
              <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0"><path d="M2 2h10v6a5 5 0 0 1-10 0V2z" fill="none" stroke="#ff5533" strokeWidth="1.6" /><rect x="4" y="4" width="2" height="2" fill="#ff5533" /><rect x="8" y="4" width="2" height="2" fill="#ff5533" /></svg>
              <span className="font-display text-[11px] text-[#e8f4ff]">{snap.kills}</span>
              <div className="flex-1">
                <div className="font-display text-[6px] text-[#5e7a90] mb-1 text-right">СБРОС ГИЛЬДИИ {snap.nextDrop - snap.kills > 0 ? snap.nextDrop - snap.kills : 0}</div>
                <Bar v={snap.dropProg} max={1} color="#f5a623" h="h-1.5" />
              </div>
            </div>
            {/* тосты */}
            <div className="flex flex-col items-center gap-1">
              {toasts.map((t) => (
                <div key={t.id} className="toast-in font-display text-[8px] px-3 py-1.5 bg-[#0a111acc] border" style={{ color: t.color, borderColor: t.color + '55', textShadow: '2px 2px 0 rgba(0,0,0,0.8)' }}>
                  {t.text}
                </div>
              ))}
            </div>
          </div>

          {/* справа: кредиты + радар */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="panel px-3 py-2 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 0L10 3v5L5.5 11 1 8V3z" fill="#f5a623" /><path d="M5.5 2L8 3.7v3.6L5.5 9 3 7.3V3.7z" fill="#ffd54a" /></svg>
                <span className="font-display text-[10px] text-[#ffd54a]">{snap.credits}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 11 11"><rect x="2" y="3" width="7" height="6" fill="#3fe0ff" /><rect x="3" y="1" width="2" height="2" fill="#3fe0ff" /><rect x="6" y="1" width="2" height="2" fill="#3fe0ff" /><rect x="1" y="9" width="9" height="1" fill="#3fe0ff" /></svg>
                <span className="font-display text-[10px] text-[#3fe0ff]">{snap.companions}</span>
              </div>
              <button
                onClick={() => { audio.toggleMute() }}
                className="pointer-events-auto font-display text-[7px] text-[#5e7a90] hover:text-[#3fe0ff] border border-[#1e2a38] px-1.5 py-1"
              >
                {snap.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ'}
              </button>
            </div>
            <div className="panel p-1.5">
              <MiniView miniRef={miniRef} />
            </div>
          </div>
          </div>

          {/* нижняя строка HUD — flex-раскладка, не выходит за края экрана */}
          <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2">
          {/* слева: броня + модули + подсказки */}
          <div className="hidden md:flex flex-col gap-2 w-[216px] shrink-0 max-w-[30vw]">
            <div className="panel px-3 py-2">
              <div className="font-display text-[6px] text-[#5e7a90] mb-1.5">ЭКИПИРОВКА</div>
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
              <span className="font-display text-[6px] text-[#3a4f63]">ЛКМ ОГОНЬ • ПКМ КЛИНОК • SHIFT РЫВОК • R ПЕРЕЗАРЯДКА</span>
            </div>
          </div>

          {/* центр: оружие */}
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
                      <div className="font-display text-[6px] text-[#5e7a90] mb-1">ДЕТАЛИ СБОРКИ</div>
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

          {/* справа: характеристики */}
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

      {/* ==================== ПАУЗА ==================== */}
      {screen === 'game' && paused && !death && (
        <div className="fixed inset-0 z-[60] bg-[#05070fcc] flex items-center justify-center font-body">
          <div className="panel px-10 py-8 w-[400px]">
            <div className="font-display text-[18px] text-[#3fe0ff] mb-1" style={{ textShadow: '3px 3px 0 rgba(63,224,255,0.2)' }}>ПАУЗА</div>
            <div className="font-display text-[7px] text-[#5e7a90] mb-5">СИСТЕМЫ В РЕЖИМЕ ОЖИДАНИЯ</div>
            <Controls compact />
            <div className="flex gap-3 mt-6">
              <button onClick={() => { audio.click(); engRef.current!.paused = false; engRef.current!.hooks.onPause(false) }} className="pointer-events-auto font-display text-[9px] bg-[#3fe0ff] text-[#0a0f16] px-5 py-3 hover:bg-[#baf3ff]" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>ПРОДОЛЖИТЬ</button>
              <button onClick={toMenu} className="pointer-events-auto font-display text-[9px] border border-[#5e7a90] text-[#8fa5ba] px-5 py-3 hover:border-[#ff5533] hover:text-[#ff5533]">В АНГАР</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== СМЕРТЬ ==================== */}
      {screen === 'game' && death && (
        <div className="fixed inset-0 z-[60] bg-[#160806d9] flex items-center justify-center font-body">
          <div className="panel px-10 py-8 w-[420px]" style={{ borderColor: '#5a231a' }}>
            <div className="font-display text-[20px] text-[#ff5533] mb-1" style={{ textShadow: '3px 3px 0 rgba(255,85,51,0.25)' }}>КОНТРАКТ ПРЕРВАН</div>
            <div className="font-display text-[7px] text-[#8a5a4a] mb-5">СИГНАЛ НАЁМНИКА ПОТЕРЯН В СЕКТОРЕ 7G</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
              {[['УСТРАНЕНО', death.kills], ['КРЕДИТЫ', death.credits], ['ВРЕМЯ', fmt(death.time)], ['КОМПАНЬОНЫ', death.companions]].map(([l, v]) => (
                <div key={l as string} className="flex items-baseline justify-between border-b border-[#2b1a16] pb-1">
                  <span className="font-display text-[7px] text-[#8a5a4a]">{l as string}</span>
                  <span className="font-display text-[13px] text-[#ffd9a0]">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={revive} className="pointer-events-auto font-display text-[10px] bg-[#f5a623] text-[#0a0f16] px-6 py-3.5 hover:bg-[#ffd54a]" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>НОВЫЙ ЗАБРОС</button>
              <button onClick={toMenu} className="pointer-events-auto font-display text-[10px] border border-[#5e7a90] text-[#8fa5ba] px-6 py-3.5 hover:border-[#3fe0ff] hover:text-[#3fe0ff]">В АНГАР</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Радар переносим в видимый контейнер (canvas один, движок рисует в него)
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
