import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Select, Switch, Table } from 'antd'
import { listBanks, setBankActive, updateBank, type Bank, type BankKind } from '../data/chequeRepo'
import Popup from './Popup'
import QuickAddBank from './QuickAddBank'

interface EditValues {
  name?: string
  kind?: BankKind
}

function EditBankForm({ bank, onSaved, onCancel }: { bank: Bank; onSaved: () => void; onCancel: () => void }) {
  const [form] = Form.useForm<EditValues>()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onFinish(v: EditValues) {
    setError(null)
    setSaving(true)
    try {
      await updateBank(bank.id, { name: (v.name ?? '').trim(), kind: v.kind ?? 'bank' })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update bank')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form<EditValues>
      name="editBank"
      form={form}
      layout="vertical"
      initialValues={{ name: bank.name, kind: bank.kind ?? 'bank' }}
      onFinish={onFinish}
    >
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Form.Item
        label="Bank name"
        name="name"
        rules={[{ required: true, whitespace: true, message: 'Bank name is required' }]}
      >
        <Input />
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
          Save bank
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Form>
  )
}

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Bank | null>(null)

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
      <div className="mb-6">
        <QuickAddBank onCreated={() => void reload()} />
      </div>
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
          {
            title: '',
            key: 'edit',
            render: (_: unknown, b) => (
              <Button size="small" aria-label={`Edit ${b.name}`} onClick={() => setEditing(b)}>
                Edit
              </Button>
            ),
          },
        ]}
      />
      <Popup title="Edit bank" open={editing !== null} onClose={() => setEditing(null)}>
        {editing && (
          <EditBankForm
            bank={editing}
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
