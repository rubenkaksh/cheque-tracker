import { useEffect, useRef, useState } from 'react'
import { Button, Select } from 'antd'
import {
  BS_MAX_YEAR,
  BS_MIN_YEAR,
  BS_MONTH_NAMES,
  adToBs,
  bsMonthDays,
  bsToAd,
  formatBsAd,
  todayKathmandu,
} from '../lib/bsdate'

export interface BsDateFieldProps {
  /** AD ISO date (yyyy-mm-dd) or null/undefined when empty. */
  value?: string | null
  /** Called with the AD ISO date once year, month and day are all chosen. */
  onChange?: (adIso: string | null) => void
  /** Inclusive AD ISO bounds; days outside are disabled. */
  min?: string
  max?: string
  /** Accessible name prefix, e.g. "Maturity date" gives "Maturity date year". */
  label?: string
  /** Forwarded by Form.Item; placed on the year select so the form label focuses it. */
  id?: string
  disabled?: boolean
}

interface Parts {
  year?: number
  month?: number
  day?: number
}

function parse(value?: string | null): { parts: Parts; invalid: boolean } {
  if (!value) return { parts: {}, invalid: false }
  try {
    const bs = adToBs(value)
    return { parts: { year: bs.year, month: bs.month, day: bs.day }, invalid: false }
  } catch {
    return { parts: {}, invalid: true }
  }
}

/** Keyboard search: option label starts with the typed text, or the numeric value equals it. */
const filterOption = (input: string, option?: { label?: unknown; value?: unknown }) => {
  const q = input.trim().toLowerCase()
  return String(option?.label ?? '').toLowerCase().startsWith(q) || String(option?.value) === q
}

export default function BsDateField({ value, onChange, min, max, label = 'Date', id, disabled }: BsDateFieldProps) {
  const initial = parse(value)
  const [parts, setParts] = useState<Parts>(initial.parts)
  const [invalid, setInvalid] = useState(initial.invalid)
  const emitted = useRef<string | null | undefined>(value)

  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    const p = parse(value)
    setParts(p.parts)
    setInvalid(p.invalid)
  }, [value])

  const outside = (ad: string) => (min !== undefined && ad < min) || (max !== undefined && ad > max)
  /** True when every day in the BS span lies outside [min, max]. */
  const spanOutside = (year: number, month?: number) => {
    const m1 = month ?? 1
    const m2 = month ?? 12
    const last = bsMonthDays(year, m2)
    if (last === undefined) return true
    const first = bsToAd(year, m1, 1)
    const end = bsToAd(year, m2, last)
    return (min !== undefined && end < min) || (max !== undefined && first > max)
  }

  function update(next: Parts) {
    setParts(next)
    setInvalid(false)
    if (next.year === undefined || next.month === undefined || next.day === undefined) return
    const days = bsMonthDays(next.year, next.month) ?? next.day
    const day = Math.min(next.day, days) // month change may shorten the month: clamp
    if (day !== next.day) setParts({ ...next, day })
    const ad = bsToAd(next.year, next.month, day)
    emitted.current = ad
    onChange?.(ad)
  }

  const years = Array.from({ length: BS_MAX_YEAR - BS_MIN_YEAR + 1 }, (_, i) => BS_MIN_YEAR + i).map((y) => ({
    value: y,
    label: String(y),
    disabled: spanOutside(y),
  }))
  const months = BS_MONTH_NAMES.map((name, i) => ({
    value: i + 1,
    label: name,
    disabled: parts.year !== undefined && spanOutside(parts.year, i + 1),
  }))
  const dayCount = parts.year !== undefined && parts.month !== undefined ? (bsMonthDays(parts.year, parts.month) ?? 32) : 32
  const days = Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => ({
    value: d,
    label: String(d),
    disabled:
      parts.year !== undefined && parts.month !== undefined && outside(bsToAd(parts.year, parts.month, d)),
  }))

  const today = todayKathmandu()
  const complete = parts.year !== undefined && parts.month !== undefined && parts.day !== undefined
  const currentAd = complete ? bsToAd(parts.year!, parts.month!, Math.min(parts.day!, dayCount)) : null
  const badRange = currentAd !== null && outside(currentAd)
  const status = invalid || badRange ? 'error' : undefined

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          id={id}
          aria-label={`${label} year`}
          className="min-w-[5.5rem] flex-1"
          showSearch
          placeholder="Year"
          status={status}
          disabled={disabled}
          value={parts.year}
          options={years}
          filterOption={filterOption}
          onChange={(y: number) => update({ ...parts, year: y })}
        />
        <Select
          aria-label={`${label} month`}
          className="min-w-[6.5rem] flex-1"
          showSearch
          placeholder="Month"
          status={status}
          disabled={disabled}
          value={parts.month}
          options={months}
          filterOption={filterOption}
          onChange={(m: number) => update({ ...parts, month: m })}
        />
        <Select
          aria-label={`${label} day`}
          className="min-w-[4.5rem] flex-1"
          showSearch
          placeholder="Day"
          status={status}
          disabled={disabled}
          value={parts.day}
          options={days}
          filterOption={filterOption}
          onChange={(d: number) => update({ ...parts, day: d })}
        />
        <Button
          size="small"
          disabled={disabled || outside(today)}
          aria-label={`${label}: set to today`}
          onClick={() => {
            const bs = adToBs(today)
            update({ year: bs.year, month: bs.month, day: bs.day })
          }}
        >
          Today
        </Button>
      </div>
      <div className="text-xs text-muted" aria-live="polite" data-testid="bs-ad-line">
        {currentAd ? formatBsAd(currentAd) : invalid ? 'AD: date not supported' : 'AD: pick year, month and day'}
      </div>
      {invalid && (
        <div role="alert" className="text-xs text-red">
          Date is outside the supported BS range ({BS_MIN_YEAR}-{BS_MAX_YEAR}).
        </div>
      )}
      {badRange && (
        <div role="alert" className="text-xs text-red">
          Date is outside the allowed range{min ? ` from ${min}` : ''}
          {max ? ` to ${max}` : ''}.
        </div>
      )}
    </div>
  )
}
