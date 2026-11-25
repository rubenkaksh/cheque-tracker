import { useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { getSupabase } from '../lib/supabase'

interface Values {
  email: string
  password: string
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFinish(v: Values) {
    setError(null)
    setBusy(true)
    try {
      const { error: err } = await getSupabase().auth.signInWithPassword({
        email: v.email,
        password: v.password,
      })
      if (err) setError(err.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 font-display text-2xl font-bold">Collection Desk: sign in</h1>
      {error && <Alert type="error" showIcon message={error} className="mb-4" />}
      <Form<Values> layout="vertical" onFinish={onFinish}>
        <Form.Item label="Email" name="email" rules={[{ required: true, message: 'Enter your email' }]}>
          <Input type="email" autoComplete="username" />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Enter your password' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={busy}>
          Sign in
        </Button>
      </Form>
    </div>
  )
}
