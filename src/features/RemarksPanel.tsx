import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Form, Input, Spin, message } from 'antd'
import { addDays, addRemark, listRemarks, type Cheque, type Remark } from '../data/chequeRepo'
import { isTerminal } from '../data/transitions'
import { formatAdAsBs, todayKathmandu } from '../lib/bsdate'
import BsDateField from './BsDateField'

interface Values {
  remark: string
  setFollowUp: boolean
  followUp: string | null
}

/** Follow-up log for one cheque (diagram: "Follow up - Remarks"). */
export default function RemarksPanel({ cheque, onChanged }: { cheque: Cheque; onChanged: () => void }) {
  const today = todayKathmandu()
  const [form] = Form.useForm<Values>()
  const [items, setItems] = useState<Remark[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const setFollowUp = Form.useWatch('setFollowUp', form)
  const canFollowUp = !isTerminal(cheque.status)

  const load = useCallback(async () => {
    try {
      setItems(await listRemarks(cheque.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load remarks')
      setItems([])
    }
  }, [cheque.id])

  useEffect(() => {
    void load()
  }, [load])

  async function onFinish(v: Values) {
    setError(null)
    setSaving(true)
    try {
      await addRemark(cheque.id, v.remark.trim(), v.setFollowUp && v.followUp ? v.followUp : undefined)
      message.success('Remark saved')
      form.resetFields()
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save remark')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="remarks-panel">
      <div className="mb-3 text-sm text-muted">
        {cheque.party}, cheque {cheque.chequeNoNorm}.
        {cheque.nextActionDate && <> Follow up on {formatAdAsBs(cheque.nextActionDate)}.</>}
      </div>
      {error && <Alert type="error" showIcon message={error} className="mb-3" />}
      <Form<Values>
        form={form}
        layout="vertical"
        initialValues={{ remark: '', setFollowUp: false, followUp: addDays(today, 7) }}
        onFinish={onFinish}
      >
        <Form.Item
          label="Remark"
          name="remark"
          rules={[{ required: true, whitespace: true, message: 'Write what happened' }]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount placeholder="e.g. Met the party, promised cash on Friday" />
        </Form.Item>
        {canFollowUp && (
          <Form.Item name="setFollowUp" valuePropName="checked" className="!mb-2">
            <Checkbox>Set next follow-up date</Checkbox>
          </Form.Item>
        )}
        {canFollowUp && setFollowUp && (
          <Form.Item label="Follow up on" name="followUp" required>
            <BsDateField label="Follow up on" min={today} />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={saving}>
          Add remark
        </Button>
      </Form>

      <div className="mt-5 border-t border-line pt-3">
        {items === null ? (
          <Spin />
        ) : items.length === 0 ? (
          <Empty description="No remarks yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <ul className="flex flex-col gap-3" data-testid="remarks-list">
            {items.map((r) => (
              <li key={r.id} className="rounded border border-line p-2 text-sm">
                <div className="whitespace-pre-wrap">{r.note}</div>
                <div className="mt-1 text-xs text-muted">
                  {r.author ?? 'Unknown'} · {formatAdAsBs(r.at.slice(0, 10))}
                  {r.nextActionDate && <> · follow up {formatAdAsBs(r.nextActionDate)}</>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
