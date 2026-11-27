import { useEffect, useState } from 'react'
import { Alert, Form, Input, InputNumber, Modal, Select, message } from 'antd'
import { getBalance, recordReceipt, type Cheque, type ReceiptMethod } from '../data/chequeRepo'
import { todayKathmandu } from '../lib/bsdate'
import BsDateField from './BsDateField'
import { formatNpr, toPaisa } from '../lib/money'

interface Values {
  amount?: string | number | null
  method: ReceiptMethod
  date: string | null
  note?: string
}

const METHODS: { value: ReceiptMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
]

interface Props {
  cheque: Cheque
  open: boolean
  onClose: () => void
  onDone: () => void
}

export default function RecordCashModal({ cheque, open, onClose, onDone }: Props) {
  const [form] = Form.useForm<Values>()
  const [balance, setBalance] = useState<bigint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setError(null)
    getBalance(cheque.id)
      .then((b) => alive && setBalance(b))
      .catch(() => alive && setBalance(null))
    return () => {
      alive = false
    }
  }, [open, cheque.id])

  async function onFinish(v: Values) {
    setError(null)
    let paisa: bigint
    try {
      paisa = BigInt(toPaisa(String(v.amount ?? '')))
    } catch {
      setError('Amount must be a positive rupee amount with at most 2 decimals')
      return
    }
    if (balance !== null && paisa > balance) {
      setError(`Amount exceeds the outstanding balance of ${formatNpr(Number(balance))}`)
      return
    }
    setSaving(true)
    try {
      await recordReceipt({
        chequeId: cheque.id,
        amountPaisa: paisa,
        method: v.method,
        receivedOn: v.date ?? todayKathmandu(),
        note: v.note?.trim() || undefined,
      })
      message.success(`${cheque.party}: received ${formatNpr(Number(paisa))}`)
      form.resetFields()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record receipt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Record cash"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Record"
      confirmLoading={saving}
      destroyOnHidden
    >
      <div className="mb-3 text-sm text-muted" data-testid="receipt-balance">
        {cheque.party}, cheque {cheque.chequeNoNorm}.{' '}
        {balance !== null && <>Outstanding: {formatNpr(Number(balance))}</>}
      </div>
      {error && <Alert type="error" showIcon message={error} className="mb-3" />}
      <Form<Values>
        form={form}
        layout="vertical"
        initialValues={{ method: 'cash', date: todayKathmandu(), note: '' }}
        onFinish={onFinish}
      >
        <Form.Item label="Amount (NPR)" name="amount" required rules={[{ required: true, message: 'Amount is required' }]}>
          <InputNumber<string> stringMode min="0" step="0.01" precision={2} className="!w-full" />
        </Form.Item>
        <Form.Item label="Method" name="method" required>
          <Select options={METHODS} />
        </Form.Item>
        <Form.Item label="Date received" name="date" required>
          <BsDateField label="Date received" />
        </Form.Item>
        <Form.Item label="Note" name="note">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
