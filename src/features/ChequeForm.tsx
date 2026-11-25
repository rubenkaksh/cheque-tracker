import { useEffect, useState } from 'react'
import { Alert, AutoComplete, Button, DatePicker, Form, Input, InputNumber, Select, message } from 'antd'
import type { Rule } from 'antd/es/form'
import dayjs, { type Dayjs } from 'dayjs'
import { addCheque, addParty, listAgents, listBanks, listParties, type Agent, type Bank } from '../data/chequeRepo'
import { DEFAULT_STATUS, labelFor, type ChequeStatus } from '../data/transitions'
import { adToBs, formatBs, todayKathmandu } from '../lib/bsdate'
import { toPaisa } from '../lib/money'
import { chequeFormSchema, normaliseChequeNo } from '../lib/validation'

/** create_cheque accepts only these initial statuses for admins. */
const NEW_STATUSES: ChequeStatus[] = ['with_agent', 'paid_at_office', 'in_office', 'pdc_hold']

interface FormValues {
  bank?: string
  party?: string
  chequeNo?: string
  amount?: string | number | null
  receivedDate?: Dayjs | null
  maturityDate?: Dayjs | null
  status?: ChequeStatus
  agent?: string
  note?: string
}

const iso = (d?: Dayjs | null) => (d ? d.format('YYYY-MM-DD') : '')

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

function bsText(d?: Dayjs | null): string {
  if (!d) return ''
  try {
    return `BS ${formatBs(adToBs(iso(d)))}`
  } catch {
    return 'BS: out of supported range'
  }
}

export default function ChequeForm({ onAdded }: { onAdded: () => void }) {
  const [form] = Form.useForm<FormValues>()
  const [dupError, setDupError] = useState<string | null>(null)
  const chequeNo = Form.useWatch('chequeNo', form)
  const received = Form.useWatch('receivedDate', form)
  const maturity = Form.useWatch('maturityDate', form)
  const status = Form.useWatch('status', form)
  const note = Form.useWatch('note', form)

  const [banks, setBanks] = useState<Bank[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [parties, setParties] = useState<string[]>([])
  const [partyError, setPartyError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoadError(null)
    Promise.all([listBanks(), listAgents(), listParties()])
      .then(([b, a, c]) => {
        if (!alive) return
        setBanks(b)
        setAgents(a)
        setParties(c.map((x) => x.name))
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : 'Could not load form data')
      })
    return () => {
      alive = false
    }
  }, [reloadKey])
  async function onAddParty() {
    setPartyError(null)
    const name = String(form.getFieldValue('party') ?? '').trim()
    if (!name) {
      setPartyError('Type the new party name first')
      return
    }
    try {
      await addParty({ name })
      message.success(`Party added: ${name}`)
      setReloadKey((k) => k + 1)
    } catch (e) {
      setPartyError(e instanceof Error ? e.message : 'Could not add party')
    }
  }

  const earlyMaturity =
    received && maturity && maturity.isBefore(received.subtract(6, 'month'), 'day')

  async function onFinish(values: FormValues) {
    setDupError(null)
    const input = toSchemaInput(values)
    const parsed = chequeFormSchema.safeParse(input)
    if (!parsed.success) {
      message.error(parsed.error.issues[0].message)
      return
    }
    const v = parsed.data
    try {
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save cheque'
      if (msg.toLowerCase().includes('duplicate')) setDupError(msg)
      else message.error(msg)
      return
    }
    message.success('Cheque added')
    form.resetFields()
    onAdded()
  }

  return (
    <div className="mx-auto max-w-xl p-3 sm:p-6">
      <h2 className="mb-4 font-display text-2xl font-bold">New cheque</h2>
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
        initialValues={{ status: DEFAULT_STATUS, receivedDate: dayjs(todayKathmandu()), note: '' }}
        onFinish={onFinish}
      >
        <Form.Item label="Bank" name="bank" required rules={[zodRule('bank', 'bank')]}>
          <Select placeholder="Select bank" options={banks.map((b) => ({ value: b.id, label: b.name }))} />
        </Form.Item>
        {partyError && <Alert type="error" showIcon message={partyError} className="mb-4" />}
        <Form.Item label="Party" required>
          <div className="flex gap-2">
            <Form.Item name="party" noStyle rules={[zodRule('party', 'party')]}>
              <AutoComplete
                className="!flex-1"
                placeholder="Party name"
                options={parties.map((p) => ({ value: p }))}
                filterOption={(input, o) => (o?.value ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
            <Button onClick={() => void onAddParty()}>Add new party</Button>
          </div>
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
          extra={bsText(received)}
        >
          <DatePicker className="!w-full" />
        </Form.Item>
        <Form.Item
          label="Maturity date"
          name="maturityDate"
          required
          dependencies={['receivedDate']}
          rules={[zodRule('maturityDate', 'maturityDate')]}
          extra={
            <>
              {bsText(maturity)}
              {earlyMaturity && (
                <div className="text-amber">
                  Warning: maturity is more than 6 months before the received date.
                </div>
              )}
            </>
          }
        >
          <DatePicker className="!w-full" />
        </Form.Item>
        <Form.Item label="Status" name="status" required dependencies={['agent']}>
          <Select options={NEW_STATUSES.map((s) => ({ value: s, label: labelFor(s) }))} />
        </Form.Item>
        <Form.Item
          label="Agent"
          name="agent"
          required={status === 'with_agent'}
          dependencies={['status']}
          rules={[zodRule('agentId', 'agent')]}
        >
          <Select allowClear placeholder="Select agent" options={agents.map((a) => ({ value: a.id, label: a.name }))} />
        </Form.Item>
        <Form.Item label="Note" name="note" rules={[zodRule('note', 'note')]}>
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
        <span hidden>{note}</span>
        <Button type="primary" htmlType="submit" block>
          Add cheque
        </Button>
      </Form>
    </div>
  )
}
