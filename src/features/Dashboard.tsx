import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Drawer, Empty, Grid, Input, Modal, Segmented, Select, Spin, Statistic, Typography } from 'antd'
import { addDays, listAllowedTransitions, listCheques, type AllowedTransition, type Cheque } from '../data/chequeRepo'
import { useAuth } from '../lib/auth'
import { ALL_STATUSES, isTerminal, labelFor, type ChequeStatus } from '../data/transitions'
import { adToBs, formatBs, todayKathmandu } from '../lib/bsdate'
import ChequeForm from './ChequeForm'
import ChequeWidget from './ChequeWidget'

type Range = 'critical' | 'today' | 'overdue' | 'week' | 'all'

export default function Dashboard() {
  const today = todayKathmandu()
  const { role } = useAuth()
  const screens = Grid.useBreakpoint()
  const [newOpen, setNewOpen] = useState(false)
  const [allowed, setAllowed] = useState<AllowedTransition[]>([])
  const [all, setAll] = useState<Cheque[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('critical')
  const [status, setStatus] = useState<ChequeStatus | undefined>()
  const [bank, setBank] = useState<string | undefined>()
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setAll(await listCheques())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load cheques')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    listAllowedTransitions()
      .then(setAllowed)
      .catch(() => setAllowed([]))
  }, [])

  const movesFor = (from: ChequeStatus): ChequeStatus[] =>
    allowed.filter((a) => a.role === role && a.from === from).map((a) => a.to)

  const newForm = (
    <ChequeForm
      embedded
      onAdded={() => {
        setNewOpen(false)
        void load()
      }}
    />
  )

  const open = all.filter((c) => !isTerminal(c.status))
  const dueToday = open.filter((c) => c.maturityDate === today).length
  const overdueCount = open.filter((c) => c.maturityDate < today).length
  const banks = Array.from(new Set(all.map((c) => c.bank))).sort()

  const weekEnd = addDays(today, 6)
  const needle = q.trim().toLowerCase().replace(/[\s-]/g, '')
  const rows: Cheque[] = all
    .filter((c) => {
      const o = !isTerminal(c.status)
      if (range === 'critical' && !(o && c.maturityDate <= today)) return false
      if (range === 'today' && !(o && c.maturityDate === today)) return false
      if (range === 'overdue' && !(o && c.maturityDate < today)) return false
      if (range === 'week' && !(o && c.maturityDate >= today && c.maturityDate <= weekEnd)) return false
      if (status && c.status !== status) return false
      if (bank && c.bank !== bank) return false
      if (needle) {
        const hay = `${c.party} ${c.chequeNoNorm}`.toLowerCase().replace(/[\s-]/g, '')
        if (!hay.includes(needle)) return false
      }
      return true
    })
    .sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          Dashboard
        </Typography.Title>
        <Button type="primary" size="large" onClick={() => setNewOpen(true)}>
          New cheque
        </Button>
      </div>
      {screens.md ? (
        <Modal title="New cheque" open={newOpen} onCancel={() => setNewOpen(false)} footer={null} destroyOnHidden>
          {newForm}
        </Modal>
      ) : (
        <Drawer title="New cheque" open={newOpen} onClose={() => setNewOpen(false)} size="large" placement="bottom" destroyOnHidden>
          {newForm}
        </Drawer>
      )}
      <div data-testid="today" className="mb-4 text-muted">
        Today: {today} (AD) / {formatBs(adToBs(today))} (BS)
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Statistic title="Due today" value={dueToday} />
        <Statistic title="Overdue" value={overdueCount} styles={{ content: { color: '#c65a4c' } }} />
        <Statistic title="Total open" value={open.length} />
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="overflow-x-auto">
          <Segmented<Range>
            value={range}
            onChange={setRange}
            options={[
              { label: 'Critical today', value: 'critical' },
              { label: 'Due today', value: 'today' },
              { label: 'Overdue', value: 'overdue' },
              { label: 'This week', value: 'week' },
              { label: 'All', value: 'all' },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            allowClear
            placeholder="Status"
            value={status}
            onChange={setStatus}
            options={ALL_STATUSES.map((s) => ({ value: s, label: labelFor(s) }))}
          />
          <Select
            allowClear
            placeholder="Bank"
            value={bank}
            onChange={setBank}
            options={banks.map((b) => ({ value: b, label: b }))}
          />
          <Input.Search
            allowClear
            placeholder="Party or cheque no"
            onChange={(e) => setQ(e.target.value)}
            onSearch={setQ}
          />
        </div>
      </div>

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message={loadError}
          action={
            <Button size="small" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : loading && all.length === 0 ? (
        <Spin className="!block !my-8" />
      ) : rows.length === 0 ? (
        <Empty description="No cheques match" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <ChequeWidget
              key={c.id}
              cheque={c}
              overdue={!isTerminal(c.status) && c.maturityDate < today}
              allowedTo={movesFor(c.status)}
              onChanged={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  )
}
