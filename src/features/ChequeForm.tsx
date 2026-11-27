import { useEffect, useRef, useState } from 'react'
import { Alert, AutoComplete, Button, Form, Input, InputNumber, Select, message } from 'antd'
import type { Rule } from 'antd/es/form'
import dayjs from 'dayjs'
import {
  addCheque,
  addParty,
  listAgents,
  listBanks,
  listParties,
  normaliseName,
  updateCheque,
  type Agent,
  type Bank,
  type Cheque,
  type ChequePatch,
  type Party,
} from '../data/chequeRepo'
import { DEFAULT_STATUS, labelFor, type ChequeStatus } from '../data/transitions'
import { todayKathmandu } from '../lib/bsdate'
import BsDateField from './BsDateField'
import { toPaisa } from '../lib/money'
import { useAuth } from '../lib/auth'
import { chequeFormSchema, normaliseChequeNo } from '../lib/validation'
import Popup from './Popup'
import QuickAddAgent from './QuickAddAgent'
import QuickAddBank from './QuickAddBank'
import QuickAddParty from './QuickAddParty'

/** create_cheque accepts only these initial statuses for admins. */
const NEW_STATUSES: ChequeStatus[] = ['with_agent', 'paid_at_office', 'in_office', 'pdc_hold']

interface FormValues {
  bank?: string
  party?: string
  chequeNo?: string
  amount?: string | number | null
  receivedDate?: string | null
  maturityDate?: string | null
  status?: ChequeStatus
  agent?: string
  note?: string
}

/** Date fields hold AD ISO strings (BsDateField converts BS entry to AD). */
const iso = (d?: string | null) => d ?? ''

function toSchemaInput(v: FormValues) {
  return {
    party: v.party ?? '',
    bank: v.bank ?? '',
    chequeNo: v.chequeNo ?? '',
    amount: v.amount === undefined || v.amount === null ? '' : String(v.amount),
    maturityDate: iso(v.maturityDate),
    receivedDate: iso(v.receivedDate),
    status: v.status ?? '',
    agentId: v.agent ? v.agent : null,
    note: v.note ?? '',
  }
}

/** Per-field rule that runs the whole zod schema and reports only issues for this field. */
function zodRule(field: keyof ReturnType<typeof toSchemaInput>, formField: string): Rule {
  return ({ getFieldsValue }) => ({
    validator: async () => {
      const r = chequeFormSchema.safeParse(toSchemaInput(getFieldsValue(true) as FormValues))
      if (r.success) return
      const issue = r.error.issues.find((i) => i.path[0] === field)
      if (issue) throw new Error(issue.message)
      void formField
    },
  })
}

const CONFLICT = /changed by someone else|stale version/i

/** paisa -> "1234.50" (digit-string arithmetic, no floats). */
function paisaToRupees(p: bigint): string {
  const s = p.toString().padStart(3, '0')
  return `${s.slice(0, -2)}.${s.slice(-2)}`
}

type Quick = 'bank' | 'party' | 'agent' | null

/**
 * New-cheque form, or edit form when `cheque` is given (admin only; status stays on Move status).
 * `onAdded` runs after a successful save (and after a version conflict, so the caller refreshes).
 */
