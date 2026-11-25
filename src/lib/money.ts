/** Integer-paisa money helpers. Pure functions, no floating-point parsing. */

const inGroup = new Intl.NumberFormat('en-IN')

function fail(message: string): never {
  throw new Error(message)
}

/**
 * Parse a human-entered rupee string (en-IN commas, up to 2 decimals) into
 * integer paisa. Digit-string arithmetic only — no float multiplication.
 */
export function toPaisa(input: string): number {
  const trimmed = input.trim()
  if (trimmed === '') fail('empty money input')
  if (trimmed.startsWith('-')) fail('negative money input')

  const cleaned = trimmed.replaceAll(',', '')
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') {
    fail('invalid money input')
  }

  const dot = cleaned.indexOf('.')
  const rupeeDigits = dot === -1 ? cleaned : cleaned.slice(0, dot)
  const decimalDigits = dot === -1 ? '' : cleaned.slice(dot + 1)

  if (decimalDigits.length > 2) fail('more than 2 decimals')
  if (rupeeDigits === '') fail('missing integer part')

  const rupees = Number(rupeeDigits)
  if (!Number.isSafeInteger(rupees)) fail('money exceeds safe integer range')

  const decimals = Number(decimalDigits.padEnd(2, '0') || '0')
  const paisa = rupees * 100 + decimals
  if (!Number.isSafeInteger(paisa)) fail('money exceeds safe integer range')
  return paisa
}

/** Format integer paisa as "NPR x,xx,xx.xx" with en-IN grouping (decimals only when paise ≠ 0). */
export function formatNpr(paisa: number): string {
  if (!Number.isSafeInteger(paisa)) fail('paisa must be a safe integer')
  if (paisa < 0) fail('negative paisa')

  const rupees = Math.floor(paisa / 100)
  const paise = paisa % 100
  const grouped = inGroup.format(rupees)
  const decimals = paise === 0 ? '' : `.${String(paise).padStart(2, '0')}`
  return `NPR ${grouped}${decimals}`
}
