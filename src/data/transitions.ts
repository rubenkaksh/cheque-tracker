/**
 * Cheque statuses and the allowed_transitions rows.
 * ALLOWED_ROWS mirrors the DB table after migrations 0008 + 0010 (37 rows). The app reads the
 * live table (listAllowedTransitions); this copy is for the test fake and must stay equal to it.
 */

export type ChequeStatus =
  | 'with_agent'
  | 'paid_at_office'
  | 'in_office'
  | 'pdc_hold'
  | 'deposited'
  | 'cleared'
  | 'bounced'
  | 'enquiry'
  | 'stale'
  | 'closed_full_cash'
  | 'partial_cash'
  | 'replaced'
  | 'redeposit'
  | 'bad_debt'
  | 'party_flagged'

export const ALL_STATUSES: ChequeStatus[] = [
  'with_agent',
  'paid_at_office',
  'in_office',
  'pdc_hold',
  'deposited',
  'cleared',
  'bounced',
  'enquiry',
  'stale',
  'closed_full_cash',
  'partial_cash',
  'replaced',
  'redeposit',
  'bad_debt',
  'party_flagged',
]

/** The status used by the Hold action. */
export const HOLD_STATUS: ChequeStatus = 'pdc_hold'

/** Default status for a newly received cheque (enum has no 'received'; closest is in_office). */
export const DEFAULT_STATUS: ChequeStatus = 'in_office'

export type Role = 'admin' | 'agent'

/** Same rows as public.allowed_transitions (0008 review section 5 + 0010). */
export const ALLOWED_ROWS: { from: ChequeStatus; to: ChequeStatus; role: Role }[] = (
  [
    ['with_agent', 'in_office', 'admin'],
    ['with_agent', 'pdc_hold', 'admin'],
    ['with_agent', 'deposited', 'admin'],
    ['paid_at_office', 'in_office', 'admin'],
    ['in_office', 'with_agent', 'admin'],
    ['in_office', 'pdc_hold', 'admin'],
    ['in_office', 'deposited', 'admin'],
    ['in_office', 'stale', 'admin'],
    ['pdc_hold', 'in_office', 'admin'],
    ['pdc_hold', 'deposited', 'admin'],
    ['pdc_hold', 'stale', 'admin'],
    ['deposited', 'cleared', 'admin'],
    ['deposited', 'bounced', 'admin'],
    ['deposited', 'enquiry', 'admin'],
    ['enquiry', 'cleared', 'admin'],
    ['enquiry', 'bounced', 'admin'],
    ['redeposit', 'cleared', 'admin'],
    ['redeposit', 'bounced', 'admin'],
    ['redeposit', 'enquiry', 'admin'],
    ['bounced', 'redeposit', 'admin'],
    ['bounced', 'replaced', 'admin'],
    ['bounced', 'partial_cash', 'admin'],
    ['bounced', 'closed_full_cash', 'admin'],
    ['bounced', 'bad_debt', 'admin'],
    ['partial_cash', 'closed_full_cash', 'admin'],
    ['partial_cash', 'replaced', 'admin'],
    ['partial_cash', 'bad_debt', 'admin'],
    ['stale', 'replaced', 'admin'],
    ['stale', 'bad_debt', 'admin'],
    ['bad_debt', 'party_flagged', 'admin'],
    ['bad_debt', 'closed_full_cash', 'admin'],
    ['with_agent', 'deposited', 'agent'],
    ['deposited', 'cleared', 'agent'],
    ['deposited', 'bounced', 'agent'],
    ['bounced', 'partial_cash', 'agent'],
    ['bounced', 'closed_full_cash', 'agent'],
    ['partial_cash', 'closed_full_cash', 'agent'],
  ] as [ChequeStatus, ChequeStatus, Role][]
).map(([from, to, role]) => ({ from, to, role }))

/** Allowed target statuses for a role, keyed by current status. */
export function transitionsFor(role: Role): Record<ChequeStatus, ChequeStatus[]> {
  const m = Object.fromEntries(ALL_STATUSES.map((s) => [s, [] as ChequeStatus[]])) as Record<ChequeStatus, ChequeStatus[]>
  for (const r of ALLOWED_ROWS) if (r.role === role) m[r.from].push(r.to)
  return m
}

/** Admin moves (kept for callers of the old static map). */
export const TRANSITIONS = transitionsFor('admin')

/** Statuses before deposit, where a matured cheque is ready to take to the bank/SACCOS. */
const PRE_DEPOSIT: ChequeStatus[] = ['with_agent', 'in_office', 'pdc_hold', 'paid_at_office']

/** Matured: maturity date reached, not yet deposited (diagram "Becomes matured"). */
export function isMatured(status: ChequeStatus, maturityDate: string, today: string): boolean {
  return PRE_DEPOSIT.includes(status) && maturityDate <= today
}

/** Statuses that no longer need action on the dashboard. */
export const TERMINAL_STATUSES: ChequeStatus[] = [
  'cleared',
  'closed_full_cash',
  'replaced',
  'party_flagged',
]

export function isTerminal(s: ChequeStatus): boolean {
  return TERMINAL_STATUSES.includes(s)
}

const LABELS: Record<ChequeStatus, string> = {
  with_agent: 'With agent',
  paid_at_office: 'Paid at office',
  in_office: 'In office',
  pdc_hold: 'On hold (PDC)',
  deposited: 'Deposited',
  cleared: 'Cleared',
  bounced: 'Bounced',
  enquiry: 'Enquiry',
  stale: 'Stale',
  closed_full_cash: 'Closed (full cash)',
  partial_cash: 'Partial cash',
  replaced: 'Replaced',
  redeposit: 'Redeposit',
  bad_debt: 'Bad debt',
  party_flagged: 'Party flagged',
}

const COLORS: Record<ChequeStatus, string> = {
  with_agent: 'blue',
  paid_at_office: 'cyan',
  in_office: 'default',
  pdc_hold: 'gold',
  deposited: 'geekblue',
  cleared: 'green',
  bounced: 'red',
  enquiry: 'orange',
  stale: 'volcano',
  closed_full_cash: 'green',
  partial_cash: 'lime',
  replaced: 'purple',
  redeposit: 'processing',
  bad_debt: 'magenta',
  party_flagged: 'error',
}

export function labelFor(status: ChequeStatus): string {
  return LABELS[status]
}

export function colorFor(status: ChequeStatus): string {
  return COLORS[status]
}
