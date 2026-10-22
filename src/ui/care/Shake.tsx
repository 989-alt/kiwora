import { useRef, useState } from 'react'
import { pop } from '../sound'
import { CareHint, Target, type CareProps } from './parts'
import { usePress } from './press'
import { careGeo, carePoints } from './targets'

export const SHAKES = 3
/** The finger counts as on one side of the stem only this far (px) past it. */
const SIDE_SLOP = 12

/** Sways the plant picture of the scene (PlantView's plant layer) once, toward `dir`. */
function sway(from: Element | null, dir: number) {
  const plant = from?.closest('.pv')?.querySelector('[data-layer="plant"]') as HTMLElement | null
  if (!plant || typeof plant.animate !== 'function') return
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  plant.animate([{ rotate: '0deg' }, { rotate: `${5 * dir}deg` }, { rotate: `${-3 * dir}deg` }, { rotate: '0deg' }], {
    duration: 520,
    easing: 'ease-out',
  })
}

/**
 * shakePollen (rice, corn): swing the plant left and right across its stem 3 times, or tap it 3 times;
 * each shake sways the plant and puffs pollen from its tassel / panicles.
 */
export function Shake({ L, rects, pic, speciesId, disabled, sound, onDone, toScene }: CareProps) {
  const [shakes, setShakes] = useState(0)
  const anchor = useRef<HTMLSpanElement>(null)
  const now = useRef({ shakes: 0, side: 0, finished: false })
  const g = careGeo(L)

  const shake = (dir: number) => {
    const n = now.current
    if (n.finished) return
    n.shakes += 1
    setShakes(n.shakes)
    sway(anchor.current, dir)
    pop(sound)
    if (n.shakes >= SHAKES) {
      n.finished = true
      onDone()
    }
  }
  const press = usePress({
    disabled,
    onTap: () => shake(now.current.shakes % 2 === 0 ? 1 : -1),
    onMove: (_step, at) => {
      const x = toScene(at).x
      const side = x > g.cx + SIDE_SLOP ? 1 : x < g.cx - SIDE_SLOP ? -1 : 0
      const n = now.current
      if (side === 0) return
      if (n.side !== 0 && side !== n.side) shake(side)
      n.side = side
    },
    onEnd: () => {
      now.current.side = 0
    },
  })
  const dot = Math.max(5, 7 * g.u)
  const from = carePoints('flower', L, pic, speciesId)
  return (
    <>
      <span ref={anchor} hidden />
      {shakes > 0 &&
        // the pollen of the last shake drifts off the tassel / panicles (a new key restarts the puff)
        from.map(([x, y], i) => (
          <span key={`${shakes}-${i}`} className="care-puff" style={{ left: x, top: y }}>
            {[0, 1, 2, 3, 4].map((k) => (
              <span
                key={k}
                className="care-pollen care-pollen--puff"
                style={{
                  left: (k - 2) * dot * 1.2,
                  top: ((k * 7) % 5) * dot * 0.4 - dot,
                  width: dot,
                  height: dot,
                  animationDelay: `${k * 0.05}s`,
                }}
              />
            ))}
          </span>
        ))}
      <Target r={rects[0]} label="포기 흔들기" disabled={disabled} press={press} className="care-shake">
        <svg className="care-rub care-swing" viewBox="0 0 100 40" aria-hidden="true">
          <path d="M14 20h72M14 20l12-10M14 20l12 10M86 20l-12-10M86 20l-12 10" />
        </svg>
      </Target>
      <CareHint>
        포기를 좌우로 흔들어 꽃가루를 날려요 {Math.min(shakes, SHAKES)}/{SHAKES}
      </CareHint>
    </>
  )
}
