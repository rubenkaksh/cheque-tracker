/**
 * Cheque form validation (zod 4). Rules from docs/audit/opus-review.md C.7.
 * Reuses money.ts (toPaisa) and bsdate.ts (todayKathmandu); no duplicate parsers.
 */

import { z } from 'zod'
import { toPaisa } from './money'
import { todayKathmandu } from './bsdate'

/** Trim, remove spaces and dashes, uppercase. */
export function normaliseChequeNo(s: string): string {
  return s.trim().replace(/[\s-]/g, '').toUpperCase()
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True when `s` is a real calendar date in YYYY-MM-DD form. */
function isRealIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/**
 * Latest allowed maturity date: the received date plus 12 months.
 * A day that does not exist in the target month clamps to that month's last day.
 */
function addTwelveMonths(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y + 1, m - 1, d))
  if (target.getUTCMonth() !== m - 1) {
    const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate()
    return `${y + 1}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  }
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const chequeNoSchema = z
  .string()
  .transform(normaliseChequeNo)
  .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, 'Cheque number must be 4-20 letters or digits'))

const amountSchema = z.string().refine(
  (s) => {
    try {
      return toPaisa(s) > 0
    } catch {
      return false
    }
  },
  { message: 'Amount must be a positive rupee amount with at most 2 decimals' },
)

const dateSchema = z.string().refine(isRealIsoDate, { message: 'Date must be YYYY-MM-DD' })

export const chequeFormSchema = z
  .object({
    party: z.string().trim().min(1, 'Party is required'),
    bank: z.string().trim().min(1, 'Bank is required'),
    chequeNo: chequeNoSchema,
    amount: amountSchema,
    maturityDate: dateSchema,
    receivedDate: dateSchema,
    status: z.string().min(1, 'Status is required'),
    agentId: z.string().min(1).nullable(),
    note: z.string().max(500, 'Note must be at most 500 characters'),
  })
  .superRefine((v, ctx) => {
    if (!isRealIsoDate(v.receivedDate) || !isRealIsoDate(v.maturityDate)) return

    if (v.receivedDate > todayKathmandu()) {
      ctx.addIssue({
        code: 'custom',
        path: ['receivedDate'],
        message: 'Received date cannot be in the future',
      })
    }

    if (v.maturityDate > addTwelveMonths(v.receivedDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['maturityDate'],
        message: 'Maturity date cannot be more than 12 months after the received date',
      })
    }

    if (v.status === 'with_agent' && (v.agentId === null || v.agentId === '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['agentId'],
        message: 'An agent is required when the cheque is with an agent',
      })
    }
  })
