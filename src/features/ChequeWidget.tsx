import { Button, Dropdown, Tag, message } from 'antd'
import { adToBs, formatBs } from '../lib/bsdate'
import { formatNpr } from '../lib/money'
import { transitionCheque, type Cheque } from '../data/chequeRepo'
import { colorFor, HOLD_STATUS, labelFor, TRANSITIONS, type ChequeStatus } from '../data/transitions'

function bsOf(iso: string): string {
  try {
    return formatBs(adToBs(iso))
  } catch {
    return '-'
  }
}

interface Props {
  cheque: Cheque
  overdue: boolean
  onChanged: () => void
}

export default function ChequeWidget({ cheque, overdue, onChanged }: Props) {
  const moves = TRANSITIONS[cheque.status]
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
        </div>
        <div className="text-right">
          <div className="rounded border border-muted/40 px-2 py-0.5 font-mono text-xs">
            {cheque.maturityDate}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-muted">BS {bsOf(cheque.maturityDate)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2 pl-1 text-sm">
        <span className="text-muted">Pay</span>
        <span className="flex-1 border-b border-dotted border-muted/60 font-medium">{cheque.party}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 pl-1">
        <div className="text-xs text-muted">{cheque.agent ? `Agent: ${cheque.agent}` : ' '}</div>
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

      {moves.length > 0 && (
        <div className="mt-3 flex gap-2 pl-1">
          {canHold && (
            <Button size="small" onClick={() => void move(HOLD_STATUS)}>
              Hold
            </Button>
          )}
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
        </div>
      )}
    </div>
  )
}
