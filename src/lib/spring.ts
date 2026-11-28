/**
 * Tiny damped-spring animator (port of Flutter's SpringSimulation as used by
 * live-demo-portfolio's SpringDeck). Animates t from 0 to 1.
 */
export interface SpringSpec {
  stiffness: number
  /** Damping ratio: < 1 overshoots, 1 is critical. */
  ratio: number
  mass?: number
}

/** Same constants as live-demo-portfolio `Motion`. */
export const SPRINGS = {
  snappy: { stiffness: 420, ratio: 0.6 },
  bouncy: { stiffness: 180, ratio: 0.45 },
  fly: { stiffness: 260, ratio: 1 },
} satisfies Record<string, SpringSpec>

/** Release thresholds from SpringDeck: distance in px, speed in px/s. */
export const THROW = { exitDistance: 110, flingSpeed: 700 }

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Runs the spring; `onFrame(t)` gets the progress (may overshoot past 1).
 * `v0` is the initial velocity in t-units per second. Returns a cancel function.
 */
export function animateSpring(
  spec: SpringSpec,
  v0: number,
  onFrame: (t: number) => void,
  onDone?: () => void,
): () => void {
  if (prefersReducedMotion()) {
    onFrame(1)
    onDone?.()
    return () => {}
  }
  const m = spec.mass ?? 1
  const c = 2 * spec.ratio * Math.sqrt(spec.stiffness * m)
  let x = -1 // displacement from target (t - 1)
  let v = v0
  let last = performance.now()
  let raf = 0
  let cancelled = false
  const step = (now: number) => {
    if (cancelled) return
    let dt = Math.min(0.064, (now - last) / 1000)
    last = now
    // semi-implicit Euler in small substeps for stability
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240)
      const a = (-spec.stiffness * x - c * v) / m
      v += a * h
      x += v * h
      dt -= h
    }
    if (Math.abs(x) < 0.002 && Math.abs(v) < 0.02) {
      onFrame(1)
      onDone?.()
      return
    }
    onFrame(1 + x)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  return () => {
    cancelled = true
    cancelAnimationFrame(raf)
  }
}

/** Velocity tracker over the last ~100 ms of pointer samples (px/s). */
export class VelocityTracker {
  private samples: { x: number; y: number; t: number }[] = []
  add(x: number, y: number, t = performance.now()) {
    this.samples.push({ x, y, t })
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift()
  }
  get(): { vx: number; vy: number } {
    const s = this.samples
    if (s.length < 2) return { vx: 0, vy: 0 }
    const a = s[0]
    const b = s[s.length - 1]
    const dt = Math.max(1, b.t - a.t) / 1000
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt }
  }
  reset() {
    this.samples = []
  }
}
