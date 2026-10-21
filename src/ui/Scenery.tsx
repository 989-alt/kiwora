import type { CSSProperties } from 'react'
import type { Place } from '../sim/types'
import './Scenery.css'

type Vars = CSSProperties & Record<`--${string}`, string | number>

/** CSS-only yard until Task 12 brings pictures: sky, sun by brightness, clouds, hills, a grass band over soil. */
export function YardBackdrop({ place, surface, unit }: { place: Place; surface: number; unit: number }) {
  const style: Vars = { '--u': `${unit}px`, '--surface': `${surface}px` }
  return (
    <div data-layer="yard-bg" className={`pv-yard pv-yard--${place}`} style={style} aria-hidden="true">
      <div className="pv-sky" />
      <span className="pv-sun" />
      <span className="pv-cloud pv-cloud--a" />
      <span className="pv-cloud pv-cloud--b" />
      <span className="pv-hill pv-hill--far" />
      <span className="pv-hill pv-hill--near" />
      <div className="pv-ground" />
    </div>
  )
}

/** Dark soil heap over the stem base, so the tree reads as planted in the ground. */
export function Mound({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <div
      data-layer="mound"
      className="pv-layer pv-mound"
      style={{ left: cx - rx, top: cy - ry, width: rx * 2, height: ry * 2 }}
    />
  )
}

/** Wooden signpost beside the tree. Its face is the pot's face for the plant's health. */
export function Signpost({ face, filter, cx, bottom }: { face: string; filter?: string; cx: number; bottom: number }) {
  return (
    <div
      data-layer="signpost"
      role="img"
      aria-label="건강 표지판"
      className="pv-layer pv-sign"
      style={{ left: cx - 42, top: bottom - 160, width: 84, height: 160 }}
    >
      <span className="pv-sign-post" />
      <span className="pv-sign-plate">
        <span className="pv-sign-face">
          <img src={`/pots/${face}.png`} alt="" draggable={false} style={{ filter }} />
        </span>
      </span>
    </div>
  )
}

/** Deterministic flakes: same look on every render, no timers. */
const FLAKES = Array.from({ length: 30 }, (_, i) => {
  const r = (n: number) => (Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1
  const f = (n: number) => Math.abs(r(n))
  return {
    x: Math.round(f(1) * 1000) / 10,
    y: Math.round(f(2) * 1000) / 10,
    size: 4 + Math.round(f(3) * 6),
    dur: 6 + Math.round(f(4) * 50) / 10,
    delay: -Math.round(f(5) * 80) / 10,
    sway: 8 + Math.round(f(6) * 20),
  }
})

/** White veil over the background plus falling flakes (still flakes with reduced motion). */
export function WinterVeil() {
  return <div data-layer="winter" className="pv-layer pv-winter" aria-hidden="true" />
}

export function Snow() {
  return (
    <div data-layer="snow" className="pv-layer pv-snow" aria-hidden="true">
      {FLAKES.map((k, i) => {
        const style: Vars = {
          left: `${k.x}%`,
          width: k.size,
          height: k.size,
          '--y': `${k.y}%`,
          '--sway': `${k.sway}px`,
          animationDuration: `${k.dur}s`,
          animationDelay: `${k.delay}s`,
        }
        return <span key={i} className="pv-flake" style={style} />
      })}
    </div>
  )
}
