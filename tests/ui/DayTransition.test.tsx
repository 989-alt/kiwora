import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { NightFx } from '../../src/store'
import App from '../../src/App'
import { newPlant } from '../../src/sim/day'
import { emptySave, SAVE_KEY } from '../../src/sim/save'
import { DayTransition, END_COOLDOWN_MS, TAP_GUARD_MS } from '../../src/ui/DayTransition'

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

const phase = (c: HTMLElement) => c.querySelector('.nt')?.getAttribute('data-phase')

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

  test('keys skip the cover, main is inert meanwhile, the day is announced, the focus comes back', () => {
    const main = document.createElement('main')
    const btn = document.createElement('button')
    main.appendChild(btn)
    document.body.appendChild(main)
    btn.focus()
    const onDone = vi.fn()
    const { container, unmount } = render(<DayTransition fx={fx()} day={5} onDone={onDone} />)
    expect(main.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(container.querySelector('.nt'))
    expect(screen.getByRole('status').textContent).toBe('5일째 아침이에요')
    act(() => void vi.advanceTimersByTime(TAP_GUARD_MS))
    fireEvent.keyDown(container.querySelector('.nt')!, { key: 'Enter' })
    expect(onDone).toHaveBeenCalledTimes(1)
    unmount()
    expect(main.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(btn)
    main.remove()
  })

  test('sunrise ends after 2.5s', () => {
    const onDone = vi.fn()
    const { container } = render(<DayTransition fx={fx()} onDone={onDone} />)
    const dt = container.querySelector('.nt')!
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
    expect(container.querySelector('.nt-forecast')?.getAttribute('data-forecast')).toBe('rain')
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
    expect(container.querySelector('.nt-forecast')).toBeNull()
  })

  test('tap skips at once, and only once', () => {
    const onDone = vi.fn()
    const { container } = render(<DayTransition fx={fx()} onDone={onDone} />)
    act(() => void vi.advanceTimersByTime(TAP_GUARD_MS))
    fireEvent.click(container.querySelector('.nt')!)
    expect(onDone).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(10_000))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  test('taps and keys in the first moments are ignored (a fast triple tap must not skip the cover)', () => {
    const onDone = vi.fn()
    const { container } = render(<DayTransition fx={fx()} onDone={onDone} />)
    const cover = container.querySelector('.nt')!
    act(() => void vi.advanceTimersByTime(TAP_GUARD_MS - 100))
    fireEvent.click(cover)
    fireEvent.keyDown(cover, { key: 'Enter' })
    fireEvent.keyDown(cover, { key: 'Escape' })
    expect(onDone).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(100))
    fireEvent.click(cover)
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
    const dt = container.querySelector('.nt')!
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
    expect(container.ownerDocument.querySelector('.nt')).not.toBeNull()
    fireEvent.click(end)
    act(() => void vi.advanceTimersByTime(60))
    fireEvent.click(container.ownerDocument.querySelector('.nt')!)
    act(() => void vi.advanceTimersByTime(60))
    fireEvent.click(end)
    expect(day()).toBe('6')
    expect(container.ownerDocument.querySelector('.nt')).not.toBeNull()
    // the cover is the last thing in the page and the end button is held while it runs
    expect((end as HTMLButtonElement).disabled).toBe(true)
    act(() => void vi.advanceTimersByTime(5000))
    expect(container.ownerDocument.querySelector('.nt')).toBeNull()
    expect(day()).toBe('6')
    act(() => void vi.advanceTimersByTime(END_COOLDOWN_MS))
    expect((screen.getByRole('button', { name: '하루 마치기' }) as HTMLButtonElement).disabled).toBe(false)
  })

  test('a tap on the cover skips it without another day', () => {
    seedQuick()
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '하루 마치기' }))
    act(() => void vi.advanceTimersByTime(TAP_GUARD_MS))
    fireEvent.click(container.ownerDocument.querySelector('.nt')!)
    expect(container.ownerDocument.querySelector('.nt')).toBeNull()
    expect(day()).toBe('6')
    // 하루 마치기 stays held for a moment after the cover closes (the tap that closed it must not end another day)
    const end = screen.getByRole('button', { name: '하루 마치기' }) as HTMLButtonElement
    expect(end.disabled).toBe(true)
    fireEvent.click(end)
    expect(day()).toBe('6')
    act(() => void vi.advanceTimersByTime(END_COOLDOWN_MS))
    expect(end.disabled).toBe(false)
  })
})
