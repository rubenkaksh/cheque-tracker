import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BS_MONTH_NAMES, adToBs } from '../src/lib/bsdate'

/** The option with this title inside the currently open (not hidden) select dropdown. */
export async function openOption(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const open = screen
      .queryAllByTitle(title)
      .filter((el) => el.closest('.ant-select-dropdown') && !el.closest('.ant-select-dropdown-hidden'))
    if (open.length !== 1) throw new Error(`expected 1 open option "${title}", found ${open.length}`)
    return open[0]
  })
}

/** Pick a BS date in a BsDateField by typing into its Year / Month / Day selects (search filter)
 * and clicking the matching option. */
export async function pickBs(label: string, year: number, month: number, day: number) {
  const fields: [string, string][] = [
    ['year', String(year)],
    ['month', BS_MONTH_NAMES[month - 1]],
    ['day', String(day)],
  ]
  for (const [part, text] of fields) {
    const box = await screen.findByRole('combobox', { name: `${label} ${part}` })
    await userEvent.type(box, text)
    await userEvent.click(await openOption(text))
  }
}

/** Same, from an AD ISO date. */
export async function pickAd(label: string, adIso: string) {
  const bs = adToBs(adIso)
  await pickBs(label, bs.year, bs.month, bs.day)
}
