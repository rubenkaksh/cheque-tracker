import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Table } from 'antd'
import { addParty, listParties, type Party } from '../data/chequeRepo'

interface Values {
  name?: string
  phone?: string
  address?: string
}

export default function PartiesPage() {
  const [form] = Form.useForm<Values>()
  const [parties, setParties] = useState<Party[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    try {
      setParties(await listParties())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load parties')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function onFinish(v: Values) {
    setError(null)
    setSaving(true)
    try {
      await addParty({ name: v.name ?? '', phone: v.phone, address: v.address })
      form.resetFields()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add party')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <h2 className="mb-4 font-display text-2xl font-bold">Parties</h2>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Form<Values> form={form} layout="vertical" onFinish={onFinish} className="mb-6">
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
        <Button type="primary" htmlType="submit" loading={saving}>
          Add party
        </Button>
      </Form>
      <Table<Party>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={parties}
        scroll={{ x: true }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Phone', dataIndex: 'phone' },
          { title: 'Address', dataIndex: 'address' },
        ]}
      />
    </div>
  )
}
