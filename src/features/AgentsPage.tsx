import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Switch, Table } from 'antd'
import { listAgents, setAgentActive, type Agent } from '../data/chequeRepo'
import { useAuth } from '../lib/auth'
import Popup from './Popup'
import QuickAddAgent from './QuickAddAgent'

export default function AgentsPage() {
  const { session } = useAuth()
  const selfId = session?.user.id
  const [agents, setAgents] = useState<Agent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const reload = useCallback(async () => {
    try {
      setAgents(await listAgents(true))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load agents')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

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
      <Table<Agent>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={agents}
        scroll={{ x: true }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Role', key: 'role', render: () => 'Agent' },
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
