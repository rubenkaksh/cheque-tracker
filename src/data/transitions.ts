/**
 * Cheque status transitions for the M0 demo.
 *
 * PROPOSED, unreviewed: pending owner answers Q1/Q2 and Opus review.
 * Uses only the 15 names of the cheque_status enum in
 * supabase/migrations/20261125000001_core.sql.
 * The enum has no "held" value; Hold maps to 'pdc_hold' (post-dated cheque kept on hold).
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

export const TRANSITIONS: Record<ChequeStatus, ChequeStatus[]> = {
  with_agent: ['in_office', 'paid_at_office', 'pdc_hold'],
  in_office: ['pdc_hold', 'deposited', 'with_agent', 'paid_at_office'],
  pdc_hold: ['in_office', 'deposited'],
  paid_at_office: ['closed_full_cash', 'partial_cash'],
  deposited: ['cleared', 'bounced', 'enquiry'],
  enquiry: ['cleared', 'bounced', 'stale'],
  bounced: ['redeposit', 'replaced', 'partial_cash', 'closed_full_cash', 'bad_debt'],
  redeposit: ['cleared', 'bounced'],
  stale: ['replaced', 'redeposit', 'bad_debt'],
  partial_cash: ['closed_full_cash', 'bad_debt'],
  bad_debt: ['party_flagged'],
  cleared: [],
  closed_full_cash: [],
  replaced: [],
  party_flagged: [],
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
