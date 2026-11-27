import { useState } from 'react'
import { Button, Dropdown, Tag, message } from 'antd'
import { formatAdAsBs, formatBsAd, todayKathmandu } from '../lib/bsdate'
import { formatNpr } from '../lib/money'
import { transitionCheque, type Cheque } from '../data/chequeRepo'
import RecordCashModal from './RecordCashModal'
import { colorFor, HOLD_STATUS, isMatured, isTerminal, labelFor, type ChequeStatus } from '../data/transitions'
import RemarksPanel from './RemarksPanel'
import AssignAgentPanel from './AssignAgentPanel'
import { useAuth } from '../lib/auth'
import ChequeForm from './ChequeForm'
import Popup from './Popup'

interface Props {
  cheque: Cheque
  overdue: boolean
  /** Statuses the CURRENT role may move this cheque to (from allowed_transitions). */
  allowedTo: ChequeStatus[]
  onChanged: () => void
}

/** transition_cheque refuses these: they only happen through record_receipt. */
const RECEIPT_ONLY: ChequeStatus[] = ['partial_cash', 'closed_full_cash']

export default function ChequeWidget({ cheque, overdue, allowedTo, onChanged }: Props) {
  const { role } = useAuth()
  const [cashOpen, setCashOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [remarksOpen, setRemarksOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const today = todayKathmandu()
  const matured = isMatured(cheque.status, cheque.maturityDate, today)
  const recovery = cheque.status === 'bounced' || cheque.status === 'partial_cash'
  const canAssign = role === 'admin' && recovery
  const followUpDue = !isTerminal(cheque.status) && !!cheque.nextActionDate && cheque.nextActionDate <= today
  const canEdit = role === 'admin' && !isTerminal(cheque.status)
  const receiptStage = cheque.status === 'bounced' || cheque.status === 'partial_cash'
  const moves = receiptStage ? allowedTo.filter((s) => !RECEIPT_ONLY.includes(s)) : allowedTo
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

  return (
    <div
      data-testid="cheque-widget"
      data-overdue={overdue}
      className="relative overflow-hidden rounded-md border border-line bg-[#fbf8ee] p-3 shadow-card"
    >
      {overdue && (
        <div
          data-testid="overdue-stripe"
          className="absolute inset-y-0 left-0 w-1.5 bg-red"
          aria-hidden
        />
      )}
      <div className="flex items-start justify-between gap-2 pl-1">
        <div>
          <div className="font-display text-sm font-bold text-green">{cheque.bank}</div>
          {overdue && <span className="text-xs font-semibold text-red">OVERDUE</span>}
          {matured && (
            <Tag color="green" className="!ml-1" data-testid="matured-tag">
              Matured: deposit or hand to agent
            </Tag>
          )}
        </div>
        <div className="text-right">
          <div className="rounded border border-muted/40 px-2 py-0.5 font-mono text-xs">
            {formatAdAsBs(cheque.maturityDate)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-muted">{formatBsAd(cheque.maturityDate)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2 pl-1 text-sm">
        <span className="text-muted">Pay</span>
        <span className="flex-1 border-b border-dotted border-muted/60 font-medium">{cheque.party}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 pl-1">
        <div className="text-xs text-muted" data-testid="custody">
          {cheque.agent ? `Agent: ${cheque.agent}` : recovery ? 'On hold at office (no agent)' : ' '}
        </div>
        <div className="rounded border-2 border-ink/60 px-2 py-1 font-mono text-base font-bold">
          {formatNpr(Number(cheque.amountPaisa))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 pl-1">
        <span className="font-mono text-sm tracking-[0.25em] text-ink">
          ⑈{cheque.chequeNoNorm}⑈
        </span>
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

        <div className="mt-3 flex flex-wrap gap-2 pl-1">
          <Button size="small" onClick={() => setRemarksOpen(true)}>
            Remarks
          </Button>
          {canAssign && (
            <Button size="small" onClick={() => setAssignOpen(true)}>
              {cheque.agentId ? 'Change agent' : 'Hand to agent'}
            </Button>
          )}
          {canEdit && (
            <Button size="small" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
          {canRecordCash && (
            <Button size="small" type="primary" onClick={() => setCashOpen(true)}>
              Record cash
            </Button>
          )}
          {canHold && (
            <Button size="small" onClick={() => void move(HOLD_STATUS)}>
              Hold
            </Button>
          )}
          {moves.length > 0 && (
          <Dropdown
            trigger={['click']}
            menu={{
              items: moves.map((s) => ({ key: s, label: labelFor(s) })),
              onClick: ({ key }) => void move(key as ChequeStatus),
            }}
          >
            <Button size="small" type="primary">
              Move status
            </Button>
          </Dropdown>
          )}
        </div>
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