export default function ChequeForm({
  onAdded,
  embedded = false,
  cheque,
  onCancel,
}: {
  onAdded: () => void
  embedded?: boolean
  cheque?: Cheque
  onCancel?: () => void
}) {
  const editing = cheque !== undefined
  const { role, session } = useAuth()
  // Agents create only with_agent cheques for themselves (create_cheque enforces it too).
  const agentMode = role === 'agent'
  const selfId = session?.user.id
  const [form] = Form.useForm<FormValues>()
  const [dupError, setDupError] = useState<string | null>(null)
  const chequeNo = Form.useWatch('chequeNo', form)
  const received = Form.useWatch('receivedDate', form)
  const maturity = Form.useWatch('maturityDate', form)
  const status = Form.useWatch('status', form)
  const note = Form.useWatch('note', form)

  const [banks, setBanks] = useState<Bank[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [quick, setQuick] = useState<Quick>(null)
  const [saving, setSaving] = useState(false)
  // Edit mode: the ids/values the form started from, so only changed fields are sent.
  const initial = useRef<{ bankId?: string; agentId?: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoadError(null)
    Promise.all([listBanks(editing), listAgents(editing), listParties()])
      .then(([b, a, c]) => {
        if (!alive) return
        setBanks(b)
        setAgents(a)
        setParties(c)
        if (cheque && !initial.current) {
          const bankId = b.find((x) => x.name === cheque.bank)?.id
          const agentId = cheque.agent ? a.find((x) => x.name === cheque.agent)?.id : undefined
          initial.current = { bankId, agentId }
          form.setFieldsValue({ bank: bankId, agent: agentId })
        }
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : 'Could not load form data')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  /** Refetch a list after a quick-add; keep the new item even if the read does not return it (agent RLS on parties). */
  async function onQuickBank(b: Bank) {
    const fresh = await listBanks(editing).catch(() => banks)
    setBanks(fresh.some((x) => x.id === b.id) ? fresh : [...fresh, b])
    form.setFieldValue('bank', b.id)
    setQuick(null)
    message.success(`Bank added: ${b.name}`)
  }
  async function onQuickParty(p: Party) {
    const fresh = await listParties().catch(() => parties)
    setParties(fresh.some((x) => x.id === p.id) ? fresh : [...fresh, p])
    form.setFieldValue('party', p.name)
    setQuick(null)
    message.success(`Party added: ${p.name}`)
  }
  async function onQuickAgent(a: Agent) {
    const fresh = await listAgents(editing).catch(() => agents)
    setAgents(fresh.some((x) => x.id === a.id) ? fresh : [...fresh, a])
    form.setFieldValue('agent', a.id)
    setQuick(null)
    message.success(`Agent added: ${a.name}`)
  }

  const earlyMaturity =
    received && maturity && dayjs(maturity).isBefore(dayjs(received).subtract(6, 'month'), 'day')

  async function onFinish(values: FormValues) {
    setDupError(null)
    const input = toSchemaInput({ ...(form.getFieldsValue(true) as FormValues), ...values })
    const parsed = chequeFormSchema.safeParse(input)
    if (!parsed.success) {
      message.error(parsed.error.issues[0].message)
      return
    }
    const v = parsed.data
    setSaving(true)
    try {
      if (cheque) {
        await saveEdit(cheque, v)
      } else {
        await addCheque({
          bankId: v.bank,
          party: v.party,
          chequeNo: v.chequeNo,
          amountPaisa: BigInt(toPaisa(v.amount)),
          receivedDate: v.receivedDate,
          maturityDate: v.maturityDate,
          status: v.status as ChequeStatus,
          agentId: v.agentId ?? undefined,
          note: v.note || undefined,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save cheque'
      if (cheque && CONFLICT.test(msg)) {
        message.error('This cheque changed, reload')
        onAdded()
      } else if (msg.toLowerCase().includes('duplicate')) setDupError(msg)
      else message.error(msg)
      return
    } finally {
      setSaving(false)
    }
    message.success(cheque ? 'Cheque updated' : 'Cheque added')
    if (!cheque) form.resetFields()
    onAdded()
  }

  /** Builds a patch of only the changed fields and sends it with the cheque's current version. */
  async function saveEdit(c: Cheque, v: ReturnType<typeof chequeFormSchema.parse>) {
    const patch: ChequePatch = {}
    if (v.bank !== initial.current?.bankId) patch.bankId = v.bank
    if (normaliseName(v.party) !== normaliseName(c.party)) {
      const known = parties.find((p) => normaliseName(p.name) === normaliseName(v.party))
      patch.partyId = known ? known.id : await addParty({ name: v.party })
    }
    if (v.chequeNo !== c.chequeNoNorm) patch.chequeNo = v.chequeNo
    const paisa = BigInt(toPaisa(v.amount))
    if (paisa !== c.amountPaisa) patch.amountPaisa = paisa
    if (v.receivedDate !== c.receivedDate) patch.receivedDate = v.receivedDate
    if (v.maturityDate !== c.maturityDate) patch.maturityDate = v.maturityDate
    if ((v.agentId ?? undefined) !== initial.current?.agentId) patch.agentId = v.agentId
    if (v.note !== (c.note ?? '')) patch.note = v.note === '' ? null : v.note
    if (Object.keys(patch).length === 0) return
    await updateCheque(c.id, c.version, patch)
  }

  return (
    <div className={embedded ? '' : 'mx-auto max-w-xl p-3 sm:p-6'}>
      {!embedded && <h2 className="mb-4 font-display text-2xl font-bold">New cheque</h2>}
      {loadError && (
        <Alert
          type="error"
          showIcon
          message={loadError}
          className="mb-4"
          action={
            <Button size="small" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          }
        />
      )}
      {dupError && <Alert type="error" showIcon message={dupError} className="mb-4" />}
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark
        validateTrigger={['onChange', 'onBlur']}
        initialValues={
          cheque
            ? {
                party: cheque.party,
                chequeNo: cheque.chequeNoNorm,
                amount: paisaToRupees(cheque.amountPaisa),
                receivedDate: cheque.receivedDate,
                maturityDate: cheque.maturityDate,
                status: cheque.status,
                note: cheque.note ?? '',
              }
            : {
                status: agentMode ? 'with_agent' : DEFAULT_STATUS,
                agent: agentMode ? selfId : undefined,
                receivedDate: todayKathmandu(),
                note: '',
              }
        }
        onFinish={onFinish}
      >
        <Form.Item
          label="Bank"
          name="bank"
          required
          rules={[zodRule('bank', 'bank')]}
          extra={
            !agentMode && (
              <Button type="link" size="small" className="!px-0" onClick={() => setQuick('bank')}>
                + Add bank
              </Button>
            )
          }
        >
          <Select placeholder="Select bank" options={banks.map((b) => ({ value: b.id, label: b.name }))} />
        </Form.Item>
        <Form.Item
          label="Party"
          name="party"
          required
          rules={[zodRule('party', 'party')]}
          extra={
            <Button type="link" size="small" className="!px-0" onClick={() => setQuick('party')}>
              + Add party
            </Button>
          }
        >
          <AutoComplete
            placeholder="Party name"
            options={parties.map((p) => ({ value: p.name }))}
            filterOption={(input, o) => (o?.value ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
        <Form.Item
          label="Cheque no"
          name="chequeNo"
          required
          rules={[zodRule('chequeNo', 'chequeNo')]}
          extra={chequeNo ? `Normalised: ${normaliseChequeNo(chequeNo)}` : undefined}
        >
          <Input placeholder="e.g. 100-009" />
        </Form.Item>
        <Form.Item label="Amount (NPR)" name="amount" required rules={[zodRule('amount', 'amount')]}>
          <InputNumber<string> stringMode min="0" step="0.01" precision={2} className="!w-full" />
        </Form.Item>
        <Form.Item
          label="Received date"
          name="receivedDate"
          required
          dependencies={['maturityDate']}
          rules={[zodRule('receivedDate', 'receivedDate')]}
        >
          <BsDateField label="Received date" />
        </Form.Item>
        <Form.Item
          label="Maturity date"
          name="maturityDate"
          required
          dependencies={['receivedDate']}
          rules={[zodRule('maturityDate', 'maturityDate')]}
          extra={
            earlyMaturity ? (
              <div className="text-amber">
                Warning: maturity is more than 6 months before the received date.
              </div>
            ) : undefined
          }
        >
          <BsDateField label="Maturity date" />
        </Form.Item>
        {!agentMode && (
          <>
        {!editing && (
        <Form.Item label="Status" name="status" required dependencies={['agent']}>
          <Select options={NEW_STATUSES.map((s) => ({ value: s, label: labelFor(s) }))} />
        </Form.Item>
        )}
        <Form.Item
          label="Agent"
          name="agent"
          required={status === 'with_agent'}
          dependencies={['status']}
          rules={[zodRule('agentId', 'agent')]}
          extra={
            <Button type="link" size="small" className="!px-0" onClick={() => setQuick('agent')}>
              + Add agent
            </Button>
          }
        >
          <Select allowClear placeholder="Select agent" options={agents.map((a) => ({ value: a.id, label: a.name }))} />
        </Form.Item>
          </>
        )}
        <Form.Item label="Note" name="note" rules={[zodRule('note', 'note')]}>
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
        <span hidden>{note}</span>
        <div className="flex gap-2">
          <Button type="primary" htmlType="submit" block loading={saving}>
            {editing ? 'Save changes' : 'Add cheque'}
          </Button>
          {editing && onCancel && <Button onClick={onCancel}>Cancel</Button>}
        </div>
      </Form>
      {/* Rendered outside the <Form>: React bubbles submit events through portals, which would submit the cheque form. */}
      <Popup title="Add bank" open={quick === 'bank'} onClose={() => setQuick(null)}>
        <QuickAddBank onCreated={(b) => void onQuickBank(b)} onCancel={() => setQuick(null)} />
      </Popup>
      <Popup title="Add party" open={quick === 'party'} onClose={() => setQuick(null)}>
        <QuickAddParty onCreated={(p) => void onQuickParty(p)} onCancel={() => setQuick(null)} />
      </Popup>
      <Popup title="Add agent" open={quick === 'agent'} onClose={() => setQuick(null)}>
        <QuickAddAgent onCreated={(a) => void onQuickAgent(a)} onCancel={() => setQuick(null)} />
      </Popup>
    </div>
  )
}
