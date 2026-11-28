import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Tag, message } from 'antd'
import {
  DollarOutlined,
  EditOutlined,
  MessageOutlined,
  PauseCircleOutlined,
  SwapOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { formatAdAsBs, formatAdAsBsLong, formatBsAd, todayKathmandu } from '../lib/bsdate'
import { formatNpr } from '../lib/money'
import { transitionCheque, type Cheque } from '../data/chequeRepo'
import RecordCashModal from './RecordCashModal'
import { colorFor, HOLD_STATUS, isMatured, isTerminal, labelFor, type ChequeStatus } from '../data/transitions'
import RemarksPanel from './RemarksPanel'
import AssignAgentPanel from './AssignAgentPanel'
import { useAuth } from '../lib/auth'
import ChequeForm from './ChequeForm'
import Popup from './Popup'
import StatusWheel from './StatusWheel'
import { animateSpring, SPRINGS, VelocityTracker } from '../lib/spring'

interface Props {
  cheque: Cheque
  overdue: boolean
  /** Statuses the CURRENT role may move this cheque to (from allowed_transitions). */
  allowedTo: ChequeStatus[]
  onChanged: () => void
}

/** transition_cheque refuses these: they only happen through record_receipt. */
const RECEIPT_ONLY: ChequeStatus[] = ['partial_cash', 'closed_full_cash']

/** Long-press time before the status wheel opens (ms). */
const HOLD_MS = 450
/** Movement that cancels a long-press and decides swipe vs scroll (px). */
const SLOP = 8

interface Action {
  key: string
  label: string
  icon: ReactNode
  /** Slot background (iOS-style full-height colour). */
  bg: string
  onClick: () => void
}

type Mode = 'idle' | 'pending' | 'swipe' | 'scroll' | 'wheel'

export default function ChequeWidget({ cheque, overdue, allowedTo, onChanged }: Props) {
  const { role } = useAuth()
  const [cashOpen, setCashOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [remarksOpen, setRemarksOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [wheel, setWheel] = useState<{ origin: { x: number; y: number } | null; drag: boolean } | null>(null)
  const today = todayKathmandu()
  const matured = isMatured(cheque.status, cheque.maturityDate, today)
  const recovery = cheque.status === 'bounced' || cheque.status === 'partial_cash'
  const canAssign = role === 'admin' && recovery
  const followUpDue = !isTerminal(cheque.status) && !!cheque.nextActionDate && cheque.nextActionDate <= today
  const canEdit = role === 'admin' && !isTerminal(cheque.status)
  const receiptStage = cheque.status === 'bounced' || cheque.status === 'partial_cash'
  // receipt-only statuses are reached through Record cash, never a bare move
  const moves = allowedTo.filter((s) => !RECEIPT_ONLY.includes(s))
  const canRecordCash = receiptStage && allowedTo.some((s) => RECEIPT_ONLY.includes(s))
  const canHold = moves.includes(HOLD_STATUS)

  async function move(to: ChequeStatus) {
    try {
      await transitionCheque(cheque.id, to, cheque.version)
      message.success(`${cheque.party}: moved to ${labelFor(to)}`)
      onChanged()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Could not move cheque')
      onChanged()
    }
  }

  // ── swipe-left action tray ───────────────────────────────────────────
  const fgRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const xRef = useRef(0)
  const trayW = useRef(0)
  const mode = useRef<Mode>('idle')
  const startPt = useRef({ x: 0, y: 0, baseX: 0 })
  const holdTimer = useRef<number | undefined>(undefined)
  const tracker = useRef(new VelocityTracker())
  const cancelAnim = useRef<() => void>(() => {})

  const setXNow = useCallback((v: number) => {
    xRef.current = v
    setX(v)
  }, [])

  const snapTo = useCallback(
    (target: number, vx = 0) => {
      cancelAnim.current()
      const from = xRef.current
      const span = target - from
      if (Math.abs(span) < 0.5) return setXNow(target)
      cancelAnim.current = animateSpring(SPRINGS.snappy, Math.max(-12, Math.min(12, vx / span)), (t) => setXNow(from + span * t))
    },
    [setXNow],
  )

  useLayoutEffect(() => {
    trayW.current = trayRef.current?.offsetWidth ?? 0
  })

  // Scroll must stay native for vertical drags, but once a gesture is ours
  // the page must not scroll under it: a non-passive touchmove can cancel it.
  useEffect(() => {
    const el = fgRef.current
    if (!el) return
    const block = (e: TouchEvent) => {
      if (mode.current === 'swipe' || mode.current === 'wheel') e.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  useEffect(() => () => {
    cancelAnim.current()
    window.clearTimeout(holdTimer.current)
  }, [])

  function openWheel(origin: { x: number; y: number } | null, drag: boolean) {
    if (moves.length === 0) return
    navigator.vibrate?.(12)
    snapTo(0)
    setWheel({ origin, drag })
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || wheel) return
    cancelAnim.current()
    mode.current = 'pending'
    startPt.current = { x: e.clientX, y: e.clientY, baseX: xRef.current }
    tracker.current.reset()
    tracker.current.add(e.clientX, e.clientY)
    window.clearTimeout(holdTimer.current)
    if (moves.length > 0) {
      const at = { x: e.clientX, y: e.clientY }
      holdTimer.current = window.setTimeout(() => {
        if (mode.current !== 'pending') return
        mode.current = 'wheel'
        openWheel(at, true)
      }, HOLD_MS)
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const m = mode.current
    if (m === 'idle' || m === 'scroll' || m === 'wheel') return
    const dx = e.clientX - startPt.current.x
    const dy = e.clientY - startPt.current.y
    if (m === 'pending') {
      if (Math.hypot(dx, dy) < SLOP) return
      window.clearTimeout(holdTimer.current)
      if (Math.abs(dx) > Math.abs(dy)) {
        mode.current = 'swipe'
        fgRef.current?.setPointerCapture?.(e.pointerId)
      } else {
        mode.current = 'scroll'
        return
      }
    }
    tracker.current.add(e.clientX, e.clientY)
    const w = trayW.current
    let nx = startPt.current.baseX + dx
    // rubber-band past both ends
    if (nx > 0) nx = nx * 0.25
    if (nx < -w) nx = -w + (nx + w) * 0.25
    setXNow(nx)
  }

  function onPointerUp() {
    window.clearTimeout(holdTimer.current)
    const m = mode.current
    mode.current = 'idle'
    if (m === 'swipe') {
      const { vx } = tracker.current.get()
      const w = trayW.current
      const open = vx < -500 || (vx <= 500 && xRef.current < -w / 2)
      snapTo(open ? -w : 0, vx)
    } else if (m === 'pending' && xRef.current !== 0) {
      snapTo(0) // tap on an open card closes the tray
    }
  }

  const actions: Action[] = [
    { key: 'remarks', label: 'Remarks', icon: <MessageOutlined />, bg: 'bg-blue', onClick: () => setRemarksOpen(true) },
    ...(canAssign
      ? [{
          key: 'assign',
          label: cheque.agentId ? 'Change agent' : 'Hand to agent',
          icon: <UserSwitchOutlined />,
          bg: 'bg-green-2',
          onClick: () => setAssignOpen(true),
        }]
      : []),
    ...(canEdit ? [{ key: 'edit', label: 'Edit', icon: <EditOutlined />, bg: 'bg-muted', onClick: () => setEditOpen(true) }] : []),
    ...(canRecordCash
      ? [{ key: 'cash', label: 'Record cash', icon: <DollarOutlined />, bg: 'bg-amber', onClick: () => setCashOpen(true) }]
      : []),
    ...(canHold
      ? [{ key: 'hold', label: 'Hold', icon: <PauseCircleOutlined />, bg: 'bg-[#b07d22]', onClick: () => void move(HOLD_STATUS) }]
      : []),
    ...(moves.length > 0
      ? [{ key: 'move', label: 'Move status', icon: <SwapOutlined />, bg: 'bg-green', onClick: () => openWheel(null, false) }]
      : []),
  ]

  const token = (
    <div className="w-44 overflow-hidden rounded-md border border-line bg-[#fbf8ee] shadow-card">
      <div className="truncate bg-green px-2 py-1 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">
        {cheque.bank}
      </div>
      <div className="px-2 py-1.5">
        <div className="truncate text-xs font-medium">{cheque.party}</div>
        <div className="font-mono text-sm font-bold">{formatNpr(Number(cheque.amountPaisa))}</div>
      </div>
    </div>
  )

  return (
    <div
      data-testid="cheque-widget"
      data-overdue={overdue}
      className="relative overflow-hidden rounded-md border border-line bg-ink shadow-card"
    >
      <div
        ref={trayRef}
        data-testid="action-tray"
        className="absolute inset-y-0 right-0 flex"
        aria-label="Cheque actions"
        onFocus={() => snapTo(-trayW.current)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) snapTo(0)
        }}
      >
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => {
              snapTo(0)
              a.onClick()
            }}
            className={`flex w-[62px] flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold leading-tight text-white ${a.bg} active:brightness-90`}
          >
            <span className="text-lg" aria-hidden>
              {a.icon}
            </span>
            {a.label}
          </button>
        ))}
      </div>

      <div
        ref={fgRef}
        data-testid="card-face"
        className="relative bg-[#fbf8ee] p-3 select-none [-webkit-touch-callout:none]"
        style={{ transform: `translateX(${x}px)`, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {overdue && (
          <div data-testid="overdue-stripe" className="absolute inset-y-0 left-0 z-10 w-1.5 bg-red" aria-hidden />
        )}
        <div
          data-testid="bank-banner"
          className="-mx-3 -mt-3 mb-2 bg-green px-4 py-1.5 font-display text-[13px] font-extrabold uppercase tracking-[0.12em] text-white"
        >
          {cheque.bank}
        </div>
        <button
          type="button"
          data-testid="more-actions"
          aria-label="Show actions"
          className="absolute right-1.5 top-1 hidden h-6 w-7 items-center justify-center rounded text-lg font-bold leading-none text-white/90 hover:bg-white/15 [@media(hover:hover)_and_(pointer:fine)]:flex"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => snapTo(xRef.current < 0 ? 0 : -trayW.current)}
        >
          ⋯
        </button>

        <div className="flex items-start justify-between gap-2 pl-1">
          <div className="pt-1">
            {overdue && <span className="text-xs font-semibold text-red">OVERDUE</span>}
            {matured && (
              <Tag color="green" className="!ml-1" data-testid="matured-tag">
                Matured: deposit or hand to agent
              </Tag>
            )}
          </div>
          <div className="text-right" data-testid="received-date">
            <div className="font-hand text-xl leading-tight text-ink" title={formatBsAd(cheque.receivedDate)}>
              {formatAdAsBsLong(cheque.receivedDate)}
            </div>
            <div className="font-mono text-[11px] text-muted">received · {formatAdAsBs(cheque.receivedDate)}</div>
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2 pl-1 text-sm">
          <span className="text-muted">Pay</span>
          <span className="flex-1 border-b border-dotted border-muted/60 font-medium">{cheque.party}</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 pl-1">
          <div className="text-xs text-muted" data-testid="custody">
            {cheque.agent ? `Brought by ${cheque.agent}` : recovery ? 'On hold at office (no agent)' : ' '}
          </div>
          <div className="rounded border-2 border-ink/60 px-2 py-1 font-mono text-base font-bold">
            {formatNpr(Number(cheque.amountPaisa))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 pl-1">
          <span className="font-mono text-sm tracking-[0.25em] text-ink">⑈{cheque.chequeNoNorm}⑈</span>
          <Tag color={colorFor(cheque.status)} className="!m-0">
            {labelFor(cheque.status)}
          </Tag>
        </div>

        {cheque.nextActionDate && !isTerminal(cheque.status) && (
          <div
            data-testid="follow-up"
            className={`mt-2 pl-1 text-xs ${followUpDue ? 'font-semibold text-red' : 'text-muted'}`}
          >
            Follow up: {formatAdAsBs(cheque.nextActionDate)}
            {followUpDue && ' (due)'}
          </div>
        )}

        {cheque.note && (
          <div data-testid="card-remark" className="mt-2 line-clamp-2 pl-1 text-xs italic text-muted">
            “{cheque.note}”
          </div>
        )}

        <div
          data-testid="maturity"
          className="-mx-3 -mb-3 mt-3 flex items-center justify-between gap-2 border-t border-line bg-paper px-4 py-1.5 font-mono text-[11px] text-muted"
        >
          <span>Matures {formatAdAsBs(cheque.maturityDate)}</span>
          <span className="font-sans text-[10px] text-muted/80" aria-hidden>
            {moves.length > 0 ? 'hold to move · ' : ''}swipe ← for actions
          </span>
        </div>
      </div>

      {wheel && (
        <StatusWheel
          options={moves}
          origin={wheel.origin}
          dragFromStart={wheel.drag}
          token={token}
          onPick={(s) => {
            setWheel(null)
            void move(s)
          }}
          onClose={() => setWheel(null)}
        />
      )}

      <Popup title="Remarks and follow-up" open={remarksOpen} onClose={() => setRemarksOpen(false)}>
        <RemarksPanel cheque={cheque} onChanged={onChanged} />
      </Popup>
      {canAssign && (
        <Popup title="Bounced cheque: hold or agent" open={assignOpen} onClose={() => setAssignOpen(false)}>
          <AssignAgentPanel
            cheque={cheque}
            onDone={() => {
              setAssignOpen(false)
              onChanged()
            }}
          />
        </Popup>
      )}
      {canEdit && (
        <Popup title="Edit cheque" open={editOpen} onClose={() => setEditOpen(false)}>
          <ChequeForm
            embedded
            cheque={cheque}
            onCancel={() => setEditOpen(false)}
            onAdded={() => {
              setEditOpen(false)
              onChanged()
            }}
          />
        </Popup>
      )}
      {canRecordCash && (
        <RecordCashModal
          cheque={cheque}
          open={cashOpen}
          onClose={() => setCashOpen(false)}
          onDone={() => {
            setCashOpen(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}
