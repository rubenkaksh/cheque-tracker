import { useEffect, useState } from 'react'
import { Alert, Button, Select, message } from 'antd'
import { listAgents, updateCheque, type Agent, type Cheque } from '../data/chequeRepo'

/**
 * Admin: hand a bounced cheque to an agent for recovery, or keep it on Hold (no agent).
 * Diagram: Bounced cheque -> Hold / Agents. Uses update_cheque (agent_id).
 */
export default function AssignAgentPanel({ cheque, onDone }: { cheque: Cheque; onDone: () => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState<string | undefined>(cheque.agentId)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listAgents()
      .then(setAgents)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load agents'))
  }, [])

  async function save(id: string | null) {
    setError(null)
    setSaving(true)
    try {
      await updateCheque(cheque.id, cheque.version, { agentId: id })
      message.success(id ? `${cheque.party}: handed to agent` : `${cheque.party}: kept on hold`)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update cheque')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="assign-agent-panel" className="flex flex-col gap-3">
      <div className="text-sm text-muted">
        {cheque.party}, cheque {cheque.chequeNoNorm}. An agent follows up with the party and adds remarks;
        with no agent the cheque stays on hold at the office.
      </div>
      {error && <Alert type="error" showIcon message={error} />}
      <Select
        aria-label="Agent"
        placeholder="Choose agent"
        value={agentId}
        onChange={setAgentId}
        options={agents.map((a) => ({ value: a.id, label: a.name }))}
      />
      <div className="flex gap-2">
        <Button type="primary" loading={saving} disabled={!agentId || agentId === cheque.agentId} onClick={() => void save(agentId ?? null)}>
          Hand to agent
        </Button>
        <Button loading={saving} disabled={!cheque.agentId} onClick={() => void save(null)}>
          Keep on hold (no agent)
        </Button>
      </div>
    </div>
  )
}
