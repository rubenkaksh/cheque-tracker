// Seed synthetic demo data through the app's normal paths (admin login, RLS, RPCs). No service role.
// Usage: VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... SEED_EMAIL=... SEED_PASSWORD=... npm run seed:demo
// Allowed targets: http://127.0.0.1 (local stack) or https://*.supabase.co. Synthetic "Test ..." data only.
import { createClient } from '@supabase/supabase-js'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, SEED_EMAIL: email, SEED_PASSWORD: password } = process.env
if (!url || !key || !email || !password) {
  console.error('Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SEED_EMAIL and SEED_PASSWORD.')
  process.exit(1)
}
if (!/^http:\/\/127\.0\.0\.1(:\d+)?(\/|$)/.test(url) && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.error(`Refusing to run: ${url} is not http://127.0.0.1 or https://*.supabase.co`)
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const die = (what, e) => {
  console.error(`FAILED ${what}: ${e?.message ?? e}`)
  process.exit(1)
}

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' })
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

const BANKS = [
  ['Test Bank Alpha', 'bank'], ['Test Bank Beta', 'bank'], ['Test Bank Gamma', 'bank'],
  ['Test Bank Delta', 'bank'], ['Test Bank Epsilon (SACCOS)', 'saccos'], ['Test Bank Zeta (SACCOS)', 'saccos'],
]
const PARTIES = ['Test Party Alpha', 'Test Party Beta', 'Test Party Gamma', 'Test Party Delta']
// [cheque no, rupees, maturity offset (days from today), initial status, move to]
const CHEQUES = [
  ['TEST1001', 125000, 0, 'in_office'],
  ['TEST1002', 99999, 0, 'with_agent'],
  ['TEST1003', 48500, -3, 'with_agent'],
  ['TEST1004', 87250, -1, 'in_office'],
  ['TEST1005', 22000, -12, 'in_office'],
  ['TEST1006', 310000, 15, 'in_office'],
  ['TEST1007', 31500, -2, 'in_office', 'deposited'],
  ['TEST1008', 56000, 3, 'in_office', 'pdc_hold'],
]

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password })
if (authErr) die('sign in', authErr)
const { data: me } = await sb.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
if (me?.role !== 'admin') die('role check', 'SEED_EMAIL must be an admin')

const summary = { banks: 0, parties: 0, cheques: 0, moved: 0, skipped: [] }

// Banks
const { data: banks, error: be } = await sb.from('banks').select('id, name')
if (be) die('list banks', be)
for (const [name, kind] of BANKS) {
  if (banks.some((b) => b.name === name)) { summary.skipped.push(`bank ${name}`); continue }
  const { error } = await sb.from('banks').insert({ name, kind })
  if (error) die(`bank ${name}`, error)
  summary.banks++
}
// Parties
const { data: parties, error: pe } = await sb.from('parties').select('id, name')
if (pe) die('list parties', pe)
for (const name of PARTIES) {
  if (parties.some((p) => p.name.toLowerCase() === name.toLowerCase())) { summary.skipped.push(`party ${name}`); continue }
  const { error } = await sb.rpc('upsert_party', { name, phone: null, address: 'Test Town' })
  if (error) die(`party ${name}`, error)
  summary.parties++
}

// Cheques
const { data: existing, error: ce } = await sb.from('cheques').select('cheque_no_norm').like('cheque_no_norm', 'TEST%')
if (ce) die('list cheques', ce)
if (existing.length) {
  summary.skipped.push(`cheques (${existing.length} TEST* already exist)`)
} else {
  const { data: bs } = await sb.from('banks').select('id, name').in('name', BANKS.map((b) => b[0]))
  const { data: ps } = await sb.from('parties').select('id, name').in('name', PARTIES)
  const { data: agents, error: ae } = await sb.from('profiles').select('id').eq('role', 'agent').eq('active', true).limit(1)
  if (ae) die('find agent', ae)
  const agentId = agents?.[0]?.id ?? null
  for (const [i, [no, rupees, off, status, moveTo]] of CHEQUES.entries()) {
    if (status === 'with_agent' && !agentId) die(`cheque ${no}`, 'no active agent profile to assign')
    const { data: ref, error } = await sb.rpc('create_cheque', {
      party_id: ps[i % ps.length].id,
      bank_id: bs[i % bs.length].id,
      cheque_no: no,
      amount_paisa: String(rupees * 100),
      maturity_date: addDays(today, off),
      received_date: addDays(today, -20),
      initial_status: status,
      agent_id: status === 'with_agent' ? agentId : null,
      note: null,
    })
    if (error) die(`cheque ${no}`, error)
    summary.cheques++
    if (moveTo) {
      const { data: row, error: re } = await sb.from('cheques').select('id, version').eq('ref_code', ref).single()
      if (re) die(`read ${ref}`, re)
      const { error: te } = await sb.rpc('transition_cheque', { cheque_id: row.id, to_status: moveTo, expected_version: row.version })
      if (te) die(`transition ${no} -> ${moveTo}`, te)
      summary.moved++
    }
  }
}

console.log(`Seed done on ${url} (today ${today}, Asia/Kathmandu)`)
console.log(`  banks created: ${summary.banks}, parties created: ${summary.parties}`)
console.log(`  cheques created: ${summary.cheques}, moved via transition_cheque: ${summary.moved}`)
if (summary.skipped.length) console.log(`  skipped (already present): ${summary.skipped.join('; ')}`)
