import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Select, Switch, Table } from 'antd'
import { addBank, listBanks, setBankActive, type Bank, type BankKind } from '../data/chequeRepo'

interface Values {
  name?: string
  kind?: BankKind
}

export default function BanksPage() {
  const [form] = Form.useForm<Values>()
  const [banks, setBanks] = useState<Bank[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try {
      setBanks(await listBanks(true))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load banks')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function onFinish(v: Values) {
    setError(null)
    setSaving(true)
    try {
      await addBank({ name: v.name ?? '', kind: v.kind ?? 'bank' })
      form.resetFields()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add bank')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(b: Bank, active: boolean) {
    setError(null)
    try {
      await setBankActive(b.id, active)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update bank')
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <h2 className="mb-4 font-display text-2xl font-bold">Banks</h2>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Form<Values>
        form={form}
        layout="vertical"
        initialValues={{ kind: 'bank' }}
        onFinish={onFinish}
        className="mb-6"
      >
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
        <Button type="primary" htmlType="submit" loading={saving}>
          Add bank
        </Button>
      </Form>
      <Table<Bank>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={banks}
        scroll={{ x: true }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Kind', dataIndex: 'kind', render: (k: string | null) => (k === 'saccos' ? 'SACCOS' : k === 'bank' ? 'Bank' : '') },
          {
            title: 'Active',
            dataIndex: 'active',
            render: (a: boolean, b) => (
              <Switch checked={a} aria-label={`Active ${b.name}`} onChange={(c) => void toggle(b, c)} />
            ),
          },
        ]}
      />
    </div>
  )
}
