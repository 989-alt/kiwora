import { useRef, useState } from 'react'
import { propArt } from '../art'
import { pop } from '../sound'
import { CareHint, Target, type CareProps } from './parts'
import { usePress } from './press'
import { branchPoints } from './targets'

/** pinch: two side branches are marked on the plant; tap each to snip it with the shears. */
export function Pinch({ L, rects, pic, disabled, sound, onDone }: CareProps) {
  const [cut, setCut] = useState<boolean[]>([false, false])
  const now = useRef([false, false])
  const snip = (i: number) => {
    const n = now.current
    if (n[i] || n.every(Boolean)) return
    n[i] = true
    setCut([...n])
    pop(sound)
    if (n.every(Boolean)) onDone()
  }
  const p0 = usePress({ disabled, onTap: () => snip(0) })
  const p1 = usePress({ disabled, onTap: () => snip(1) })
  const presses = [p0, p1]
  const shears = propArt('shears')
  const pts = branchPoints(L, pic)
  const sz = Math.max(40, 56 * L.unit)
  const leaf = Math.max(16, 26 * L.unit)
  return (
    <>
      {pts.map(([x, y], i) =>
        cut[i] ? (
          // the snipped twig falls away
          <svg
            key={i}
            className="care-fall"
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{ left: x - leaf / 2, top: y - leaf / 2, width: leaf, height: leaf }}
          >
            <path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" fill="#4d9a3a" stroke="#2f6b25" strokeWidth="1.5" />
            <path d="M5 19 15 9" stroke="#2f6b25" strokeWidth="1.5" />
          </svg>
        ) : (
          <img
            key={i}
            className="care-pic care-shears"
            src={shears.src}
            alt=""
            draggable={false}
            // the shears point in at the branch from outside the plant
            style={{
              left: i === 0 ? x - sz * 1.05 : x + sz * 0.05,
              top: y - sz * 0.5,
              width: sz,
              height: sz,
              transform: `rotate(${i === 0 ? 60 : -60}deg)`,
            }}
          />
        ),
      )}
      {rects.map((r, i) => (cut[i] ? null : <Target key={i} r={r} label="곁가지 자르기" disabled={disabled} press={presses[i]} />))}
      <CareHint>곁가지를 톡 눌러 잘라요 {cut.filter(Boolean).length}/2</CareHint>
    </>
  )
}
