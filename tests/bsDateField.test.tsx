import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import BsDateField from '../src/features/BsDateField'
import { todayKathmandu } from '../src/lib/bsdate'
import { openOption, pickBs } from './bsPick'

function Harness({ initial = null, min, max, spy }: { initial?: string | null; min?: string; max?: string; spy: (v: string | null) => void }) {
  const [v, setV] = useState<string | null>(initial)
  return (
    <BsDateField
      label="Due"
      value={v}
      min={min}
      max={max}
      onChange={(x) => {
        setV(x)
        spy(x)
      }}
    />
  )
}

async function openDay() {
  const day = screen.getByRole('combobox', { name: 'Due day' })
  await userEvent.click(day)
  return day
}

describe('BsDateField', () => {
  it('emits the AD date after picking BS year, month and day, and shows it', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await pickBs('Due', 2083, 8, 9)
    expect(spy).toHaveBeenLastCalledWith('2026-11-25')
    expect(screen.getByTestId('bs-ad-line')).toHaveTextContent('AD 2026-11-25')
  })

  it('does not emit until all three parts are chosen', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Due year' }), '2083')
    await userEvent.click(await openOption('2083'))
    expect(spy).not.toHaveBeenCalled()
  })

  it('limits days to the real month length (32 in Asar 2083, 29 in Mangsir 2083)', async () => {
    const { unmount } = render(<Harness initial="2026-06-20" spy={() => {}} />) // 2083-03-06 (Asar)
    await userEvent.type(screen.getByRole('combobox', { name: 'Due day' }), '32')
    expect(await openOption('32')).toBeInTheDocument()
    unmount()

    render(<Harness initial="2026-11-25" spy={() => {}} />) // 2083-08-09 (Mangsir)
    const day = screen.getByRole('combobox', { name: 'Due day' })
    await userEvent.type(day, '30')
    expect(screen.queryAllByTitle('30').filter((e) => e.closest('.ant-select-dropdown'))).toHaveLength(0)
    await userEvent.clear(day)
    await userEvent.type(day, '29')
    expect(await openOption('29')).toBeInTheDocument()
  })

  it('clamps the day when switching to a shorter month', async () => {
    const spy = vi.fn()
    render(<Harness initial="2026-06-26" spy={spy} />)
    await pickBs('Due', 2083, 3, 32)
    expect(spy).toHaveBeenLastCalledWith('2026-07-16')
    await userEvent.type(screen.getByRole('combobox', { name: 'Due month' }), 'Mangsir')
    await userEvent.click(await openOption('Mangsir'))
    expect(screen.getByTestId('bs-ad-line')).toHaveTextContent('AD 2026-12-15') // 2083-08-29
  })

  it('disables days outside min/max', async () => {
    const spy = vi.fn()
    render(<Harness initial="2026-11-25" min="2026-11-20" max="2026-11-30" spy={spy} />) // 2083-08-09 inside
    await openDay()
    const opt = await openOption('1') // 2083-08-01 = AD 2026-11-17, before min
    expect(opt.closest('.ant-select-item')).toHaveClass('ant-select-item-option-disabled')
    expect(await openOption('10')).not.toHaveClass('ant-select-item-option-disabled')
  })

  it('flags a value outside min/max and an unsupported value', () => {
    const { unmount } = render(<Harness initial="2026-11-25" min="2026-12-01" spy={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/outside the allowed range/i)
    unmount()
    render(<Harness initial="1900-01-01" spy={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/supported BS range/i)
  })

  it('Today button sets Kathmandu today', async () => {
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await userEvent.click(screen.getByRole('button', { name: 'Due: set to today' }))
    expect(spy).toHaveBeenLastCalledWith(todayKathmandu())
  })

  it('Today is disabled when today is outside the allowed range', () => {
    render(<Harness min="2099-01-01" spy={() => {}} />)
    expect(screen.getByRole('button', { name: 'Due: set to today' })).toBeDisabled()
  })
})
