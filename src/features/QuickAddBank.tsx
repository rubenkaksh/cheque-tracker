import { useState } from 'react'
import { Alert, Button, Form, Input, Select } from 'antd'
import { addBank, listBanks, normaliseName, type Bank, type BankKind } from '../data/chequeRepo'

interface Values {
  name?: string
  kind?: BankKind
}

interface Props {
  /** Called with the saved bank (looked up after the insert, so it carries the real id). */
  onCreated: (bank: Bank) => void
  onCancel?: () => void
  submitLabel?: string
}

/** Small add-bank form shared by the cheque form popup and the Banks page. Errors show inline. */
export default function QuickAddBank({ onCreated, onCancel, submitLabel = 'Add bank' }: Props) {
  const [form] = Form.useForm<Values>()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onFinish(v: Values) {
    setError(null)
    setSaving(true)
    try {
      const name = (v.name ?? '').trim()
      await addBank({ name, kind: v.kind ?? 'bank' })
      const saved = (await listBanks(true)).find((b) => normaliseName(b.name) === normaliseName(name))
      form.resetFields()
      onCreated(saved ?? { id: '', name, kind: v.kind ?? 'bank', active: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add bank')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form<Values> name="quickAddBank" form={form} layout="vertical" initialValues={{ kind: 'bank' }} onFinish={onFinish}>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Form.Item
        label="Bank name"
        name="name"
        rules={[{ required: true, whitespace: true, message: 'Bank name is required' }]}
      >
        <Input placeholder="e.g. Test Bank Omega" />
      </Form.Item>
      <Form.Item label="Kind" name="kind" rules={[{ required: true }]}>
        <Select
          options={[
            { value: 'bank', label: 'Bank' },
            { value: 'saccos', label: 'SACCOS' },
          ]}
        />
      </Form.Item>
      <div className="flex gap-2">
        <Button type="primary" htmlType="submit" loading={saving}>
          {submitLabel}
        </Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
      </div>
    </Form>
  )
}
