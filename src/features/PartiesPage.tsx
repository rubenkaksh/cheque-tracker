import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Table } from 'antd'
import { listParties, updateParty, type Party } from '../data/chequeRepo'
import Popup from './Popup'
import QuickAddParty from './QuickAddParty'

interface EditValues {
  name?: string
  phone?: string
  address?: string
}

function EditPartyForm({ party, onSaved, onCancel }: { party: Party; onSaved: () => void; onCancel: () => void }) {
  const [form] = Form.useForm<EditValues>()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onFinish(v: EditValues) {
    setError(null)
    setSaving(true)
    try {
      await updateParty(party.id, {
        name: (v.name ?? '').trim(),
        phone: v.phone?.trim() || null,
        address: v.address?.trim() || null,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update party')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form<EditValues>
      name="editParty"
      form={form}
      layout="vertical"
      initialValues={{ name: party.name, phone: party.phone ?? '', address: party.address ?? '' }}
      onFinish={onFinish}
    >
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Form.Item
        label="Party name"
        name="name"
        rules={[
          { required: true, whitespace: true, message: 'Party name is required' },
          { min: 2, message: 'Party name must be at least 2 characters' },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="Phone" name="phone">
        <Input />
      </Form.Item>
      <Form.Item label="Address" name="address">
        <Input />
      </Form.Item>
      <div className="flex gap-2">
        <Button type="primary" htmlType="submit" loading={saving}>
          Save party
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Form>
  )
}

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Party | null>(null)

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

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <h2 className="mb-4 font-display text-2xl font-bold">Parties</h2>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <div className="mb-6">
        <QuickAddParty onCreated={() => void reload()} />
      </div>
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
          {
            title: '',
            key: 'edit',
            render: (_: unknown, p) => (
              <Button size="small" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                Edit
              </Button>
            ),
          },
        ]}
      />
      <Popup title="Edit party" open={editing !== null} onClose={() => setEditing(null)}>
        {editing && (
          <EditPartyForm
            party={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              void reload()
            }}
          />
        )}
      </Popup>
    </div>
  )
}
