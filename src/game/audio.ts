// ============================================================
// НАЁМНИК ПУСТОТЫ — WebAudio-синтезатор (без ассетов)
// ============================================================

class AudioSys {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  muted = false
  noiseBuf: AudioBuffer | null = null

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.42
      this.master.connect(this.ctx.destination)
      const len = this.ctx.sampleRate * 1
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    } catch {
      this.ctx = null
    }
  }

  toggleMute() {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.42
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return
    const t0 = this.ctx.currentTime + delay
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(this.master)
    o.start(t0); o.stop(t0 + dur + 0.02)
  }

  private noise(dur: number, vol: number, freq = 1000, q = 0.6, delay = 0, slideTo = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf || this.muted) return
    const t0 = this.ctx.currentTime + delay
    const s = this.ctx.createBufferSource()
    s.buffer = this.noiseBuf
    s.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(freq, t0)
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur)
    f.Q.value = q
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    s.connect(f); f.connect(g); g.connect(this.master)
    s.start(t0); s.stop(t0 + dur + 0.02)
  }

  click() { this.tone(880, 0.06, 'square', 0.12); this.tone(1320, 0.05, 'square', 0.08, 0, 0.03) }
  hover() { this.tone(660, 0.04, 'square', 0.05) }

  shoot(proj: string) {
    if (proj === 'laser') { this.tone(1400, 0.09, 'square', 0.09, -900) }
    else if (proj === 'plasma') { this.tone(520, 0.12, 'sawtooth', 0.1, -260); this.tone(1040, 0.08, 'square', 0.05, -500) }
    else if (proj === 'rocket') { this.noise(0.28, 0.16, 900, 0.5, 0, 180); this.tone(120, 0.24, 'sawtooth', 0.12, -60) }
    else if (proj === 'rail') { this.tone(2200, 0.12, 'sawtooth', 0.11, -1800); this.noise(0.1, 0.08, 3200, 1) }
    else { this.noise(0.07, 0.14, 1800, 0.8, 0, 500); this.tone(300, 0.05, 'square', 0.06, -140) }
  }
  enemyShoot() { this.tone(340, 0.14, 'sawtooth', 0.07, -160) }
  slash() { this.noise(0.13, 0.18, 2600, 0.7, 0, 700); this.tone(220, 0.09, 'triangle', 0.08, 140) }
  hit() { this.tone(200, 0.06, 'square', 0.1, -80); this.noise(0.05, 0.08, 1200, 0.7) }
  hurt() { this.tone(140, 0.18, 'sawtooth', 0.16, -70); this.noise(0.14, 0.12, 500, 0.6) }
  explode() { this.noise(0.4, 0.28, 400, 0.4, 0, 60); this.tone(70, 0.34, 'sawtooth', 0.18, -30) }
  capsuleHit() { this.tone(260, 0.05, 'square', 0.08, -60) }
  capsuleBreak() { this.noise(0.3, 0.24, 700, 0.5, 0, 120); this.tone(520, 0.16, 'square', 0.1, 300); this.tone(780, 0.2, 'square', 0.08, 400, 0.08) }
  coin() { this.tone(980, 0.06, 'square', 0.07); this.tone(1470, 0.08, 'square', 0.07, 0, 0.05) }
  pickup() { this.tone(520, 0.08, 'square', 0.09); this.tone(780, 0.08, 'square', 0.09, 0, 0.07); this.tone(1040, 0.1, 'square', 0.08, 0, 0.14) }
  rareSting() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'square', 0.09, 0, i * 0.07)) }
  reload() { this.noise(0.05, 0.1, 2000, 1); this.noise(0.06, 0.12, 1400, 1, 0, 0); this.noise(0.07, 0.12, 2400, 1, 0.14) }
  dash() { this.noise(0.16, 0.12, 1600, 0.6, 0, 3800) }
  teleport() {
    this.tone(180, 0.7, 'sawtooth', 0.14, 1400)
    this.tone(90, 0.8, 'square', 0.1, 700)
    this.noise(0.7, 0.1, 600, 0.5, 0.05, 4000)
    this.tone(1600, 0.3, 'sine', 0.12, -1200, 0.55)
  }
  shuttle() { this.noise(1.4, 0.12, 300, 0.4, 0, 150); this.tone(160, 1.2, 'sawtooth', 0.07, 40) }
  podLand() { this.noise(0.4, 0.3, 300, 0.4, 0, 50); this.tone(60, 0.4, 'sine', 0.22, -20); this.noise(0.2, 0.14, 1800, 0.8, 0.05, 300) }
  companion() { [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, 0, i * 0.06)); this.noise(0.5, 0.1, 800, 0.5, 0.1, 200) }
  death() { this.tone(300, 0.8, 'sawtooth', 0.16, -260); this.noise(0.7, 0.2, 500, 0.4, 0, 60); this.tone(80, 1, 'square', 0.12, -40, 0.15) }
  bladeHit() { this.tone(420, 0.07, 'square', 0.1, -200); this.noise(0.09, 0.14, 900, 0.6) }
  deny() { this.tone(180, 0.08, 'square', 0.09, -60); this.tone(120, 0.1, 'square', 0.07, -40, 0.07) }
  heal() { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.09, 'triangle', 0.1, 0, i * 0.055)) }
  upgrade() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.09, 'square', 0.08, 0, i * 0.055)); this.tone(1760, 0.16, 'sine', 0.07, -500, 0.26) }
}

export const audio = new AudioSys()
