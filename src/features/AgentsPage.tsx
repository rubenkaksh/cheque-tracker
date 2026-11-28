import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Statistic, Switch, Table, Tag } from 'antd'
import { listAgents, listCheques, setAgentActive, type Agent, type Cheque } from '../data/chequeRepo'
import { colorFor, labelFor } from '../data/transitions'
import { useAuth } from '../lib/auth'
import { formatAdAsBs, todayKathmandu } from '../lib/bsdate'
import { formatNpr } from '../lib/money'
import Popup from './Popup'
import QuickAddAgent from './QuickAddAgent'

/**
 * A cheque is physically with an agent while it is out for collection
 * (with_agent), or bounced/part-paid and handed to an agent for recovery.
 * agent_id is never cleared on later moves, so it alone is not enough:
 * a cheque back in office or deposited still carries its old agent_id.
 */
export function isWithAgent(c: Cheque): boolean {
  if (c.status === 'with_agent') return true
  return (c.status === 'bounced' || c.status === 'partial_cash') && !!c.agentId
}

interface AgentRow extends Agent {
  held: Cheque[]
  heldPaisa: bigint
}

export default function AgentsPage() {
  const { session } = useAuth()
  const selfId = session?.user.id
  const today = todayKathmandu()
  const [agents, setAgents] = useState<Agent[]>([])
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState<React.Key[] | null>(null)

  const reload = useCallback(async () => {
    try {
      const [a, c] = await Promise.allSettled([listAgents(true), listCheques()])
      if (a.status === 'fulfilled') setAgents(a.value)
      if (c.status === 'fulfilled') setCheques(c.value)
      const failed = [a, c].find((r) => r.status === 'rejected')
      if (failed) throw failed.reason
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load agents')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const rows: AgentRow[] = useMemo(
    () =>
      agents
        .map((a) => {
          const held = cheques
            .filter((c) => isWithAgent(c) && c.agentId === a.id)
            .sort((x, y) => x.maturityDate.localeCompare(y.maturityDate))
          return { ...a, held, heldPaisa: held.reduce((s, c) => s + c.amountPaisa, 0n) }
        })
        .sort((x, y) => y.held.length - x.held.length || x.name.localeCompare(y.name)),
    [agents, cheques],
  )

  const totalCount = rows.reduce((s, r) => s + r.held.length, 0)
  const totalPaisa = rows.reduce((s, r) => s + r.heldPaisa, 0n)
  // Open every agent who holds cheques until the user collapses one.
  const expandedKeys = expanded ?? rows.filter((r) => r.held.length > 0).map((r) => r.id)

  async function toggle(a: Agent, active: boolean) {
    setError(null)
    try {
      await setAgentActive(a.id, active)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update agent')
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold">Agents</h2>
        <Button type="primary" onClick={() => setAdding(true)}>
          Add agent
        </Button>
      </div>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <div className="mb-4 flex gap-8" data-testid="with-agents-summary">
        <Statistic title="Cheques with agents" value={totalCount} />
        <Statistic title="Amount with agents" value={formatNpr(Number(totalPaisa))} />
      </div>
      <Table<AgentRow>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={rows}
        scroll={{ x: true }}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpanded([...keys]),
          rowExpandable: (r) => r.held.length > 0,
          expandedRowRender: (r) => (
            <ul className="m-0 list-none p-0" data-testid={`held-${r.id}`}>
              {r.held.map((c) => {
                const overdue = c.maturityDate <= today
                return (
                  <li key={c.id} className="flex items-start justify-between gap-3 border-b border-black/5 py-2 last:border-0">
                    <div className="min-w-0">
                      <div className="font-semibold">{c.party}</div>
                      <div className="text-xs opacity-70">
                        {c.bank} · <span className="font-mono">{c.chequeNoNorm}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                        <Tag color={colorFor(c.status)} className="m-0">
                          {labelFor(c.status)}
                        </Tag>
                        <span className={overdue ? 'font-semibold text-red-600' : 'opacity-70'}>
                          {overdue ? 'Matured' : 'Matures'} {formatAdAsBs(c.maturityDate)}
                        </span>
                      </div>
                    </div>
                    <div className="whitespace-nowrap font-mono">{formatNpr(Number(c.amountPaisa))}</div>
                  </li>
                )
              })}
            </ul>
          ),
        }}
        locale={{ emptyText: <Empty description="No agents yet" /> }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Cheques held',
            key: 'held',
            align: 'right',
            render: (_, r) => r.held.length,
          },
          {
            title: 'Amount',
            key: 'amount',
            align: 'right',
            render: (_, r) => (r.held.length ? formatNpr(Number(r.heldPaisa)) : '–'),
          },
          {
            title: 'Active',
            dataIndex: 'active',
            render: (a: boolean | undefined, row) => (
              <Switch
                checked={a ?? true}
                disabled={row.id === selfId}
                aria-label={`Active ${row.name}`}
                onChange={(c) => void toggle(row, c)}
              />
            ),
          },
        ]}
      />
      <Popup title="Add agent" open={adding} onClose={() => setAdding(false)}>
        <QuickAddAgent
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false)
            void reload()
          }}
        />
      </Popup>
    </div>
  )
}
