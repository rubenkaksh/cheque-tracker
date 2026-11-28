import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Tag } from 'antd'
import { colorFor, isTerminal, labelFor, type ChequeStatus } from '../data/transitions'
import { animateSpring, SPRINGS, THROW, VelocityTracker } from '../lib/spring'
import { STATUS_ICONS } from './statusIcons'

interface Props {
  /** Statuses on the ring, in cyclic order (first sits at 12 o'clock). */
  options: ChequeStatus[]
  /** Where the press happened (viewport px); null centres the wheel. */
  origin: { x: number; y: number } | null
  /** True when the finger that long-pressed is still down and keeps dragging. */
  dragFromStart: boolean
  /** The small cheque the user throws. */
  token: ReactNode
  onPick: (status: ChequeStatus) => void
  onClose: () => void
}

const MAX_RADIUS = 122
const MARGIN = 64
/** A short flick has to travel this far before its speed counts as a throw. */
const MIN_FLING_DIST = 48
/** Widest miss (radians) still counted as aimed at a status. */
const MAX_CONE = (35 * Math.PI) / 180

type Pt = { x: number; y: number }

/**
 * Radial status switcher (weapon-wheel style). Drag the cheque token and
 * throw it toward a status: past 110 px or faster than 700 px/s it flies to
 * the nearest status in that direction; otherwise it springs back home.
 * A throw that misses every status by more than the aim cone springs back.
 * Final statuses (cleared, replaced, ...) ask for a confirm tap first.
 * Tapping a status also picks it.
 */
