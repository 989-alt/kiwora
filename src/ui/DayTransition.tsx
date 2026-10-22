import { useEffect, useRef, useState } from 'react'
import type { NightFx } from '../store'
import { propArt } from './art'
import { Forecast, Stars } from './NightScene'
import './DayTransition.css'

/**
 * Where the scene is. Full motion: dusk (sunset) -> night (moon, stars) -> dawn (sunrise, quick plants only);
 * a daily plant ends with 'out' (the cover thins away over the night scene that stays). Reduced motion: only
 * 'night' and 'out' (a 0.2 s fade each way).
 */
export type DayPhase = 'dusk' | 'night' | 'dawn' | 'out'

/** The sunset takes this long; the night starts then. */
export const SUNSET_MS = 800
/** The night alone (no forecast) ends here. */
export const NIGHT_END_MS = 1700
/** The sunrise takes this long after the night. */
export const SUNRISE_MS = 800
/** With a forecast the night stays this much longer. */
export const FORECAST_HOLD_MS = 2000
/** Reduced motion (and a plant that died, finished or must move): one fade in and one out. */
export const FADE_MS = 400
/** The cover thins away during the last part of a daily night. */
const OUT_MS = 400

const REDUCED = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches
}

type Step = { at: number; phase: DayPhase } | { at: number; done: true }

function timeline(fx: NightFx, reduced: boolean): Step[] {
  const hold = fx.forecast ? FORECAST_HOLD_MS : 0
  if (reduced || fx.ending === 'fade') {
    return [
      { at: FADE_MS / 2 + hold, phase: 'out' },
      { at: FADE_MS + hold, done: true },
    ]
  }
  const nightEnd = NIGHT_END_MS + hold
  if (fx.ending === 'night') {
    return [
      { at: SUNSET_MS, phase: 'night' },
      { at: nightEnd - OUT_MS, phase: 'out' },
      { at: nightEnd, done: true },
    ]
  }
  return [
    { at: SUNSET_MS, phase: 'night' },
    { at: nightEnd, phase: 'dawn' },
    { at: nightEnd + SUNRISE_MS, done: true },
  ]
}

type Props = {
  fx: NightFx
  onDone: () => void
  /** The plant lives in the yard (the forecast words differ for heat). */
  outdoor?: boolean
  /** The plant's day number once the cover is over (read out for a screen reader). */
  day?: number
}

/**
 * The cover between two days (full screen, over everything). Quick plant: sunset, night, sunrise, then the next
 * morning. Daily plant: sunset and night, and the night scene of the grow screen stays. A tap anywhere ends it.
 * Mount it once per signal (the store clears the signal with nightFxDone).
 */
export function DayTransition({ fx, onDone, outdoor = false, day }: Props) {
  const cover = useRef<HTMLDivElement>(null)
  const [reduced] = useState(prefersReducedMotion)
  const short = reduced || fx.ending === 'fade'
  const [phase, setPhase] = useState<DayPhase>(short ? 'night' : 'dusk')
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const finished = useRef(false)

  const finish = () => {
    if (finished.current) return
    finished.current = true
    doneRef.current()
  }

  useEffect(() => {
    const timers = timeline(fx, reduced).map((step) =>
      window.setTimeout(() => ('done' in step ? finish() : setPhase(step.phase)), step.at),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
    // One run per mount: the store clears the signal when the scene ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While the cover runs the screen under it cannot be reached by keys or a reader; the cover takes the focus
  // (Enter, Space or Escape skips it) and hands it back to what had it.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const mains = Array.from(document.querySelectorAll('main'))
    mains.forEach((m) => m.setAttribute('inert', ''))
    cover.current?.focus({ preventScroll: true })
    return () => {
      mains.forEach((m) => m.removeAttribute('inert'))
      if (before && document.contains(before) && typeof before.focus === 'function') before.focus({ preventScroll: true })
    }
  }, [])

  const announce =
    fx.ending === 'sunrise' && day ? `${day}일째 아침이에요` : fx.ending === 'night' ? '밤이 되었어요' : '하루가 끝났어요'
  const moon = propArt('moon')
  return (
    <div
      ref={cover}
      className="dt"
      role="presentation"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault()
          finish()
        }
      }}
      data-phase={phase}
      data-ending={fx.ending}
      data-motion={reduced ? 'reduced' : 'full'}
      onClick={finish}
    >
      <p className="dt-live" role="status" aria-live="polite">
        {announce}
      </p>
      <div className="dt-sky dt-sky--dusk" />
      <div className="dt-sky dt-sky--night" />
      <div className="dt-sky dt-sky--dawn" />
      <Stars />
      <div className="dt-sun" />
      <img className="dt-moon" src={moon.src} alt="" width={160} height={160} draggable={false} />
      {fx.forecast && <Forecast kind={fx.forecast} outdoor={outdoor} className="dt-forecast" />}
    </div>
  )
}
