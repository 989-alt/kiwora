import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { NightFx } from '../../src/store'
import App from '../../src/App'
import { newPlant } from '../../src/sim/day'
import { emptySave, SAVE_KEY } from '../../src/sim/save'
import { DayTransition } from '../../src/ui/DayTransition'

const fx = (over: Partial<NightFx> = {}): NightFx => ({ ending: 'sunrise', forecast: null, n: 1, ...over })

/** window.matchMedia stand-in: the prefers-reduced-motion query answers `reduced`. */
function stubMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') && reduced,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

const phase = (c: HTMLElement) => c.querySelector('.dt')?.getAttribute('data-phase')

describe('DayTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubMotion(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    // @ts-expect-error the stub is removed again (jsdom has no matchMedia)
    delete window.matchMedia
  })

  test('sunrise ends after 2.5s', () => {
    const onDone = vi.fn()
    const { container } = render(<DayTransition fx={fx()} onDone={onDone} />)
    const dt = container.querySelector('.dt')!
    expect(dt.getAttribute('role')).toBe('presentation')
    expect(phase(container)).toBe('dusk')
    act(() => void vi.advanceTimersByTime(799))
    expect(phase(container)).toBe('dusk')
    act(() => void vi.advanceTimersByTime(1))
    expect(phase(container)).toBe('night')
    act(() => void vi.advanceTimersByTime(900))
    expect(phase(container)).toBe('dawn')
    act(() => void vi.advanceTimersByTime(799))
    expect(onDone).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  test('a daily night stops at the night after 1.7s (the night scene stays)', () => {
    const onDone = vi.fn()
    const { container } = render(<DayTransition fx={fx({ ending: 'night' })} onDone={onDone} />)
    act(() => void vi.advanceTimersByTime(1699))
    expect(onDone).not.toHaveBeenCalled()
    expect(phase(container)).not.toBe('dawn')
    act(() => void vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  test('a forecast keeps the night 2s longer', () => {
    const onDone = vi.fn()
    const { container } = render(<DayTransition fx={fx({ forecast: 'rain' })} onDone={onDone} />)
    expect(container.querySelector('.dt-forecast')?.getAttribute('data-forecast')).toBe('rain')
    act(() => void vi.advanceTimersByTime(2500))
    expect(onDone).not.toHaveBeenCalled()
    expect(phase(container)).toBe('night')
    act(() => void vi.advanceTimersByTime(1999))
    expect(onDone).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  test('no forecast slot on a calm day', () => {
    const { container } = render(<DayTransition fx={fx()} onDone={() => {}} />)
    expect(container.querySelector('.dt-forecast')).toBeNull()
  })

  test('tap skips at once, and only once', () => {
    const onDone = vi.fn()
    const { container } = render(<DayTransition fx={fx()} onDone={onDone} />)
    act(() => void vi.advanceTimersByTime(300))
    fireEvent.click(container.querySelector('.dt')!)
    expect(onDone).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(10_000))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  test('unmounting stops the timers', () => {
    const onDone = vi.fn()
    const { unmount } = render(<DayTransition fx={fx()} onDone={onDone} />)
    unmount()
    act(() => void vi.advanceTimersByTime(10_000))
    expect(onDone).not.toHaveBeenCalled()
  })

  test('reduced motion fades in 0.4s', () => {
    stubMotion(true)
    const onDone = vi.fn()
    const { container } = render(<DayTransition fx={fx()} onDone={onDone} />)
    const dt = container.querySelector('.dt')!
    expect(dt.getAttribute('data-motion')).toBe('reduced')
    expect(phase(container)).toBe('night')
    act(() => void vi.advanceTimersByTime(399))
    expect(onDone).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  test('reduced motion still holds the night for a forecast', () => {
    stubMotion(true)
    const onDone = vi.fn()
    render(<DayTransition fx={fx({ ending: 'night', forecast: 'cold' })} onDone={onDone} />)
    act(() => void vi.advanceTimersByTime(2399))
    expect(onDone).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  test('a fade ending (died, finished, to be moved) is the short fade too', () => {
    const onDone = vi.fn()
    render(<DayTransition fx={fx({ ending: 'fade' })} onDone={onDone} />)
    act(() => void vi.advanceTimersByTime(400))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  test('the latest onDone is used', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<DayTransition fx={fx()} onDone={first} />)
    rerender(<DayTransition fx={fx()} onDone={second} />)
    act(() => void vi.advanceTimersByTime(2500))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('App with the cover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubMotion(false)
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    // @ts-expect-error the stub is removed again (jsdom has no matchMedia)
    delete window.matchMedia
    localStorage.clear()
  })

  const seedQuick = () => {
    const save = { ...emptySave(), plant: { ...newPlant('corn', { mode: 'quick', weatherSeed: 0 }), stageIndex: 3, day: 5 }, settings: { sound: false, tutorialSeen: true } }
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  }
  const day = () => /(\d+)일째/.exec(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label') ?? '')![1]

  test('double-tapping 하루 마치기 in quick mode advances exactly one day', () => {
    seedQuick()
    const { container } = render(<App />)
    expect(day()).toBe('5')
    const end = screen.getByRole('button', { name: '하루 마치기' })
    fireEvent.click(end)
    expect(container.ownerDocument.querySelector('.dt')).not.toBeNull()
    fireEvent.click(end)
    fireEvent.click(end)
    expect(day()).toBe('6')
    // the cover is the last thing in the page and the end button is held while it runs
    expect((end as HTMLButtonElement).disabled).toBe(true)
    act(() => void vi.advanceTimersByTime(5000))
    expect(container.ownerDocument.querySelector('.dt')).toBeNull()
    expect(day()).toBe('6')
    expect((screen.getByRole('button', { name: '하루 마치기' }) as HTMLButtonElement).disabled).toBe(false)
  })

  test('a tap on the cover skips it without another day', () => {
    seedQuick()
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    fireEvent.click(container.ownerDocument.querySelector('.dt')!)
    expect(container.ownerDocument.querySelector('.dt')).toBeNull()
    expect(day()).toBe('6')
  })
})