export default function StatusWheel({ options, origin, dragFromStart, token, onPick, onClose }: Props) {
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 })
  const [aim, setAim] = useState<number | null>(null)
  const [shown, setShown] = useState(false)
  const dragging = useRef(dragFromStart)
  const start = useRef<Pt | null>(null)
  const startOffset = useRef<Pt>({ x: 0, y: 0 })
  const offsetRef = useRef<Pt>({ x: 0, y: 0 })
  const tracker = useRef(new VelocityTracker())
  const cancelAnim = useRef<() => void>(() => {})
  const busy = useRef(false)
  const pointerId = useRef<number | null>(null)
  const firstChip = useRef<HTMLButtonElement | null>(null)
  const [confirm, setConfirm] = useState<number | null>(null)
  // latest props for window listeners attached once
  const optionsRef = useRef(options)
  const onPickRef = useRef(onPick)
  const onCloseRef = useRef(onClose)
  optionsRef.current = options
  onPickRef.current = onPick
  onCloseRef.current = onClose

  const vw = typeof window === 'undefined' ? 400 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const RADIUS = Math.max(84, Math.min(MAX_RADIUS, vw / 2 - 80))
  const reach = RADIUS + MARGIN
  const c: Pt = {
    x: clamp(origin?.x ?? vw / 2, Math.min(reach, vw / 2), Math.max(vw - reach, vw / 2)),
    y: clamp(origin?.y ?? vh / 2, Math.min(reach, vh / 2), Math.max(vh - reach, vh / 2)),
  }
  const n = options.length
  const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n)
  const chipPos = (i: number): Pt => ({ x: Math.cos(angleOf(i)) * RADIUS, y: Math.sin(angleOf(i)) * RADIUS })

  function nearest(dir: Pt): number | null {
    if (n === 0 || Math.hypot(dir.x, dir.y) < 1) return null
    const a = Math.atan2(dir.y, dir.x)
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < n; i++) {
      const d = Math.abs(Math.atan2(Math.sin(a - angleOf(i)), Math.cos(a - angleOf(i))))
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  function setOff(p: Pt) {
    offsetRef.current = p
    setOffset(p)
  }

  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const id = requestAnimationFrame(() => setShown(true))
    firstChip.current?.focus({ preventScroll: true })
    return () => {
      cancelAnimationFrame(id)
      busy.current = false
      opener?.focus?.({ preventScroll: true })
    }
  }, [])

  /** Final statuses get a confirm tap; the rest are picked at once. */
  function choose(i: number) {
    const s = optionsRef.current[i]
    if (isTerminal(s)) {
      busy.current = true
      setAim(i)
      setConfirm(i)
    } else onPickRef.current(s)
  }

  function cancelConfirm() {
    setConfirm(null)
    busy.current = false
    springHome({ x: 0, y: 0 })
  }

  function flyTo(i: number, speed: number) {
    busy.current = true
    const from = offsetRef.current
    const to = chipPos(i)
    const span = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y))
    setAim(i)
    cancelAnim.current = animateSpring(
      SPRINGS.fly,
      Math.min(12, speed / span),
      (t) => setOff({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }),
      () => choose(i),
    )
  }

  function springHome(v: Pt) {
    const from = offsetRef.current
    const dist = Math.hypot(from.x, from.y)
    const vt = dist < 1 ? 0 : -(v.x * from.x + v.y * from.y) / (dist * dist)
    setAim(null)
    cancelAnim.current = animateSpring(SPRINGS.bouncy, vt, (t) =>
      setOff({ x: from.x * (1 - t), y: from.y * (1 - t) }),
    )
  }

  /** Index of the status the direction points at, or null outside the aim cone. */
  function aimed(dir: Pt): number | null {
    const i = nearest(dir)
    if (i === null) return null
    const a = Math.atan2(dir.y, dir.x)
    const miss = Math.abs(Math.atan2(Math.sin(a - angleOf(i)), Math.cos(a - angleOf(i))))
    return miss <= Math.min((Math.PI / Math.max(1, n)) * 0.6, MAX_CONE) ? i : null
  }

  useLayoutEffect(() => {
    function move(e: PointerEvent) {
      if (!dragging.current || busy.current) return
      if (pointerId.current === null) {
        // long-press finger: released before the wheel listened? then stop
        if (e.buttons === 0) {
          dragging.current = false
          return
        }
        pointerId.current = e.pointerId
      }
      if (e.pointerId !== pointerId.current) return
      if (!start.current) {
        start.current = { x: e.clientX, y: e.clientY }
        startOffset.current = offsetRef.current
      }
      const p = {
        x: startOffset.current.x + e.clientX - start.current.x,
        y: startOffset.current.y + e.clientY - start.current.y,
      }
      tracker.current.add(e.clientX, e.clientY)
      setOff(p)
      setAim(Math.hypot(p.x, p.y) > 28 ? aimed(p) : null)
    }
    function up(e: PointerEvent) {
      if (!dragging.current || busy.current) return
      if (pointerId.current !== null && e.pointerId !== pointerId.current) return
      dragging.current = false
      pointerId.current = null
      start.current = null
      const p = offsetRef.current
      const { vx, vy } = tracker.current.get()
      tracker.current.reset()
      const dist = Math.hypot(p.x, p.y)
      const speed = Math.hypot(vx, vy)
      // velocity counts only when it points the way the card is already going
      const along = dist < 1 ? speed : (vx * p.x + vy * p.y) / dist
      const flung = along > THROW.flingSpeed && dist >= MIN_FLING_DIST
      // small phones shrink the ring, so the exit line shrinks with it
      if (n > 0 && (dist > Math.min(THROW.exitDistance, RADIUS * 0.7) || flung)) {
        const i = aimed(p)
        if (i !== null) return flyTo(i, speed)
      }
      springHome({ x: vx, y: vy })
    }
    function cancel(e: PointerEvent) {
      if (!dragging.current) return
      if (pointerId.current !== null && e.pointerId !== pointerId.current) return
      dragging.current = false
      pointerId.current = null
      start.current = null
      tracker.current.reset()
      if (!busy.current) springHome({ x: 0, y: 0 })
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', key)
      cancelAnim.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  return createPortal(
    <div
      data-testid="status-wheel"
      className="fixed inset-0 z-[1000] select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-ink/55 backdrop-blur-[2px] transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full border border-white/25 transition-all duration-200"
        style={{
          left: c.x - RADIUS,
          top: c.y - RADIUS,
          width: RADIUS * 2,
          height: RADIUS * 2,
          transform: `scale(${shown ? 1 : 0.4})`,
          opacity: shown ? 1 : 0,
        }}
      />
      <div role="menu" aria-label="Move status to">
        {options.map((s, i) => {
          const p = chipPos(i)
          const on = aim === i
          return (
            <button
              key={s}
              type="button"
              role="menuitem"
              ref={i === 0 ? firstChip : undefined}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => !busy.current && choose(i)}
              className="absolute z-10 rounded-full transition-[transform,opacity] duration-200 ease-out"
              style={{
                left: c.x + (shown ? p.x : 0),
                top: c.y + (shown ? p.y : 0),
                opacity: shown ? 1 : 0,
                transform: `translate(-50%, -50%) scale(${on ? 1.18 : 1})`,
              }}
            >
              <Tag
                color={colorFor(s)}
                icon={STATUS_ICONS[s]}
                className={`!m-0 !rounded-full !px-3 !py-1 !text-[13px] !font-semibold shadow-card ${on ? '!ring-2 !ring-white' : ''}`}
              >
                {labelFor(s)}
              </Tag>
            </button>
          )
        })}
      </div>
      <div
        data-testid="wheel-token"
        className="absolute cursor-grab touch-none active:cursor-grabbing"
        style={{
          left: c.x + offset.x,
          top: c.y + offset.y,
          transform: `translate(-50%, -50%) rotate(${clamp(offset.x / 14, -12, 12)}deg) scale(${shown ? 1 : 0.85})`,
          transition: 'scale 150ms',
        }}
        onPointerDown={(e) => {
          if (busy.current) return
          e.stopPropagation()
          cancelAnim.current()
          dragging.current = true
          pointerId.current = e.pointerId
          start.current = { x: e.clientX, y: e.clientY }
          startOffset.current = offsetRef.current
          tracker.current.reset()
          tracker.current.add(e.clientX, e.clientY)
        }}
      >
        {token}
      </div>
      {confirm !== null ? (
        <div
          data-testid="wheel-confirm"
          role="alertdialog"
          aria-label={`Move to ${labelFor(options[confirm])}?`}
          className="absolute inset-x-4 bottom-8 z-20 mx-auto flex max-w-sm items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-card"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-sm font-semibold text-ink">
            Move to {labelFor(options[confirm])}? This is final.
          </span>
          <span className="flex gap-2">
            <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-muted" onClick={cancelConfirm}>
              Cancel
            </button>
            <button
              type="button"
              autoFocus
              className="rounded-lg bg-green px-3 py-1.5 text-sm font-semibold text-white"
              onClick={() => onPickRef.current(options[confirm])}
            >
              Move
            </button>
          </span>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-sm font-medium text-white/85">
          Throw the cheque toward a status · tap outside to cancel
        </div>
      )}
    </div>,
    document.body,
  )
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
