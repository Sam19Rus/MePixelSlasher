// Seeded RNG (mulberry32) + разделённые потоки: world / gameplay / loot / combat
export class Rng {
  private s: number
  constructor(seed: number) { this.s = seed >>> 0 || 1 }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(a: number, b: number): number { return a + (b - a) * this.next() }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)) }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)] }
}
export interface RngStreams { world: Rng; gameplay: Rng; loot: Rng; combat: Rng }
export function makeStreams(seed: number): RngStreams {
  return {
    world: new Rng(seed * 2654435761 + 11),
    gameplay: new Rng(seed * 40503 + 7777),
    loot: new Rng(seed * 97 + 31337),
    combat: new Rng(seed * 104729 + 555),
  }
}
