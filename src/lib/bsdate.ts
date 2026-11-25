/**
 * Bikram Sambat (BS) date adapter over `nepali-date-converter`.
 *
 * Every BS/AD conversion funnels through this file so a later library swap
 * touches only here. Pure functions, no React, no side effects.
 */

import NepaliDate, { dateConfigMap } from 'nepali-date-converter'

/** A Bikram Sambat calendar date. `month` is 1-based (1 = Baisakh). */
export interface BsDate {
  year: number
  month: number
  day: number
}

const BS_MONTH_KEYS = [
  'Baisakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Aswin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const

/** Kathmandu is UTC+05:45, no DST. */
const KTM_OFFSET_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function rangeError(message: string, cause?: unknown): RangeError {
  const detail = cause instanceof Error && cause.message !== '' ? ` (${cause.message})` : ''
  return new RangeError(`${message}${detail}`)
}

/** Days in the given BS month, or undefined when the year/month is unsupported. */
function daysInBsMonth(year: number, month: number): number | undefined {
  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined
  const yearConfig = dateConfigMap[String(year)]
  if (yearConfig === undefined) return undefined
  return yearConfig[BS_MONTH_KEYS[month - 1]]
}

/**
 * Convert a BS date to an AD date string `YYYY-MM-DD`.
 *
 * @throws RangeError when the date is outside the library's supported range
 * (BS 2000-01-01 … 2090-12-30) or is not a real calendar date.
 */
export function bsToAd(year: number, month: number, day: number): string {
  const days = daysInBsMonth(year, month)
  if (
    !Number.isInteger(year) ||
    days === undefined ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > days
  ) {
    throw rangeError(`BS date out of supported range: ${year}-${pad(month, 2)}-${pad(day, 2)}`)
  }

  try {
    // Library months are 0-based indexes (Baisakh = 0).
    const ad = new NepaliDate(year, month - 1, day).getAD()
    return `${pad(ad.year, 4)}-${pad(ad.month + 1, 2)}-${pad(ad.date, 2)}`
  } catch (cause) {
    throw rangeError(`BS date out of supported range: ${year}-${pad(month, 2)}-${pad(day, 2)}`, cause)
  }
}

/**
 * Convert an AD date string `YYYY-MM-DD` to a BS date.
 *
 * @throws RangeError for a malformed string, a non-existent calendar date,
 * or a date outside the library's supported range.
 */
export function adToBs(ad: string): BsDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ad)
  if (match === null) throw rangeError(`Invalid AD date: ${ad}`)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw rangeError(`Invalid AD date: ${ad}`)
  }

  // Build the Date from local calendar fields (noon avoids DST-edge midnight
  // shifts); setFullYear avoids the JS quirk that maps years 0-99 to 19xx.
  const jsDate = new Date(0)
  jsDate.setFullYear(year, month - 1, day)
  jsDate.setHours(12, 0, 0, 0)
  if (
    jsDate.getFullYear() !== year ||
    jsDate.getMonth() !== month - 1 ||
    jsDate.getDate() !== day
  ) {
    throw rangeError(`Invalid AD date: ${ad}`)
  }

  try {
    const bs = NepaliDate.fromAD(jsDate).getBS()
    // getBS() reports a 0-based month index.
    return { year: bs.year, month: bs.month + 1, day: bs.date }
  } catch (cause) {
    throw rangeError(`AD date out of supported range: ${ad}`, cause)
  }
}

/** True when the BS date exists in the library's calendar (BS 2000-2090). */
export function isValidBs(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  const days = daysInBsMonth(year, month)
  if (days === undefined) return false
  return day >= 1 && day <= days
}

/** Format a BS date as zero-padded `YYYY-MM-DD`. */
export function formatBs(bs: BsDate): string {
  return `${pad(bs.year, 4)}-${pad(bs.month, 2)}-${pad(bs.day, 2)}`
}

/**
 * Today's AD date in Kathmandu (UTC+05:45) as `YYYY-MM-DD`.
 * The day rolls over at 18:15 UTC (00:45 the next day in Kathmandu).
 */
export function todayKathmandu(now: Date = new Date()): string {
  const ktm = new Date(now.getTime() + KTM_OFFSET_MS)
  return `${pad(ktm.getUTCFullYear(), 4)}-${pad(ktm.getUTCMonth() + 1, 2)}-${pad(ktm.getUTCDate(), 2)}`
}
