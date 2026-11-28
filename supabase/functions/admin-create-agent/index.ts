// Admin-only: creates an auth user + profiles row. Never returns the password.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // Caller must be an active admin (checked as the caller, so RLS/auth.uid() apply).
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: u, error: uErr } = await caller.auth.getUser()
  if (uErr || !u.user) return json({ error: 'Not authenticated' }, 401)
  const { data: me } = await caller.from('profiles').select('role, active').eq('id', u.user.id).maybeSingle()
  if (me?.role !== 'admin' || me?.active !== true) return json({ error: 'Admin only' }, 403)

  let body: { email?: string; password?: string; full_name?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const fullName = (body.full_name ?? '').trim()
  const role = body.role === 'admin' ? 'admin' : 'agent'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email' }, 400)
  if (fullName.length < 2) return json({ error: 'Full name must be at least 2 characters' }, 400)
  if (password.length < 10) return json({ error: 'Password must be at least 10 characters' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (cErr || !created.user) {
    const dup = /already|registered|exists/i.test(cErr?.message ?? '')
    return json({ error: dup ? 'A user with this email already exists' : (cErr?.message ?? 'Could not create user') }, dup ? 409 : 400)
  }

  const { error: pErr } = await admin
    .from('profiles')
    .upsert({ id: created.user.id, full_name: fullName, role, active: true })
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id) // roll back
    return json({ error: `Could not create profile: ${pErr.message}` }, 500)
  }

  return json({ id: created.user.id, email, role })
})
