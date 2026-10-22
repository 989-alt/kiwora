import type { WeatherId } from '../sim/types'
import { propArt, weatherArt } from './art'
import { forecastText } from './weatherText'
import './DayTransition.css'

/** Where the stars sit (percent of the sky) and how long each waits before it twinkles. Fixed, so a reload looks the same. */
const STARS: { x: number; y: number; size: number }[] = [
  [6, 12, 3], [12, 34, 2], [18, 8, 4], [24, 24, 2], [31, 14, 3], [37, 40, 2], [43, 6, 3], [49, 28, 2],
  [55, 16, 4], [61, 36, 2], [67, 10, 3], [73, 26, 2], [79, 6, 3], [85, 38, 2], [91, 18, 4], [95, 30, 2],
  [9, 54, 2], [27, 60, 3], [46, 52, 2], [64, 58, 3], [82, 56, 2], [97, 8, 3], [3, 28, 2], [58, 46, 2],
].map(([x, y, size]) => ({ x, y, size }))

/** The night sky's stars: plain CSS dots. */
export function Stars() {
  return (
    <div className="stars" aria-hidden="true">
      {STARS.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${(i % 7) * 0.45}s` }}
        />
      ))}
    </div>
  )
}

/** Tomorrow's weather: its picture and the sentence (the same on the day-transition cover and the night scene). */
export function Forecast({ kind, outdoor, className }: { kind: WeatherId; outdoor: boolean; className: string }) {
  const art = weatherArt(kind)
  return (
    <div className={className} data-forecast={kind}>
      {art.real && <img className="forecast-icon" src={art.src} alt="" width={96} height={96} draggable={false} />}
      <p className="forecast-text">{forecastText(kind, outdoor)}</p>
    </div>
  )
}

type Props = {
  /** Tomorrow's weather, if any. */
  forecast: WeatherId | null
  /** The plant lives in the yard (the words differ for heat). */
  outdoor?: boolean
  /** One line about today's growth ('' = none). */
  summary: string
}

/**
 * The night sky over the scene while a daily plant's day is done: dark veil, stars, the moon and a big
 * 내일 다시 만나요. It covers the scene only (the menu and the tools stay where they are) and has no motion,
 * so it looks the same after a reload.
 */
export function NightScene({ forecast, outdoor = false, summary }: Props) {
  const moon = propArt('moon')
  return (
    <div className="gs-night" data-forecast={forecast ?? undefined}>
      <Stars />
      <img className="gs-night-moon" src={moon.src} alt="" width={120} height={120} draggable={false} />
      <div className="gs-night-text">
        <p className="gs-night-title">내일 다시 만나요</p>
        {summary && <p className="gs-night-summary">{summary}</p>}
        {forecast && <Forecast kind={forecast} outdoor={outdoor} className="gs-night-forecast" />}
      </div>
    </div>
  )
}
