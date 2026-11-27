import { useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { addParty, type Party } from '../data/chequeRepo'

interface Values {
  name?: string
  phone?: string
  address?: string
}

interface Props {
  onCreated: (party: Party) => void
  onCancel?: () => void
  submitLabel?: string
}

/** Small add-party form shared by the cheque form popup and the Parties page. */
export default function QuickAddParty({ onCreated, onCancel, submitLabel = 'Add party' }: Props) {
  const [form] = Form.useForm<Values>()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onFinish(v: Values) {
    setError(null)
    setSaving(true)
    try {
      const name = (v.name ?? '').trim()
      const id = await addParty({ name, phone: v.phone, address: v.address })
      form.resetFields()
      onCreated({ id, name, phone: v.phone?.trim() || null, address: v.address?.trim() || null })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add party')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form<Values> name="quickAddParty" form={form} layout="vertical" onFinish={onFinish}>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Form.Item
        label="Party name"
        name="name"
        rules={[
          { required: true, whitespace: true, message: 'Party name is required' },
          { min: 2, message: 'Party name must be at least 2 characters' },
        ]}
      >
        <Input placeholder="e.g. Test Party Omega" />
      </Form.Item>
      <Form.Item label="Phone" name="phone">
        <Input />
      </Form.Item>
      <Form.Item label="Address" name="address">
        <Input />
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
