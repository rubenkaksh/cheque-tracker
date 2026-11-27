import { useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { createAgent, type Agent } from '../data/chequeRepo'

interface Values {
  fullName?: string
  email?: string
  password?: string
}

interface Props {
  onCreated: (agent: Agent) => void
  onCancel?: () => void
  submitLabel?: string
}

/** Admin-only add-agent form (calls the admin-create-agent Edge Function through the repo). */
export default function QuickAddAgent({ onCreated, onCancel, submitLabel = 'Add agent' }: Props) {
  const [form] = Form.useForm<Values>()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onFinish(v: Values) {
    setError(null)
    setSaving(true)
    try {
      const fullName = (v.fullName ?? '').trim()
      const created = await createAgent({ fullName, email: (v.email ?? '').trim(), password: v.password ?? '' })
      form.resetFields()
      onCreated({ id: created.id, name: fullName, active: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form<Values> name="quickAddAgent" form={form} layout="vertical" onFinish={onFinish}>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Form.Item
        label="Full name"
        name="fullName"
        rules={[
          { required: true, whitespace: true, message: 'Full name is required' },
          { min: 2, message: 'Full name must be at least 2 characters' },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Email"
        name="email"
        rules={[
          { required: true, message: 'Email is required' },
          { type: 'email', message: 'Enter a valid email' },
        ]}
      >
        <Input type="email" autoComplete="off" />
      </Form.Item>
      <Form.Item
        label="Password"
        name="password"
        rules={[
          { required: true, message: 'Password is required' },
          { min: 10, message: 'Password must be at least 10 characters' },
        ]}
        extra="The password is shown once. Tell the agent to change it after the first login."
      >
        <Input.Password autoComplete="new-password" />
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
