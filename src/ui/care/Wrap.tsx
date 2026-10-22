import { useRef, useState } from 'react'
import { propArt } from '../art'
import type { SceneLayout } from '../PlantView'
import { plink } from '../sound'
import { CareHint, Target, type CareProps, type Pt } from './parts'
import { usePress } from './press'
import { careGeo, hits, strawAt, wrapAt } from './targets'

/**
 * straw.webp: a bundle lying diagonally, its long axis from about (52, 416) to (453, 92), tied in the
 * middle (of 512): turned 39 degrees it lies flat, turned -51 it stands up.
 */
const STRAW = { len: 520, flat: 39, upright: -51 }

/** The straw as a picture centered on (x, y), long axis `len` px, turned `deg` past how it was drawn. */
function strawStyle(c: Pt, len: number, deg: number) {
  const s = len / STRAW.len
  return { left: c.x - 256 * s, top: c.y - 256 * s, width: 512 * s, height: 512 * s, transform: `rotate(${deg}deg)` }
}

/** The straw standing around the lower trunk, tied with two bands of string. */
export function StrawWrap({ L }: { L: SceneLayout }) {
  const g = careGeo(L)
  const w = wrapAt(g)
  const pic = propArt('straw')
  const mid = { x: w.x, y: g.ground - w.h / 2 }
  const band = Math.max(3, 4 * g.u)
  return (
    <>
      <img className="care-pic care-straw" src={pic.src} alt="" draggable={false} style={strawStyle(mid, w.h * 1.15, STRAW.upright)} />
      <svg className="care-svg" width="100%" height="100%" aria-hidden="true">
        {[0.3, 0.72].map((k) => (
          <ellipse
            key={k}
            className="care-band"
            cx={w.x}
            cy={g.ground - w.h * k}
            rx={w.w * 0.62}
            ry={Math.max(3, 5 * g.u)}
            strokeWidth={band}
          />
        ))}
      </svg>
    </>
  )
}

/** winterWrap (trees): drag the straw lying on the ground to the trunk (or tap the trunk) to wrap it. */
export function Wrap({ L, rects, disabled, sound, onDone, toScene }: CareProps) {
  const [trunkR, strawR] = rects
  const [wrapped, setWrapped] = useState(false)
  const [ghost, setGhost] = useState<Pt | null>(null)
  const finished = useRef(false)
  const wrap = () => {
    if (finished.current) return
    finished.current = true
    setWrapped(true)
    plink(sound)
    onDone()
  }
  const trunk = usePress({ disabled, onTap: wrap })
  const straw = usePress({
    disabled,
    onTap: wrap,
    onMove: (_step, at, dragging) => {
      if (dragging) setGhost(toScene(at))
    },
    onDrop: (at) => {
      const p = toScene(at)
      if (hits(trunkR, p.x, p.y)) wrap()
    },
    onEnd: () => setGhost(null),
  })
  const g = careGeo(L)
  const s = strawAt(g)
  const pic = propArt('straw')
  return (
    <>
      {wrapped && <StrawWrap L={L} />}
      {!wrapped && (
        <>
          <Target r={trunkR} label="짚 감쌀 밑동" disabled={disabled} press={trunk} className="care-slot" />
          {!ghost && (
            <img className="care-pic care-straw" src={pic.src} alt="" draggable={false} style={strawStyle(s, s.w, STRAW.flat)} />
          )}
          <Target r={strawR} label="짚" disabled={disabled} press={straw} mark={false} className="care-source" />
        </>
      )}
      {ghost && (
        <img className="care-pic care-straw care-ghost" src={pic.src} alt="" draggable={false} style={strawStyle(ghost, s.w * 0.8, STRAW.upright)} />
      )}
      <CareHint>{wrapped ? '짚으로 감쌌어요' : '짚을 끌어 나무 밑동을 감싸요'}</CareHint>
    </>
  )
}
